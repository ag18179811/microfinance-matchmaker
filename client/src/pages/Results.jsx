import ScoreGauge from '../components/ScoreGauge.jsx';
import FollowUpChat from '../components/FollowUpChat.jsx';
import WhatIfSimulator from '../components/WhatIfSimulator.jsx';

const READINESS_FACTORS = [
  { key: 'timeInBusiness', label: 'Time in business', blurb: 'Longer operating history lowers lender risk.' },
  { key: 'revenueStability', label: 'Revenue stability', blurb: 'Consistent revenue signals ability to repay.' },
  { key: 'requestToRevenueRatio', label: 'Loan-to-revenue ratio', blurb: 'How reasonable your ask is against what you bring in.' },
  { key: 'completeness', label: 'Profile completeness', blurb: 'How much of your application we could confirm.' },
  {
    key: 'answerQuality',
    label: 'Answer credibility',
    blurb: 'Whether your answers are specific, consistent, and hold up — independent of how big or established your business is.',
  },
];

// Anything past ~6 entries reads better as a count with the full list
// available on demand than as a wall of unbroken abbreviations.
function formatGeography(geography) {
  const states = (geography || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (states.length === 0) return { summary: '—', full: null };
  if (states.length === 1 && /national|nationwide/i.test(states[0])) return { summary: 'All 50 states', full: null };
  if (states.length <= 6) return { summary: states.join(', '), full: null };
  const hasDC = states.includes('DC');
  const count = hasDC ? states.length - 1 : states.length;
  return { summary: hasDC ? `${count} states + DC` : `${count} states`, full: states.join(', ') };
}

function factorColor(value) {
  if (value >= 75) return 'var(--color-success)';
  if (value >= 50) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

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

// The bare domain, shown under the apply button as a trust cue so the user
// can see where the link goes before clicking.
function linkHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export default function Results({ results, conversationId }) {
  const { readinessScore, aiSummary, matches, subScores, applicationId } = results;
  const topMatch = matches[0]?.match_score ?? 0;

  return (
    <div className="page-wide">
      <div className="results-header">
        <div className="results-heading">
          <h1>Your funding readiness</h1>
          <p>Based on what you told us, here's where you stand and who's likely to fund you.</p>
        </div>
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

      {subScores && (
        <div className="breakdown-card">
          <div className="breakdown-header">
            <h2 className="section-title" style={{ marginBottom: 0 }}>
              How your readiness score breaks down
            </h2>
            <p className="breakdown-subtitle">Five factors, weighted evenly — this is the actual math behind the {readinessScore}/100 above.</p>
          </div>
          <div className="breakdown-grid">
            {READINESS_FACTORS.map((factor) => {
              const value = subScores[factor.key] ?? 0;
              return (
                <div className="breakdown-row" key={factor.key}>
                  <div className="breakdown-row-top">
                    <span className="breakdown-label">{factor.label}</span>
                    <span className="breakdown-value" style={{ color: factorColor(value) }}>
                      {value}/100
                    </span>
                  </div>
                  <div className="breakdown-bar-track">
                    <div className="breakdown-bar-fill" style={{ width: `${value}%`, background: factorColor(value) }} />
                  </div>
                  <p className="breakdown-blurb">{factor.blurb}</p>
                </div>
              );
            })}
          </div>
          {subScores.answerQualityConcerns?.length > 0 && (
            <div className="quality-concerns">
              <p className="quality-concerns-title">Why your answer credibility score is lower:</p>
              <ul>
                {subScores.answerQualityConcerns.map((concern) => (
                  <li key={concern}>{concern}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {applicationId && <WhatIfSimulator applicationId={applicationId} />}

      <h2 className="section-title">Matched lenders</h2>
      {matches.length > 0 && (
        <p className="section-note">
          Every match below links straight to that program's official application page. Apply to as many as you
          qualify for — approvals and terms vary, so more applications means better odds.
        </p>
      )}

      {matches.length === 0 ? (
        <div className="empty-state">No lenders matched your current profile — try adjusting your funding amount or location.</div>
      ) : (
        <div className="lender-list">
          {matches.map((m, i) => {
            const industries = (m.industries || '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            const geo = formatGeography(m.geography);
            // Static and live-discovered lenders come from separate tables
            // with independent id sequences, so provenance must be part of
            // the key to stay unique.
            const cardKey = `${m.provenance || 'verified'}-${m.id}`;

            return (
              <div className="lender-card" key={cardKey} style={{ animationDelay: `${Math.min(i, 8) * 0.06}s` }}>
                <div className="lender-card-top">
                  <div className="lender-name">
                    <span className="lender-rank">#{i + 1}</span>
                    {m.name}
                    {m.provenance === 'discovered' && (
                      <span className="tag tag-discovered" title="Found via live web search rather than our hand-verified list — confirm details on the official site before applying.">
                        Auto-discovered
                      </span>
                    )}
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
                    <dd>
                      {geo.full ? (
                        <details className="geo-detail">
                          <summary>{geo.summary}</summary>
                          <span className="geo-full">{geo.full}</span>
                        </details>
                      ) : (
                        geo.summary
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Loan range</dt>
                    <dd>
                      {formatCurrency(m.min_loan)} – {formatCurrency(m.max_loan)}
                    </dd>
                  </div>
                </dl>

                {(m.reasons?.length > 0 || m.cautions?.length > 0) && (
                  <div className="lender-analysis">
                    {m.reasons?.length > 0 && (
                      <ul className="analysis-list analysis-list-good">
                        {m.reasons.map((reason) => (
                          <li key={reason}>
                            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                              <path d="M2.5 7.2l2.8 2.8L11.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {reason}
                          </li>
                        ))}
                      </ul>
                    )}
                    {m.cautions?.length > 0 && (
                      <ul className="analysis-list analysis-list-caution">
                        {m.cautions.map((caution) => (
                          <li key={caution}>
                            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                              <path d="M7 4.5v3.4M7 10.3v.1M1.5 12h11L7 2 1.5 12z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {caution}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {m.eligibility_notes && <div className="lender-notes">{m.eligibility_notes}</div>}

                <div className="lender-apply">
                  {m.source_url ? (
                    <>
                      <a className="btn btn-primary lender-apply-btn" href={m.source_url} target="_blank" rel="noreferrer">
                        Apply with {m.name}
                        <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                          <path d="M5 2h7v7M12 2L2 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </a>
                      {linkHost(m.source_url) && (
                        <span className="lender-apply-host">opens {linkHost(m.source_url)} in a new tab</span>
                      )}
                    </>
                  ) : (
                    <>
                      <a
                        className="btn btn-secondary lender-apply-btn"
                        href={`https://www.google.com/search?q=${encodeURIComponent(`${m.name} small business loan application`)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Find {m.name}'s application page
                        <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                          <path d="M5 2h7v7M12 2L2 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </a>
                      <span className="lender-apply-host">no official link on file yet — this searches for it</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {conversationId && <FollowUpChat conversationId={conversationId} />}
    </div>
  );
}
