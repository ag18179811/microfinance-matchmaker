import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyHelpMode, helpModeInfo, helpModeDirective } from './help-mode.js';

test('a prior denial routes to strategist regardless of the rest', () => {
  for (const priorFundingHistory of [
    'Applied to a bank last year and was declined for short history.',
    'A bank turned me down last month for being too new.',
    'I applied to an SBA lender and they rejected my application.',
    'Tried a credit union, it fell through.',
    "Applied once, didn't go through.",
  ]) {
    const r = classifyHelpMode(
      { time_in_business_months: 60, prior_funding_history: priorFundingHistory },
      { completeness: 90, answerQuality: 90 },
      85
    );
    assert.equal(r.mode, 'strategist', `"${priorFundingHistory}" -> strategist`);
  }
});

test('low readiness or under six months routes to rebuilder', () => {
  assert.equal(classifyHelpMode({ time_in_business_months: 3 }, {}, 70).mode, 'rebuilder');
  assert.equal(classifyHelpMode({ time_in_business_months: 24 }, {}, 40).mode, 'rebuilder');
});

test('a strong, complete, credible file routes to organizer', () => {
  const r = classifyHelpMode(
    { time_in_business_months: 40, prior_funding_history: 'none' },
    { completeness: 80, answerQuality: 75 },
    74
  );
  assert.equal(r.mode, 'organizer');
});

test('the middle case routes to demystifier', () => {
  const r = classifyHelpMode({ time_in_business_months: 18 }, { completeness: 55, answerQuality: 55 }, 58);
  assert.equal(r.mode, 'demystifier');
});

test('helpModeInfo and helpModeDirective agree on the mode set', () => {
  for (const mode of ['organizer', 'demystifier', 'rebuilder', 'strategist']) {
    assert.ok(helpModeInfo(mode).headline);
    assert.ok(helpModeDirective(mode).length > 0);
  }
  assert.equal(helpModeInfo('nonsense'), null);
  assert.equal(helpModeDirective('nonsense'), '');
});
