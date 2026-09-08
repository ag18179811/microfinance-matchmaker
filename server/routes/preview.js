// A no-account readiness estimate. Deterministic only — no LLM call, no
// persistence, no lender list — so it has no cost or abuse surface beyond
// the rate limiter, and can't be mistaken for the real report. Its only
// job is to give someone enough of a taste to be worth signing in.

import { Router } from 'express';
import pool from '../db/connection.js';
import { computeReadiness, scoreLenderMatch } from '../services/matching-engine.js';
import { normalizeState, INDUSTRIES } from '../constants.js';

const router = Router();

const FACTOR_LABELS = {
  timeInBusiness: 'time in business',
  revenueStability: 'revenue',
  requestToRevenueRatio: 'how much you\'re asking for relative to revenue',
  completeness: 'profile completeness',
  answerQuality: 'answer credibility',
};

router.post('/', async (req, res) => {
  const b = req.body || {};
  const state = normalizeState(b.state);
  const months = Number(b.time_in_business_months);
  const revenue = Number(b.annual_revenue);
  const requested = Number(b.requested_amount);

  if (!state) return res.status(400).json({ error: 'A US state is required.' });
  if (![months, revenue, requested].every((n) => Number.isFinite(n) && n >= 0)) {
    return res.status(400).json({ error: 'Time in business, revenue, and amount needed must all be numbers.' });
  }

  const industry = INDUSTRIES.includes(b.industry) ? b.industry : null;
  const application = {
    state,
    industry,
    time_in_business_months: Math.round(months),
    annual_revenue: Math.round(revenue),
    requested_amount: Math.round(requested),
    // enough of the profile "filled" that completeness isn't punitively low
    // for a preview that only asks four questions
    business_name: 'preview',
    city: 'preview',
    purpose: 'preview',
  };

  // Neutral answer-quality (there are no typed answers to judge yet).
  const { readinessScore, subScores } = computeReadiness(application, { qualityScore: 60 });

  // A rough count of static programs this profile could match — no live
  // discovery, no persistence.
  let eligibleCount = 0;
  try {
    const { rows } = await pool.query('SELECT * FROM lenders');
    eligibleCount = rows.filter((l) => scoreLenderMatch(l, application) !== null).length;
  } catch {
    eligibleCount = 0;
  }

  const weakest = Object.entries(subScores)
    .filter(([k]) => k !== 'answerQuality' && k !== 'completeness')
    .sort((a, b) => a[1] - b[1])[0];

  res.json({
    readinessScore,
    subScores,
    eligibleCount,
    weakestFactor: weakest ? FACTOR_LABELS[weakest[0]] : null,
    note: 'This is a quick estimate from four numbers. The full report runs an adaptive interview, scores answer credibility, searches for live programs, and builds your funding story.',
  });
});

export default router;
