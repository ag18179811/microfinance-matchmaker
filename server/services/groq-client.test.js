import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { callGroqChat } from './groq-client.js';

const originalFetch = global.fetch;
const originalSetTimeout = global.setTimeout;

afterEach(() => {
  global.fetch = originalFetch;
  global.setTimeout = originalSetTimeout;
});

// Skip the real wait so these tests run fast — the delay math itself isn't
// what's under test here, the retry-then-succeed control flow is.
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
    if (calls === 1) {
      return { ok: false, status: 429, text: async () => 'Rate limit reached. Please try again in 0.1s.' };
    }
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) };
  };

  const result = await callGroqChat({ apiKey: 'k', model: 'm', messages: [], temperature: 0 });
  assert.equal(calls, 2);
  assert.equal(result.ok, true);
});

test('a non-429 error is not retried', async () => {
  stubTimers();
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return { ok: false, status: 500, text: async () => 'server error' };
  };

  const result = await callGroqChat({ apiKey: 'k', model: 'm', messages: [], temperature: 0 });
  assert.equal(calls, 1);
  assert.equal(result.ok, false);
  assert.equal(result.status, 500);
});

test('repeated 429s exhaust retries and surface failure', async () => {
  stubTimers();
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return { ok: false, status: 429, text: async () => 'Rate limit reached. Please try again in 0.1s.' };
  };

  const result = await callGroqChat({ apiKey: 'k', model: 'm', messages: [], temperature: 0, maxRetries: 2 });
  assert.equal(calls, 3); // initial attempt + 2 retries
  assert.equal(result.ok, false);
  assert.equal(result.status, 429);
});

test('a thrown network error is caught and surfaced as ok:false', async () => {
  global.fetch = async () => {
    throw new Error('network down');
  };

  const result = await callGroqChat({ apiKey: 'k', model: 'm', messages: [], temperature: 0 });
  assert.equal(result.ok, false);
  assert.match(result.error, /network down/);
});
