import { useRef, useState } from 'react';

const PLACEHOLDER =
  "Describe your business — e.g. I run a coffee shop in Austin, TX. We've been open " +
  "about 3 years, do roughly $180,000 a year in revenue, and I'm looking for $20,000 " +
  'to buy a new espresso machine and renovate the seating area.';

const EXAMPLES = [
  "I run a coffee shop in Austin, TX. Open 3 years, ~$180k revenue, need $20k for equipment.",
  "Landscaping business in Denver, CO, 5 years in, want $50k to buy a second truck.",
  "First-year bakery in Detroit, MI doing about $60k, need $15k for a new oven.",
];

const TRUST_ITEMS = [
  'Free to use',
  'No credit check to see matches',
  'Real CDFI & city loan programs',
  'Your data is never sold',
];

const STEPS = [
  {
    title: 'Describe your business',
    body: 'Tell us about your business in plain English — no forms, no jargon. We only ask follow-up questions for what you didn’t already cover.',
  },
  {
    title: 'Get your readiness score',
    body: 'We score your funding readiness and match you against a database of CDFI, city, and nonprofit lending programs based on your industry, location, and needs.',
  },
  {
    title: 'See ranked matches & next steps',
    body: 'Review your best-fit lenders with match strength, loan ranges, and eligibility notes — plus AI coaching on how to strengthen your application.',
  },
];

const TRUST_POINTS = [
  {
    title: 'We never sell your data',
    body: 'Your business details are used only to calculate your readiness score and find matches — never sold or shared with third parties for marketing.',
  },
  {
    title: 'Deterministic, transparent scoring',
    body: 'Lender matching and eligibility scoring run on fixed, rules-based logic — not a black-box model — so match reasons are consistent and explainable.',
  },
  {
    title: 'AI is used for coaching only',
    body: 'Generative AI helps turn your description into structured fields and writes plain-language coaching notes. It never makes eligibility or approval decisions.',
  },
];

export default function DescribeBusiness({ onStart }) {
  const [description, setDescription] = useState('');
  const textareaRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = description.trim();
    if (!trimmed) return;
    onStart(trimmed);
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
    <>
      <div className="hero">
        <span className="hero-eyebrow">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1l1.4 3 3.3.4-2.4 2.3.6 3.3L6 8.4 3.1 10l.6-3.3L1.3 4.4l3.3-.4L6 1z" fill="currentColor" />
          </svg>
          AI-powered funding readiness
        </span>
        <h1>What does your business need funding for?</h1>
        <p className="hero-subtitle">
          Describe your business in your own words. We'll chat through a couple quick follow-up
          questions for whatever's missing, then match you with real CDFI and city microloan programs.
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

        <div className="example-chips">
          {EXAMPLES.map((text) => (
            <button type="button" className="example-chip" key={text} onClick={() => useExample(text)}>
              {text.length > 58 ? `${text.slice(0, 58)}…` : text}
            </button>
          ))}
        </div>

        <div className="trust-row">
          {TRUST_ITEMS.map((item) => (
            <span className="trust-item" key={item}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="7" fill="var(--color-success-light)" />
                <path d="M4 7.2l2 2 4-4.4" stroke="var(--color-success)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {item}
            </span>
          ))}
        </div>
      </div>

      <section id="how-it-works" className="section-band">
        <div className="section-inner">
          <div className="section-heading">
            <div className="card-eyebrow" style={{ textAlign: 'center' }}>
              How it works
            </div>
            <h2 className="section-band-title">From description to matched lenders in minutes</h2>
          </div>
          <div className="steps-grid">
            {STEPS.map((step, i) => (
              <div className="step-card" key={step.title}>
                <div className="step-number">{i + 1}</div>
                <h3 className="step-title">{step.title}</h3>
                <p className="step-body">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="trust" className="section-band section-band-alt">
        <div className="section-inner">
          <div className="section-heading">
            <div className="card-eyebrow" style={{ textAlign: 'center' }}>
              Security &amp; trust
            </div>
            <h2 className="section-band-title">Built to be transparent, not another black box</h2>
          </div>
          <div className="steps-grid">
            {TRUST_POINTS.map((point) => (
              <div className="step-card" key={point.title}>
                <h3 className="step-title">{point.title}</h3>
                <p className="step-body">{point.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
