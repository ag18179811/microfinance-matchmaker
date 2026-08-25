import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { runInterviewTurn, HARD_TURN_CAP } from './groq-interview.js';

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

const baseArgs = { history: [{ role: 'user', content: 'I run a bakery' }], currentFields: {}, currentNotes: [], attachmentTexts: [], turnCount: 1 };

test('a well-formed turn is coerced and passed through', async () => {
  mockGroqResponse({
    reasoningSteps: ['The description mentions revenue but not location.', 'Location is needed for lender matching.'],
    done: false,
    nextQuestion: 'What city and state is the bakery in?',
    questionType: 'text',
    options: null,
    fileHint: null,
    updatedFields: { annual_revenue: '85000', business_structure: 'LLC' },
  });

  const result = await runInterviewTurn(baseArgs);
  assert.equal(result.ok, true);
  assert.equal(result.done, false);
  assert.equal(result.nextQuestion, 'What city and state is the bakery in?');
  assert.equal(result.updatedFields.annual_revenue, 85000);
  assert.equal(result.updatedFields.business_structure, 'llc');
  assert.deepEqual(result.reasoningSteps, ['The description mentions revenue but not location.', 'Location is needed for lender matching.']);
});

test('unknown or invalid updatedFields keys are dropped, never trusted raw', async () => {
  mockGroqResponse({
    reasoningSteps: ['test'],
    done: false,
    nextQuestion: 'test?',
    questionType: 'text',
    updatedFields: {
      industry: 'Astrology Consulting', // not in the fixed enum
      credit_band: 'excellent', // not one of the allowed bands
      some_made_up_field: 'value', // not a known field at all
      employee_count: 'a few', // not numeric
    },
  });

  const result = await runInterviewTurn(baseArgs);
  assert.equal(result.updatedFields.industry, undefined);
  assert.equal(result.updatedFields.credit_band, undefined);
  assert.equal(result.updatedFields.some_made_up_field, undefined);
  assert.equal(result.updatedFields.employee_count, undefined);
});

test('a select question keeps a clean options list', async () => {
  mockGroqResponse({
    reasoningSteps: ['test'],
    done: false,
    nextQuestion: 'How would you describe your revenue pattern?',
    questionType: 'select',
    options: ['steady', 'seasonal', 'growing', 'declining'],
    updatedFields: {},
  });

  const result = await runInterviewTurn(baseArgs);
  assert.equal(result.questionType, 'select');
  assert.deepEqual(result.options, ['steady', 'seasonal', 'growing', 'declining']);
});

test('done:true from the model is honored, with nextQuestion cleared', async () => {
  mockGroqResponse({ reasoningSteps: ['Profile is thorough enough.'], done: true, nextQuestion: 'ignored', updatedFields: {} });

  const result = await runInterviewTurn(baseArgs);
  assert.equal(result.done, true);
  assert.equal(result.nextQuestion, null);
});

test('the hard turn cap forces done:true regardless of what the model says', async () => {
  mockGroqResponse({ reasoningSteps: ['keep going'], done: false, nextQuestion: 'one more thing?', updatedFields: {} });

  const result = await runInterviewTurn({ ...baseArgs, turnCount: HARD_TURN_CAP });
  assert.equal(result.done, true);
});

test('returns ok:false (signal to fall back) when no API key is configured', async () => {
  delete process.env.GROQ_API_KEY;
  let called = false;
  global.fetch = async () => {
    called = true;
    throw new Error('should not be called');
  };

  const result = await runInterviewTurn(baseArgs);
  assert.equal(called, false);
  assert.equal(result.ok, false);
});

test('returns ok:false (signal to fall back) when the Groq call fails', async () => {
  global.fetch = async () => ({ ok: false, status: 500, text: async () => 'server error' });

  const result = await runInterviewTurn(baseArgs);
  assert.equal(result.ok, false);
});

test('newNotes captures open-ended, business-specific facts beyond the fixed schema', async () => {
  mockGroqResponse({
    reasoningSteps: ['test'],
    done: false,
    nextQuestion: 'Do you have a commissary kitchen agreement?',
    questionType: 'text',
    updatedFields: {},
    newNotes: [
      { topic: 'Commissary kitchen', detail: 'Operates out of a shared commissary kitchen, not a fixed storefront.' },
      { topic: 'Permits', detail: 'Holds a county mobile food vendor permit, renews annually.' },
    ],
  });

  const result = await runInterviewTurn(baseArgs);
  assert.equal(result.newNotes.length, 2);
  assert.equal(result.newNotes[0].topic, 'Commissary kitchen');
});

test('newNotes drops malformed entries and caps the count per turn', async () => {
  mockGroqResponse({
    reasoningSteps: ['test'],
    done: false,
    nextQuestion: 'test?',
    updatedFields: {},
    newNotes: [
      { topic: 'ok', detail: 'fine' },
      { topic: '', detail: 'missing topic, should be dropped' },
      { topic: 'missing detail' }, // no detail key at all, should be dropped
      { topic: 'a', detail: '1' },
      { topic: 'b', detail: '2' },
      { topic: 'c', detail: '3' },
      { topic: 'd', detail: '4' },
      { topic: 'e', detail: '5' }, // beyond the 5-per-turn cap, should be dropped
    ],
  });

  const result = await runInterviewTurn(baseArgs);
  assert.equal(result.newNotes.length, 5);
});

test('newNotes defaults to an empty array when the model omits it', async () => {
  mockGroqResponse({ reasoningSteps: ['test'], done: false, nextQuestion: 'test?', updatedFields: {} });

  const result = await runInterviewTurn(baseArgs);
  assert.deepEqual(result.newNotes, []);
});

test('reasoningSteps is capped and each step is bounded in length, never trusted raw', async () => {
  mockGroqResponse({
    reasoningSteps: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], // 8 given, cap is 6
    done: false,
    nextQuestion: 'test?',
    updatedFields: {},
  });

  const result = await runInterviewTurn(baseArgs);
  assert.equal(result.reasoningSteps.length, 6);
});

test('reasoningSteps falls back to a single default step when the model omits it', async () => {
  mockGroqResponse({ done: false, nextQuestion: 'test?', updatedFields: {} });

  const result = await runInterviewTurn(baseArgs);
  assert.equal(result.reasoningSteps.length, 1);
});

test('directAnswer is coerced through when the model answers a direct question', async () => {
  mockGroqResponse({
    reasoningSteps: ['test'],
    directAnswer: 'The current SBA 504 debenture limit is $5.5 million for small manufacturers.',
    done: false,
    nextQuestion: 'How many employees do you have?',
    updatedFields: {},
  });

  const result = await runInterviewTurn(baseArgs);
  assert.equal(result.directAnswer, 'The current SBA 504 debenture limit is $5.5 million for small manufacturers.');
});

test('directAnswer defaults to null when the model has nothing to answer', async () => {
  mockGroqResponse({ reasoningSteps: ['test'], done: false, nextQuestion: 'test?', updatedFields: {} });

  const result = await runInterviewTurn(baseArgs);
  assert.equal(result.directAnswer, null);
});

test('directAnswer is always null when done:true', async () => {
  mockGroqResponse({ reasoningSteps: ['test'], directAnswer: 'some answer', done: true, updatedFields: {} });

  const result = await runInterviewTurn(baseArgs);
  assert.equal(result.directAnswer, null);
});

// Found via live testing: without an explicit nudge, the model can ask a
// near-identical question 3+ times in a row when an answer doesn't satisfy
// it. routes/interview.js detects that pattern and passes stuckField in —
// this confirms the resulting prompt actually tells the model to move on.
test('a stuckField is surfaced to the model as an explicit instruction to move on', async () => {
  let capturedBody;
  global.fetch = async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ reasoningSteps: ['test'], done: false, nextQuestion: 'Something else', updatedFields: {} }) } }] }),
    };
  };

  await runInterviewTurn({ ...baseArgs, stuckField: 'existing_monthly_debt_payment' });
  const lastUserMessage = capturedBody.messages[capturedBody.messages.length - 1].content;
  assert.match(lastUserMessage, /existing_monthly_debt_payment/);
  assert.match(lastUserMessage, /move to a genuinely different topic/i);
});

// This is step 2 of the two-step turn (server/services/openai-interview-reason.js
// is step 1) — when step 1 succeeded, its analysis must actually reach this
// call and change the system prompt's framing, not be silently ignored.
test('when analysisText is provided, it is included in the request and the prompt reflects it', async () => {
  let capturedBody;
  global.fetch = async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ reasoningSteps: ['test'], done: false, nextQuestion: 'test?', updatedFields: {} }) } }] }),
    };
  };

  await runInterviewTurn({
    ...baseArgs,
    analysisText: 'The business mentioned a county mobile food vendor permit; looked it up and it renews annually.',
    citedUrls: ['https://example.gov/permits'],
  });

  const systemMessage = capturedBody.messages[0].content;
  const userMessage = capturedBody.messages[capturedBody.messages.length - 1].content;
  assert.match(systemMessage, /research analysis already written by a first-pass reasoning step/i);
  assert.match(userMessage, /county mobile food vendor permit/);
  assert.match(userMessage, /example\.gov\/permits/);
});

test('without analysisText, the prompt tells the model to reason from the conversation itself', async () => {
  let capturedBody;
  global.fetch = async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ reasoningSteps: ['test'], done: false, nextQuestion: 'test?', updatedFields: {} }) } }] }),
    };
  };

  await runInterviewTurn(baseArgs);
  const systemMessage = capturedBody.messages[0].content;
  assert.match(systemMessage, /no prior analysis was provided/i);
});
