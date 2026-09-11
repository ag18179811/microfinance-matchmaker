// Language support for the AI-generated content. The React chrome stays
// English for now, but the interview questions, coaching, business case,
// underwriter simulation, improvement plan, and application pack, which is
// most of what the user actually reads and writes, come back in the
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

// A plain-writing style rule appended to every AI system prompt, in every
// language: no em dashes and none of the other tics that make generated
// text read as generated rather than written by the person it's supposed
// to sound like.
const STYLE_DIRECTIVE =
  '\n\nWRITING STYLE: Never use an em dash (—) or double hyphen (--) for any reason; use a period, comma, ' +
  'colon, or parentheses instead. Do not use emoji. Avoid generic AI-assistant phrasing ("I\'d be happy to", ' +
  '"it\'s important to note", "in today\'s world", "unlock", "leverage", "dive into", "game-changer"). Write ' +
  'like a knowledgeable person talking directly to this specific business owner: plain, concrete, and varied ' +
  'in sentence length, not like marketing copy. Any text field that will be displayed as plain text in the ' +
  'app (not a JSON field explicitly documented as markdown) must contain NO markdown syntax whatsoever: no ' +
  '**bold**, no _italics_, no # headers, no bullet dashes. Where a numbered list is genuinely called for, ' +
  'write it as plain "1. ... 2. ... 3. ..." on its own lines, nothing more.';

// Appended to an AI system prompt. The style rule always applies; the
// language-translation instruction only applies past English.
export function languageDirective(code) {
  const norm = normalizeLanguage(code);
  if (norm === 'en') return STYLE_DIRECTIVE;
  const name = SUPPORTED[norm];
  return (
    STYLE_DIRECTIVE +
    `\n\nLANGUAGE: The applicant is communicating in ${name}. Write EVERY user-facing string (questions, ` +
    `explanations, summaries, the narrative, reviewer dialogue) entirely in natural, warm ${name}, not ` +
    `translated-sounding ${name}. Keep all JSON keys and enum values (e.g. "questionType", "select", field ` +
    `names) in English exactly as specified. The writing-style rule above applies in ${name} too.`
  );
}
