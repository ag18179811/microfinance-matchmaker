// A drafted business plan in the standard sections a lender or SBA
// intermediary expects, assembled from the interview, the Living Business
// Case, and the cash-flow projection, then refined by conversation (same
// draft-then-talk pattern as business-case.js). Never invents a market
// figure, a competitor, or a number the owner didn't provide; where a
// section genuinely needs outside input it says so in a bracketed prompt.

import { callGroqChat } from './groq-client.js';
import { coerceString } from './field-coercion.js';
import { languageDirective } from './language.js';
import { helpModeDirective } from './help-mode.js';

const MODEL = 'openai/gpt-oss-120b';

export const PLAN_SECTIONS = ['summary', 'company', 'market', 'offering', 'operations', 'management', 'use_of_funds', 'financials'];

const HEADINGS = {
  summary: 'Executive summary',
  company: 'Company description',
  market: 'Market and customers',
  offering: 'Products and services',
  operations: 'Operations',
  management: 'Management and team',
  use_of_funds: 'Use of funds',
  financials: 'Financial position and repayment',
};

function systemPrompt(hasProjection) {
  return (
    'You are drafting a business plan for a small business owner applying for funding, the kind an SBA ' +
    'microloan intermediary or a CDFI asks for. Use the standard sections below. Write in clear, plain ' +
    'business prose (third person is fine for a plan), 1-2 short paragraphs per section.\n\n' +
    'ABSOLUTE RULES:\n' +
    '- Use ONLY what the owner has told you (interview answers, the funding narrative, the specific facts, ' +
    (hasProjection ? 'and the cash-flow projection' : 'the projection is not available') +
    '). Never invent a market size, a growth statistic, a named competitor, a customer count, or a financial ' +
    'figure they did not provide.\n' +
    '- Where a section genuinely needs a fact the owner has not given (e.g. a local market figure, a specific ' +
    'competitor), write a short bracketed prompt like "[Add: the 2-3 businesses you compete with most ' +
    'directly]" rather than making something up.\n' +
    '- "use_of_funds" must tie each dollar to a concrete outcome. "financials" summarizes current revenue, ' +
    'existing debt, and how repayment works, grounded in real numbers.\n\n' +
    'Respond with ONLY valid JSON, no markdown:\n' +
    '{ "sections": [ { "key": "summary|company|market|offering|operations|management|use_of_funds|financials", ' +
    '"body": "prose" } ] }  // all eight keys, in that order'
  );
}

function reviseSystemPrompt() {
  return (
    'You maintain a small business owner\'s business plan. They just told you something in plain language, a ' +
    'correction or an addition. Update the affected section(s) and leave every other section byte-for-byte ' +
    'identical. Use only what they have actually told you; never invent specifics. Respond with ONLY valid ' +
    'JSON:\n{ "sections": [ { "key": "...", "body": "..." } ],  // all eight, in order\n' +
    '  "reply": "one short, warm sentence on what you changed" }'
  );
}

function coerceSections(raw) {
  const byKey = new Map();
  if (Array.isArray(raw)) {
    for (const s of raw) {
      const key = coerceString(s?.key);
      if (key && PLAN_SECTIONS.includes(key) && !byKey.has(key)) {
        byKey.set(key, { key, heading: HEADINGS[key], body: coerceString(s?.body) || '' });
      }
    }
  }
  return PLAN_SECTIONS.map(
    (key) => byKey.get(key) || { key, heading: HEADINGS[key], body: `[This section still needs your input, tell me about ${HEADINGS[key].toLowerCase()} and I'll write it.]` }
  );
}

function context({ application, additionalNotes, businessCaseSections, projection }) {
  return JSON.stringify({
    interviewAnswers: { ...application, additional_notes: undefined, user_id: undefined },
    specificFacts: additionalNotes || [],
    fundingNarrative: (businessCaseSections || []).map((s) => ({ heading: s.heading, body: s.body })),
    cashFlowProjection: projection?.months
      ? { startingCash: projection.startingCash, months: projection.months.map((m) => ({ label: m.label, revenue: m.revenue, expenses: m.expenses, net: m.net, endingCash: m.endingCash })) }
      : null,
  });
}

function parse(result) {
  try {
    return JSON.parse(result.data.choices?.[0]?.message?.content ?? '{}');
  } catch {
    return null;
  }
}

export async function draftBusinessPlan({ application, additionalNotes, businessCaseSections, projection, language = 'en', helpMode = null }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { ok: false, reason: 'no GROQ_API_KEY configured' };

  const result = await callGroqChat({
    apiKey,
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt(Boolean(projection?.months)) + helpModeDirective(helpMode) + languageDirective(language) },
      { role: 'user', content: context({ application, additionalNotes, businessCaseSections, projection }) },
    ],
    temperature: 0.45,
    response_format: { type: 'json_object' },
  });

  if (!result.ok) {
    return { ok: false, reason: result.status === 429 ? 'the AI service is rate-limited right now' : 'the draft request failed' };
  }
  const raw = parse(result);
  if (!raw) return { ok: false, reason: 'the draft response was not valid JSON' };
  return { ok: true, sections: coerceSections(raw.sections) };
}

export async function reviseBusinessPlan({ application, additionalNotes, sections, userMessage, language = 'en' }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { ok: false, reason: 'no GROQ_API_KEY configured' };

  const payload = JSON.stringify({
    interviewAnswers: { ...application, additional_notes: undefined, user_id: undefined },
    specificFacts: additionalNotes || [],
    currentPlan: sections.map((s) => ({ key: s.key, body: s.body })),
    ownerJustSaid: userMessage,
  });

  const result = await callGroqChat({
    apiKey,
    model: MODEL,
    messages: [
      { role: 'system', content: reviseSystemPrompt() + languageDirective(language) },
      { role: 'user', content: payload },
    ],
    temperature: 0.4,
    response_format: { type: 'json_object' },
  });

  if (!result.ok) return { ok: false, reason: result.status === 429 ? 'the AI service is rate-limited right now' : 'the update request failed' };
  const raw = parse(result);
  if (!raw) return { ok: false, reason: 'the update response was not valid JSON' };
  return { ok: true, sections: coerceSections(raw.sections), reply: coerceString(raw.reply) || 'Updated.' };
}
