import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { reasonAboutTurn } from './openai-interview-reason.js';

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

function mockResponsesOutput({ text, urls = [] }) {
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text,
              annotations: urls.map((url) => ({ type: 'url_citation', url, title: 'Source' })),
            },
          ],
        },
      ],
    }),
  });
}

const baseArgs = {
  history: [{ role: 'user', content: 'I run a mobile food truck in Austin, TX.' }],
  currentFields: { business_name: 'Taco Truck Co' },
  currentNotes: [],
};

test('a successful call returns the analysis text and any cited URLs', async () => {
  mockResponsesOutput({
    text: 'The user mentioned a mobile food vendor permit; looked it up and confirmed it renews annually in Travis County.',
    urls: ['https://traviscountytx.gov/permits/mobile-food'],
  });

  const result = await reasonAboutTurn(baseArgs);
  assert.equal(result.ok, true);
  assert.match(result.analysisText, /mobile food vendor permit/);
  assert.deepEqual(result.citedUrls, ['https://traviscountytx.gov/permits/mobile-food']);
});

test('a call with no search needed returns analysis text and an empty citedUrls array', async () => {
  mockResponsesOutput({ text: 'The business name and location are now known; still need annual revenue.', urls: [] });

  const result = await reasonAboutTurn(baseArgs);
  assert.equal(result.ok, true);
  assert.deepEqual(result.citedUrls, []);
});

test('the stuckField hint is included in the outgoing request', async () => {
  let capturedBody;
  global.fetch = async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'ok', annotations: [] }] }] }),
    };
  };

  await reasonAboutTurn({ ...baseArgs, stuckField: 'existing_monthly_debt_payment' });
  const lastMessage = capturedBody.input[capturedBody.input.length - 1].content;
  assert.match(lastMessage, /existing_monthly_debt_payment/);
});

test('the request enables the web_search tool', async () => {
  let capturedBody;
  global.fetch = async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'ok', annotations: [] }] }] }),
    };
  };

  await reasonAboutTurn(baseArgs);
  assert.deepEqual(capturedBody.tools, [{ type: 'web_search' }]);
});

test('returns ok:false when no API key is configured, without calling fetch', async () => {
  delete process.env.OPENAI_API_KEY;
  let called = false;
  global.fetch = async () => {
    called = true;
    throw new Error('should not be called');
  };

  const result = await reasonAboutTurn(baseArgs);
  assert.equal(called, false);
  assert.equal(result.ok, false);
});

test('returns ok:false when the call fails, without throwing', async () => {
  global.fetch = async () => ({ ok: false, status: 500, text: async () => 'server error' });

  const result = await reasonAboutTurn(baseArgs);
  assert.equal(result.ok, false);
});

test('returns ok:false when the response has no message text', async () => {
  global.fetch = async () => ({ ok: true, json: async () => ({ output: [] }) });

  const result = await reasonAboutTurn(baseArgs);
  assert.equal(result.ok, false);
});
