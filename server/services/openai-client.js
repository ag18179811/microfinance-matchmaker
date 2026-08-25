// Shared OpenAI Responses API caller. Same retry-on-429 discipline as
// server/services/groq-client.js — a transient rate limit is worth one
// short retry before a caller falls back, other errors surface immediately.

const OPENAI_URL = 'https://api.openai.com/v1/responses';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempt) {
  // OpenAI's 429 body doesn't reliably include a "retry in Ns" hint the way
  // Groq's does, so this backs off on a fixed schedule instead.
  return (attempt + 1) * 1500;
}

// body: the full Responses API request body (model, input, tools, text, etc.)
// Returns { ok: true, data } on success, or { ok: false, status, error } once
// retries are exhausted / a non-retryable error occurs / the request throws.
export async function callOpenAIResponses({ apiKey, body, maxRetries = 2 }) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        return { ok: true, data: await response.json() };
      }

      const errorText = await response.text();
      if (response.status === 429 && attempt < maxRetries) {
        await sleep(retryDelayMs(attempt));
        continue;
      }
      return { ok: false, status: response.status, error: errorText };
    } catch (err) {
      return { ok: false, status: null, error: err.message };
    }
  }
}
