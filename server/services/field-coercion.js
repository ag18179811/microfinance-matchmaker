// Shared "never trust raw model or user input" coercion helpers, used by
// every code path that turns free text or LLM JSON output into a structured
// application field: groq-extract.js, groq-interview.js, and the
// deterministic interview-fallback.js path all rely on these.

import { INDUSTRIES } from '../constants.js';

export function coerceNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

export function coerceIndustry(value) {
  if (!value) return null;
  const match = INDUSTRIES.find((i) => i.toLowerCase() === String(value).trim().toLowerCase());
  return match || null;
}

export function coerceString(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function coerceSelect(value, options) {
  if (!value) return null;
  const match = options.find((o) => o.toLowerCase() === String(value).trim().toLowerCase());
  return match || null;
}
