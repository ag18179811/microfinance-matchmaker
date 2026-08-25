// Live discovery of real funding programs, to supplement the small
// hand-verified static table in db/seed-lenders.js. Two-step design instead
// of one combined call: OpenAI's web_search tool has a documented higher
// failure/truncation rate when forced into a complex structured-output
// schema in the same call, so step 1 does the live search and returns
// grounded, citation-backed text; step 2 (schema-only, no tool) extracts
// clean structured fields from that already-grounded text. Same
// "extract, never invent" discipline as groq-extract.js — anything without
// a real, actually-cited source_url is dropped, never guessed.
//
// matching-engine.js never calls this and stays fully deterministic; this
// is called once from routes/match.js and its output is threaded in as
// plain data, the same way the static lenders table is.

import { callOpenAIResponses } from './openai-client.js';
import { coerceString, coerceNumber } from './field-coercion.js';

const MODEL = 'gpt-4.1-mini';
const MAX_RESULTS = 8;

const SEARCH_SYSTEM_PROMPT =
  'You are researching real, currently-operating small business funding programs (CDFIs, SBA microloan ' +
  'intermediaries, city/state small business loan programs, nonprofit business lenders) FOR A FOR-PROFIT SMALL ' +
  'BUSINESS OWNER — every program you report must be one a for-profit business (sole proprietorship, LLC, ' +
  'corporation, partnership) can actually apply to and receive funds from. Explicitly EXCLUDE grant programs ' +
  'restricted to 501(c)(3) nonprofits, arts councils, government agencies, or individual artists/creators only ' +
  '— those cannot be used by this audience even if they turn up in search results for the industry. Use web ' +
  'search to find programs that actually serve the given state and are relevant to the given industry. Only ' +
  'describe programs you actually found via search results — never describe a program from memory without a ' +
  'search result backing it up, and never estimate or guess loan amounts, eligibility rules, or URLs. For each ' +
  'program found, state: its exact name, what states/regions it serves, its loan amount range if stated, any ' +
  'industry restrictions, key eligibility requirements (time in business, revenue minimums, ownership ' +
  'requirements, and explicitly note if it requires nonprofit/501(c)(3) status), and the exact URL of the page ' +
  'describing its funding program. If you find nothing genuinely relevant and usable by a for-profit business ' +
  'after searching, say so plainly instead of describing something tangential.';

const EXTRACTION_SYSTEM_PROMPT =
  'You will be given research notes about small business funding programs, each grounded in specific cited ' +
  'source URLs, plus the list of URLs that were actually cited. Extract each genuinely distinct, real program ' +
  'into a structured record. Rules: source_url MUST be one of the cited URLs given to you — never invent or ' +
  'modify a URL. If a field is not clearly stated in the research notes, use null rather than guessing. Skip ' +
  'any program the notes describe as restricted to 501(c)(3) nonprofits, arts councils, government agencies, ' +
  'or individual artists/creators only — this platform serves for-profit small businesses, so those programs ' +
  'are not usable even if the research notes mention them. If the research notes say nothing relevant was ' +
  'found, or describe no usable program with a real cited URL, return an empty lenders array — do not force an ' +
  'entry to exist.';

function extractionSchema() {
  return {
    type: 'object',
    properties: {
      lenders: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: { type: 'string', enum: ['CDFI', 'nonprofit', 'city_program', 'state_program'] },
            geography: { type: 'string', description: 'Comma-separated two-letter state codes, or "National"' },
            min_loan: { type: ['integer', 'null'] },
            max_loan: { type: ['integer', 'null'] },
            industries: { type: 'string', description: 'Comma-separated, or empty string if no restriction' },
            eligibility_notes: { type: 'string' },
            source_url: { type: 'string' },
            min_months_in_business: { type: ['integer', 'null'] },
            min_months_in_business_type: { type: ['string', 'null'], enum: ['required', 'preferred', null] },
          },
          required: [
            'name',
            'type',
            'geography',
            'min_loan',
            'max_loan',
            'industries',
            'eligibility_notes',
            'source_url',
            'min_months_in_business',
            'min_months_in_business_type',
          ],
          additionalProperties: false,
        },
      },
    },
    required: ['lenders'],
    additionalProperties: false,
  };
}

function findMessageText(output) {
  const message = Array.isArray(output) ? output.find((item) => item.type === 'message') : null;
  const content = message?.content?.find((c) => c.type === 'output_text' || c.type === 'text');
  return { text: content?.text ?? null, annotations: content?.annotations ?? [] };
}

function collectCitedUrls(annotations) {
  return annotations.filter((a) => a?.type === 'url_citation' && a.url).map((a) => a.url);
}

// Defensive coercion — never trust the model's structured output blindly,
// same discipline as groq-extract.js. citedUrls is the ground truth list
// from step 1; any entry whose source_url isn't literally in that list is
// dropped, since that's the strongest available signal against invention.
function coerceEntries(raw, citedUrls) {
  if (!Array.isArray(raw)) return [];
  const citedSet = new Set(citedUrls);
  return raw
    .map((entry) => ({
      name: coerceString(entry?.name),
      type: coerceString(entry?.type),
      geography: coerceString(entry?.geography),
      min_loan: coerceNumber(entry?.min_loan),
      max_loan: coerceNumber(entry?.max_loan),
      industries: coerceString(entry?.industries) ?? '',
      eligibility_notes: coerceString(entry?.eligibility_notes) ?? '',
      source_url: coerceString(entry?.source_url),
      min_months_in_business: coerceNumber(entry?.min_months_in_business),
      min_months_in_business_type: coerceString(entry?.min_months_in_business_type),
    }))
    .filter((entry) => entry.name && entry.source_url && /^https?:\/\//i.test(entry.source_url))
    .filter((entry) => citedSet.size === 0 || citedSet.has(entry.source_url))
    .slice(0, MAX_RESULTS);
}

// Returns an array of lender records (possibly empty) — never throws.
// Callers should treat this as a non-blocking enhancement: if it fails or
// no key is configured, matching just proceeds on the static table alone.
export async function searchLiveLenders({ state, industry }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !state) return [];

  console.log(`[openai-lender-search] live search: state=${state} industry=${industry || '(any)'}`);

  const searchResult = await callOpenAIResponses({
    apiKey,
    body: {
      model: MODEL,
      input: [
        { role: 'system', content: SEARCH_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Find real small business funding programs serving businesses in the state of ${state}${industry ? `, particularly relevant to the "${industry}" industry` : ''}.`,
        },
      ],
      tools: [{ type: 'web_search' }],
    },
  });

  if (!searchResult.ok) {
    console.error(`[openai-lender-search] search call failed (${searchResult.status ?? 'network error'}): ${searchResult.error}`);
    return [];
  }

  const { text: groundedText, annotations } = findMessageText(searchResult.data.output);
  const citedUrls = collectCitedUrls(annotations);
  if (!groundedText || citedUrls.length === 0) return [];

  const extractResult = await callOpenAIResponses({
    apiKey,
    body: {
      model: MODEL,
      input: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify({ researchNotes: groundedText, citedUrls }) },
      ],
      text: { format: { type: 'json_schema', name: 'lender_list', strict: true, schema: extractionSchema() } },
    },
  });

  if (!extractResult.ok) {
    console.error(`[openai-lender-search] extraction call failed (${extractResult.status ?? 'network error'}): ${extractResult.error}`);
    return [];
  }

  const { text: extractedJson } = findMessageText(extractResult.data.output);
  try {
    const parsed = JSON.parse(extractedJson ?? '{}');
    return coerceEntries(parsed.lenders, citedUrls);
  } catch (err) {
    console.error('[openai-lender-search] extraction response was not valid JSON:', err.message);
    return [];
  }
}
