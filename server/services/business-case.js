// The Living Business Case: one evolving, first-person funding narrative,
// drafted from the interview and then refined ONLY by conversation — the
// owner never faces a form or a blank field. This is the piece that carries
// a business's specific, real story forward to the people who will actually
// read it.
//
// Discipline, same as groq-extract.js / groq-interview.js:
//   - First person, in the OWNER'S voice. Never the app's voice.
//   - Only what the owner actually said or clearly implied. Never invent a
//     number, a date, a customer, or a plan.
//   - Every extrapolation is surfaced as an assumption the owner can
//     correct. "Inferred" content is labelled, not hidden.
//   - Honest about weak spots. A thin file gets its true story told well,
//     never papered over.
// Eligibility and scoring never happen here — matching-engine.js stays the
// only source of truth for those.

import { callGroqChat } from './groq-client.js';
import { coerceString } from './field-coercion.js';

const MODEL = 'openai/gpt-oss-120b';

// Fixed section skeleton so the UI stays stable — but each body is prose in
// the owner's voice, not a filled-in form field.
export const SECTION_ORDER = ['who', 'business', 'traction', 'situation', 'ask', 'repayment', 'risks'];

const SECTION_HEADINGS = {
  who: 'Who I am and how I got here',
  business: 'What my business does and how it makes money',
  traction: 'Where the business is right now',
  situation: 'The opportunity in front of me',
  ask: 'What I need, and exactly what it pays for',
  repayment: 'How I plan to pay it back',
  risks: "What could go wrong — and how I've thought about it",
};

const CONFIDENCE = new Set(['stated', 'inferred', 'thin']);

function buildDraftSystemPrompt() {
  return (
    'You help a small business owner tell the story of their business and their funding need, in their own ' +
    'voice, so lenders and loan reviewers understand who they really are. You are writing a FIRST-PERSON ' +
    'narrative ("I", "we", "my business") as if the owner wrote it — natural, specific, and honest, never ' +
    'corporate boilerplate.\n\n' +
    'ABSOLUTE RULES:\n' +
    '- Use ONLY what the owner actually told you (their interview answers and the specific facts gathered). ' +
    'Never invent a number, a date, a customer name, a projection, or a plan they did not state.\n' +
    "- Where you extrapolate or fill a gap with a reasonable guess, keep the sentence but mark that section's " +
    'confidence as "inferred" AND add a specific item to "assumptions" phrased as a direct question to the owner.\n' +
    '- Where you simply do not have enough to write a section honestly, set its confidence to "thin" and write ' +
    'the body as a short, friendly prompt describing exactly what is still needed (not filler prose).\n' +
    '- The "risks" section must be honest and constructive: name the real weak spots in this specific file ' +
    '(short operating history, thin margins, seasonality, a credit issue the owner mentioned) and, in the ' +
    "owner's voice, the true and reasonable way they think about each one. Never fabricate a mitigation.\n" +
    '- Keep each section to 2-5 sentences. Plain language. No jargon the owner did not use themselves.\n\n' +
    'You are given the seven sections to fill. Respond with ONLY a valid JSON object, no markdown:\n' +
    '{\n' +
    '  "sections": [\n' +
    '    { "key": "who|business|traction|situation|ask|repayment|risks", "body": "first-person prose", ' +
    '"confidence": "stated|inferred|thin" }\n' +
    '  ],  // exactly the seven keys, in that order\n' +
    '  "assumptions": [ { "text": "A direct yes/no or fill-in question about something you guessed" } ]  // 0-6 items\n' +
    '}'
  );
}

function buildReviseSystemPrompt() {
  return (
    'You are maintaining a small business owner\'s first-person funding narrative. The owner just told you ' +
    'something in plain conversation — a correction, an addition, or an answer to one of your open ' +
    'assumptions. Update the narrative to match.\n\n' +
    'ABSOLUTE RULES:\n' +
    "- Keep it first-person and in the owner's voice. Change only what their message actually affects — " +
    'leave every other section byte-for-byte identical.\n' +
    '- Use only what the owner has now told you across the whole conversation. Never invent specifics.\n' +
    '- If their message resolves an open assumption, remove that assumption. If their correction reveals a ' +
    'NEW gap or guess, add a new assumption.\n' +
    '- If a section you update is now fully grounded in what they said, set its confidence to "stated". If it ' +
    'is still partly a guess, keep it "inferred".\n' +
    '- Be warm and brief in "reply" — acknowledge what changed, like a person would. One or two sentences.\n\n' +
    'Respond with ONLY a valid JSON object, no markdown:\n' +
    '{\n' +
    '  "sections": [ { "key": "...", "body": "...", "confidence": "stated|inferred|thin" } ],  // all seven, in order\n' +
    '  "assumptions": [ { "text": "..." } ],\n' +
    '  "reply": "short, warm, conversational acknowledgement of what you changed",\n' +
    '  "changeSummary": "terse third-person note for the change log, e.g. \'Corrected equipment cost to $12k; added landlord concession\'"\n' +
    '}'
  );
}

function ownerContext(application, additionalNotes) {
  return JSON.stringify({
    interviewAnswers: { ...application, additional_notes: undefined, user_id: undefined },
    specificFactsGathered: additionalNotes || [],
  });
}

function coerceSections(raw) {
  const byKey = new Map();
  if (Array.isArray(raw)) {
    for (const s of raw) {
      const key = coerceString(s?.key);
      if (key && SECTION_ORDER.includes(key) && !byKey.has(key)) {
        byKey.set(key, {
          key,
          heading: SECTION_HEADINGS[key],
          body: coerceString(s?.body) || '',
          confidence: CONFIDENCE.has(s?.confidence) ? s.confidence : 'inferred',
        });
      }
    }
  }
  // Guarantee all seven exist, in order — a missing one becomes a "thin" prompt.
  return SECTION_ORDER.map(
    (key) =>
      byKey.get(key) || {
        key,
        heading: SECTION_HEADINGS[key],
        body: 'Tell me a bit about this and I’ll write it up.',
        confidence: 'thin',
      }
  );
}

let assumptionCounter = 0;
function coerceAssumptions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a) => coerceString(typeof a === 'string' ? a : a?.text))
    .filter(Boolean)
    .slice(0, 6)
    .map((text) => ({ id: `a${Date.now().toString(36)}-${assumptionCounter++}`, text, resolved: false }));
}

function parseJson(result) {
  try {
    return JSON.parse(result.data.choices?.[0]?.message?.content ?? '{}');
  } catch {
    return null;
  }
}

// Returns { ok: true, sections, assumptions } or { ok: false, reason }.
export async function draftBusinessCase({ application, additionalNotes }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { ok: false, reason: 'no GROQ_API_KEY configured' };

  const result = await callGroqChat({
    apiKey,
    model: MODEL,
    messages: [
      { role: 'system', content: buildDraftSystemPrompt() },
      { role: 'user', content: ownerContext(application, additionalNotes) },
    ],
    temperature: 0.5,
    response_format: { type: 'json_object' },
  });

  if (!result.ok) {
    console.error(`[business-case] draft call failed (${result.status ?? 'network'}): ${result.error}`);
    return { ok: false, reason: result.status === 429 ? 'the AI service is rate-limited right now' : 'the draft request failed' };
  }

  const raw = parseJson(result);
  if (!raw) return { ok: false, reason: 'the draft response was not valid JSON' };

  return { ok: true, sections: coerceSections(raw.sections), assumptions: coerceAssumptions(raw.assumptions) };
}

// history: [{ at, summary }] — passed through for the model's awareness; the
// route owns persistence. Returns { ok, sections, assumptions, reply, changeSummary }.
export async function reviseBusinessCase({ application, additionalNotes, sections, assumptions, userMessage }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { ok: false, reason: 'no GROQ_API_KEY configured' };

  const payload = JSON.stringify({
    ownerContext: JSON.parse(ownerContext(application, additionalNotes)),
    currentNarrative: sections.map((s) => ({ key: s.key, body: s.body, confidence: s.confidence })),
    openAssumptions: (assumptions || []).filter((a) => !a.resolved).map((a) => a.text),
    ownerJustSaid: userMessage,
  });

  const result = await callGroqChat({
    apiKey,
    model: MODEL,
    messages: [
      { role: 'system', content: buildReviseSystemPrompt() },
      { role: 'user', content: payload },
    ],
    temperature: 0.4,
    response_format: { type: 'json_object' },
  });

  if (!result.ok) {
    console.error(`[business-case] revise call failed (${result.status ?? 'network'}): ${result.error}`);
    return { ok: false, reason: result.status === 429 ? 'the AI service is rate-limited right now' : 'the update request failed' };
  }

  const raw = parseJson(result);
  if (!raw) return { ok: false, reason: 'the update response was not valid JSON' };

  return {
    ok: true,
    sections: coerceSections(raw.sections),
    assumptions: coerceAssumptions(raw.assumptions),
    reply: coerceString(raw.reply) || 'Updated.',
    changeSummary: coerceString(raw.changeSummary) || 'Narrative updated',
  };
}

export function emptyCase() {
  return {
    sections: SECTION_ORDER.map((key) => ({
      key,
      heading: SECTION_HEADINGS[key],
      body: 'Tell me a bit about this and I’ll write it up.',
      confidence: 'thin',
    })),
    assumptions: [],
  };
}
