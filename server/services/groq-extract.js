// Free-text -> structured application fields. Extraction only — this file
// never decides eligibility or requiredness, and it is instructed to never
// guess a value the user didn't actually provide. matching-engine.js remains
// the sole source of truth for eligibility.

import { INDUSTRIES, normalizeState } from '../constants.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-120b';

const SCHEMA_DESCRIPTION = `{
  "business_name": string or null,
  "industry": one of [${INDUSTRIES.map((i) => `"${i}"`).join(', ')}] or null,
  "city": string or null,
  "state": string or null (US state name or two-letter abbreviation),
  "time_in_business_months": integer or null,
  "annual_revenue": integer, whole US dollars with no symbols or commas, or null,
  "requested_amount": integer, whole US dollars with no symbols or commas, or null,
  "purpose": string or null
}`;

function buildSystemPrompt() {
  const today = new Date().toISOString().slice(0, 10);
  return (
    'You are an information-extraction engine for a small business funding readiness platform. ' +
    "Extract only facts that are explicitly stated or unambiguously implied in the user's business " +
    "description. Never guess, estimate, or invent a number, location, or industry that isn't clearly " +
    `given — if something isn't clearly stated, return null for that field. Today's date is ${today}; ` +
    'convert stated durations ("about 3 years", "since 2019") into an integer number of months for ' +
    'time_in_business_months. If a dollar figure is given as a range, use the midpoint. Strip currency ' +
    'symbols and commas from dollar amounts. For "industry", choose the single closest match from the ' +
    'fixed list in the schema; if nothing clearly fits, return null — do not invent an industry not in ' +
    'the list. Respond with ONLY a single valid JSON object matching exactly this schema, and nothing ' +
    `else — no markdown, no commentary, no explanation:\n${SCHEMA_DESCRIPTION}`
  );
}

function coerceNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

function coerceIndustry(value) {
  if (!value) return null;
  const match = INDUSTRIES.find((i) => i.toLowerCase() === String(value).trim().toLowerCase());
  return match || null;
}

function coerceString(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function emptyExtraction() {
  return {
    business_name: null,
    industry: null,
    city: null,
    state: null,
    time_in_business_months: null,
    annual_revenue: null,
    requested_amount: null,
    purpose: null,
  };
}

export async function extractApplicationFields(description) {
  const apiKey = process.env.GROQ_API_KEY;

  // No key configured: don't guess. Carry the raw description forward as the
  // funding purpose and let the follow-up form collect everything else
  // explicitly, so accuracy never depends on a heuristic parser.
  if (!apiKey) {
    return { ...emptyExtraction(), purpose: coerceString(description) };
  }

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: description },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Groq extraction error (${response.status}): ${errorText}`);
      return { ...emptyExtraction(), purpose: coerceString(description) };
    }

    const data = await response.json();
    const raw = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');

    return {
      business_name: coerceString(raw.business_name),
      industry: coerceIndustry(raw.industry),
      city: coerceString(raw.city),
      state: normalizeState(raw.state),
      time_in_business_months: coerceNumber(raw.time_in_business_months),
      annual_revenue: coerceNumber(raw.annual_revenue),
      requested_amount: coerceNumber(raw.requested_amount),
      purpose: coerceString(raw.purpose) ?? coerceString(description),
    };
  } catch (err) {
    console.error('Groq extraction request failed:', err.message);
    return { ...emptyExtraction(), purpose: coerceString(description) };
  }
}
