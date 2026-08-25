import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { generateCoachingSummary } from './groq-coach.js';

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

const application = { business_name: 'Test Co', additional_notes: '[]' };
const subScores = { timeInBusiness: 80, revenueStability: 80, requestToRevenueRatio: 80, completeness: 80, answerQuality: 80 };

test('a successful call returns the model text', async () => {
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: 'Great profile, here are 3 tips.' } }] }),
  });

  const result = await generateCoachingSummary(application, subScores, 85, []);
  assert.equal(result, 'Great profile, here are 3 tips.');
});

test('a rate-limited call falls back with a retryable, non-misleading message (the score itself is not blamed on a missing key)', async () => {
  global.fetch = async () => ({ ok: false, status: 429, text: async () => 'Rate limit reached. Please try again in 0.1s.' });

  const result = await generateCoachingSummary(application, subScores, 85, []);
  assert.match(result, /rate-limited/i);
  assert.doesNotMatch(result, /GROQ_API_KEY/);
});

test('no API key configured produces a distinct, non-retryable fallback', async () => {
  delete process.env.GROQ_API_KEY;
  let called = false;
  global.fetch = async () => {
    called = true;
    throw new Error('should not be called');
  };

  const result = await generateCoachingSummary(application, subScores, 85, []);
  assert.equal(called, false);
  assert.match(result, /no GROQ_API_KEY configured/);
});
