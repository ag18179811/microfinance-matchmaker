// Language support for the AI-generated content. The React chrome stays
// English for now, but the interview questions, coaching, business case,
// underwriter simulation, improvement plan, and application pack — which is
// most of what the user actually reads and writes — come back in the
// language the owner used in their opening description.

const SUPPORTED = {
  en: 'English',
  es: 'Spanish',
  pt: 'Portuguese',
  fr: 'French',
  zh: 'Chinese (Simplified)',
  vi: 'Vietnamese',
  ko: 'Korean',
  tl: 'Tagalog',
  ht: 'Haitian Creole',
  ar: 'Arabic',
  ru: 'Russian',
};

export function normalizeLanguage(code) {
  const c = String(code || '')
    .trim()
    .toLowerCase()
    .slice(0, 2);
  return SUPPORTED[c] ? c : 'en';
}

export function languageName(code) {
  return SUPPORTED[normalizeLanguage(code)];
}

// Appended to an AI system prompt. Empty string for English so English
// prompts are byte-for-byte unchanged.
export function languageDirective(code) {
  const norm = normalizeLanguage(code);
  if (norm === 'en') return '';
  const name = SUPPORTED[norm];
  return (
    `\n\nLANGUAGE: The applicant is communicating in ${name}. Write EVERY user-facing string — questions, ` +
    `explanations, summaries, the narrative, reviewer dialogue — entirely in natural, warm ${name}, not ` +
    `translated-sounding ${name}. Keep all JSON keys and enum values (e.g. "questionType", "select", field ` +
    `names) in English exactly as specified.`
  );
}
