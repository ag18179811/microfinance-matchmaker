import { useRef, useState } from 'react';
import { authedFetch } from '../api.js';

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return idCounter;
}

// Deliberately starts empty rather than replaying the structured interview
// transcript — the AI still has full context server-side (this posts into
// the same conversation thread), this just keeps the results page from
// feeling cluttered with a Q&A log the user already saw on the chat screen.
export default function FollowUpChat({ conversationId }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || busy) return;

    setInputValue('');
    setError(null);
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', text }]);
    setBusy(true);
    try {
      const res = await authedFetch(`/api/interview/${conversationId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send that message');
      setMessages((prev) => [...prev, { id: nextId(), role: 'ai', text: data.reply }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  return (
    <div className="followup-card">
      <h2 className="section-title">Ask a follow-up</h2>
      <p className="followup-subtitle">
        Keep talking with the AI about your results — it remembers your full profile and matches from this
        conversation, and you can come back to it anytime from your chat history.
      </p>

      {messages.length > 0 && (
        <div className="followup-thread">
          {messages.map((m) => (
            <div className={`followup-msg ${m.role === 'user' ? 'followup-msg-user' : 'followup-msg-ai'}`} key={m.id}>
              {m.text}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}

      <form className="followup-input-row" onSubmit={handleSubmit}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="e.g. Which lender should I apply to first?"
          disabled={busy}
        />
        <button className="btn btn-primary" type="submit" disabled={busy || !inputValue.trim()}>
          {busy ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
