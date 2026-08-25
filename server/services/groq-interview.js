// Adaptive interview turn engine. Gathering as much specific, relevant,
// business-particular information as possible IS the job — not filling in a
// fixed set of fields. The structured fields below exist so the deterministic
// matching engine has something to filter on, but the model is explicitly
// told they are reference points, never a checklist. Eligibility and match
// scoring never happen here — matching-engine.js stays the sole,
// deterministic source of truth for those. This file only decides what to
// ask next and extracts structured answers, the same "extract, never
// invent" discipline as groq-extract.js.

import { REQUIRED_APPLICATION_FIELDS, DEEP_PROFILE_FIELDS, DEEP_PROFILE_FIELD_ORDER, normalizeState } from '../constants.js';
import { coerceNumber, coerceIndustry, coerceString, coerceSelect } from './field-coercion.js';
import { callGroqChat } from './groq-client.js';

const MODEL = 'openai/gpt-oss-120b';

export const HARD_TURN_CAP = 16;
const ALL_FIELD_KEYS = [...REQUIRED_APPLICATION_FIELDS, ...DEEP_PROFILE_FIELD_ORDER];
const MAX_NOTES_PER_TURN = 5;

function fieldSchemaDescription() {
  const core = REQUIRED_APPLICATION_FIELDS.map((k) => `  "${k}": required core field`).join('\n');
  const deep = DEEP_PROFILE_FIELD_ORDER.map((k) => {
    const meta = DEEP_PROFILE_FIELDS[k];
    const type = meta.type === 'select' ? `one of [${meta.options.map((o) => `"${o}"`).join(', ')}]` : meta.type;
    return `  "${k}": ${type}${meta.optional ? ' (optional — never required, never lowers readiness if left null)' : ''}`;
  }).join('\n');
  return (
    `Core fields (already covered by earlier extraction if the user's opening description mentioned them):\n${core}\n\n` +
    'Structured reference fields — fill these in via updatedFields ONLY when they come up naturally as part of ' +
    `a genuinely relevant question. They are reference points you may capture along the way, NEVER a checklist ` +
    `to work through for its own sake:\n${deep}`
  );
}

function buildSystemPrompt() {
  return (
    'You are conducting a funding-readiness interview for a small business owner. GATHERING AS MUCH SPECIFIC, ' +
    'RELEVANT, USEFUL INFORMATION AS POSSIBLE ABOUT THIS PARTICULAR BUSINESS IS YOUR PRIMARY JOB — more ' +
    'important than quickly reaching any fixed set of fields. Think like an experienced loan officer running a ' +
    'real underwriting interview, not a form to fill out. Start broad, then go specific based on what THIS ' +
    'business and owner actually tell you. Every business is different, so the substance of what you ask must ' +
    'genuinely differ by industry and situation — a seasonal ice cream shop, a B2B software consultancy, a ' +
    'construction contractor, and a home daycare have almost nothing in common in what a real lender would need ' +
    'to know about them. Do not default to the same generic financial checklist for every applicant. Dig into ' +
    'whatever is actually distinctive and material to THIS business: industry-specific licensing or permits, ' +
    'seasonality, supply chain or inventory needs, collateral, a detailed and specific use of the requested ' +
    'funds (not just a one-line purpose), competitive position, growth plans, staffing, insurance or bonding, ' +
    'or anything else a careful underwriter would probe for a business exactly like this one. Never ask about ' +
    'something already answered. Ask about ownership demographics (if at all) only once, near the end, and ' +
    'always frame it as strictly optional. Only set fileHint when a specific document would meaningfully ' +
    "strengthen THIS question's answer. Declare done:true only once you have a genuinely rich, specific, " +
    'non-generic picture of this business — not merely once the structured fields happen to be filled in; a ' +
    'thorough interview usually takes a meaningful number of turns. You never decide eligibility or lender ' +
    'matches — only gather and record information. Never invent a value the user did not state or clearly ' +
    'imply.\n\n' +
    `${fieldSchemaDescription()}\n\n` +
    'Respond with ONLY a single valid JSON object, no markdown, no commentary:\n' +
    '{\n' +
    '  "reasoning": "one or two sentences on why this is the most valuable next question for THIS specific business, or why the profile is now sufficient",\n' +
    '  "done": boolean,\n' +
    '  "nextQuestion": "string, or null if done",\n' +
    '  "questionType": "text" | "select",\n' +
    '  "options": ["..."] or null (only for questionType select),\n' +
    '  "fileHint": "string or null",\n' +
    '  "targetField": "one of the structured field keys above this question is chiefly trying to fill, or null if this is an open-ended/situational question",\n' +
    '  "updatedFields": { any structured field keys above you can now confidently fill in, or {} },\n' +
    '  "newNotes": [ { "topic": "short label for what this is about", "detail": "the specific, useful fact learned" } ] — any new situational or industry-specific facts learned this turn that do not fit the structured fields, or [] if none\n' +
    '}\n\n' +
    'updatedFields should include EVERY structured field you can confidently determine from the full ' +
    'conversation so far, not just ones mentioned in the latest message. newNotes should only include facts ' +
    'not already captured in an earlier note or structured field — this is where most of what makes this ' +
    'business unique should end up.'
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

// Free-form facts that don't fit the fixed schema — this is deliberately
// unbounded in shape (any topic string) since the whole point is to capture
// whatever is actually specific to this business, not force it into a
// pre-defined slot. Still defensively validated: must be a real {topic,
// detail} pair of non-empty strings, capped so one turn can't flood the
// profile.
function coerceNotes(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((n) => ({ topic: coerceString(n?.topic), detail: coerceString(n?.detail) }))
    .filter((n) => n.topic && n.detail)
    .slice(0, MAX_NOTES_PER_TURN);
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
    newNotes: coerceNotes(raw?.newNotes),
  };
}

function buildUserContent(currentFields, currentNotes, attachmentTexts, stuckField) {
  const parts = [
    `Current known profile (JSON): ${JSON.stringify(currentFields)}`,
    `Specific facts already gathered about this business (JSON): ${JSON.stringify(currentNotes)}`,
  ];
  if (attachmentTexts?.length) {
    parts.push(
      ...attachmentTexts.map((t, i) => `Content extracted from an uploaded document #${i + 1}:\n${t.slice(0, 4000)}`)
    );
  }
  if (stuckField) {
    parts.push(
      `IMPORTANT: your last two questions both targeted "${stuckField}" and it still isn't resolved. Do NOT ask ` +
        'about it again this turn, in any phrasing — move to a genuinely different topic instead. It can be ' +
        'revisited later if it turns out to matter.'
    );
  }
  return parts.join('\n\n');
}

// history: [{ role: 'user'|'assistant', content: string }] in chronological order.
// Returns { ok: true, ...turn } on success, or { ok: false } when there's no
// key or the call failed — callers should fall back to the deterministic
// fixed-question path rather than surface an error.
export async function runInterviewTurn({ history, currentFields, currentNotes, attachmentTexts, turnCount, stuckField }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { ok: false };

  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: buildUserContent(currentFields, currentNotes || [], attachmentTexts, stuckField) },
  ];

  const result = await callGroqChat({
    apiKey,
    model: MODEL,
    messages,
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  if (!result.ok) {
    console.error(`Groq interview call failed (${result.status ?? 'network error'}): ${result.error}`);
    return { ok: false };
  }

  try {
    const raw = JSON.parse(result.data.choices?.[0]?.message?.content ?? '{}');
    return { ok: true, ...coerceTurnResponse(raw, turnCount) };
  } catch (err) {
    console.error('Groq interview response was not valid JSON:', err.message);
    return { ok: false };
  }
}
