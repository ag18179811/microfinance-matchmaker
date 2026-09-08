import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveProfile, modelInfo, APPLICATION_MODELS } from './lender-application-profiles.js';

test('a known static lender resolves to its verified profile with real intake data', () => {
  const p = deriveProfile({ name: 'Accion Opportunity Fund', type: 'CDFI' });
  assert.equal(p.verified, true);
  assert.equal(p.model, 'cdfi_term_loan');
  assert.ok(p.need.length > 0, 'has a real document list');
  assert.ok(p.steps.length > 0);
  assert.ok(p.sources.length > 0, 'carries its verification sources');
  assert.ok(p.applyUrl?.startsWith('https://'));
});

test('name matching is case-insensitive and tolerant of slight variations', () => {
  assert.equal(deriveProfile({ name: 'liftfund' }).slug, 'liftfund');
  assert.equal(deriveProfile({ name: 'KIVA U.S.' }).slug, 'kiva-us');
  assert.equal(deriveProfile({ name: 'Justine Petersen Housing and Reinvestment Corporation' }).slug, 'justine-petersen');
});

test('the eight programs cover genuinely different application models', () => {
  const models = new Set(
    ['Accion Opportunity Fund', 'Kiva U.S.', 'SBA Microloan Program', 'Grameen America', 'Community Reinvestment Fund, USA (CRF)']
      .map((name) => deriveProfile({ name }).model)
  );
  assert.ok(models.has('cdfi_term_loan'));
  assert.ok(models.has('crowdfunding'));
  assert.ok(models.has('sba_intermediary'));
  assert.ok(models.has('group_lending'));
  assert.ok(models.has('referral_network'));
});

test('a grant gets the grant model regardless of the issuing org type or verified status', () => {
  const p = deriveProfile({ id: 5, name: 'City Storefront Grant', type: 'city_program', funding_type: 'grant', source_url: 'https://city.gov/grant' });
  assert.equal(p.model, 'grant');
  assert.ok(p.need.some((n) => /project|budget|fit/i.test(n.item)));
  assert.ok(/no credit check|no repayment|not a loan|keep/i.test(p.howItWorks) === false || /panel|priorities|specific/i.test(p.howItWorks));
  assert.equal(p.applyUrl, 'https://city.gov/grant');
});

test('an unknown (web-discovered) lender is never presented as verified', () => {
  const p = deriveProfile({ id: 99, name: 'Some Regional Loan Fund Nobody Verified', type: 'CDFI', source_url: 'https://example.org/apply' });
  assert.equal(p.verified, false);
  assert.deepEqual(p.need, [], 'no fabricated document checklist');
  assert.match(p.howItWorks, /haven.t verified|confirm/i);
  assert.equal(p.applyUrl, 'https://example.org/apply');
});

test('every application model has display copy', () => {
  for (const key of Object.keys(APPLICATION_MODELS)) {
    const info = modelInfo(key);
    assert.ok(info.label && info.blurb, `${key} has label + blurb`);
  }
});
