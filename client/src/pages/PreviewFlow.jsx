import { useState } from 'react';
import { apiUrl } from '../api.js';
import ScoreGauge from '../components/ScoreGauge.jsx';

const INDUSTRIES = [
  'Retail', 'Food Service', 'Personal Services', 'Professional Services', 'Manufacturing',
  'Construction', 'Transportation', 'Wholesale', 'Agriculture', 'Tourism', 'Health Care',
  'Child Care', 'Arts and Entertainment', 'Technology', 'Real Estate',
];

const LANDING_STEPS = [
  {
    title: 'Describe your business',
    body: 'Tell us about your business in plain English. No forms, no jargon. We only ask follow-up questions for what you didn’t already cover.',
  },
  {
    title: 'Get your readiness score',
    body: 'We score your funding readiness, then search the web for CDFI, city, county, grant, and nonprofit programs matched to your specific situation, not a preset list.',
  },
  {
    title: 'See ranked matches & next steps',
    body: 'Review your best-fit programs with match strength, funding ranges, and eligibility notes, plus AI coaching on how to strengthen your application.',
  },
];

const LANDING_TRUST = [
  {
    title: 'We never sell your data',
    body: 'Your business details are used only to calculate your readiness score and find matches. Never sold or shared with third parties for marketing.',
  },
  {
    title: 'Deterministic, transparent scoring',
    body: 'Once programs are found for you, the eligibility and match scoring runs on fixed, rules-based logic, not a black-box model, so every match reason is explainable.',
  },
  {
    title: 'AI is used for coaching only',
    body: 'Generative AI helps turn your description into structured fields and writes plain-language coaching notes. It never makes eligibility or approval decisions.',
  },
];

function GoogleButton({ onClick, label }) {
  return (
    <button type="button" className="google-signin-btn" onClick={onClick}>
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.71v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.61z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 009 18z" />
        <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 013.68 9c0-.59.1-1.17.27-1.7V4.97H.96A9 9 0 000 9c0 1.45.35 2.83.96 4.03l2.99-2.33z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 00.96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
      </svg>
      {label}
    </button>
  );
}

export default function PreviewFlow({ onSignIn }) {
  const [mode, setMode] = useState('intro'); // intro | form | result
  const [form, setForm] = useState({ state: '', industry: '', years: '', revenue: '', amount: '' });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/preview'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: form.state.trim(),
          industry: form.industry || undefined,
          time_in_business_months: Math.round(Number(form.years) * 12),
          annual_revenue: Number(String(form.revenue).replace(/[^0-9.]/g, '')),
          requested_amount: Number(String(form.amount).replace(/[^0-9.]/g, '')),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not run the estimate');
      setResult(data);
      setMode('result');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'intro') {
    return (
      <>
        <div className="landing-hero">
          <div className="landing-hero-inner">
            <div className="landing-copy">
              <h1>Know where you stand before a lender tells you no</h1>
              <p className="hero-subtitle">
                Describe your business in plain English. Get a readiness score, programs matched to your specific
                situation instead of a preset list, and a funding story you can actually hand to a reviewer.
              </p>
              <div className="preview-cta-row">
                <button type="button" className="btn btn-primary" onClick={() => setMode('form')}>
                  Try the quick estimate
                </button>
                <button type="button" className="btn btn-secondary" onClick={onSignIn}>
                  Sign in to start
                </button>
              </div>
              <div className="trust-row">
                <span className="trust-item">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="7" fill="var(--color-success-light)" />
                    <path d="M4 7.2l2 2 4-4.4" stroke="var(--color-success)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Free · no credit check · nothing saved until you sign in
                </span>
              </div>
            </div>

            <div className="proof-card" aria-hidden="true">
              <div className="proof-head">
                <span className="proof-business">Rivera Family Bakery</span>
                <span className="proof-tag">Sample report</span>
              </div>
              <div className="proof-score-row">
                <ScoreGauge value={75} size={68} strokeWidth={7} />
                <div>
                  <div className="proof-score-num">75/100</div>
                  <div className="proof-score-label">Funding readiness</div>
                </div>
              </div>
              <div className="proof-match">
                <div className="proof-match-top">
                  <span className="proof-match-name">Accion Opportunity Fund</span>
                  <span className="proof-match-pct">92% match</span>
                </div>
                <div className="proof-match-track"><div className="proof-match-fill" style={{ width: '92%' }} /></div>
              </div>
              <div className="proof-match">
                <div className="proof-match-top">
                  <span className="proof-match-name">Community storefront grant</span>
                  <span className="proof-match-pct">81% match</span>
                </div>
                <div className="proof-match-track"><div className="proof-match-fill" style={{ width: '81%' }} /></div>
              </div>
            </div>
          </div>
        </div>

        <section id="how-it-works" className="section-band">
          <div className="section-inner">
            <div className="section-heading">
              <div className="card-eyebrow" style={{ textAlign: 'center' }}>How it works</div>
              <h2 className="section-band-title">From description to matched programs in minutes</h2>
            </div>
            <div className="steps-grid">
              {LANDING_STEPS.map((step, i) => (
                <div className="step-card" key={step.title}>
                  <div className="step-number">{String(i + 1).padStart(2, '0')}</div>
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
              <div className="card-eyebrow" style={{ textAlign: 'center' }}>Security &amp; trust</div>
              <h2 className="section-band-title">Built to be transparent, not another black box</h2>
            </div>
            <div className="steps-grid">
              {LANDING_TRUST.map((point, i) => (
                <div className="step-card" key={point.title}>
                  <div className="step-number">{String(i + 1).padStart(2, '0')}</div>
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

  if (mode === 'form') {
    return (
      <div className="preview-card">
        <h1>Quick readiness estimate</h1>
        <p className="preview-sub">Four questions. Rough numbers are fine.</p>
        <form onSubmit={submit} className="preview-form">
          <label>
            What state is your business in?
            <input type="text" value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="e.g. TX or Texas" required />
          </label>
          <label>
            Industry <span className="preview-optional">(optional)</span>
            <select value={form.industry} onChange={(e) => set('industry', e.target.value)}>
              <option value="">Choose one…</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </label>
          <label>
            How long have you been in business? <span className="preview-optional">(years)</span>
            <input type="number" min="0" step="0.5" value={form.years} onChange={(e) => set('years', e.target.value)} placeholder="e.g. 1.5" required />
          </label>
          <label>
            Roughly what's your annual revenue?
            <input type="text" inputMode="numeric" value={form.revenue} onChange={(e) => set('revenue', e.target.value)} placeholder="e.g. 90,000" required />
          </label>
          <label>
            How much funding do you need?
            <input type="text" inputMode="numeric" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="e.g. 25,000" required />
          </label>
          {error && <div className="alert alert-danger">{error}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Estimating…' : 'See my estimate'}
          </button>
        </form>
      </div>
    );
  }

  // result
  return (
    <div className="preview-card">
      <h1>Your quick estimate</h1>
      <div className="preview-result">
        <ScoreGauge value={result.readinessScore} size={110} />
        <div>
          <div className="preview-score-num">{result.readinessScore}/100</div>
          <div className="preview-score-label">Estimated readiness</div>
          {result.weakestFactor && (
            <p className="preview-weakest">Biggest thing holding the number down right now: {result.weakestFactor}.</p>
          )}
        </div>
      </div>

      <p className="preview-note">{result.note}</p>

      <div className="preview-signin-block">
        <p>Sign in to get the real report: your matches, your funding story, and a plan to raise the number.</p>
        <GoogleButton onClick={onSignIn} label="Sign in with Google to continue" />
        <button type="button" className="bc-linkbtn" onClick={() => setMode('form')}>
          ← Adjust my numbers
        </button>
      </div>
    </div>
  );
}
