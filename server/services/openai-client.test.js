import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { callOpenAIResponses } from './openai-client.js';

const originalFetch = global.fetch;
const originalSetTimeout = global.setTimeout;

afterEach(() => {
  global.fetch = originalFetch;
  global.setTimeout = originalSetTimeout;
});

function stubTimers() {
  global.setTimeout = (fn) => {
    fn();
    return 0;
  };
}

test('a 429 is retried and a subsequent success is returned', async () => {
  stubTimers();
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    if (calls === 1) return { ok: false, status: 429, text: async () => 'rate limited' };
    return { ok: true, json: async () => ({ output: [] }) };
  };

  const result = await callOpenAIResponses({ apiKey: 'k', body: { model: 'm' } });
  assert.equal(calls, 2);
  assert.equal(result.ok, true);
});

test('a non-429 error is not retried', async () => {
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return { ok: false, status: 400, text: async () => 'bad request' };
  };

  const result = await callOpenAIResponses({ apiKey: 'k', body: { model: 'm' } });
  assert.equal(calls, 1);
  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
});

test('a thrown network error is caught and surfaced as ok:false', async () => {
  global.fetch = async () => {
    throw new Error('network down');
  };

  const result = await callOpenAIResponses({ apiKey: 'k', body: { model: 'm' } });
  assert.equal(result.ok, false);
  assert.match(result.error, /network down/);
});
