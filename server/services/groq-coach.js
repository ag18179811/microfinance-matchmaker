// Coaching text generation only. Never used for eligibility decisions —
// those come exclusively from matching-engine.js.

import { callGroqChat } from './groq-client.js';

const MODEL = 'openai/gpt-oss-120b';

const SYSTEM_PROMPT =
  'You are a funding readiness coach for small business owners applying to CDFI and city ' +
  "microloan programs. Given the applicant's data, computed sub-scores, and the specific, " +
  'business-particular facts gathered in additionalNotes, write a 2-3 sentence plain-English summary ' +
  'of their readiness and exactly 3 prioritized, concrete action items. Ground this in what is actually ' +
  'specific to THIS business — reference the concrete facts in additionalNotes rather than writing ' +
  'generic advice that could apply to any small business. Do not invent eligibility rules — only comment ' +
  'on the data given. If qualityConcerns is non-empty, the answers themselves were flagged as thin, ' +
  'inconsistent, or not credible — say so plainly and directly in the summary instead of writing an ' +
  'upbeat readiness summary that ignores it; a low answerQuality score means this report is not yet ' +
  'trustworthy, and the applicant needs to hear that.';

function fallbackSummary(readinessScore, reason, retryable) {
  return (
    `Readiness score: ${readinessScore}/100. AI coaching summary is unavailable right now (${reason}). ` +
    'The score above is still computed by the deterministic rules engine and is accurate; only the ' +
    `written explanation failed to generate.${retryable ? ' Try refreshing in a moment.' : ''}`
  );
}

export async function generateCoachingSummary(application, subScores, readinessScore, qualityConcerns = []) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return fallbackSummary(readinessScore, 'no GROQ_API_KEY configured', false);
  }

  let additionalNotes = [];
  try {
    additionalNotes = typeof application.additional_notes === 'string' ? JSON.parse(application.additional_notes) : application.additional_notes || [];
  } catch {
    additionalNotes = [];
  }

  const userPayload = JSON.stringify({
    applicant: { ...application, additional_notes: undefined },
    additionalNotes,
    subScores,
    readinessScore,
    qualityConcerns,
  });

  const result = await callGroqChat({
    apiKey,
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPayload },
    ],
    temperature: 0.4,
  });

  if (!result.ok) {
    console.error(`Groq coaching call failed (${result.status ?? 'network error'}): ${result.error}`);
    return fallbackSummary(readinessScore, result.status === 429 ? 'the AI service is rate-limited right now' : 'the Groq API request failed', true);
  }

  const content = result.data.choices?.[0]?.message?.content?.trim();
  return content || fallbackSummary(readinessScore, 'the Groq API request failed', true);
}
