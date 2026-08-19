import ScoreGauge from '../components/ScoreGauge.jsx';

function formatType(type) {
  if (!type) return '';
  if (type.toUpperCase() === 'CDFI') return 'CDFI';
  return type
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

function matchBadgeClass(score) {
  if (score >= 85) return 'match-badge match-badge-high';
  if (score >= 65) return 'match-badge match-badge-mid';
  return 'match-badge match-badge-low';
}

function formatCurrency(n) {
  if (n === null || n === undefined) return '—';
  return `$${Number(n).toLocaleString()}`;
}

export default function Results({ results, onStartOver }) {
  const { readinessScore, aiSummary, matches } = results;
  const topMatch = matches[0]?.match_score ?? 0;

  return (
    <div className="page-wide">
      <div className="results-header">
        <div className="results-heading">
          <h1>Your funding readiness</h1>
          <p>Based on what you told us, here's where you stand and who's likely to fund you.</p>
        </div>
        <button className="btn btn-secondary" onClick={onStartOver}>
          Start a new application
        </button>
      </div>

      <div className="stat-row">
        <div className="stat-card gauge-card">
          <ScoreGauge value={readinessScore} />
          <div className="gauge-copy">
            <div className="stat-value">{readinessScore}/100</div>
            <div className="stat-label">Readiness score</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{matches.length}</div>
          <div className="stat-label">Matched lenders</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{matches.length > 0 ? `${topMatch}%` : '—'}</div>
          <div className="stat-label">Top match strength</div>
        </div>
      </div>

      <div className="coaching-card">
        <div className="coaching-header">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1l1.85 4 4.15.5-3 2.9.75 4.1L8 10.5 4.25 12.5 5 8.4l-3-2.9 4.15-.5L8 1z" fill="currentColor" />
          </svg>
          AI Coaching Summary
        </div>
        <div className="coaching-body">{aiSummary}</div>
      </div>

      <h2 className="section-title">Matched lenders</h2>

      {matches.length === 0 ? (
        <div className="empty-state">No lenders matched your current profile — try adjusting your funding amount or location.</div>
      ) : (
        <div className="lender-list">
          {matches.map((m, i) => {
            const industries = (m.industries || '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);

            return (
              <div className="lender-card" key={m.id}>
                <div className="lender-card-top">
                  <div className="lender-name">
                    <span className="lender-rank">#{i + 1}</span>
                    {m.name}
                  </div>
                  <span className={matchBadgeClass(m.match_score)}>{m.match_score}% match</span>
                </div>

                <div className="match-bar-track">
                  <div className="match-bar-fill" style={{ width: `${m.match_score}%` }} />
                </div>

                <div className="tag-row">
                  <span className="tag tag-type">{formatType(m.type)}</span>
                  {industries.slice(0, 4).map((ind) => (
                    <span className="tag" key={ind}>
                      {ind}
                    </span>
                  ))}
                  {industries.length > 4 && <span className="tag">+{industries.length - 4} more</span>}
                </div>

                <dl className="lender-meta">
                  <div>
                    <dt>Geography served</dt>
                    <dd>{m.geography}</dd>
                  </div>
                  <div>
                    <dt>Loan range</dt>
                    <dd>
                      {formatCurrency(m.min_loan)} – {formatCurrency(m.max_loan)}
                    </dd>
                  </div>
                </dl>

                {m.eligibility_notes && <div className="lender-notes">{m.eligibility_notes}</div>}
              </div>
            );
          })}
        </div>
      )}

      <div className="results-footer">
        <button className="btn btn-secondary" onClick={onStartOver}>
          Start a new application
        </button>
      </div>
    </div>
  );
}
