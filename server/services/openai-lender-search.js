// The sole source of real funding programs the app matches against — there
// is no preset catalog. Called per application from routes/match.js with
// the owner's full profile. Two-step design instead of one combined call:
// OpenAI's web_search tool has a documented higher failure/truncation rate
// when forced into a complex structured-output schema in the same call, so
// step 1 does the live search and returns grounded, citation-backed text;
// step 2 (schema-only, no tool) extracts clean structured fields from that
// already-grounded text. Same "extract, never invent" discipline as
// groq-extract.js — anything without a real, actually-cited source_url is
// dropped, never guessed.
//
// matching-engine.js never calls this and stays fully deterministic; this
// function's output is threaded into it as plain data.

import { callOpenAIResponses, findMessageText, collectCitedUrls } from './openai-client.js';
import { coerceString, coerceNumber } from './field-coercion.js';

const MODEL = 'gpt-4.1-mini';
const MAX_RESULTS = 8;

const SEARCH_SYSTEM_PROMPT =
  'You are researching real, currently-operating small business funding programs FOR ONE SPECIFIC FOR-PROFIT ' +
  'SMALL BUSINESS OWNER whose full situation is given below. Every program you report must be one this ' +
  'particular business can actually apply to and receive funds from. Include BOTH:\n' +
  '  - loans: CDFIs, SBA microloan intermediaries, city/state/county small business loan programs, nonprofit lenders\n' +
  '  - grants: business grants a for-profit can win — and here you MUST go beyond the obvious national ones. ' +
  'Search specifically for grants that fit THIS owner: their city and county (municipal storefront/facade, ' +
  'economic-development, main-street, and small-business-relief grants are common and hyper-local), their ' +
  "industry (industry-association and trade grants), their stated use of funds (e.g. energy-efficiency, " +
  'equipment, hiring, technology-adoption, exporting grants), their business stage, and — ONLY when the owner ' +
  'has explicitly stated it — their ownership background (woman-, veteran-, Black-, Latino-, Native-, ' +
  'immigrant-, disability-owned grant programs). Do NOT return a demographic-restricted program unless the ' +
  "owner's stated background actually qualifies them for it.\n" +
  'Explicitly EXCLUDE anything restricted to 501(c)(3) nonprofits, arts councils, government agencies, or ' +
  'individual artists/creators only. Only describe programs you actually found via search results — never from ' +
  'memory without a citation, and never estimate or guess amounts, eligibility rules, or URLs. For each ' +
  'program, state: its exact name, WHETHER IT IS A LOAN OR A GRANT, what states/regions/cities it serves, its ' +
  'funding amount range if stated, any industry or ownership restrictions, key eligibility requirements (time ' +
  'in business, revenue minimums, ownership requirements, whether it needs 501(c)(3) status), and the exact ' +
  'URL of the page describing it. Prioritize the programs that fit this specific owner most tightly.\n' +
  'BE STRICT ABOUT LOCATION: the business is in the state given below. Many US cities share a name across ' +
  'states (Columbus OH vs Columbus IN, Portland OR vs Portland ME) — never report a city/county program from ' +
  'the wrong state. If a program\'s service area does not clearly include this business\'s state, drop it.\n' +
  'If after searching you find nothing genuinely usable by this business, say so plainly rather than list something tangential.';

const EXTRACTION_SYSTEM_PROMPT =
  'You will be given research notes about small business funding programs, each grounded in specific cited ' +
  'source URLs, plus the list of URLs that were actually cited. Extract each genuinely distinct, real program ' +
  'into a structured record. Rules: source_url MUST be one of the cited URLs given to you — never invent or ' +
  'modify a URL. Set funding_type to "grant" if the notes describe it as a grant (money not repaid) and "loan" ' +
  'otherwise. If a field is not clearly stated in the research notes, use null rather than guessing. Skip ' +
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
            funding_type: { type: 'string', enum: ['loan', 'grant', 'other'], description: 'loan = repaid; grant = not repaid' },
            geography: { type: 'string', description: 'Comma-separated two-letter state codes, or "National"' },
            min_loan: { type: ['integer', 'null'], description: 'min funding amount (award floor for grants)' },
            max_loan: { type: ['integer', 'null'], description: 'max funding amount (award ceiling for grants)' },
            industries: { type: 'string', description: 'Comma-separated, or empty string if no restriction' },
            eligibility_notes: { type: 'string' },
            source_url: { type: 'string' },
            min_months_in_business: { type: ['integer', 'null'] },
            min_months_in_business_type: { type: ['string', 'null'], enum: ['required', 'preferred', null] },
          },
          required: [
            'name',
            'type',
            'funding_type',
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

// Defensive coercion — never trust the model's structured output blindly,
// same discipline as groq-extract.js. citedUrls is the ground truth list
// from step 1; any entry whose source_url isn't literally in that list is
// dropped, since that's the strongest available signal against invention.
function coerceEntries(raw, citedUrls) {
  if (!Array.isArray(raw)) return [];
  const citedSet = new Set(citedUrls);
  const FUNDING_TYPES = new Set(['loan', 'grant', 'other']);
  return raw
    .map((entry) => ({
      name: coerceString(entry?.name),
      type: coerceString(entry?.type),
      funding_type: FUNDING_TYPES.has(entry?.funding_type) ? entry.funding_type : 'loan',
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

// Builds the plain-language "who this owner is" brief the search runs
// against — every signal the interview captured that could change which
// programs (especially grants) this specific business qualifies for.
function ownerBrief({
  state,
  industry,
  city,
  ownershipDemographics,
  timeInBusinessMonths,
  annualRevenue,
  requestedAmount,
  useOfFunds,
  businessStructure,
  notes,
}) {
  const lines = [];
  lines.push(`Location: ${[city, state].filter(Boolean).join(', ') || state}`);
  if (industry) lines.push(`Industry: ${industry}`);
  if (Number.isFinite(timeInBusinessMonths)) {
    const stage =
      timeInBusinessMonths < 12 ? 'startup / under a year' : timeInBusinessMonths < 24 ? 'early-stage (1–2 years)' : `established (${Math.floor(timeInBusinessMonths / 12)}+ years)`;
    lines.push(`Time in business: ${timeInBusinessMonths} months (${stage})`);
  }
  if (Number.isFinite(annualRevenue)) lines.push(`Annual revenue: about $${Math.round(annualRevenue).toLocaleString()}`);
  if (Number.isFinite(requestedAmount)) lines.push(`Amount they're trying to raise: about $${Math.round(requestedAmount).toLocaleString()}`);
  if (businessStructure) lines.push(`Legal structure: ${businessStructure}`);
  if (useOfFunds) lines.push(`What the money is for: ${useOfFunds}`);
  if (ownershipDemographics) lines.push(`Owner background (self-reported): ${ownershipDemographics}`);
  const noteLines = (Array.isArray(notes) ? notes : [])
    .map((n) => (typeof n === 'string' ? n : n?.detail || n?.topic))
    .filter(Boolean)
    .slice(0, 6);
  if (noteLines.length) lines.push(`Other specifics from the interview:\n- ${noteLines.join('\n- ')}`);
  return lines.join('\n');
}

// Returns an array of program records (possibly empty) — never throws.
// Callers treat this as a non-blocking enhancement: on failure or with no
// key, matching proceeds on the verified catalog alone. `state` is the only
// required field; everything else sharpens the search, especially for grants.
export async function searchLiveLenders(context) {
  const { state, industry } = context;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !state) return [];

  console.log(`[openai-lender-search] live search: state=${state} industry=${industry || '(any)'} city=${context.city || '(any)'} owner=${context.ownershipDemographics ? 'stated' : 'n/a'}`);

  const searchResult = await callOpenAIResponses({
    apiKey,
    body: {
      model: MODEL,
      input: [
        { role: 'system', content: SEARCH_SYSTEM_PROMPT },
        {
          role: 'user',
          content:
            'Find every real, currently-open loan and grant program this specific business could apply to. ' +
            'Search for hyper-local (city/county), industry, use-of-funds, and — where they qualify — ownership-' +
            `specific grants, not just national ones.\n\n${ownerBrief(context)}`,
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
