// The application pack: the Living Business Case + the underwriter-review
// prepared answers, projected into exactly the shape a specific lender's
// process consumes. A Kiva pack (personal story + business description +
// a private-lender worksheet) and a CDFI pack (use-of-funds statement +
// repayment narrative + document checklist) are genuinely different
// artifacts, so the blocks are chosen by application model.
//
// One AI call, grounded strictly in the business case and the owner's own
// prepared answers — it reformats and organizes, it does not invent. The
// document checklist and process steps are copied verbatim from the
// verified lender profile, never generated.

import { callGroqChat } from './groq-client.js';
import { coerceString } from './field-coercion.js';

const MODEL = 'openai/gpt-oss-120b';

// Which prose blocks each model's pack needs, and what each one is.
export const BLOCKS_BY_MODEL = {
  cdfi_term_loan: [
    ['business_summary', 'Business summary', 'One tight paragraph a loan officer can read in 20 seconds: what the business is, how long, how it makes money, where it stands.'],
    ['use_of_funds', 'Use-of-funds statement', 'Exactly what the money buys, with the cost breakdown, AND the business reason for each piece tied to a concrete outcome (more capacity, lower costs, more revenue). This is the piece lenders say is most often too vague.'],
    ['repayment', 'How repayment works', "A plain, honest paragraph on where the monthly payment comes from — grounded in the owner's actual cash-flow numbers and any seasonality. No invented projections."],
  ],
  crowdfunding: [
    ['personal_story', 'Your personal story (2 paragraphs)', "First person, specific, and human — who the owner is, why this business, what this moment means. Kiva lenders fund people; this is the piece that does that work. Around 2 paragraphs."],
    ['business_description', 'Business description (2 paragraphs)', 'What the business does, who it serves, how it makes money, where it is now. Concrete, not promotional. Around 2 paragraphs.'],
    ['loan_use', 'What the loan pays for', 'A specific, itemized breakdown of how every dollar is used.'],
    ['invite_message', 'A message to invite your private lenders', "A short, warm, personal message the owner can adapt and send to friends, family, customers, and suppliers, asking them to lend during the 15-day private period. First person, in the owner's voice, easy to forward."],
  ],
  sba_intermediary: [
    ['business_summary', 'Business summary', 'One paragraph: what the business is, how long, how it makes money, where it stands.'],
    ['use_of_funds', 'Use-of-funds statement', 'Exactly what the money buys, the cost breakdown, and the business reason for each piece.'],
    ['business_plan_outline', 'Business plan outline', 'A section-by-section skeleton (as a bulleted outline, not full prose) the owner can flesh out — most intermediaries require a written plan. Base every bullet on what the owner has actually told us; mark clearly where they still need to add detail.'],
  ],
  referral_network: [
    ['business_summary', 'Business summary', 'One paragraph the network can use to route the request well: what the business is, how long, how it makes money, the amount and purpose.'],
    ['use_of_funds', 'What the funding is for', 'A specific, itemized breakdown.'],
  ],
  group_lending: [
    ['business_summary', 'Business summary', "One short paragraph on the business, in the owner's voice."],
    ['group_note', 'Forming your group', "A short, practical note to the owner on who in their life could be the other four women entrepreneurs in their lending group, and how to raise it with them — grounded in anyone they've mentioned (customers, other vendors, community)."],
  ],
};

function buildSystemPrompt(model, lenderName) {
  const blocks = BLOCKS_BY_MODEL[model] || BLOCKS_BY_MODEL.cdfi_term_loan;
  const blockSpec = blocks.map(([key, label, desc]) => `  "${key}": ${desc} (shown to the owner as "${label}")`).join('\n');
  return (
    `You are assembling a small business owner's application material for ${lenderName}. You are given their ` +
    'funding narrative (already written in their voice) and the answers they prepared in a practice review ' +
    'with this lender.\n\n' +
    'ABSOLUTE RULES:\n' +
    "- Reformat and organize ONLY. Every fact must trace to the narrative or the prepared answers. Never " +
    'invent a number, a projection, a customer, a date, or a plan.\n' +
    "- Keep the owner's voice — first person, plain, specific. Not marketing copy.\n" +
    '- Where something important is genuinely missing for a block, write one bracketed prompt like ' +
    '"[Add: your exact monthly payment once you know the loan terms]" rather than making it up.\n\n' +
    'Produce these blocks:\n' +
    `${blockSpec}\n\n` +
    'Respond with ONLY a valid JSON object, no markdown:\n' +
    '{\n' +
    blocks.map(([key]) => `  "${key}": "the text for this block"`).join(',\n') +
    '\n}'
  );
}

function coercePack(raw, model) {
  const blocks = BLOCKS_BY_MODEL[model] || BLOCKS_BY_MODEL.cdfi_term_loan;
  const out = [];
  for (const [key, label] of blocks) {
    const text = coerceString(raw?.[key]);
    if (text) out.push({ key, label, text });
  }
  return out;
}

// Returns { ok, blocks, checklist, steps } — checklist/steps are copied
// straight from the verified profile (or empty for unverified lenders).
export async function buildPack({ businessCase, review, profile, lender }) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = profile?.model || 'cdfi_term_loan';

  const staticParts = {
    checklist: profile?.verified ? profile.need || [] : [],
    steps: profile?.steps || [],
    applyUrl: profile?.applyUrl || lender?.source_url || null,
    timeline: profile?.timeline || null,
    preparedAnswers: review?.prepared_answers || [],
    verified: Boolean(profile?.verified),
  };

  if (!apiKey) return { ok: false, reason: 'no GROQ_API_KEY configured', ...staticParts, blocks: [] };

  const payload = JSON.stringify({
    fundingNarrative: (businessCase?.sections || []).map((s) => ({ heading: s.heading, body: s.body })),
    preparedAnswersFromReview: (review?.prepared_answers || []).map((p) => ({ question: p.question, answer: p.answer })),
    reviewVerdict: review?.verdict || null,
  });

  const result = await callGroqChat({
    apiKey,
    model: MODEL,
    messages: [
      { role: 'system', content: buildSystemPrompt(model, lender?.name || 'this lender') },
      { role: 'user', content: payload },
    ],
    temperature: 0.4,
    response_format: { type: 'json_object' },
  });

  if (!result.ok) {
    console.error(`[application-pack] failed (${result.status ?? 'network'}): ${result.error}`);
    return {
      ok: false,
      reason: result.status === 429 ? 'the AI service is rate-limited right now' : 'the pack could not be assembled',
      ...staticParts,
      blocks: [],
    };
  }

  let raw;
  try {
    raw = JSON.parse(result.data.choices?.[0]?.message?.content ?? '{}');
  } catch {
    return { ok: false, reason: 'the pack response was not valid JSON', ...staticParts, blocks: [] };
  }

  return { ok: true, model, blocks: coercePack(raw, model), ...staticParts };
}
