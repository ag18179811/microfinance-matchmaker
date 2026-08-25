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

// coerceSelect only matches the raw enum string exactly ("llc", "s_corp"),
// which almost never appears verbatim in a normal typed answer ("we're an
// LLC", "S-corp"). Without this, a perfectly clear answer gets rejected and
// the fallback re-asks the identical question — this is the fuzzy tier
// tried first, so a real answer given in plain English is actually heard.
const INDUSTRY_KEYWORD_HINTS = [
  [/bak(e|ery|ing)|caf[eé]|coffee|restaurant|food truck|catering|bar\b|brewery/i, 'Food Service'],
  [/retail|storefront|boutique|shop\b|store\b/i, 'Retail'],
  [/salon|barber|spa|gym|fitness|dry\s*clean|cleaning service/i, 'Personal Services'],
  [/consult|law firm|attorney|accounting|bookkeep|marketing agency/i, 'Professional Services'],
  [/manufactur|factory|fabricat/i, 'Manufacturing'],
  [/construction|contractor|remodel|builder|home addition/i, 'Construction'],
  [/trucking|logistics|freight|delivery service|transport/i, 'Transportation'],
  [/wholesale|distributor/i, 'Wholesale'],
  [/farm|agricultur|ranch|orchard/i, 'Agriculture'],
  [/tour|hotel|hospitality|travel agency/i, 'Tourism'],
  [/clinic|medical|dental|health\s*care|therapy practice/i, 'Health Care'],
  [/day\s*care|daycare|childcare|preschool/i, 'Child Care'],
  [/art gallery|studio|entertainment|music venue|theater/i, 'Arts and Entertainment'],
  [/software|app\b|saas|tech startup|it services/i, 'Technology'],
  [/real estate|property management|realtor/i, 'Real Estate'],
];

function fuzzyIndustryMatch(text) {
  for (const [pattern, value] of INDUSTRY_KEYWORD_HINTS) {
    if (pattern.test(text)) return value;
  }
  return null;
}

const SELECT_KEYWORD_HINTS = {
  business_structure: [
    [/\bllc\b|limited liability/i, 'llc'],
    [/sole\s*prop|\bindividual\b|just me|by myself/i, 'sole_prop'],
    [/\bs[\s-]?corp/i, 's_corp'],
    [/\bc[\s-]?corp|incorporated|\binc\b/i, 'c_corp'],
    [/partnership/i, 'partnership'],
  ],
  has_tax_returns: [
    [/two\s*year|2\s*year|both\s*years/i, 'yes_2yr'],
    [/one\s*year|1\s*year|first\s*year|just\s*one/i, 'yes_1yr'],
    [/not\s*yet|don'?t\s*have|no\s*returns|none/i, 'no'],
  ],
  cash_flow_pattern: [
    [/steady|consistent|stable|flat/i, 'steady'],
    [/seasonal/i, 'seasonal'],
    [/grow|increasing|up\b|climbing/i, 'growing'],
    [/declin|decreas|down\b|dropping|slowing/i, 'declining'],
  ],
  credit_band: [
    [/not\s*sure|don'?t\s*know|unsure|no\s*idea/i, 'not_sure'],
    [/excellent|great/i, '720_plus'],
    [/\bgood\b/i, '680_720'],
    [/\bfair\b/i, '600_680'],
    [/\bpoor\b|\bbad\b/i, 'under_600'],
  ],
};

function creditBandFromNumber(text) {
  const match = text.match(/\b(\d{3})\b/);
  if (!match) return null;
  const score = Number(match[1]);
  if (score < 300 || score > 850) return null; // not a plausible credit score
  if (score < 600) return 'under_600';
  if (score < 680) return '600_680';
  if (score < 720) return '680_720';
  return '720_plus';
}

function fuzzySelectMatch(fieldKey, text) {
  if (fieldKey === 'credit_band') {
    const fromNumber = creditBandFromNumber(text);
    if (fromNumber) return fromNumber;
  }
  const hints = SELECT_KEYWORD_HINTS[fieldKey];
  if (!hints) return null;
  for (const [pattern, value] of hints) {
    if (pattern.test(text)) return value;
  }
  return null;
}

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
    const exact = coerceIndustry(text);
    if (exact) return { ok: true, value: exact };
    const fuzzy = fuzzyIndustryMatch(text);
    return fuzzy ? { ok: true, value: fuzzy } : { ok: false };
  }
  if (fieldKey === 'state') {
    const value = normalizeState(text);
    return value ? { ok: true, value } : { ok: false };
  }
  if (meta.type === 'select') {
    const exact = coerceSelect(text, meta.options);
    if (exact) return { ok: true, value: exact };
    const fuzzy = fuzzySelectMatch(fieldKey, text);
    return fuzzy ? { ok: true, value: fuzzy } : { ok: false };
  }
  if (meta.type === 'number') {
    const value = coerceNumber(text);
    return value !== null ? { ok: true, value } : { ok: false };
  }
  const value = coerceString(text);
  return value !== null ? { ok: true, value } : { ok: false };
}
