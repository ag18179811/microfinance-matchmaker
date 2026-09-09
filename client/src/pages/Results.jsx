import ScoreGauge from '../components/ScoreGauge.jsx';
import FollowUpChat from '../components/FollowUpChat.jsx';
import WhatIfSimulator from '../components/WhatIfSimulator.jsx';
import BusinessCase from '../components/BusinessCase.jsx';
import LenderPrep from '../components/LenderPrep.jsx';
import ImprovementPlan from '../components/ImprovementPlan.jsx';
import AdvisorBridge from '../components/AdvisorBridge.jsx';
import Tracker from '../components/Tracker.jsx';
import FundingPlan from '../components/FundingPlan.jsx';
import CashflowProjection from '../components/CashflowProjection.jsx';
import DocumentVault from '../components/DocumentVault.jsx';
import NextStep from '../components/NextStep.jsx';
import BusinessPlan from '../components/BusinessPlan.jsx';
import ResultsNav from '../components/ResultsNav.jsx';
import { useCallback, useEffect, useState } from 'react';
import { authedFetch } from '../api.js';

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

const HELP_MODE_ICON = {
  organizer: '⚡',
  demystifier: '🧭',
  rebuilder: '🌱',
  strategist: '🔄',
};

// Stable per-program key for tracking. Name-derived (not a row id) so a
// tracked program stays tracked across a re-search. Kept identical to the
// server copy `programKey` in server/routes/match.js.
function lenderKeyOf(m) {
  return (
    String(m.name || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-+|-+$)/g, '')
      .slice(0, 80) || 'program'
  );
}

export default function Results({ results, conversationId, onResultsUpdate }) {
  const { readinessScore, aiSummary, matches, subScores, applicationId, helpMode } = results;
  const topMatch = matches[0]?.match_score ?? 0;

  const [tracked, setTracked] = useState([]);
  const [docsVersion, setDocsVersion] = useState(0);
  const [shareState, setShareState] = useState('idle'); // idle | working | copied
  const [rediscoverState, setRediscoverState] = useState('idle'); // idle | working | done | throttled

  async function rediscover() {
    if (rediscoverState === 'working') return;
    setRediscoverState('working');
    try {
      const res = await authedFetch(`/api/match/${applicationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rediscover: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'search failed');
      onResultsUpdate?.(data);
      setRediscoverState('done');
      setTimeout(() => setRediscoverState('idle'), 4000);
    } catch {
      setRediscoverState('idle');
    }
  }

  async function shareReport() {
    setShareState('working');
    try {
      const res = await authedFetch(`/api/applications/${applicationId}/share`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error();
      const url = `${window.location.origin}${data.path}`;
      try {
        await navigator.clipboard.writeText(url);
        setShareState('copied');
        setTimeout(() => setShareState('idle'), 2500);
      } catch {
        window.prompt('Copy this link to share your report:', url);
        setShareState('idle');
      }
    } catch {
      setShareState('idle');
    }
  }
  const refreshTracked = useCallback(() => {
    if (!applicationId) return;
    authedFetch(`/api/tracker/${applicationId}`)
      .then((r) => (r.ok ? r.json() : { tracked: [] }))
      .then((d) => setTracked(d.tracked || []))
      .catch(() => {});
  }, [applicationId]);
  useEffect(refreshTracked, [refreshTracked]);

  const trackedKeys = new Set(tracked.map((t) => t.lenderKey));

  async function toggleTrack(m) {
    const key = lenderKeyOf(m);
    try {
      if (trackedKeys.has(key)) {
        await authedFetch(`/api/tracker/${applicationId}/${encodeURIComponent(key)}`, { method: 'DELETE' });
      } else {
        await authedFetch(`/api/tracker/${applicationId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lenderKey: key, lenderName: m.name, fundingType: m.funding_type || 'loan', status: 'considering' }),
        });
      }
      refreshTracked();
    } catch {
      /* non-critical */
    }
  }

  return (
    <div className="page-wide">
      <div className="results-header">
        <div className="results-heading">
          <h1>Your funding readiness</h1>
          <p>Based on what you told us, here's where you stand and who's likely to fund you.</p>
        </div>
        <div className="results-header-actions">
          {applicationId && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={shareReport} disabled={shareState === 'working'}>
              {shareState === 'copied' ? '✓ Link copied' : shareState === 'working' ? '…' : 'Share report'}
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm results-print-btn" onClick={() => window.print()}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 6V2h8v4M4 12H2V7h12v5h-2M4 10h8v4H4z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Save as PDF
          </button>
        </div>
      </div>
      <p className="print-only print-tagline">
        Microfinance Matchmaker — funding readiness report. Not a lender; does not guarantee approval. Confirm
        every program's current requirements on its official site.
      </p>

      {helpMode && (
        <div className={`help-mode-banner help-mode-${helpMode.mode}`}>
          <span className="help-mode-icon" aria-hidden="true">{HELP_MODE_ICON[helpMode.mode] || '•'}</span>
          <div>
            <div className="help-mode-headline">{helpMode.headline}</div>
            <p className="help-mode-blurb">{helpMode.blurb}</p>
          </div>
        </div>
      )}

      <NextStep readinessScore={readinessScore} helpMode={helpMode} matches={matches} tracked={tracked} />

      <ResultsNav />

      <div className="stat-row" id="standing">
        <div className="stat-card gauge-card">
          <ScoreGauge value={readinessScore} />
          <div className="gauge-copy">
            <div className="stat-value">{readinessScore}/100</div>
            <div className="stat-label">Readiness score</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{matches.length}</div>
          <div className="stat-label">Matched programs</div>
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

      <div id="raise">{applicationId && <ImprovementPlan applicationId={applicationId} />}</div>

      {helpMode?.mode === 'rebuilder' && <AdvisorBridge prominent />}

      {applicationId && <WhatIfSimulator applicationId={applicationId} />}

      <div className="results-phase">
        <span className="results-phase-line" />
        <span className="results-phase-label">Now prepare to apply</span>
        <span className="results-phase-line" />
      </div>

      <div id="fundingplan">{applicationId && matches.length > 1 && <FundingPlan applicationId={applicationId} />}</div>

      <div id="applications">
        {applicationId && <Tracker applicationId={applicationId} tracked={tracked} onChange={refreshTracked} />}
      </div>

      <div id="story">{applicationId && <BusinessCase applicationId={applicationId} onProfileSynced={onResultsUpdate} />}</div>

      <div id="prep">
      {applicationId && <CashflowProjection applicationId={applicationId} />}

      {applicationId && (
        <BusinessPlan
          applicationId={applicationId}
          hint={
            matches.some((m) => /sba microloan/i.test(m.name)) || helpMode?.mode === 'rebuilder'
              ? 'One of your matches (or your situation) calls for a written business plan — here\'s a draft to build on'
              : undefined
          }
        />
      )}

      {applicationId && <DocumentVault applicationId={applicationId} onChange={() => setDocsVersion((v) => v + 1)} />}
      </div>

      <div id="lenders">
      {applicationId && matches.length > 0 && <LenderPrep applicationId={applicationId} refreshSignal={docsVersion} />}

      <div className="section-title-row">
        <h2 className="section-title" style={{ marginBottom: 0 }}>Matched programs</h2>
        {applicationId && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={rediscover}
            disabled={rediscoverState === 'working'}
          >
            {rediscoverState === 'working'
              ? 'Searching…'
              : rediscoverState === 'done'
                ? '✓ Search refreshed'
                : 'Search again'}
          </button>
        )}
      </div>
      {matches.length > 0 && (
        <p className="section-note">
          These programs were found by a live web search matched to your specific business — your location, industry,
          what the funding is for, and your situation. A fresh search can turn up different programs (new rounds open
          often), so it's worth running again later. Confirm current details on each program's official site before
          applying; approvals and terms vary, so apply to as many as you qualify for.
        </p>
      )}

      {matches.length === 0 ? (
        <div className="empty-state">
          The live search didn't surface programs for your current profile right now. Try{' '}
          <strong>Search again</strong> above, adjust your funding amount, location, or what the money is for — new
          programs and rounds open regularly.
        </div>
      ) : (
        <div className="lender-list">
          {matches.map((m, i) => {
            const industries = (m.industries || '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            const geo = formatGeography(m.geography);
            const cardKey = `${m.provenance || 'discovered'}-${m.id}`;

            return (
              <div className="lender-card" key={cardKey} style={{ animationDelay: `${Math.min(i, 8) * 0.06}s` }}>
                <div className="lender-card-top">
                  <div className="lender-name">
                    <span className="lender-rank">#{i + 1}</span>
                    {m.name}
                    {m.funding_type === 'grant' && (
                      <span className="tag tag-grant" title="A grant is money you don't repay — competitive and awarded on a cycle.">
                        Grant
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
                    <dt>{m.funding_type === 'grant' ? 'Award range' : 'Loan range'}</dt>
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
                        {m.funding_type === 'grant' ? `Apply for the ${m.name}` : `Apply with ${m.name}`}
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

                {applicationId && (
                  <button
                    type="button"
                    className={`lender-track-btn ${trackedKeys.has(lenderKeyOf(m)) ? 'is-tracked' : ''}`}
                    onClick={() => toggleTrack(m)}
                  >
                    {trackedKeys.has(lenderKeyOf(m)) ? '✓ Tracking this' : '+ Track this program'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>

      {helpMode?.mode !== 'rebuilder' && <AdvisorBridge />}

      {conversationId && <FollowUpChat conversationId={conversationId} />}
    </div>
  );
}
