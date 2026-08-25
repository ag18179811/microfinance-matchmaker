// Shared Groq chat-completion caller. A single results request can trigger
// several Groq calls in a row (interview extraction, quality check,
// coaching summary), which is enough to trip the free tier's per-minute
// token budget even under normal use. Groq's own 429 response says how
// long until it clears — that's a transient, near-certain-to-succeed-soon
// condition, so it's worth one short retry before a caller falls back to
// its static message. Other errors (4xx/5xx besides 429, network failure)
// are not retried and surface immediately.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(errorText, attempt) {
  const match = errorText.match(/try again in ([\d.]+)s/i);
  if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 250;
  return (attempt + 1) * 1500;
}

// Returns { ok: true, data } on success, or { ok: false, status, error } once
// retries are exhausted / a non-retryable error occurs / the request throws.
export async function callGroqChat({ apiKey, model, messages, temperature, response_format, maxRetries = 2 }) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, temperature, response_format }),
      });

      if (response.ok) {
        return { ok: true, data: await response.json() };
      }

      const errorText = await response.text();
      if (response.status === 429 && attempt < maxRetries) {
        await sleep(retryDelayMs(errorText, attempt));
        continue;
      }
      return { ok: false, status: response.status, error: errorText };
    } catch (err) {
      return { ok: false, status: null, error: err.message };
    }
  }
}
