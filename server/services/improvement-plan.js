// "How to raise your score" — a prioritized, concrete plan for the levers
// that are actually dragging this application down. The impact numbers are
// REAL: each item re-runs the deterministic readiness engine
// (matching-engine.js) with that one improvement applied, so "would move
// you from 61 to 74" is computed, not guessed. An optional AI pass then
// rewrites each step to reference something specific about this business;
// if it's unavailable the deterministic steps stand on their own.

import { computeReadiness } from './matching-engine.js';
import { callGroqChat } from './groq-client.js';
import { coerceString } from './field-coercion.js';

const MODEL = 'openai/gpt-oss-120b';

function money(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString()}`;
}

function tierLabel(months) {
  if (months <= 6) return '6 months';
  if (months <= 12) return '1 year';
  if (months <= 24) return '2 years';
  return '5 years';
}

// The deterministic core. Returns { readinessScore, items: [...] } where each
// item has a real projectedReadiness (or null when the lever can't be
// cleanly projected, e.g. answer quality).
export function computeImprovementPlan(application, subScores, readinessScore, qualityConcerns = []) {
  const held = { qualityScore: subScores?.answerQuality };
  const project = (patch) => computeReadiness({ ...application, ...patch }, held).readinessScore;
  const items = [];

  const revenue = Number(application.annual_revenue) || 0;
  const requested = Number(application.requested_amount) || 0;
  const months = Number(application.time_in_business_months) || 0;

  // Lever: loan-to-revenue ratio
  if ((subScores?.requestToRevenueRatio ?? 100) < 65 && revenue > 0 && requested > 0) {
    const target = Math.max(500, Math.round((revenue * 0.25) / 500) * 500);
    if (target < requested) {
      items.push({
        key: 'requestToRevenueRatio',
        title: 'Ask for less, relative to your revenue',
        current: subScores.requestToRevenueRatio,
        detail: `You're asking ${money(requested)} against ${money(revenue)} in revenue. Lenders read that ratio closely — above about half your revenue, it starts working against you.`,
        action: `Bringing the request to about ${money(target)} — roughly a quarter of your revenue — lands in a range most lenders are comfortable with. If you genuinely need more, split it: apply to two programs for part each.`,
        projectedReadiness: project({ requested_amount: target }),
        timeframe: 'Right now',
      });
    }
  }

  // Lever: time in business
  if ((subScores?.timeInBusiness ?? 100) < 80) {
    const nextTier = months < 6 ? 6 : months < 12 ? 12 : months < 24 ? 24 : 60;
    if (nextTier > months) {
      const gap = nextTier - months;
      items.push({
        key: 'timeInBusiness',
        title: `Get past ${tierLabel(nextTier)} in business`,
        current: subScores.timeInBusiness,
        detail: `You're at ${months} month${months === 1 ? '' : 's'}. The next threshold lenders look for is ${nextTier} months.`,
        action: `That's ${gap} month${gap === 1 ? '' : 's'} away. In the meantime, if you operated earlier in any form — a pop-up, a side operation, a registered DBA, freelance work in the same trade — document it with dates; several lenders will count that toward your history.`,
        projectedReadiness: project({ time_in_business_months: nextTier }),
        timeframe: `${gap} month${gap === 1 ? '' : 's'}`,
      });
    }
  }

  // Lever: revenue band
  if ((subScores?.revenueStability ?? 100) < 80 && revenue > 0) {
    const nextTier = revenue < 25000 ? 25000 : revenue < 75000 ? 75000 : revenue < 200000 ? 200000 : revenue;
    if (nextTier > revenue) {
      const perMonth = Math.round((nextTier - revenue) / 12);
      items.push({
        key: 'revenueStability',
        title: `Grow annual revenue past ${money(nextTier)}`,
        current: subScores.revenueStability,
        detail: `At ${money(revenue)} a year you're in a lower band. Crossing ${money(nextTier)} moves you up a tier in how lenders read repayment ability.`,
        action: `That's about ${money(perMonth)} more per month. If a recent stretch is already stronger than your trailing 12 months, you don't have to wait — apply with a year-to-date figure and a short note explaining the trend.`,
        projectedReadiness: project({ annual_revenue: nextTier }),
        timeframe: 'Ongoing',
      });
    }
  }

  // Lever: profile completeness
  if ((subScores?.completeness ?? 100) < 75) {
    const CHECK = [
      ['time_in_business_months', 'how long you\'ve been operating'],
      ['annual_revenue', 'your approximate annual revenue'],
      ['existing_monthly_debt_payment', 'what you pay monthly toward existing debt'],
      ['business_structure', 'your legal structure'],
      ['has_tax_returns', 'whether you have business tax returns ready'],
      ['cash_flow_pattern', 'your revenue pattern (steady / seasonal / growing)'],
      ['credit_band', 'your rough credit range'],
      ['use_of_funds_detail', 'a specific breakdown of what the funding is for'],
    ];
    const missing = CHECK.filter(([k]) => {
      const v = application[k];
      return v === null || v === undefined || String(v).trim() === '';
    }).map(([, label]) => label);
    if (missing.length > 0) {
      items.push({
        key: 'completeness',
        title: 'Fill in the gaps in your profile',
        current: subScores.completeness,
        detail: `The more of your picture a lender can confirm, the more confident the match. A few things are still blank.`,
        action: `Go back to the chat and cover: ${missing.slice(0, 4).join('; ')}${missing.length > 4 ? '; and a couple more' : ''}.`,
        projectedReadiness: null,
        timeframe: 'A few minutes',
      });
    }
  }

  // Lever: answer credibility
  if ((subScores?.answerQuality ?? 100) < 60 && qualityConcerns.length > 0) {
    items.push({
      key: 'answerQuality',
      title: 'Firm up a few answers',
      current: subScores.answerQuality,
      detail: `Some answers read as thin, vague, or inconsistent, which caps how much a lender can rely on this profile no matter how strong the business is.`,
      action: `Specifically: ${qualityConcerns.slice(0, 3).join('; ')}. Come back to the chat and add concrete detail — real numbers, specifics, dates.`,
      projectedReadiness: null,
      timeframe: 'A few minutes',
    });
  }

  // Highest projected gain first; unprojectable items (still important) after.
  items.sort((a, b) => {
    const ga = a.projectedReadiness == null ? -1 : a.projectedReadiness - readinessScore;
    const gb = b.projectedReadiness == null ? -1 : b.projectedReadiness - readinessScore;
    return gb - ga;
  });

  return { readinessScore, items };
}

// Optional: rewrite each `action` to reference something specific about
// this business. Returns the plan unchanged if the AI call isn't available.
export async function personalizeImprovementPlan(plan, application, additionalNotes) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || plan.items.length === 0) return plan;

  const payload = JSON.stringify({
    business: { ...application, additional_notes: undefined, user_id: undefined },
    specificFacts: additionalNotes || [],
    steps: plan.items.map((it) => ({ key: it.key, title: it.title, action: it.action })),
  });

  const result = await callGroqChat({
    apiKey,
    model: MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are refining a funding-readiness action plan. For each step, keep the same advice and the same ' +
          'numbers, but rewrite the "action" text so it references something concrete and specific about THIS ' +
          "business (its industry, its situation, a fact from specificFacts). Never invent a fact or change a " +
          'dollar figure or timeframe. Keep each action to 1–3 sentences, plain and direct. Respond with ONLY ' +
          'JSON: { "steps": [ { "key": "...", "action": "rewritten text" } ] }',
      },
      { role: 'user', content: payload },
    ],
    temperature: 0.4,
    response_format: { type: 'json_object' },
  });

  if (!result.ok) return plan;
  try {
    const raw = JSON.parse(result.data.choices?.[0]?.message?.content ?? '{}');
    const byKey = new Map((raw.steps || []).map((s) => [s.key, coerceString(s.action)]));
    return {
      ...plan,
      items: plan.items.map((it) => (byKey.get(it.key) ? { ...it, action: byKey.get(it.key) } : it)),
    };
  } catch {
    return plan;
  }
}
