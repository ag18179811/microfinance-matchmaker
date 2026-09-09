import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFundingPlan } from './funding-plan.js';

const profileFor = (m) => ({
  model: m.funding_type === 'grant' ? 'grant' : m._model || 'cdfi_term_loan',
  timeline: 'about 30 days',
  applyUrl: 'https://example.org',
});

test('stacks multiple programs toward the ask, in accessibility order', () => {
  const plan = computeFundingPlan({
    application: { requested_amount: 40000 },
    profileFor,
    matches: [
      { id: 1, name: 'Slow Referral Net', funding_type: 'loan', match_score: 90, min_loan: 5000, max_loan: 50000, provenance: 'verified', _model: 'referral_network' },
      { id: 2, name: 'Kiva', funding_type: 'loan', match_score: 80, min_loan: 0, max_loan: 15000, provenance: 'verified', _model: 'crowdfunding' },
      { id: 3, name: 'CDFI Term', funding_type: 'loan', match_score: 85, min_loan: 5000, max_loan: 25000, provenance: 'verified', _model: 'cdfi_term_loan' },
    ],
  });
  // Kiva (crowdfunding) is most accessible -> comes first in the stack
  assert.equal(plan.stack[0].name, 'Kiva');
  // Kiva caps at 15k, CDFI covers the next 25k -> 40k total, no gap
  assert.equal(plan.coveredByLoans, 40000);
  assert.equal(plan.gap, 0);
});

test('names the gap when the programs cannot cover the ask', () => {
  const plan = computeFundingPlan({
    application: { requested_amount: 60000 },
    profileFor,
    matches: [{ id: 1, name: 'Small Fund', funding_type: 'loan', match_score: 90, min_loan: 1000, max_loan: 15000, provenance: 'verified' }],
  });
  assert.equal(plan.coveredByLoans, 15000);
  assert.equal(plan.gap, 45000);
});

test('grants are listed as speculative and do not close the gap', () => {
  const plan = computeFundingPlan({
    application: { requested_amount: 20000 },
    profileFor,
    matches: [
      { id: 9, name: 'City Grant', funding_type: 'grant', match_score: 75, min_loan: 0, max_loan: 10000, provenance: 'discovered' },
      { id: 1, name: 'Micro Loan', funding_type: 'loan', match_score: 88, min_loan: 500, max_loan: 12000, provenance: 'verified' },
    ],
  });
  const grant = plan.stack.find((p) => p.name === 'City Grant');
  assert.ok(grant.speculative);
  // gap is computed from loans only: 20k - 12k = 8k
  assert.equal(plan.gap, 8000);
});

test('very weak matches (score < 45) are excluded from the stack', () => {
  const plan = computeFundingPlan({
    application: { requested_amount: 10000 },
    profileFor,
    matches: [
      { id: 1, name: 'Weak', funding_type: 'loan', match_score: 30, min_loan: 1000, max_loan: 20000, provenance: 'verified' },
      { id: 2, name: 'Strong', funding_type: 'loan', match_score: 85, min_loan: 1000, max_loan: 20000, provenance: 'verified' },
    ],
  });
  assert.deepEqual(plan.stack.map((p) => p.name), ['Strong']);
});
