// Post-results conversation. Once an interview is complete and matches have
// been generated, further messages in the same thread land here instead of
// the structured extraction loop in groq-interview.js — this is a grounded
// Q&A coach over the applicant's own stored data, not another attempt to
// gather fields. It never changes the readiness score or match results;
// matching-engine.js remains the only thing that computes those.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-120b';

const SYSTEM_PROMPT_BASE =
  'You are a funding readiness coach continuing a conversation with a small business owner AFTER their ' +
  "readiness report and lender matches have already been generated. Answer using the applicant's profile, " +
  'the specific business-particular facts in additionalNotes, and match data provided below — be concrete ' +
  "and specific to THIS business rather than generic advice. Each match's officialLink is the verified " +
  'real URL for that program — share it when relevant, never invent or guess a different URL. You cannot ' +
  'change their readiness score or match results; you can only explain, advise, and clarify. If asked ' +
  'something unrelated to their funding readiness, gently steer back to that topic.';

function fallbackReply() {
  return (
    'AI follow-up chat is unavailable right now (no GROQ_API_KEY configured, or the Groq API request failed). ' +
    'Your results above are still fully valid — set GROQ_API_KEY in your .env to enable continued conversation.'
  );
}

export async function generateFollowUpReply({ application, subScores, readinessScore, matches, history }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return fallbackReply();

  let additionalNotes = [];
  try {
    additionalNotes = typeof application.additional_notes === 'string' ? JSON.parse(application.additional_notes) : application.additional_notes || [];
  } catch {
    additionalNotes = [];
  }

  const context = JSON.stringify({
    application: { ...application, additional_notes: undefined },
    additionalNotes,
    subScores,
    readinessScore,
    topMatches: matches.slice(0, 5).map((m) => ({
      name: m.name,
      matchScore: m.match_score,
      loanRange: [m.min_loan, m.max_loan],
      reasons: m.reasons,
      cautions: m.cautions,
      officialLink: m.source_url,
    })),
  });

  const messages = [
    { role: 'system', content: `${SYSTEM_PROMPT_BASE}\n\nApplicant profile and match results (JSON):\n${context}` },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.4 }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Groq follow-up error (${response.status}): ${errorText}`);
      return 'I ran into a problem answering that — mind trying again?';
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "I couldn't quite come up with an answer to that — try rephrasing?";
  } catch (err) {
    console.error('Groq follow-up request failed:', err.message);
    return 'I ran into a problem answering that — mind trying again?';
  }
}
