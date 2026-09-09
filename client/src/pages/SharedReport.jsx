import { useEffect, useState } from 'react';
import { apiUrl } from '../api.js';
import ScoreGauge from '../components/ScoreGauge.jsx';

const FACTOR_LABELS = {
  timeInBusiness: 'Time in business',
  revenueStability: 'Revenue stability',
  requestToRevenueRatio: 'Loan-to-revenue ratio',
  completeness: 'Profile completeness',
  answerQuality: 'Answer credibility',
};

function money(n) {
  return n == null ? '—' : `$${Number(n).toLocaleString()}`;
}

export default function SharedReport({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(apiUrl(`/api/shared/${token}`))
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Could not load this report');
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [token]);

  if (error) {
    return (
      <main className="main" id="main">
        <div className="page">
          <div className="alert alert-danger">{error}</div>
        </div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="main" id="main">
        <div className="hero">
          <div className="spinner" />
        </div>
      </main>
    );
  }

  return (
    <main className="main" id="main">
      <div className="page-wide">
        <div className="shared-banner">
          <strong>Shared funding readiness report</strong> — {data.businessName || 'a business'}
          {data.location ? ` · ${data.location}` : ''}. Read-only; shared by the owner.
        </div>

        <div className="results-header">
          <div className="results-heading">
            <h1>{data.businessName || 'Funding readiness'}</h1>
            <p>
              {data.industry ? `${data.industry}. ` : ''}Seeking {money(data.requestedAmount)}.
            </p>
          </div>
        </div>

        {data.helpMode && (
          <div className={`help-mode-banner help-mode-${data.helpMode.mode}`}>
            <div>
              <div className="help-mode-headline">{data.helpMode.headline}</div>
              <p className="help-mode-blurb">{data.helpMode.blurb}</p>
            </div>
          </div>
        )}

        <div className="stat-row">
          <div className="stat-card gauge-card">
            <ScoreGauge value={data.readinessScore} />
            <div className="gauge-copy">
              <div className="stat-value">{data.readinessScore}/100</div>
              <div className="stat-label">Readiness score</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{data.matches.length}</div>
            <div className="stat-label">Matched programs</div>
          </div>
        </div>

        {data.aiSummary && (
          <div className="coaching-card">
            <div className="coaching-header">AI Coaching Summary</div>
            <div className="coaching-body">{data.aiSummary}</div>
          </div>
        )}

        {data.subScores && (
          <div className="breakdown-card">
            <h2 className="section-title">Readiness breakdown</h2>
            <div className="breakdown-grid">
              {Object.entries(FACTOR_LABELS).map(([k, label]) => (
                <div className="breakdown-row" key={k}>
                  <div className="breakdown-row-top">
                    <span className="breakdown-label">{label}</span>
                    <span className="breakdown-value">{data.subScores[k] ?? 0}/100</span>
                  </div>
                  <div className="breakdown-bar-track">
                    <div className="breakdown-bar-fill" style={{ width: `${data.subScores[k] ?? 0}%`, background: 'var(--color-primary)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.fundingStory?.length > 0 && (
          <div className="bc-card">
            <h2 className="section-title">Funding story</h2>
            <div className="bc-sections">
              {data.fundingStory.map((s) => (
                <div className="bc-section bc-tone-ok" key={s.heading}>
                  <div className="bc-section-head">
                    <h3>{s.heading}</h3>
                  </div>
                  <p className="bc-body">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.fundingPlan && (
          <div className="fp-card">
            <h2 className="section-title">Funding plan</h2>
            <div className="fp-stack">
              {data.fundingPlan.stack.map((p, i) => (
                <div className={`fp-piece ${p.speculative ? 'fp-piece-grant' : ''}`} key={p.name}>
                  <div className="fp-piece-step">{i + 1}</div>
                  <div className="fp-piece-body">
                    <div className="fp-piece-top">
                      <span className="fp-piece-name">{p.name}</span>
                      <span className="fp-piece-amount">
                        {p.speculative ? (p.amount ? `up to ${money(p.amount)}` : 'amount varies') : money(p.amount)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {data.fundingPlan.rationale && <div className="fp-rationale">{data.fundingPlan.rationale}</div>}
          </div>
        )}

        <h2 className="section-title">Matched programs</h2>
        <div className="lender-list">
          {data.matches.map((m) => (
            <div className="lender-card" key={m.name}>
              <div className="lender-card-top">
                <div className="lender-name">
                  {m.name}
                  {m.fundingType === 'grant' && <span className="tag tag-grant" style={{ marginLeft: '0.5rem' }}>Grant</span>}
                </div>
                <span className="match-badge match-badge-mid">{m.matchScore}% match</span>
              </div>
              <div className="match-bar-track">
                <div className="match-bar-fill" style={{ width: `${m.matchScore}%` }} />
              </div>
              <dl className="lender-meta">
                <div>
                  <dt>{m.fundingType === 'grant' ? 'Award range' : 'Loan range'}</dt>
                  <dd>{money(m.minLoan)} – {money(m.maxLoan)}</dd>
                </div>
              </dl>
              {m.reasons?.length > 0 && (
                <ul className="analysis-list analysis-list-good">
                  {m.reasons.map((r) => <li key={r}>{r}</li>)}
                </ul>
              )}
              {m.applyUrl && (
                <a className="btn btn-primary lender-apply-btn" href={m.applyUrl} target="_blank" rel="noreferrer">
                  {m.fundingType === 'grant' ? `Apply for the ${m.name}` : `Apply with ${m.name}`} ↗
                </a>
              )}
            </div>
          ))}
        </div>

        <p className="shared-foot">
          Generated by Microfinance Matchmaker. Not a lender; does not guarantee approval. Confirm every
          program's current requirements on its official site.
        </p>
      </div>
    </main>
  );
}
