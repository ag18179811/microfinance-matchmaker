// The Underwriter Simulation: a focused review conversation held as the
// person who will actually read this file at a specific lender. The persona
// changes per application model — a Kiva reviewer and a CDFI loan officer
// are looking for genuinely different things — and every question is
// grounded in THIS file's specific friction with THIS lender (the cautions
// and weak sub-scores the deterministic engine already computed), never a
// generic checklist.
//
// Hard rules, enforced in the prompt:
//   - Never promise or imply approval. This is practice, not a decision.
//   - Never state an eligibility rule that isn't in the verified profile
//     data passed in. If a hard disqualifier is present, say so plainly and
//     stop wasting the owner's time.
//   - Help the owner tell the TRUE story of their file well. Never coach
//     them toward a misrepresentation.
//   - The owner's answers get captured back in their own voice, cleaned up,
//     ready to paste into the real application.

import { callGroqChat } from './groq-client.js';
import { coerceString } from './field-coercion.js';

const MODEL = 'openai/gpt-oss-120b';

const PERSONAS = {
  cdfi_term_loan:
    'You are an experienced CDFI loan officer doing a first review of this application. You underwrite on ' +
    'cash flow and character more than credit score. You are mission-driven — you want to fund good ' +
    "businesses that banks turn down — but the loan has to make sense and get repaid. You're direct, warm, " +
    'and practical, never intimidating, and you speak plainly.',
  crowdfunding:
    'You are a Kiva U.S. application reviewer. There is NO credit check. You are assessing whether this ' +
    "person's story is real and specific, whether they have a genuine photo of themselves with their " +
    'business, and — most important — whether they truly have a network of 5–40 people who will lend during ' +
    'the 15-day private fundraising period. You hold applications to the CARE principle: Complete, Accurate, ' +
    'Realistic, Engaging. You are encouraging but honest about whether their network and story are strong ' +
    'enough to fund.',
  sba_intermediary:
    'You are an intake counselor at a local SBA microloan intermediary — a nonprofit that coaches the ' +
    'businesses it funds. You usually require a written business plan, and often a business training ' +
    'workshop before funding. You are supportive and educational, and you set realistic expectations about ' +
    'the timeline and any training requirement.',
  referral_network:
    "You represent a small-business lending network — applying routes the owner's request to partner " +
    "lenders, you don't fund directly. You are screening for basic fit and completeness before routing, and " +
    'you explain clearly what happens after they apply.',
  group_lending:
    'You are a Grameen America member services staffer. Loans go to groups of five women entrepreneurs who ' +
    'meet for 30 minutes every week. There is no credit check and no collateral. What you are really ' +
    'checking is whether this person can form a real group and commit to the weekly meeting for the life of ' +
    'the loan. You are warm and community-oriented.',
};

function fileContext({ application, additionalNotes, subScores, matchDetail, profile, lender }) {
  return JSON.stringify({
    lender: {
      name: lender?.name,
      type: lender?.type,
      loanRange: [lender?.min_loan, lender?.max_loan],
      eligibilityNotes: lender?.eligibility_notes || null,
      verifiedApplicationProfile: profile?.verified
        ? {
            model: profile.model,
            howItWorks: profile.howItWorks,
            need: profile.need,
            steps: profile.steps,
            gotchas: profile.gotchas,
            timeline: profile.timeline,
            underwriterFocus: profile.underwriterFocus,
          }
        : { note: 'application process not verified for this lender — do not assert specifics' },
    },
    thisBusiness: { ...application, additional_notes: undefined, user_id: undefined },
    specificFactsFromInterview: additionalNotes || [],
    readinessSubScores: subScores || null,
    thisLenderReasons: matchDetail?.reasons || [],
    thisLenderCautions: matchDetail?.cautions || [],
  });
}

function startPrompt(model) {
  return (
    `${PERSONAS[model] || PERSONAS.cdfi_term_loan}\n\n` +
    'You are about to walk this owner through what you, specifically, will be thinking when you open their ' +
    'file. Open the conversation:\n' +
    '1. One sentence on who you are and what this is (a practice review, not a decision).\n' +
    '2. Name the 1–3 things about THIS file you most want to dig into — pulled from the cautions, the weak ' +
    "sub-scores, and this business's actual situation. Be specific: reference what they told the interview.\n" +
    '3. If a HARD disqualifier is present (wrong state, a hard time-in-business gate, an excluded industry), ' +
    'say so plainly and recommend they not spend time here — do not pretend.\n' +
    '4. Ask ONE focused opening question.\n\n' +
    'Warm, plain language, no jargon. Respond with ONLY valid JSON, no markdown:\n' +
    '{\n' +
    '  "opening": "your 4–8 sentence opening, ending with one clear question",\n' +
    '  "focusPoints": ["short label for each thing you want to dig into"],\n' +
    '  "hardBlocker": "one sentence naming a disqualifier, or null"\n' +
    '}'
  );
}

function turnPrompt(model) {
  return (
    `${PERSONAS[model] || PERSONAS.cdfi_term_loan}\n\n` +
    'Continue the review. You just heard the owner\'s answer to your last question. In order:\n' +
    '1. React like a real reviewer would — acknowledge what helps, name what still concerns you, briefly.\n' +
    "2. Capture their answer in THEIR voice, cleaned up into 1–3 sentences they could paste straight into " +
    'the real application. This goes in "capturedAnswer".\n' +
    '3. Either ask the next focused question, OR — if you have covered the main friction points (usually ' +
    'after 4–6 exchanges) — set "readyToClose": true and give your honest closing read in "verdict".\n\n' +
    'Never promise approval. Never invent an eligibility rule. If their answer reveals a hard disqualifier, ' +
    'say so and close.\n\n' +
    'Respond with ONLY valid JSON, no markdown:\n' +
    '{\n' +
    '  "message": "your reaction + next question (or your closing remark if readyToClose)",\n' +
    '  "capturedAnswer": { "question": "the question they just answered", "answer": "their answer, cleaned into their voice" } | null,\n' +
    '  "readyToClose": boolean,\n' +
    '  "verdict": {\n' +
    '    "timing": "now" | "soon" | "later",\n' +
    '    "strengths": ["what is genuinely strong in this file for you"],\n' +
    '    "gaps": ["what is still thin or missing"],\n' +
    '    "recommendation": "2–4 sentences: apply now / strengthen these things first / start with a different lender, and why"\n' +
    '  } | null\n' +
    '}'
  );
}

function parseJson(result) {
  try {
    return JSON.parse(result.data.choices?.[0]?.message?.content ?? '{}');
  } catch {
    return null;
  }
}

function coerceVerdict(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const timing = ['now', 'soon', 'later'].includes(raw.timing) ? raw.timing : 'soon';
  const strengths = Array.isArray(raw.strengths) ? raw.strengths.map(coerceString).filter(Boolean).slice(0, 5) : [];
  const gaps = Array.isArray(raw.gaps) ? raw.gaps.map(coerceString).filter(Boolean).slice(0, 5) : [];
  const recommendation = coerceString(raw.recommendation) || '';
  if (!recommendation && strengths.length === 0 && gaps.length === 0) return null;
  return { timing, strengths, gaps, recommendation };
}

export async function startReview(ctx) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { ok: false, reason: 'no GROQ_API_KEY configured' };

  const model = ctx.profile?.model || 'cdfi_term_loan';
  const result = await callGroqChat({
    apiKey,
    model: MODEL,
    messages: [
      { role: 'system', content: startPrompt(model) },
      { role: 'user', content: fileContext(ctx) },
    ],
    temperature: 0.5,
    response_format: { type: 'json_object' },
  });

  if (!result.ok) {
    console.error(`[underwriter-sim] start failed (${result.status ?? 'network'}): ${result.error}`);
    return { ok: false, reason: result.status === 429 ? 'the AI service is rate-limited right now' : 'the review could not start' };
  }
  const raw = parseJson(result);
  if (!raw?.opening) return { ok: false, reason: 'the review response was malformed' };

  return {
    ok: true,
    opening: coerceString(raw.opening),
    focusPoints: Array.isArray(raw.focusPoints) ? raw.focusPoints.map(coerceString).filter(Boolean).slice(0, 4) : [],
    hardBlocker: coerceString(raw.hardBlocker) || null,
  };
}

// history: [{ role: 'underwriter' | 'owner', content }] in order.
export async function continueReview(ctx) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { ok: false, reason: 'no GROQ_API_KEY configured' };

  const model = ctx.profile?.model || 'cdfi_term_loan';
  const transcript = (ctx.history || [])
    .map((m) => ({ role: m.role === 'owner' ? 'user' : 'assistant', content: m.content }));

  const result = await callGroqChat({
    apiKey,
    model: MODEL,
    messages: [
      { role: 'system', content: turnPrompt(model) },
      { role: 'user', content: fileContext(ctx) },
      ...transcript,
      { role: 'user', content: ctx.userMessage },
    ],
    temperature: 0.45,
    response_format: { type: 'json_object' },
  });

  if (!result.ok) {
    console.error(`[underwriter-sim] turn failed (${result.status ?? 'network'}): ${result.error}`);
    return { ok: false, reason: result.status === 429 ? 'the AI service is rate-limited right now' : 'the review turn failed' };
  }
  const raw = parseJson(result);
  if (!raw?.message) return { ok: false, reason: 'the review response was malformed' };

  const captured =
    raw.capturedAnswer && coerceString(raw.capturedAnswer.question) && coerceString(raw.capturedAnswer.answer)
      ? { question: coerceString(raw.capturedAnswer.question), answer: coerceString(raw.capturedAnswer.answer) }
      : null;

  const readyToClose = raw.readyToClose === true;
  return {
    ok: true,
    message: coerceString(raw.message),
    capturedAnswer: captured,
    readyToClose,
    verdict: readyToClose ? coerceVerdict(raw.verdict) : null,
  };
}
