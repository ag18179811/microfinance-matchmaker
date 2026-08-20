// Coaching text generation only. Never used for eligibility decisions —
// those come exclusively from matching-engine.js.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-120b';

const SYSTEM_PROMPT =
  'You are a funding readiness coach for small business owners applying to CDFI and city ' +
  'microloan programs. Given the applicant\'s data and their computed sub-scores, write a 2-3 ' +
  'sentence plain-English summary of their readiness and exactly 3 prioritized, concrete action ' +
  'items. Do not invent eligibility rules — only comment on the data given.';

function fallbackSummary(readinessScore) {
  return (
    `Readiness score: ${readinessScore}/100. AI coaching summary is unavailable right now ` +
    '(no GROQ_API_KEY configured, or the Groq API request failed). Set GROQ_API_KEY in your ' +
    '.env file to enable personalized coaching text.'
  );
}

export async function generateCoachingSummary(application, subScores, readinessScore) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return fallbackSummary(readinessScore);
  }

  const userPayload = JSON.stringify({
    applicant: application,
    subScores,
    readinessScore,
  });

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPayload },
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Groq API error (${response.status}): ${errorText}`);
      return fallbackSummary(readinessScore);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    return content || fallbackSummary(readinessScore);
  } catch (err) {
    console.error('Groq API request failed:', err.message);
    return fallbackSummary(readinessScore);
  }
}
