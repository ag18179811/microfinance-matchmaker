import { Router } from 'express';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import db from '../db/connection.js';
import { extractApplicationFields } from '../services/groq-extract.js';
import { runInterviewTurn, HARD_TURN_CAP } from '../services/groq-interview.js';
import { nextFallbackTurn, coerceFallbackAnswer } from '../services/interview-fallback.js';
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

function loadHistory(conversationId) {
  return db
    .prepare('SELECT role, content, field_key, field_key_source FROM conversation_messages WHERE conversation_id = ? ORDER BY id ASC')
    .all(conversationId);
}

function loadAttachmentTexts(conversationId) {
  const rows = db
    .prepare('SELECT extracted_text FROM conversation_attachments WHERE conversation_id = ? AND extracted_text IS NOT NULL ORDER BY id ASC')
    .all(conversationId);
  return rows.map((r) => r.extracted_text);
}

function saveMessage(conversationId, role, content, { reasoning = null, fieldKey = null, fieldKeySource = null } = {}) {
  db.prepare(
    `INSERT INTO conversation_messages (conversation_id, role, content, reasoning, field_key, field_key_source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(conversationId, role, content, reasoning, fieldKey, fieldKeySource, new Date().toISOString());
}

function persistConversationState(conversationId, fields, turnCount, done) {
  db.prepare('UPDATE conversations SET fields = ?, turn_count = ?, status = ? WHERE id = ?').run(
    JSON.stringify(fields),
    turnCount,
    done ? 'complete' : 'in_progress',
    conversationId
  );
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

// Runs one interview turn: tries the LLM, falls back to the deterministic
// field walk if GROQ_API_KEY is unset or the call fails. Persists the
// resulting fields/turn_count/status and, if not done, the assistant's
// question — tagged with which field it's chiefly about and where that
// question came from, so the next reply knows how strictly to validate.
async function advanceTurn(conversationId, historyForModel, fields, turnCount) {
  const attachmentTexts = loadAttachmentTexts(conversationId);
  const llmTurn = await runInterviewTurn({ history: historyForModel, currentFields: fields, attachmentTexts, turnCount: turnCount + 1 });

  let turn;
  let fieldKey = null;
  let fieldKeySource = null;
  if (llmTurn.ok) {
    turn = llmTurn;
    fields = { ...fields, ...turn.updatedFields };
    fieldKey = turn.targetField;
    fieldKeySource = fieldKey ? 'llm' : null;
  } else {
    const fb = nextFallbackTurn(fields);
    turn = { done: fb.done, reasoning: null, nextQuestion: fb.nextQuestion, questionType: fb.questionType, options: fb.options, fileHint: null };
    fieldKey = fb.fieldKey;
    fieldKeySource = fieldKey ? 'fallback' : null;
  }

  const newTurnCount = turnCount + 1;
  persistConversationState(conversationId, fields, newTurnCount, turn.done);
  if (!turn.done) saveMessage(conversationId, 'assistant', turn.nextQuestion, { reasoning: turn.reasoning, fieldKey, fieldKeySource });

  return { turn, fields, turnCount: newTurnCount };
}

router.post('/start', async (req, res) => {
  const description = String(req.body?.description ?? '').trim();
  if (!description) return res.status(400).json({ error: 'description is required' });

  const extracted = await extractApplicationFields(description);
  const { purpose, ...coreFields } = extracted;
  const seededFields = { ...coreFields, use_of_funds_detail: purpose || null };

  const info = db
    .prepare(`INSERT INTO conversations (status, fields, turn_count, created_at) VALUES ('in_progress', '{}', 0, ?)`)
    .run(new Date().toISOString());
  const conversationId = info.lastInsertRowid;
  saveMessage(conversationId, 'user', description);

  const { turn, fields } = await advanceTurn(conversationId, [{ role: 'user', content: description }], seededFields, 0);

  if (turn.done) return res.json({ conversationId, done: true, fields });
  res.json({ conversationId, done: false, message: toClientMessage(turn) });
});

router.post('/:id/reply', async (req, res) => {
  const conversationId = Number(req.params.id);
  const text = String(req.body?.text ?? '').trim();
  if (!text) return res.status(400).json({ error: 'text is required' });

  const convo = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });
  if (convo.status === 'complete') return res.status(400).json({ error: 'This interview is already complete' });

  let fields = JSON.parse(convo.fields || '{}');
  const fullHistory = loadHistory(conversationId);
  const lastAssistant = [...fullHistory].reverse().find((m) => m.role === 'assistant');

  // The previous question came from the deterministic fallback path (no LLM
  // available) — there's no model to interpret nuance, so the reply must
  // coerce cleanly against that exact field or we ask again. This retry still
  // counts as a turn and respects the same hard cap as the LLM path, so a
  // string of unparseable answers can't loop forever.
  if (lastAssistant?.field_key_source === 'fallback') {
    const { ok, value } = coerceFallbackAnswer(lastAssistant.field_key, text);
    if (!ok) {
      saveMessage(conversationId, 'user', text);
      const newTurnCount = convo.turn_count + 1;
      if (newTurnCount >= HARD_TURN_CAP) {
        persistConversationState(conversationId, fields, newTurnCount, true);
        return res.json({ conversationId, done: true, fields });
      }
      const retry = nextFallbackTurn(fields); // fields unchanged -> same field again
      persistConversationState(conversationId, fields, newTurnCount, false);
      saveMessage(conversationId, 'assistant', retry.nextQuestion, { fieldKey: retry.fieldKey, fieldKeySource: 'fallback' });
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

  saveMessage(conversationId, 'user', text);
  const historyForModel = loadHistory(conversationId).map((m) => ({ role: m.role, content: m.content }));
  const { turn, fields: fieldsAfterTurn, turnCount } = await advanceTurn(conversationId, historyForModel, fields, convo.turn_count);

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
      persistConversationState(conversationId, finalFields, turnCount, turn.done);
    }
  }

  if (turn.done) return res.json({ conversationId, done: true, fields: finalFields });
  res.json({ conversationId, done: false, message: toClientMessage(turn) });
});

router.post('/:id/attachments', handleUpload, async (req, res) => {
  const conversationId = Number(req.params.id);
  const convo = db.prepare('SELECT id FROM conversations WHERE id = ?').get(conversationId);
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

  db.prepare(
    `INSERT INTO conversation_attachments (conversation_id, filename, mime_type, extracted_text, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(conversationId, originalname, mimetype, extractedText, new Date().toISOString());

  res.status(201).json({ filename: originalname, textExtracted: extractedText !== null });
});

export default router;
