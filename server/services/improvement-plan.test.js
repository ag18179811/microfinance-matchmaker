import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeImprovementPlan } from './improvement-plan.js';

const weakApp = {
  time_in_business_months: 8,
  annual_revenue: 40000,
  requested_amount: 35000,
  existing_monthly_debt_payment: 0,
  business_structure: 'llc',
};
const weakSub = { timeInBusiness: 40, revenueStability: 40, requestToRevenueRatio: 15, completeness: 55, answerQuality: 50 };

test('a weak application gets prioritized levers with real projected gains', () => {
  const plan = computeImprovementPlan(weakApp, weakSub, 42, []);
  assert.ok(plan.items.length >= 2);
  // The loan-to-revenue lever should project a higher score than the baseline.
  const ratio = plan.items.find((i) => i.key === 'requestToRevenueRatio');
  assert.ok(ratio, 'loan-to-revenue lever present');
  assert.ok(ratio.projectedReadiness > 42, 'asking for less genuinely raises the computed score');
});

test('items are ordered by projected gain, unprojectable ones last', () => {
  const plan = computeImprovementPlan(weakApp, weakSub, 42, ['One answer was vague']);
  const gains = plan.items.map((i) => (i.projectedReadiness == null ? -1 : i.projectedReadiness - 42));
  const sorted = [...gains].sort((a, b) => b - a);
  assert.deepEqual(gains, sorted);
});

test('a strong application produces few or no levers', () => {
  const strongApp = { time_in_business_months: 60, annual_revenue: 300000, requested_amount: 20000, existing_monthly_debt_payment: 0 };
  const strongSub = { timeInBusiness: 100, revenueStability: 100, requestToRevenueRatio: 100, completeness: 90, answerQuality: 90 };
  const plan = computeImprovementPlan(strongApp, strongSub, 92, []);
  assert.equal(plan.items.length, 0);
});

test('answer-quality concerns become a step only when concerns exist', () => {
  const withConcerns = computeImprovementPlan(weakApp, { ...weakSub, answerQuality: 40 }, 42, ['Revenue figure conflicts with the bank statements']);
  assert.ok(withConcerns.items.some((i) => i.key === 'answerQuality'));

  const noConcerns = computeImprovementPlan(weakApp, { ...weakSub, answerQuality: 40 }, 42, []);
  assert.ok(!noConcerns.items.some((i) => i.key === 'answerQuality'));
});
