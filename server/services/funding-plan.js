// The funding plan: how to actually get to the amount the owner needs,
// given that no single program may cover it: a capital stack (which
// programs, roughly how much from each) plus a sensible order to pursue
// them in. Deterministic allocation and ordering; one grounded AI call
// writes the rationale. Never invents a program or an amount outside a
// program's stated range.

import { callGroqChat } from './groq-client.js';
import { coerceString } from './field-coercion.js';
import { languageDirective } from './language.js';

const MODEL = 'openai/gpt-oss-120b';

// Lower = pursue earlier. Grants are non-blocking (long cycles, apply in
// parallel with everything); fast credit-blind money comes first among the
// things you actively work; referral networks and slow CDFI processes last.
function accessibilityRank(model, fundingType) {
  if (fundingType === 'grant') return 0;
  return (
    {
      crowdfunding: 1,
      group_lending: 2,
      cdfi_term_loan: 3,
      sba_intermediary: 4,
      referral_network: 5,
    }[model] ?? 3
  );
}

function money(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString()}`;
}

// matches: from loadResults (name, match_score, funding_type, min_loan,
//          max_loan, provenance, id, source_url, reasons, cautions)
// profileFor: (match) => the application profile (deriveProfile result)
// verdicts: { [lenderKey]: { timing, recommendation } } from any reviews
export function computeFundingPlan({ application, matches, profileFor, verdicts = {} }) {
  const need = Number(application.requested_amount) || 0;
  const ranked = matches
    .map((m) => {
      const profile = profileFor(m);
      const key = `${m.provenance || 'verified'}:${m.id}`;
      const max = Number(m.max_loan) || 0;
      const min = Number(m.min_loan) || 0;
      return {
        key,
        name: m.name,
        fundingType: m.funding_type || 'loan',
        model: profile.model,
        matchScore: m.match_score,
        min,
        max: Number.isFinite(max) && max > 0 ? max : null,
        timeline: profile.timeline || null,
        applyUrl: profile.applyUrl || m.source_url || null,
        verdictTiming: verdicts[key]?.timing || null,
        rank: accessibilityRank(profile.model, m.funding_type),
      };
    })
    // strongest matches first within each accessibility tier; drop very weak fits
    .filter((p) => p.matchScore >= 45)
    .sort((a, b) => a.rank - b.rank || b.matchScore - a.matchScore);

  // Greedy allocation toward the need. Grants are sized at their award
  // ceiling but flagged "if awarded" and don't reduce the "still need" gap
  // (they're a bonus, not a plan you can count on).
  let covered = 0;
  const stack = [];
  for (const p of ranked) {
    if (p.fundingType !== 'grant' && covered >= need) break;
    if (p.fundingType === 'grant') {
      // Only state a grant amount when the program publishes an award
      // ceiling. Otherwise it's "amount varies".
      stack.push({ ...p, amount: p.max ? Math.min(p.max, need) : null, speculative: true });
      continue;
    }
    const cap = p.max || (need - covered) || need;
    const amount = Math.max(0, Math.min(cap, need - covered));
    if (amount < (p.min || 0) && p.min > 0) {
      // ask is below this program's floor, still worth listing as a full
      // alternative rather than a partial slice
      stack.push({ ...p, amount: Math.min(p.max || need, need), note: `below this program's ${money(p.min)} minimum for a partial slice, would need to be most of your ask` });
      covered = need;
      continue;
    }
    stack.push({ ...p, amount });
    covered += amount;
  }

  const nonGrantCovered = covered;
  const gap = Math.max(0, need - nonGrantCovered);

  return {
    need,
    stack: stack.slice(0, 5),
    coveredByLoans: nonGrantCovered,
    gap,
    order: [...stack]
      .slice(0, 5)
      .sort((a, b) => {
        // grants + fast money in parallel first, then by verdict timing, then rank
        const t = { now: 0, soon: 1, later: 2 };
        return (
          a.rank - b.rank ||
          (t[a.verdictTiming] ?? 1) - (t[b.verdictTiming] ?? 1) ||
          b.matchScore - a.matchScore
        );
      })
      .map((p) => p.name),
  };
}

// Wraps the deterministic plan with a written rationale. Falls back to the
// bare plan if the AI call isn't available.
export async function narrateFundingPlan(plan, { application, additionalNotes, language = 'en' }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || plan.stack.length === 0) return { ...plan, rationale: null };

  const payload = JSON.stringify({
    amountNeeded: plan.need,
    business: { industry: application.industry, state: application.state, use_of_funds_detail: application.use_of_funds_detail },
    specificFacts: additionalNotes || [],
    proposedStack: plan.stack.map((p) => ({
      name: p.name,
      type: p.fundingType,
      model: p.model,
      amount: p.amount,
      speculative: !!p.speculative,
      note: p.note || null,
      timeline: p.timeline,
      reviewerTiming: p.verdictTiming,
    })),
    stillNeededFromOwnerOrElsewhere: plan.gap,
    suggestedOrder: plan.order,
  });

  const result = await callGroqChat({
    apiKey,
    model: MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are advising a small business owner on how to actually raise the funding they need when no ' +
          'single program covers it. You are given a proposed capital stack and order (already computed, do ' +
          'not change the programs or the amounts). Write 2 short paragraphs of plain, direct rationale:\n' +
          '1. Why this combination: what each piece does, why grants are a bonus not a plan, and where the ' +
          'remaining gap (if any) realistically comes from.\n' +
          '2. Why this order: what to start now and in parallel, what to hold and why, and a realistic sense ' +
          'of the total timeline.\n' +
          'Never invent a program, an amount, or an eligibility rule. Be encouraging but honest about the ' +
          'gap and the timeline.' +
          languageDirective(language),
      },
      { role: 'user', content: payload },
    ],
    temperature: 0.4,
  });

  if (!result.ok) return { ...plan, rationale: null };
  return { ...plan, rationale: coerceString(result.data.choices?.[0]?.message?.content) };
}
