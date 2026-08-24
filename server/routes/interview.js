import { Router } from 'express';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import pool from '../db/connection.js';
import { extractApplicationFields } from '../services/groq-extract.js';
import { runInterviewTurn, HARD_TURN_CAP } from '../services/groq-interview.js';
import { nextFallbackTurn, coerceFallbackAnswer } from '../services/interview-fallback.js';
import { generateFollowUpReply } from '../services/groq-followup.js';
import { loadResults, loadSubScores } from './match.js';
import { DEEP_PROFILE_FIELDS } from '../constants.js';

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);

function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    next();
  });
}

// Every conversation lookup here is scoped to req.userId (set by
// requireAuth) — a conversation id alone is never enough to read or reply
// to it. That used to be a real gap: any id was previously readable/writable
// by anyone.
async function loadOwnedConversation(conversationId, userId) {
  const { rows } = await pool.query('SELECT * FROM conversations WHERE id = $1 AND user_id = $2', [conversationId, userId]);
  return rows[0] || null;
}

async function loadHistory(conversationId) {
  const { rows } = await pool.query(
    'SELECT role, content, field_key, field_key_source FROM conversation_messages WHERE conversation_id = $1 ORDER BY id ASC',
    [conversationId]
  );
  return rows;
}

async function loadAttachmentTexts(conversationId) {
  const { rows } = await pool.query(
    'SELECT extracted_text FROM conversation_attachments WHERE conversation_id = $1 AND extracted_text IS NOT NULL ORDER BY id ASC',
    [conversationId]
  );
  return rows.map((r) => r.extracted_text);
}

async function saveMessage(conversationId, role, content, { reasoning = null, fieldKey = null, fieldKeySource = null } = {}) {
  await pool.query(
    `INSERT INTO conversation_messages (conversation_id, role, content, reasoning, field_key, field_key_source)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [conversationId, role, content, reasoning, fieldKey, fieldKeySource]
  );
}

async function persistConversationState(conversationId, fields, notes, turnCount, done) {
  await pool.query('UPDATE conversations SET fields = $1, notes = $2, turn_count = $3, status = $4 WHERE id = $5', [
    JSON.stringify(fields),
    JSON.stringify(notes),
    turnCount,
    done ? 'complete' : 'in_progress',
    conversationId,
  ]);
}

function toClientMessage(turn) {
  return {
    text: turn.nextQuestion,
    reasoning: turn.reasoning ?? null,
    questionType: turn.questionType,
    options: turn.options,
    fileHint: turn.fileHint ?? null,
  };
}

function isBlank(value) {
  return value === null || value === undefined || value === '';
}

// If the model's last two LLM-sourced questions both targeted the same
// structured field and it's still unresolved, flag it so the next call is
// explicitly told to move on. Found via live testing: without this, the
// model can fixate — re-asking a near-identical question 3+ times in a row
// when an answer doesn't satisfy it, instead of pivoting to a different
// topic the way a real interviewer would.
function computeStuckField(fullHistoryRows) {
  const llmAssistantTurns = fullHistoryRows.filter((m) => m.role === 'assistant' && m.field_key_source === 'llm' && m.field_key);
  if (llmAssistantTurns.length < 2) return null;
  const last = llmAssistantTurns[llmAssistantTurns.length - 1];
  const secondLast = llmAssistantTurns[llmAssistantTurns.length - 2];
  return last.field_key === secondLast.field_key ? last.field_key : null;
}

// Runs one interview turn: tries the LLM, falls back to the deterministic
// field walk if GROQ_API_KEY is unset or the call fails. Persists the
// resulting fields/notes/turn_count/status and, if not done, the
// assistant's question — tagged with which field it's chiefly about and
// where that question came from, so the next reply knows how strictly to
// validate. `notes` is the free-form, business-specific facts list — this
// is where most of what makes a given interview genuinely different from
// the next one lives, as opposed to the fixed `fields` schema.
async function advanceTurn(conversationId, fullHistoryRows, fields, notes, turnCount) {
  const attachmentTexts = await loadAttachmentTexts(conversationId);
  const historyForModel = fullHistoryRows.map((m) => ({ role: m.role, content: m.content }));
  const llmTurn = await runInterviewTurn({
    history: historyForModel,
    currentFields: fields,
    currentNotes: notes,
    attachmentTexts,
    turnCount: turnCount + 1,
    stuckField: computeStuckField(fullHistoryRows),
  });

  let turn;
  let fieldKey = null;
  let fieldKeySource = null;
  if (llmTurn.ok) {
    turn = llmTurn;
    fields = { ...fields, ...turn.updatedFields };
    notes = [...notes, ...turn.newNotes];
    fieldKey = turn.targetField;
    fieldKeySource = fieldKey ? 'llm' : null;
  } else {
    const fb = nextFallbackTurn(fields);
    turn = { done: fb.done, reasoning: null, nextQuestion: fb.nextQuestion, questionType: fb.questionType, options: fb.options, fileHint: null };
    fieldKey = fb.fieldKey;
    fieldKeySource = fieldKey ? 'fallback' : null;
  }

  const newTurnCount = turnCount + 1;
  await persistConversationState(conversationId, fields, notes, newTurnCount, turn.done);
  if (!turn.done) await saveMessage(conversationId, 'assistant', turn.nextQuestion, { reasoning: turn.reasoning, fieldKey, fieldKeySource });

  return { turn, fields, notes, turnCount: newTurnCount };
}

// Once a conversation is complete, further replies don't re-run the
// structured interview — they're grounded Q&A about the stored profile and
// match results. Response shape is deliberately different (mode: 'followup')
// so the client never mistakes this for another structured turn.
async function handleFollowUp(req, res, convo) {
  const text = String(req.body?.text ?? '').trim();
  if (!text) return res.status(400).json({ error: 'text is required' });

  if (!convo.application_id) {
    return res.status(409).json({ error: 'Still finishing your analysis — try again in a moment.' });
  }

  const { rows: appRows } = await pool.query('SELECT * FROM applications WHERE id = $1 AND user_id = $2', [
    convo.application_id,
    req.userId,
  ]);
  const application = appRows[0];
  if (!application) return res.status(409).json({ error: 'Could not find your results for this conversation.' });

  const [matches, subScores] = await Promise.all([loadResults(application.id), loadSubScores(application.id)]);
  const readinessScore = matches[0]?.readiness_score ?? null;

  await saveMessage(convo.id, 'user', text);
  const history = (await loadHistory(convo.id)).map((m) => ({ role: m.role, content: m.content }));
  const reply = await generateFollowUpReply({ application, subScores, readinessScore, matches, history });
  await saveMessage(convo.id, 'assistant', reply);

  res.json({ conversationId: convo.id, mode: 'followup', reply });
}

router.post('/start', async (req, res) => {
  const description = String(req.body?.description ?? '').trim();
  if (!description) return res.status(400).json({ error: 'description is required' });

  const extracted = await extractApplicationFields(description);
  const { purpose, ...coreFields } = extracted;
  const seededFields = { ...coreFields, use_of_funds_detail: purpose || null };

  const { rows } = await pool.query(
    `INSERT INTO conversations (user_id, status, fields, notes, turn_count) VALUES ($1, 'in_progress', '{}', '[]', 0) RETURNING id`,
    [req.userId]
  );
  const conversationId = rows[0].id;
  await saveMessage(conversationId, 'user', description);

  const { turn, fields, notes } = await advanceTurn(conversationId, [{ role: 'user', content: description }], seededFields, [], 0);

  if (turn.done) return res.json({ conversationId, done: true, fields, notes });
  res.json({ conversationId, done: false, message: toClientMessage(turn) });
});

router.post('/:id/reply', async (req, res) => {
  const convo = await loadOwnedConversation(req.params.id, req.userId);
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });
  if (convo.status === 'complete') return handleFollowUp(req, res, convo);

  const conversationId = convo.id;
  const text = String(req.body?.text ?? '').trim();
  if (!text) return res.status(400).json({ error: 'text is required' });

  let fields = JSON.parse(convo.fields || '{}');
  const notes = JSON.parse(convo.notes || '[]');
  const fullHistory = await loadHistory(conversationId);
  const lastAssistant = [...fullHistory].reverse().find((m) => m.role === 'assistant');

  // The previous question came from the deterministic fallback path (no LLM
  // available) — there's no model to interpret nuance, so the reply must
  // coerce cleanly against that exact field or we ask again. This retry still
  // counts as a turn and respects the same hard cap as the LLM path, so a
  // string of unparseable answers can't loop forever.
  if (lastAssistant?.field_key_source === 'fallback') {
    const { ok, value } = coerceFallbackAnswer(lastAssistant.field_key, text);
    if (!ok) {
      await saveMessage(conversationId, 'user', text);
      const newTurnCount = convo.turn_count + 1;
      if (newTurnCount >= HARD_TURN_CAP) {
        await persistConversationState(conversationId, fields, notes, newTurnCount, true);
        return res.json({ conversationId, done: true, fields, notes });
      }
      const retry = nextFallbackTurn(fields); // fields unchanged -> same field again
      await persistConversationState(conversationId, fields, notes, newTurnCount, false);
      await saveMessage(conversationId, 'assistant', retry.nextQuestion, { fieldKey: retry.fieldKey, fieldKeySource: 'fallback' });
      return res.json({
        conversationId,
        done: false,
        message: toClientMessage({
          reasoning: "Sorry, I couldn't quite parse that.",
          nextQuestion: retry.nextQuestion,
          questionType: retry.questionType,
          options: retry.options,
          fileHint: null,
        }),
      });
    }
    fields[lastAssistant.field_key] = value;
  }

  await saveMessage(conversationId, 'user', text);
  const updatedHistory = await loadHistory(conversationId);
  const {
    turn,
    fields: fieldsAfterTurn,
    notes: notesAfterTurn,
    turnCount,
  } = await advanceTurn(conversationId, updatedHistory, fields, notes, convo.turn_count);

  // Safety net: the model is usually able to fold a reply into updatedFields
  // even for open-ended questions, but it can occasionally miss re-reporting
  // one. If the field its own previous question targeted is still blank,
  // make a best-effort deterministic attempt to capture it from the raw
  // reply. Restricted to select-type fields on purpose: a false match there
  // requires the reply to exactly equal one of a handful of known enum
  // strings, which is safe. For number/text fields a stray reply that isn't
  // actually answering the question (the user talking about something else
  // entirely) can coincidentally "parse" — e.g. "3 employees" silently
  // becoming a $3 debt payment — so those are left to the model alone rather
  // than risk writing a wrong number into the profile.
  let finalFields = fieldsAfterTurn;
  const targetKey = lastAssistant?.field_key;
  const targetIsSelect = targetKey && (DEEP_PROFILE_FIELDS[targetKey]?.type === 'select' || targetKey === 'industry' || targetKey === 'state');
  if (lastAssistant?.field_key_source === 'llm' && targetIsSelect && isBlank(finalFields[targetKey])) {
    const safetyNet = coerceFallbackAnswer(targetKey, text);
    if (safetyNet.ok) {
      finalFields = { ...finalFields, [targetKey]: safetyNet.value };
      await persistConversationState(conversationId, finalFields, notesAfterTurn, turnCount, turn.done);
    }
  }

  if (turn.done) return res.json({ conversationId, done: true, fields: finalFields, notes: notesAfterTurn });
  res.json({ conversationId, done: false, message: toClientMessage(turn) });
});

router.post('/:id/attachments', handleUpload, async (req, res) => {
  const convo = await loadOwnedConversation(req.params.id, req.userId);
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });
  if (!req.file) return res.status(400).json({ error: 'file is required' });

  const { originalname, mimetype, buffer } = req.file;
  if (!ALLOWED_MIME_TYPES.has(mimetype)) {
    return res.status(400).json({ error: 'Only PDF, PNG, or JPEG files are supported' });
  }

  let extractedText = null;
  if (mimetype === 'application/pdf') {
    let parser;
    try {
      parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      const text = (result.text || '').trim();
      if (text.length > 20) extractedText = text.slice(0, 20000);
    } catch (err) {
      console.error('PDF text extraction failed:', err.message);
    } finally {
      await parser?.destroy();
    }
  }

  await pool.query(
    `INSERT INTO conversation_attachments (conversation_id, filename, mime_type, extracted_text)
     VALUES ($1, $2, $3, $4)`,
    [convo.id, originalname, mimetype, extractedText]
  );

  res.status(201).json({ filename: originalname, textExtracted: extractedText !== null });
});

export default router;
