import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeInterviewProgress } from './interview-progress.js';

test('done always reports 100 regardless of how little was gathered', () => {
  const p = computeInterviewProgress({ fields: {}, notes: [], turnCount: 2, done: true });
  assert.equal(p.percent, 100);
  assert.equal(p.phase, 'Building your matches');
});

test('never reports 0 or 100 while the interview is still going', () => {
  const early = computeInterviewProgress({ fields: {}, notes: [], turnCount: 0, done: false });
  assert.ok(early.percent >= 1 && early.percent < 100);

  const saturated = computeInterviewProgress({
    fields: {
      business_name: 'x', industry: 'Retail', city: 'x', state: 'TX',
      time_in_business_months: 24, annual_revenue: 200000, requested_amount: 40000,
      existing_monthly_debt_payment: 0, business_structure: 'llc', employee_count: 4,
      has_tax_returns: 'yes_2yr', cash_flow_pattern: 'steady', credit_band: '680_720',
      prior_funding_history: 'none', use_of_funds_detail: 'equipment',
    },
    notes: Array.from({ length: 20 }, (_, i) => ({ topic: `t${i}`, detail: `d${i}` })),
    turnCount: 30,
    done: false,
  });
  assert.ok(saturated.percent < 100, 'stays below 100 until done is true');
});

test('progress only ever moves forward as fields, notes, and turns accumulate', () => {
  const steps = [
    { fields: {}, notes: [], turnCount: 1 },
    { fields: { business_name: 'x', industry: 'Retail' }, notes: [], turnCount: 2 },
    { fields: { business_name: 'x', industry: 'Retail', city: 'Austin', state: 'TX' }, notes: [{ topic: 'a', detail: 'b' }], turnCount: 4 },
    {
      fields: { business_name: 'x', industry: 'Retail', city: 'Austin', state: 'TX', time_in_business_months: 18, annual_revenue: 90000, requested_amount: 25000 },
      notes: [{ topic: 'a', detail: 'b' }, { topic: 'c', detail: 'd' }],
      turnCount: 7,
    },
    {
      fields: { business_name: 'x', industry: 'Retail', city: 'Austin', state: 'TX', time_in_business_months: 18, annual_revenue: 90000, requested_amount: 25000, business_structure: 'llc', credit_band: 'not_sure' },
      notes: [{ topic: 'a', detail: 'b' }, { topic: 'c', detail: 'd' }, { topic: 'e', detail: 'f' }],
      turnCount: 10,
    },
  ];

  let last = 0;
  for (const step of steps) {
    const { percent } = computeInterviewProgress({ ...step, done: false });
    assert.ok(percent >= last, `expected ${percent} >= ${last}`);
    last = percent;
  }
});

test('an all-blank vs a well-populated profile at the same turn differ in the bar', () => {
  const blank = computeInterviewProgress({ fields: {}, notes: [], turnCount: 5, done: false });
  const populated = computeInterviewProgress({
    fields: { business_name: 'x', industry: 'Retail', city: 'Austin', state: 'TX', time_in_business_months: 18, annual_revenue: 90000, requested_amount: 25000 },
    notes: [{ topic: 'a', detail: 'b' }, { topic: 'c', detail: 'd' }],
    turnCount: 5,
    done: false,
  });
  assert.ok(populated.percent > blank.percent);
});

test('phase label tracks the percentage band', () => {
  assert.equal(computeInterviewProgress({ turnCount: 0 }).phase, 'Getting the basics');
  assert.equal(
    computeInterviewProgress({
      fields: {
        business_name: 'x', industry: 'Retail', city: 'x', state: 'TX',
        time_in_business_months: 24, annual_revenue: 200000, requested_amount: 40000,
        existing_monthly_debt_payment: 0, business_structure: 'llc', employee_count: 4,
        has_tax_returns: 'yes_2yr', cash_flow_pattern: 'steady', credit_band: '680_720',
        prior_funding_history: 'none', use_of_funds_detail: 'equipment',
      },
      notes: Array.from({ length: 12 }, (_, i) => ({ topic: `t${i}`, detail: `d${i}` })),
      turnCount: 13,
    }).phase,
    'Almost ready to match'
  );
});
