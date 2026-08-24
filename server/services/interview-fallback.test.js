import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextFallbackTurn, coerceFallbackAnswer } from './interview-fallback.js';

test('nextFallbackTurn walks core fields first, then deep fields, skipping anything already filled', () => {
  const turn = nextFallbackTurn({ business_name: 'Joe\'s', industry: 'Retail' });
  assert.equal(turn.fieldKey, 'city');
});

test('nextFallbackTurn reports done once every core and deep field has been asked about', () => {
  const allFilled = {
    business_name: 'x', industry: 'Retail', city: 'x', state: 'TX',
    time_in_business_months: 12, annual_revenue: 1000, requested_amount: 500,
    existing_monthly_debt_payment: 0, business_structure: 'llc', employee_count: 1,
    has_tax_returns: 'no', cash_flow_pattern: 'steady', credit_band: 'not_sure',
    prior_funding_history: 'none', use_of_funds_detail: 'equipment',
    ownership_demographics: '', // resolved-but-declined, not blank
  };
  assert.equal(nextFallbackTurn(allFilled).done, true);
});

test('coerceFallbackAnswer validates a select field case-insensitively', () => {
  assert.deepEqual(coerceFallbackAnswer('business_structure', 'LLC'), { ok: true, value: 'llc' });
  assert.deepEqual(coerceFallbackAnswer('business_structure', 'nonsense'), { ok: false });
});

test('coerceFallbackAnswer parses a number field and rejects unparseable text', () => {
  assert.deepEqual(coerceFallbackAnswer('employee_count', '4'), { ok: true, value: 4 });
  assert.deepEqual(coerceFallbackAnswer('employee_count', 'a few'), { ok: false });
});

test('coerceFallbackAnswer accepts state as either an abbreviation or full name', () => {
  assert.deepEqual(coerceFallbackAnswer('state', 'Texas'), { ok: true, value: 'TX' });
  assert.deepEqual(coerceFallbackAnswer('state', 'tx'), { ok: true, value: 'TX' });
});

// Regression: declining the optional ownership_demographics question must be
// remembered as resolved, not treated as still-blank — otherwise
// nextFallbackTurn re-asks it forever since a genuine skip and "never asked"
// were previously both represented as null.
test('an optional field, once explicitly skipped, is never asked again', () => {
  const skip = coerceFallbackAnswer('ownership_demographics', 'skip');
  assert.equal(skip.ok, true);
  assert.equal(skip.value, ''); // the resolved-but-declined sentinel, distinct from null/undefined

  const fieldsAfterSkip = { ownership_demographics: skip.value };
  const next = nextFallbackTurn(fieldsAfterSkip);
  assert.notEqual(next.fieldKey, 'ownership_demographics');
});

test('an optional field that has never been touched is still asked', () => {
  const turn = nextFallbackTurn({ prior_funding_history: 'none' }); // ownership_demographics untouched
  assert.equal(turn.fieldKey, 'business_name'); // walks from the top, but confirms it's not treated as done
  assert.equal(nextFallbackTurn({}).done, false);
});
