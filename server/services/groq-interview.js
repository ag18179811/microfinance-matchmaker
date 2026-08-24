// Adaptive interview turn engine. On every turn this asks the model to pick
// the single most valuable next question given everything gathered so far
// (or declare the profile sufficient), and to say briefly why. Eligibility
// and match scoring never happen here — matching-engine.js stays the sole,
// deterministic source of truth for those. This file only decides what to
// ask next and extracts structured answers, the same "extract, never
// invent" discipline as groq-extract.js.

import { REQUIRED_APPLICATION_FIELDS, DEEP_PROFILE_FIELDS, DEEP_PROFILE_FIELD_ORDER, normalizeState } from '../constants.js';
import { coerceNumber, coerceIndustry, coerceString, coerceSelect } from './field-coercion.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-120b';

export const HARD_TURN_CAP = 14;
const ALL_FIELD_KEYS = [...REQUIRED_APPLICATION_FIELDS, ...DEEP_PROFILE_FIELD_ORDER];

function fieldSchemaDescription() {
  const core = REQUIRED_APPLICATION_FIELDS.map((k) => `  "${k}": required core field`).join('\n');
  const deep = DEEP_PROFILE_FIELD_ORDER.map((k) => {
    const meta = DEEP_PROFILE_FIELDS[k];
    const type = meta.type === 'select' ? `one of [${meta.options.map((o) => `"${o}"`).join(', ')}]` : meta.type;
    return `  "${k}": ${type}${meta.optional ? ' (optional — never required, never lowers readiness if left null)' : ''}`;
  }).join('\n');
  return `Core fields (already covered by earlier extraction if the user's opening description mentioned them):\n${core}\n\nDeeper profile fields you are responsible for filling in through conversation:\n${deep}`;
}

function buildSystemPrompt() {
  return (
    'You are conducting a funding-readiness interview for a small business owner applying to CDFI ' +
    'and city microloan programs. Your job each turn is to pick the SINGLE most valuable next question ' +
    "given everything already known — start broad, then go specific based on what the user has told you. " +
    'Never ask about something already answered. Ask about ownership demographics (if at all) only once, ' +
    'near the end, and always frame it as strictly optional. Only set fileHint when a specific document ' +
    "(e.g. a recent P&L, bank statement, or tax return) would meaningfully strengthen THIS question's answer " +
    "— most turns should leave it null. Declare done:true once the profile is genuinely sufficient for a " +
    'defensible readiness grade (this usually takes a meaningful number of turns, not just 2-3), or once ' +
    "nothing further would materially change the analysis. You never decide eligibility or lender matches — " +
    'only gather and extract information. Never invent a value the user did not state or clearly imply.\n\n' +
    `${fieldSchemaDescription()}\n\n` +
    'Respond with ONLY a single valid JSON object, no markdown, no commentary:\n' +
    '{\n' +
    '  "reasoning": "one or two sentences on why this is the most valuable next question, or why the profile is now sufficient",\n' +
    '  "done": boolean,\n' +
    '  "nextQuestion": "string, or null if done",\n' +
    '  "questionType": "text" | "select",\n' +
    '  "options": ["..."] or null (only for questionType select),\n' +
    '  "fileHint": "string or null",\n' +
    '  "targetField": "the single field key above that nextQuestion is chiefly trying to fill, or null if done/not applicable",\n' +
    '  "updatedFields": { any of the field keys above you can now confidently fill in from the conversation, or {} }\n' +
    '}\n\n' +
    'updatedFields should include EVERY field you can confidently determine from the full conversation so far, ' +
    'not just ones mentioned in the latest message — re-include fields you already filled in on earlier turns too.'
  );
}

// Never trust the model's structured output blindly — same discipline as
// groq-extract.js. Anything malformed or referencing an unknown field is
// silently dropped rather than propagated.
function coerceUpdatedFields(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const key of ALL_FIELD_KEYS) {
    if (!(key in raw)) continue;
    const value = raw[key];
    if (key === 'industry') out[key] = coerceIndustry(value);
    else if (key === 'state') out[key] = normalizeState(value);
    else if (key in DEEP_PROFILE_FIELDS && DEEP_PROFILE_FIELDS[key].type === 'select') {
      out[key] = coerceSelect(value, DEEP_PROFILE_FIELDS[key].options);
    } else if (
      key === 'time_in_business_months' ||
      key === 'annual_revenue' ||
      key === 'requested_amount' ||
      key === 'existing_monthly_debt_payment' ||
      key === 'employee_count'
    ) {
      out[key] = coerceNumber(value);
    } else {
      out[key] = coerceString(value);
    }
    if (out[key] === null) delete out[key];
  }
  return out;
}

function coerceTurnResponse(raw, turnCount) {
  const forceDone = turnCount >= HARD_TURN_CAP;
  const done = forceDone || raw?.done === true;
  const questionType = raw?.questionType === 'select' ? 'select' : 'text';
  const options =
    questionType === 'select' && Array.isArray(raw?.options)
      ? raw.options.map((o) => coerceString(o)).filter(Boolean).slice(0, 12)
      : null;

  const targetField = ALL_FIELD_KEYS.includes(raw?.targetField) ? raw.targetField : null;

  return {
    reasoning: coerceString(raw?.reasoning)?.slice(0, 600) || (done ? "That's enough to grade this profile." : "Let's dig a bit deeper."),
    done,
    nextQuestion: done ? null : coerceString(raw?.nextQuestion) || 'Is there anything else about your business worth mentioning?',
    questionType,
    options: options?.length ? options : null,
    fileHint: coerceString(raw?.fileHint),
    targetField: done ? null : targetField,
    updatedFields: coerceUpdatedFields(raw?.updatedFields),
  };
}

function buildUserContent(currentFields, attachmentTexts) {
  const parts = [`Current known profile (JSON): ${JSON.stringify(currentFields)}`];
  if (attachmentTexts?.length) {
    parts.push(
      ...attachmentTexts.map((t, i) => `Content extracted from an uploaded document #${i + 1}:\n${t.slice(0, 4000)}`)
    );
  }
  return parts.join('\n\n');
}

// history: [{ role: 'user'|'assistant', content: string }] in chronological order.
// Returns { ok: true, ...turn } on success, or { ok: false } when there's no
// key or the call failed — callers should fall back to the deterministic
// fixed-question path rather than surface an error.
export async function runInterviewTurn({ history, currentFields, attachmentTexts, turnCount }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { ok: false };

  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: buildUserContent(currentFields, attachmentTexts) },
  ];

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Groq interview error (${response.status}): ${errorText}`);
      return { ok: false };
    }

    const data = await response.json();
    const raw = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
    return { ok: true, ...coerceTurnResponse(raw, turnCount) };
  } catch (err) {
    console.error('Groq interview request failed:', err.message);
    return { ok: false };
  }
}
