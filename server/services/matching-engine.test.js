import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeReadiness, matchLenders, scoreLenderMatch } from './matching-engine.js';

const strongApplication = {
  business_name: 'Corner Bakery LLC',
  industry: 'Food Service',
  city: 'Austin',
  state: 'TX',
  time_in_business_months: 36,
  annual_revenue: 180000,
  requested_amount: 20000,
  purpose: 'Buy a second oven',
};

const thinApplication = {
  business_name: '',
  industry: 'Food Service',
  city: '',
  state: 'TX',
  time_in_business_months: 2,
  annual_revenue: 0,
  requested_amount: 40000,
  purpose: '',
};

const lenders = [
  {
    id: 1,
    name: 'Gulf Coast Microloan Program',
    geography: 'TX',
    min_loan: 2000,
    max_loan: 50000,
    industries: 'Retail,Food Service,Personal Services,Arts and Entertainment',
  },
  {
    id: 2,
    name: 'Great Lakes Development Loan Fund',
    geography: 'MI,OH,IN,IL,WI',
    min_loan: 15000,
    max_loan: 350000,
    industries: 'Manufacturing,Construction,Transportation,Wholesale',
  },
  {
    id: 3,
    name: 'National Main Street Loan Program',
    geography: 'National',
    min_loan: 10000,
    max_loan: 250000,
    industries: 'Retail,Food Service,Personal Services,Professional Services,Manufacturing',
  },
];

test('computeReadiness scores a strong application higher than a thin one', () => {
  const strong = computeReadiness(strongApplication);
  const thin = computeReadiness(thinApplication);
  assert.ok(strong.readinessScore > thin.readinessScore);
  assert.ok(strong.readinessScore >= 0 && strong.readinessScore <= 100);
  assert.ok(thin.readinessScore >= 0 && thin.readinessScore <= 100);
});

test('scoreLenderMatch excludes lenders outside the applicant state and not national', () => {
  const outOfStateLender = lenders[1]; // MI,OH,IN,IL,WI
  const result = scoreLenderMatch(outOfStateLender, strongApplication);
  assert.equal(result, null);
});

test('scoreLenderMatch excludes lenders when requested amount is far outside loan range', () => {
  const tinyLoanLender = { geography: 'TX', min_loan: 2000, max_loan: 5000, industries: 'Food Service' };
  const result = scoreLenderMatch(tinyLoanLender, strongApplication);
  assert.equal(result, null);
});

test('matchLenders returns only eligible lenders, sorted by match score descending', () => {
  const matches = matchLenders(strongApplication, lenders);
  assert.equal(matches.length, 2); // Gulf Coast (TX) + National Main Street (National), not Great Lakes (MI region)
  assert.ok(matches[0].matchScore >= matches[matches.length - 1].matchScore);
  assert.ok(matches.every((m) => m.matchScore >= 0 && m.matchScore <= 100));
});

test('matchLenders is deterministic across repeated calls', () => {
  const first = matchLenders(strongApplication, lenders);
  const second = matchLenders(strongApplication, lenders);
  assert.deepEqual(
    first.map((m) => [m.lender.name, m.matchScore]),
    second.map((m) => [m.lender.name, m.matchScore])
  );
});

test('scoreLenderMatch hard-disqualifies when a required time-in-business threshold is unmet', () => {
  const strictLender = {
    geography: 'TX',
    min_loan: 2000,
    max_loan: 50000,
    industries: 'Food Service',
    min_months_in_business: 6,
    min_months_in_business_type: 'required',
  };
  const newBusiness = { ...strongApplication, time_in_business_months: 2 };
  assert.equal(scoreLenderMatch(strictLender, newBusiness), null);

  const establishedBusiness = { ...strongApplication, time_in_business_months: 6 };
  assert.ok(scoreLenderMatch(strictLender, establishedBusiness) !== null);
});

test('scoreLenderMatch keeps a preferred (soft) time-in-business threshold eligible but scores it down with a caution', () => {
  const softLender = {
    geography: 'TX',
    min_loan: 2000,
    max_loan: 50000,
    industries: 'Food Service',
    min_months_in_business: 12,
    min_months_in_business_type: 'preferred',
  };
  const under = scoreLenderMatch(softLender, { ...strongApplication, time_in_business_months: 4 });
  const over = scoreLenderMatch(softLender, { ...strongApplication, time_in_business_months: 24 });

  assert.ok(under !== null, 'a preferred threshold must not disqualify');
  assert.ok(under.matchScore < over.matchScore);
  assert.ok(under.cautions.some((c) => c.toLowerCase().includes('prefers')));
  assert.equal(over.cautions.length, 0);
});

test('scoreLenderMatch explains every eligible match with at least one reason', () => {
  const result = scoreLenderMatch(lenders[0], strongApplication);
  assert.ok(result.reasons.length > 0);
});
