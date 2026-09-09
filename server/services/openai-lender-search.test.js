import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { searchLiveLenders } from './openai-lender-search.js';

const originalFetch = global.fetch;
const originalKey = process.env.OPENAI_API_KEY;

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'test-key';
});

afterEach(() => {
  global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
});

const CITED_URL = 'https://realcdfi.org/small-business-loans';

function searchResponsePayload({ text, urls }) {
  return {
    output: [
      {
        type: 'message',
        content: [
          {
            type: 'output_text',
            text,
            annotations: urls.map((url) => ({ type: 'url_citation', url, title: 'Real CDFI' })),
          },
        ],
      },
    ],
  };
}

function extractionResponsePayload(lenders) {
  return {
    output: [
      {
        type: 'message',
        content: [{ type: 'output_text', text: JSON.stringify({ lenders }) }],
      },
    ],
  };
}

// Odd calls are the grounded-search step, even calls the schema-extract
// step — so this serves both the targeted pass and, if it's reached, the
// broadened fallback pass with the same payloads.
function mockTwoStepFetch({ searchText, citedUrls, extractedLenders }) {
  let call = 0;
  global.fetch = async () => {
    call += 1;
    if (call % 2 === 1) {
      return { ok: true, json: async () => searchResponsePayload({ text: searchText, urls: citedUrls }) };
    }
    return { ok: true, json: async () => extractionResponsePayload(extractedLenders) };
  };
  return () => call;
}

test('a well-formed two-step response is coerced correctly', async () => {
  mockTwoStepFetch({
    searchText: 'Real CDFI Fund offers loans from $5,000 to $50,000 in Ohio.',
    citedUrls: [CITED_URL],
    extractedLenders: [
      {
        name: 'Real CDFI Fund',
        type: 'CDFI',
        geography: 'OH',
        min_loan: 5000,
        max_loan: 50000,
        industries: '',
        eligibility_notes: 'Must be in business 1+ years.',
        source_url: CITED_URL,
        min_months_in_business: 12,
        min_months_in_business_type: 'required',
      },
    ],
  });

  const result = await searchLiveLenders({ state: 'OH', industry: 'Retail' });
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Real CDFI Fund');
  assert.equal(result[0].source_url, CITED_URL);
  assert.equal(result[0].min_loan, 5000);
});

test('an entry whose source_url is not among the actually-cited URLs is dropped', async () => {
  mockTwoStepFetch({
    searchText: 'Found a program.',
    citedUrls: [CITED_URL],
    extractedLenders: [
      {
        name: 'Suspicious Fund',
        type: 'CDFI',
        geography: 'OH',
        min_loan: 5000,
        max_loan: 50000,
        industries: '',
        eligibility_notes: '',
        source_url: 'https://not-actually-cited.example.com/loans',
        min_months_in_business: null,
        min_months_in_business_type: null,
      },
    ],
  });

  const result = await searchLiveLenders({ state: 'OH', industry: 'Retail' });
  assert.equal(result.length, 0);
});

test('an entry missing a source_url is dropped', async () => {
  mockTwoStepFetch({
    searchText: 'Found a program.',
    citedUrls: [CITED_URL],
    extractedLenders: [
      {
        name: 'No Link Fund',
        type: 'CDFI',
        geography: 'OH',
        min_loan: 5000,
        max_loan: 50000,
        industries: '',
        eligibility_notes: '',
        source_url: null,
        min_months_in_business: null,
        min_months_in_business_type: null,
      },
    ],
  });

  const result = await searchLiveLenders({ state: 'OH', industry: 'Retail' });
  assert.equal(result.length, 0);
});

test('when the search finds nothing citable, extraction is skipped and a broadened fallback pass runs', async () => {
  const getCallCount = mockTwoStepFetch({ searchText: 'Nothing relevant found.', citedUrls: [], extractedLenders: [] });

  const result = await searchLiveLenders({ state: 'WY', industry: 'Astrology' });
  assert.deepEqual(result, []);
  assert.equal(getCallCount(), 2, 'two search calls (targeted + broadened), no extraction calls');
});

test('a broadened fallback pass runs only when the first pass succeeded but was empty', async () => {
  // targeted pass: search ok, no citations -> empty. broadened pass: finds one.
  let call = 0;
  global.fetch = async () => {
    call += 1;
    if (call === 1) return { ok: true, json: async () => searchResponsePayload({ text: 'nothing local', urls: [] }) };
    if (call === 2) return { ok: true, json: async () => searchResponsePayload({ text: 'statewide CDFI', urls: [CITED_URL] }) };
    return {
      ok: true,
      json: async () =>
        extractionResponsePayload([
          { name: 'Statewide CDFI', type: 'CDFI', geography: 'OH', min_loan: 5000, max_loan: 50000, industries: '', eligibility_notes: '', source_url: CITED_URL, min_months_in_business: null, min_months_in_business_type: null },
        ]),
    };
  };
  const result = await searchLiveLenders({ state: 'OH', industry: 'Retail', city: 'Nowheresville' });
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Statewide CDFI');
});

test('a hard search-API failure is not followed by a broadened pass', async () => {
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return { ok: false, status: 500, text: async () => 'server error' };
  };
  const result = await searchLiveLenders({ state: 'OH', industry: 'Retail' });
  assert.deepEqual(result, []);
  assert.equal(calls, 1, 'one search call, no broadened retry after a hard failure');
});

test('a program whose geography is a different state is dropped', async () => {
  mockTwoStepFetch({
    searchText: 'Found programs.',
    citedUrls: [CITED_URL],
    extractedLenders: [
      { name: 'Columbus Ohio Fund', type: 'CDFI', geography: 'OH', min_loan: 1000, max_loan: 20000, industries: '', eligibility_notes: '', source_url: CITED_URL, min_months_in_business: null, min_months_in_business_type: null },
      { name: 'Columbus Indiana Fund', type: 'city_program', geography: 'IN', min_loan: 1000, max_loan: 20000, industries: '', eligibility_notes: '', source_url: CITED_URL, min_months_in_business: null, min_months_in_business_type: null },
      { name: 'Nationwide Grant', type: 'nonprofit', geography: 'National', min_loan: 0, max_loan: 10000, industries: '', eligibility_notes: '', source_url: CITED_URL, min_months_in_business: null, min_months_in_business_type: null },
    ],
  });
  const result = await searchLiveLenders({ state: 'OH', city: 'Columbus', industry: 'Retail' });
  const names = result.map((r) => r.name);
  assert.ok(names.includes('Columbus Ohio Fund'));
  assert.ok(names.includes('Nationwide Grant'), 'national programs are kept');
  assert.ok(!names.includes('Columbus Indiana Fund'), 'wrong-state program is dropped');
});

test('a failed search call returns [] without throwing', async () => {
  global.fetch = async () => ({ ok: false, status: 500, text: async () => 'server error' });

  const result = await searchLiveLenders({ state: 'OH', industry: 'Retail' });
  assert.deepEqual(result, []);
});

test('a failed extraction call (after a successful search) returns [] without throwing', async () => {
  let call = 0;
  global.fetch = async () => {
    call += 1;
    if (call === 1) {
      return { ok: true, json: async () => searchResponsePayload({ text: 'Found a program.', urls: [CITED_URL] }) };
    }
    return { ok: false, status: 500, text: async () => 'server error' };
  };

  const result = await searchLiveLenders({ state: 'OH', industry: 'Retail' });
  assert.deepEqual(result, []);
});

test('skips the network call entirely when no API key is configured', async () => {
  delete process.env.OPENAI_API_KEY;
  let called = false;
  global.fetch = async () => {
    called = true;
    throw new Error('should not be called');
  };

  const result = await searchLiveLenders({ state: 'OH', industry: 'Retail' });
  assert.equal(called, false);
  assert.deepEqual(result, []);
});

test('skips the network call entirely when no state is provided', async () => {
  let called = false;
  global.fetch = async () => {
    called = true;
    throw new Error('should not be called');
  };

  const result = await searchLiveLenders({ state: null, industry: 'Retail' });
  assert.equal(called, false);
  assert.deepEqual(result, []);
});

test('the search prompt carries the full owner profile (city, use of funds, ownership)', async () => {
  let sentBody = null;
  global.fetch = async (_url, opts) => {
    if (!sentBody) {
      sentBody = JSON.parse(opts.body);
      return { ok: true, json: async () => searchResponsePayload({ text: 'nothing', urls: [] }) };
    }
    return { ok: true, json: async () => extractionResponsePayload([]) };
  };

  await searchLiveLenders({
    state: 'OH',
    industry: 'Food & Beverage',
    city: 'Cleveland',
    ownershipDemographics: 'woman-owned, first-generation immigrant',
    timeInBusinessMonths: 8,
    annualRevenue: 40000,
    requestedAmount: 15000,
    useOfFunds: 'a walk-in cooler and a delivery bike',
    businessStructure: 'llc',
    notes: [{ topic: 'location', detail: 'in a designated opportunity zone' }],
  });

  const userMsg = sentBody.input.find((m) => m.role === 'user').content;
  assert.match(userMsg, /Cleveland/);
  assert.match(userMsg, /woman-owned, first-generation immigrant/);
  assert.match(userMsg, /walk-in cooler/);
  assert.match(userMsg, /opportunity zone/);
  assert.match(userMsg, /startup|under a year/i);
});

test('caps results at 8 entries even if the model returns more', async () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    name: `Fund ${i}`,
    type: 'CDFI',
    geography: 'OH',
    min_loan: 1000,
    max_loan: 10000,
    industries: '',
    eligibility_notes: '',
    source_url: CITED_URL,
    min_months_in_business: null,
    min_months_in_business_type: null,
  }));
  mockTwoStepFetch({ searchText: 'many programs', citedUrls: [CITED_URL], extractedLenders: many });

  const result = await searchLiveLenders({ state: 'OH', industry: 'Retail' });
  assert.equal(result.length, 8);
});
