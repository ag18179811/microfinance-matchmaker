import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { extractApplicationFields, emptyExtraction } from './groq-extract.js';

const originalFetch = global.fetch;
const originalKey = process.env.GROQ_API_KEY;

beforeEach(() => {
  process.env.GROQ_API_KEY = 'test-key';
});

afterEach(() => {
  global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalKey;
});

function mockGroqResponse(contentObj) {
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(contentObj) } }] }),
  });
}

test('extraction coerces and validates a well-formed model response', async () => {
  mockGroqResponse({
    business_name: '  Steady Grind Coffee  ',
    industry: 'food service', // wrong case, must normalize to exact enum value
    city: 'Austin',
    state: 'Texas', // full name, must normalize to abbreviation
    time_in_business_months: 36,
    annual_revenue: '$180,000',
    requested_amount: '20000',
    purpose: 'Buy a new espresso machine',
  });

  const result = await extractApplicationFields('irrelevant, fetch is mocked');

  assert.equal(result.business_name, 'Steady Grind Coffee');
  assert.equal(result.industry, 'Food Service');
  assert.equal(result.city, 'Austin');
  assert.equal(result.state, 'TX');
  assert.equal(result.time_in_business_months, 36);
  assert.equal(result.annual_revenue, 180000);
  assert.equal(result.requested_amount, 20000);
  assert.equal(result.purpose, 'Buy a new espresso machine');
});

test('extraction rejects an industry not in the fixed enum rather than inventing one', async () => {
  mockGroqResponse({
    business_name: 'Widget Co',
    industry: 'Astrology Consulting', // not in INDUSTRIES
    city: null,
    state: null,
    time_in_business_months: null,
    annual_revenue: null,
    requested_amount: null,
    purpose: null,
  });

  const result = await extractApplicationFields('irrelevant');
  assert.equal(result.industry, null);
});

test('extraction rejects an unrecognized state rather than guessing', async () => {
  mockGroqResponse({
    business_name: null,
    industry: null,
    city: null,
    state: 'Atlantis',
    time_in_business_months: null,
    annual_revenue: null,
    requested_amount: null,
    purpose: null,
  });

  const result = await extractApplicationFields('irrelevant');
  assert.equal(result.state, null);
});

test('extraction falls back to null fields (no guessing) when the Groq call fails', async () => {
  global.fetch = async () => ({ ok: false, status: 500, text: async () => 'server error' });

  const result = await extractApplicationFields('I run a bakery in Denver');
  assert.deepEqual(
    { ...result, purpose: undefined },
    { ...emptyExtraction(), purpose: undefined }
  );
  assert.equal(result.purpose, 'I run a bakery in Denver');
});

test('extraction skips the network call entirely when no API key is configured', async () => {
  delete process.env.GROQ_API_KEY;
  let called = false;
  global.fetch = async () => {
    called = true;
    throw new Error('should not be called');
  };

  const result = await extractApplicationFields('I run a bakery in Denver');
  assert.equal(called, false);
  assert.equal(result.business_name, null);
  assert.equal(result.purpose, 'I run a bakery in Denver');
});
