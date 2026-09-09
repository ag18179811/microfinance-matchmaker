import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kindsForProfile, coverageFor } from './document-kinds.js';

const accionLike = {
  verified: true,
  need: [
    { item: 'Up to 3 months of business bank statements' },
    { item: 'Government-issued ID or ITIN' },
    { item: 'Business registration documents and any licenses' },
    { item: 'A voided check from your primary business bank account' },
    { item: '2–3 years of personal and business tax returns' },
    { item: 'Business financial statements and sales / cash-flow projections' },
  ],
};

test('maps a verified checklist to the document kinds it implies', () => {
  const kinds = kindsForProfile(accionLike);
  for (const k of ['bank_statement', 'id', 'registration', 'voided_check', 'tax_return', 'financial_statement', 'projections']) {
    assert.ok(kinds.includes(k), `expected ${k}`);
  }
});

test('an unverified lender yields no checklist', () => {
  assert.deepEqual(kindsForProfile({ verified: false, need: [{ item: 'bank statements' }] }), []);
  assert.deepEqual(kindsForProfile({ verified: true, need: null }), []);
});

test('coverageFor splits needed into have / missing', () => {
  const cov = coverageFor(accionLike, ['bank_statement', 'tax_return']);
  assert.deepEqual(new Set(cov.have), new Set(['bank_statement', 'tax_return']));
  assert.ok(cov.missing.includes('id'));
  assert.ok(cov.missing.includes('voided_check'));
  assert.equal(cov.needed.length, cov.have.length + cov.missing.length);
});
