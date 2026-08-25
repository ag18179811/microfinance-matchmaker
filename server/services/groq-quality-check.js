// Judges whether the applicant's own answers are credible, coherent, and
// substantive — a check the deterministic rules engine cannot do, since it
// only sees whether a field is present, not whether the content in it makes
// sense. Without this, a profile stuffed with joke/nonsense/self-contradictory
// text scores exactly as well as a genuine one, because "completeness" in
// matching-engine.js only counts presence.
//
// This intentionally judges CREDIBILITY, not business strength — a small,
// new, financially weak business that answers honestly and specifically
// must score high here; a large, established business that gives evasive
// or contradictory answers must score low. Revenue/tenure/loan-fit already
// capture business strength elsewhere in the readiness score; this is the
// one axis that catches "the applicant isn't engaging in good faith or the
// story doesn't hold together," independent of how strong the business is.
//
// Like every other Groq call in this app, matching-engine.js itself never
// calls this — the score it returns is threaded into computeReadiness() as
// plain input data, the same way already-extracted fields are, so the
// scoring formula itself stays deterministic and auditable.

import { callGroqChat } from './groq-client.js';

const MODEL = 'openai/gpt-oss-120b';

// Used when the check can't run at all (no key) or fails after retries —
// deliberately NOT full credit (100) and NOT zero: an unverified profile is
// neither vouched for nor accused, so it shouldn't swing the score either way.
export const UNAVAILABLE_QUALITY_SCORE = 60;

const SYSTEM_PROMPT =
  'You are a fraud/credibility reviewer for a small business funding-readiness platform. You will be given ' +
  "a business's structured application fields and the free-text facts (\"notes\") gathered during an " +
  "interview. Judge ONLY whether the content is credible, internally consistent, and substantive — never " +
  'whether the business itself is strong, big, profitable, or a good loan candidate (that is scored ' +
  'elsewhere). A small, brand-new, financially weak business that answers honestly and specifically must ' +
  'score HIGH here. Score LOW only when the content itself is the problem: answers that are joke/satirical ' +
  '/nonsensical, self-contradictory (e.g. claimed revenue or history that cannot be reconciled with other ' +
  'stated facts), clearly not describing a real business, evasive non-answers, or so generic/thin they ' +
  "carry no real information. Do not penalize brevity alone, imperfect grammar, or a business simply being " +
  'small or new — those are not credibility problems. Respond with ONLY a single valid JSON object, no ' +
  'markdown, no commentary:\n' +
  '{\n' +
  '  "qualityScore": integer 0-100,\n' +
  '  "concerns": ["short, specific, factual description of each credibility problem found — empty array if none"]\n' +
  '}';

function coerceResult(raw) {
  const scoreNum = Number(raw?.qualityScore);
  const qualityScore = Number.isFinite(scoreNum) ? Math.max(0, Math.min(100, Math.round(scoreNum))) : UNAVAILABLE_QUALITY_SCORE;
  const concerns = Array.isArray(raw?.concerns)
    ? raw.concerns.filter((c) => typeof c === 'string' && c.trim()).map((c) => c.trim()).slice(0, 8)
    : [];
  return { qualityScore, concerns };
}

export async function assessAnswerQuality(application) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { qualityScore: UNAVAILABLE_QUALITY_SCORE, concerns: [], checked: false };

  let additionalNotes = [];
  try {
    additionalNotes = typeof application.additional_notes === 'string' ? JSON.parse(application.additional_notes) : application.additional_notes || [];
  } catch {
    additionalNotes = [];
  }

  const userPayload = JSON.stringify({
    business_name: application.business_name,
    industry: application.industry,
    city: application.city,
    state: application.state,
    time_in_business_months: application.time_in_business_months,
    annual_revenue: application.annual_revenue,
    requested_amount: application.requested_amount,
    purpose: application.purpose,
    use_of_funds_detail: application.use_of_funds_detail,
    prior_funding_history: application.prior_funding_history,
    cash_flow_pattern: application.cash_flow_pattern,
    notes: additionalNotes,
  });

  const result = await callGroqChat({
    apiKey,
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPayload },
    ],
    temperature: 0,
    response_format: { type: 'json_object' },
  });

  if (!result.ok) {
    console.error(`Groq quality-check call failed (${result.status ?? 'network error'}): ${result.error}`);
    return { qualityScore: UNAVAILABLE_QUALITY_SCORE, concerns: [], checked: false };
  }

  try {
    const raw = JSON.parse(result.data.choices?.[0]?.message?.content ?? '{}');
    return { ...coerceResult(raw), checked: true };
  } catch (err) {
    console.error('Groq quality-check response was not valid JSON:', err.message);
    return { qualityScore: UNAVAILABLE_QUALITY_SCORE, concerns: [], checked: false };
  }
}
