// Deterministic, no-LLM interview path. Used whenever GROQ_API_KEY is unset
// or a Groq call fails — the adaptive interview must degrade to something
// that still works, never break outright. Walks the full field list in a
// fixed order and asks for whatever isn't filled yet, same idea as the
// original fixed-checklist intake this replaced, just extended to cover the
// deeper profile fields too.

import { INDUSTRIES, REQUIRED_APPLICATION_FIELDS, DEEP_PROFILE_FIELDS, DEEP_PROFILE_FIELD_ORDER, normalizeState } from '../constants.js';
import { coerceNumber, coerceIndustry, coerceString, coerceSelect } from './field-coercion.js';

const ALL_ORDER = [...REQUIRED_APPLICATION_FIELDS, ...DEEP_PROFILE_FIELD_ORDER];

const CORE_LABELS = {
  business_name: "What's your business called?",
  industry: 'Which industry best fits your business?',
  city: 'What city is your business based in?',
  state: 'What state is it in? You can use the 2-letter code or the full name.',
  time_in_business_months: 'About how many months have you been in operation?',
  annual_revenue: "What's your approximate annual revenue, in dollars?",
  requested_amount: 'How much funding are you looking for, in dollars?',
};

const NUMBER_FIELDS = new Set(['time_in_business_months', 'annual_revenue', 'requested_amount', 'existing_monthly_debt_payment', 'employee_count']);

function metaFor(key) {
  if (key in DEEP_PROFILE_FIELDS) return { ...DEEP_PROFILE_FIELDS[key] };
  if (key === 'industry') return { type: 'select', options: INDUSTRIES, label: CORE_LABELS[key] };
  return { type: NUMBER_FIELDS.has(key) ? 'number' : 'text', label: CORE_LABELS[key] };
}

// Distinct from "answered with an empty string" (which never actually
// happens — every coercion path below either returns a real value or drops
// to null/undefined). null/undefined means "never asked yet"; '' is the
// explicit-skip sentinel for optional fields, set below, and deliberately
// does NOT count as still-needing-to-be-asked — otherwise a declined
// optional question would loop forever.
function needsAsking(value) {
  return value === null || value === undefined;
}

// What should be asked next, given the fields filled in so far. Returns
// { done: true } once every field (core + deep) has been asked about.
export function nextFallbackTurn(currentFields) {
  const key = ALL_ORDER.find((k) => needsAsking(currentFields[k]));
  if (!key) return { done: true, fieldKey: null, nextQuestion: null, questionType: 'text', options: null };

  const meta = metaFor(key);
  return {
    done: false,
    fieldKey: key,
    nextQuestion: meta.label,
    questionType: meta.type === 'select' ? 'select' : 'text',
    options: meta.type === 'select' ? meta.options : null,
  };
}

// Coerces a raw user answer for the given field. Optional fields (currently
// just ownership_demographics) accept "skip"/"none"/"" as an explicit pass —
// stored as '' (the resolved-but-declined sentinel — see needsAsking above),
// not re-asked, and normalized back to null wherever the field is actually
// used (matching-engine's completeness check, the applications insert).
export function coerceFallbackAnswer(fieldKey, raw) {
  const meta = metaFor(fieldKey);
  const text = String(raw ?? '').trim();

  if (meta.optional && (!text || /^(skip|none|n\/a|no)$/i.test(text))) {
    return { ok: true, value: '' };
  }
  if (!text) return { ok: false };

  if (fieldKey === 'industry') {
    const value = coerceIndustry(text);
    return value ? { ok: true, value } : { ok: false };
  }
  if (fieldKey === 'state') {
    const value = normalizeState(text);
    return value ? { ok: true, value } : { ok: false };
  }
  if (meta.type === 'select') {
    const value = coerceSelect(text, meta.options);
    return value ? { ok: true, value } : { ok: false };
  }
  if (meta.type === 'number') {
    const value = coerceNumber(text);
    return value !== null ? { ok: true, value } : { ok: false };
  }
  const value = coerceString(text);
  return value !== null ? { ok: true, value } : { ok: false };
}
