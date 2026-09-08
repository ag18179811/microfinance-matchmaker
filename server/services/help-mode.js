// Adaptive follow-through: different owners need opposite things after the
// match. A confident operator with messy books wants fast organization; a
// terrified first-timer needs demystification and "your situation is
// normal"; someone who isn't fundable yet needs a plan and a reason to come
// back; someone who's been rejected needs a post-mortem and a new angle.
//
// The mode is derived deterministically from the application and sub-scores
// (no extra AI call), then used to shape the tone of the coaching summary,
// the business case, and the improvement plan, and to set a banner on the
// results page.

const MODES = {
  organizer: {
    headline: "You've got a strong file — let's get it organized fast",
    blurb:
      "Your fundamentals are solid. The work now is packaging what you already have the way each lender wants to see it. We'll keep this brisk.",
  },
  demystifier: {
    headline: "New to this? We'll walk every step with you",
    blurb:
      "Applying for business funding for the first time is genuinely confusing, and your situation is more normal than it feels. We'll explain each term and each step as it comes up.",
  },
  rebuilder: {
    headline: "Let's get you fundable first",
    blurb:
      "You're early, and a rushed application now would likely be a 'no' that's harder to come back from. Here's a focused plan to strengthen your file — come back and re-run this when you've worked through it.",
  },
  strategist: {
    headline: "Been turned down before? Let's change the approach",
    blurb:
      "A past 'no' isn't the end of the story — it usually means the file needs to be framed differently, or aimed at a different kind of lender. We'll start from what went wrong last time.",
  },
};

const DENIAL_RE = /\b(denied|denial|declin\w*|rejected|turned (us )?down|didn'?t (get|qualify)|not approved|fell through|got a no|wasn'?t approved)\b/i;

export function classifyHelpMode(application, subScores = {}, readinessScore = 50) {
  const months = Number(application.time_in_business_months) || 0;
  const priorFunding = String(application.prior_funding_history || '');
  const completeness = subScores.completeness ?? 50;
  const answerQuality = subScores.answerQuality ?? 50;

  // Been rejected before — this reframing need outranks everything else.
  if (DENIAL_RE.test(priorFunding)) return { mode: 'strategist', ...MODES.strategist };

  // Not fundable yet — a plan beats an application.
  if (readinessScore < 45 || months < 6) return { mode: 'rebuilder', ...MODES.rebuilder };

  // Strong, complete, credible file — move fast.
  if (readinessScore >= 68 && completeness >= 65 && answerQuality >= 60) {
    return { mode: 'organizer', ...MODES.organizer };
  }

  // Everything in between: someone who can get there but needs the hand-holding.
  return { mode: 'demystifier', ...MODES.demystifier };
}

export function helpModeInfo(mode) {
  return MODES[mode] ? { mode, ...MODES[mode] } : null;
}

// Appended to an AI system prompt to tune tone. Empty for the neutral case.
export function helpModeDirective(mode) {
  switch (mode) {
    case 'organizer':
      return '\n\nTONE: This owner is experienced and confident — be brisk and direct, skip the hand-holding, respect that they know their business.';
    case 'demystifier':
      return '\n\nTONE: This owner is new to business funding and may be anxious — define any term you use, reassure that their situation is normal, and go one step at a time. Never condescend.';
    case 'rebuilder':
      return "\n\nTONE: This owner isn't fundable yet. Be honest and kind about that, focus on what to build rather than where to apply, and be encouraging about the path forward.";
    case 'strategist':
      return '\n\nTONE: This owner has been turned down before. Acknowledge that directly, treat it as information rather than failure, and focus on what to do differently.';
    default:
      return '';
  }
}
