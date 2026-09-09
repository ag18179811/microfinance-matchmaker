import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedProjection, recalcProjection } from './cashflow-projection.js';

test('seeds 12 months and the year roughly sums to annual revenue', () => {
  const p = seedProjection({ annual_revenue: 120000, requested_amount: 30000, cash_flow_pattern: 'steady' });
  assert.equal(p.months.length, 12);
  const total = p.months.reduce((a, m) => a + m.revenue, 0);
  assert.ok(Math.abs(total - 120000) < 120000 * 0.05, `year total ${total} within 5% of 120000`);
});

test('the estimated loan payment is positive and applied from month 2', () => {
  const p = seedProjection({ annual_revenue: 90000, requested_amount: 25000, cash_flow_pattern: 'steady' });
  assert.ok(p.estimatedLoanPayment > 0);
  assert.equal(p.months[0].loanPayment, 0);
  assert.equal(p.months[1].loanPayment, p.estimatedLoanPayment);
});

test('a seasonal pattern is not flat but still sums to about the annual figure', () => {
  const p = seedProjection({ annual_revenue: 120000, requested_amount: 0, cash_flow_pattern: 'seasonal' });
  const revs = p.months.map((m) => m.revenue);
  assert.ok(Math.max(...revs) - Math.min(...revs) > 1000, 'seasonal months vary');
  const total = revs.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 120000) < 120000 * 0.08);
});

test('recalcProjection recomputes net and ending cash from edited inputs', () => {
  const months = Array.from({ length: 12 }, (_, i) => ({ label: `M${i}`, revenue: 10000, expenses: 6000, loanPayment: 500 }));
  const out = recalcProjection(5000, months);
  assert.equal(out[0].net, 3500);
  assert.equal(out[0].endingCash, 8500);
  assert.equal(out[11].endingCash, 5000 + 3500 * 12);
});

test('recalcProjection tolerates junk input without throwing', () => {
  const out = recalcProjection('abc', [{ revenue: 'x', expenses: null }, {}]);
  assert.equal(out.length, 2);
  assert.equal(out[0].revenue, 0);
});
