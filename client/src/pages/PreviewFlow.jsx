import { useState } from 'react';
import { apiUrl } from '../api.js';
import ScoreGauge from '../components/ScoreGauge.jsx';

const INDUSTRIES = [
  'Retail', 'Food Service', 'Personal Services', 'Professional Services', 'Manufacturing',
  'Construction', 'Transportation', 'Wholesale', 'Agriculture', 'Tourism', 'Health Care',
  'Child Care', 'Arts and Entertainment', 'Technology', 'Real Estate',
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
      <div className="hero">
        <span className="hero-eyebrow">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1l1.4 3 3.3.4-2.4 2.3.6 3.3L6 8.4 3.1 10l.6-3.3L1.3 4.4l3.3-.4L6 1z" fill="currentColor" />
          </svg>
          AI-powered funding readiness
        </span>
        <h1>See where you stand with lenders</h1>
        <p className="hero-subtitle">
          Get a quick readiness estimate from four questions — no account needed. Then sign in for the full
          report: an adaptive interview, live-matched CDFIs and grants, and a funding story you can hand to a
          lender.
        </p>
        <div className="preview-cta-row">
          <button type="button" className="btn btn-primary" onClick={() => setMode('form')}>
            Try the quick estimate
          </button>
          <button type="button" className="btn btn-secondary" onClick={onSignIn}>
            Sign in to start
          </button>
        </div>
        <div className="trust-row" style={{ marginTop: '2rem' }}>
          <span className="trust-item">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="7" fill="var(--color-success-light)" />
              <path d="M4 7.2l2 2 4-4.4" stroke="var(--color-success)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            The estimate isn't saved anywhere. Sign-in is Google — we never see a password.
          </span>
        </div>
      </div>
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
        <p>Sign in to get the real report — your matches, your funding story, and a plan to raise the number.</p>
        <GoogleButton onClick={onSignIn} label="Sign in with Google to continue" />
        <button type="button" className="bc-linkbtn" onClick={() => setMode('form')}>
          ← Adjust my numbers
        </button>
      </div>
    </div>
  );
}
