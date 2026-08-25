import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { assessAnswerQuality, UNAVAILABLE_QUALITY_SCORE } from './groq-quality-check.js';

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

const application = { business_name: 'Test Co', additional_notes: '[]' };

test('a credible, well-formed response is passed through and clamped', async () => {
  mockGroqResponse({ qualityScore: 92, concerns: [] });
  const result = await assessAnswerQuality(application);
  assert.equal(result.qualityScore, 92);
  assert.deepEqual(result.concerns, []);
  assert.equal(result.checked, true);
});

test('flagged concerns are passed through', async () => {
  mockGroqResponse({
    qualityScore: 8,
    concerns: ['Stated use of funds is not a real business purpose', 'Revenue figure contradicts stated time in business'],
  });
  const result = await assessAnswerQuality(application);
  assert.equal(result.qualityScore, 8);
  assert.equal(result.concerns.length, 2);
});

test('an out-of-range score is clamped to 0-100', async () => {
  mockGroqResponse({ qualityScore: 500, concerns: [] });
  const result = await assessAnswerQuality(application);
  assert.equal(result.qualityScore, 100);
});

test('a missing/non-numeric score falls back to the neutral unavailable score', async () => {
  mockGroqResponse({ concerns: [] });
  const result = await assessAnswerQuality(application);
  assert.equal(result.qualityScore, UNAVAILABLE_QUALITY_SCORE);
});

test('returns the neutral unavailable score, unchecked, when no API key is configured', async () => {
  delete process.env.GROQ_API_KEY;
  let called = false;
  global.fetch = async () => {
    called = true;
    throw new Error('should not be called');
  };

  const result = await assessAnswerQuality(application);
  assert.equal(called, false);
  assert.equal(result.qualityScore, UNAVAILABLE_QUALITY_SCORE);
  assert.equal(result.checked, false);
});

test('returns the neutral unavailable score, unchecked, when the Groq call fails', async () => {
  global.fetch = async () => ({ ok: false, status: 500, text: async () => 'server error' });

  const result = await assessAnswerQuality(application);
  assert.equal(result.qualityScore, UNAVAILABLE_QUALITY_SCORE);
  assert.equal(result.checked, false);
});
