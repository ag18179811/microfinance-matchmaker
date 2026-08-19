import { useRef, useState } from 'react';
import { apiUrl } from '../api.js';

const PLACEHOLDER =
  "Describe your business — e.g. I run a coffee shop in Austin, TX. We've been open " +
  "about 3 years, do roughly $180,000 a year in revenue, and I'm looking for $20,000 " +
  'to buy a new espresso machine and renovate the seating area.';

const EXAMPLES = [
  "I run a coffee shop in Austin, TX. Open 3 years, ~$180k revenue, need $20k for equipment.",
  "Landscaping business in Denver, CO, 5 years in, want $50k to buy a second truck.",
  "First-year bakery in Detroit, MI doing about $60k, need $15k for a new oven.",
];

export default function DescribeBusiness({ onExtracted }) {
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!description.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/intake/extract'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze description');
      onExtracted(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function useExample(text) {
    setDescription(text);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <div className="hero">
      <span className="hero-eyebrow">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 1l1.4 3 3.3.4-2.4 2.3.6 3.3L6 8.4 3.1 10l.6-3.3L1.3 4.4l3.3-.4L6 1z" fill="currentColor" />
        </svg>
        AI-powered funding readiness
      </span>
      <h1>What does your business need funding for?</h1>
      <p className="hero-subtitle">
        Describe your business in your own words. We'll figure out what we need, ask only for
        what's missing, then match you with real CDFI and city microloan programs.
      </p>

      <form className="composer" onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          rows="4"
          placeholder={PLACEHOLDER}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          required
        />
        <div className="composer-footer">
          <span className="composer-hint">Press Enter to submit, Shift+Enter for a new line</span>
          <button className="send-btn" type="submit" disabled={submitting || !description.trim()} aria-label="Analyze my business">
            {submitting ? (
              <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            ) : (
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="alert alert-danger" style={{ marginTop: '1.25rem', maxWidth: 680 }}>
          {error}
        </div>
      )}

      <div className="example-chips">
        {EXAMPLES.map((text) => (
          <button type="button" className="example-chip" key={text} onClick={() => useExample(text)}>
            {text.length > 58 ? `${text.slice(0, 58)}…` : text}
          </button>
        ))}
      </div>
    </div>
  );
}
