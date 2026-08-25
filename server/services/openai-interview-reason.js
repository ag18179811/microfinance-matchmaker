// Step 1 of an interview turn: genuine reasoning about this specific
// conversation, with the ability to search the web when that would actually
// help — a specific permit, certification, program, or competitor the user
// mentioned. Free-form output on purpose, no structured-output schema:
// OpenAI's docs note a higher failure/truncation rate when web_search is
// forced into a complex schema in the same call (same reasoning already
// applied in openai-lender-search.js). groq-interview.js is step 2 — it
// takes this free-form analysis and turns it into the structured turn
// (next question, updated fields, notes, reasoningSteps for the UI).
//
// The model decides whether search is actually warranted; it is never
// forced. Never used for eligibility or scoring — matching-engine.js stays
// the only source of truth for those, same as everywhere else in this app.

import { callOpenAIResponses, findMessageText, collectCitedUrls } from './openai-client.js';

const MODEL = 'gpt-4.1-mini';

const SYSTEM_PROMPT =
  'You are an experienced small-business loan underwriter conducting a funding-readiness interview. Read the ' +
  'full conversation so far and think through it like a real analyst would: what has this specific business ' +
  'told you, what does it suggest about their readiness, what is still unclear or missing, and what would be ' +
  'genuinely most valuable to ask next — not a generic next field, but whatever a careful underwriter would ' +
  'actually want to know about THIS business given what has been said so far. Whenever the user names something ' +
  'specific and real-world checkable — a named program, a permit or license type, a certification, a competitor, ' +
  'a regulation, an industry term you are not fully certain about — actually use web search to look it up rather ' +
  'than reasoning from memory alone; a real underwriter would verify this kind of thing, not assume it. Err ' +
  'toward searching when there is a concrete, named thing to check. Only skip it when the user has already fully ' +
  'explained the detail themselves and there is nothing left to verify. Write your analysis out ' +
  'as plain prose reasoning, not a form: what you now understand, what stood out, and what you want to ask ' +
  'next and why. This is read by a second step that turns it into a structured question, so be concrete and ' +
  'specific rather than vague.';

function buildUserContent(currentFields, currentNotes, stuckField) {
  const parts = [
    `Current known profile (JSON): ${JSON.stringify(currentFields)}`,
    `Specific facts already gathered (JSON): ${JSON.stringify(currentNotes || [])}`,
  ];
  if (stuckField) {
    parts.push(
      `Note: the last two questions both targeted "${stuckField}" and it's still unresolved — do not reason ` +
        'toward asking about it again; move to a genuinely different topic.'
    );
  }
  return parts.join('\n\n');
}

// Returns { ok: true, analysisText, citedUrls } on success, or
// { ok: false } when no key is configured or the call fails — callers
// should treat this as an enhancement, not a hard dependency: proceed to
// step 2 with the raw history instead of blocking the turn on this.
export async function reasonAboutTurn({ history, currentFields, currentNotes, stuckField }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false };

  const result = await callOpenAIResponses({
    apiKey,
    body: {
      model: MODEL,
      input: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: buildUserContent(currentFields, currentNotes, stuckField) },
      ],
      tools: [{ type: 'web_search' }],
    },
  });

  if (!result.ok) {
    console.error(`[openai-interview-reason] call failed (${result.status ?? 'network error'}): ${result.error}`);
    return { ok: false };
  }

  const { text, annotations } = findMessageText(result.data.output);
  if (!text) return { ok: false };

  return { ok: true, analysisText: text, citedUrls: collectCitedUrls(annotations) };
}
