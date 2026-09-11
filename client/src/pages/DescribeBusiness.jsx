import { useRef, useState } from 'react';

const PLACEHOLDER =
  "Describe your business. For example: I run a coffee shop in Austin, TX. We've been open " +
  "about 3 years, do roughly $180,000 a year in revenue, and I'm looking for $20,000 " +
  'to buy a new espresso machine and renovate the seating area.';

export default function DescribeBusiness({ onStart }) {
  const [description, setDescription] = useState('');
  const textareaRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = description.trim();
    if (!trimmed) return;
    onStart(trimmed);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <div className="hero">
      <h1>What does your business need funding for?</h1>
      <p className="hero-subtitle">
        Describe your business in your own words. We'll chat through a couple quick follow-up
        questions for whatever's missing, then search the web for programs matched to your specific situation.
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
          <button className="send-btn" type="submit" disabled={!description.trim()} aria-label="Start conversation">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
