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

function mockTwoStepFetch({ searchText, citedUrls, extractedLenders }) {
  let call = 0;
  global.fetch = async () => {
    call += 1;
    if (call === 1) {
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

test('when the search step finds nothing citable, extraction is never called and [] is returned', async () => {
  const getCallCount = mockTwoStepFetch({ searchText: 'Nothing relevant found.', citedUrls: [], extractedLenders: [] });

  const result = await searchLiveLenders({ state: 'WY', industry: 'Astrology' });
  assert.deepEqual(result, []);
  assert.equal(getCallCount(), 1, 'extraction call should be skipped when there are no citations');
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
