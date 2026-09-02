import { useEffect, useRef, useState } from 'react';
import { authedFetch } from '../api.js';
import ScoreGauge from './ScoreGauge.jsx';

// "What if I changed my plan?" — re-runs the readiness + matching engine
// against a hypothetical version of the application (server: POST
// /api/match/:id/simulate) without saving anything. Three financial levers
// only; location/industry aren't simulated because changing them would need
// a fresh lender search. Degrades silently: if the endpoint isn't available
// (e.g. an older record with no stored breakdown) the card just doesn't
// render.

const LEVERS = [
  { key: 'requested_amount', label: 'Funding amount requested', kind: 'money' },
  { key: 'time_in_business_months', label: 'Time in business', kind: 'months' },
  { key: 'annual_revenue', label: 'Annual revenue', kind: 'money' },
];

function fmtMoney(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString()}`;
}

function fmtMonths(n) {
  const m = Math.round(Number(n) || 0);
  if (m < 12) return `${m} month${m === 1 ? '' : 's'}`;
  const years = Math.floor(m / 12);
  const rem = m % 12;
  return rem ? `${years}y ${rem}m` : `${years} year${years === 1 ? '' : 's'}`;
}

function fmtValue(kind, n) {
  return kind === 'months' ? fmtMonths(n) : fmtMoney(n);
}

function rangeFor(kind, current) {
  const c = Number(current) || 0;
  if (kind === 'months') {
    return { min: 0, max: Math.max(60, Math.ceil((c * 2) / 6) * 6), step: 1 };
  }
  // money
  const max = Math.max(kind === 'money' ? 50000 : 0, Math.ceil((c * 2) / 5000) * 5000, 50000);
  return { min: 0, max, step: Math.max(500, Math.round(max / 100 / 500) * 500) };
}

function Delta({ value, unit }) {
  if (value === 0) return <span className="whatif-delta whatif-delta-flat">no change</span>;
  const up = value > 0;
  return (
    <span className={`whatif-delta ${up ? 'whatif-delta-up' : 'whatif-delta-down'}`}>
      {up ? '▲' : '▼'} {up ? '+' : ''}
      {value}
      {unit ? ` ${unit}` : ''}
    </span>
  );
}

export default function WhatIfSimulator({ applicationId }) {
  const [snapshot, setSnapshot] = useState(null);
  const [values, setValues] = useState(null);
  const [sim, setSim] = useState(null);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const debounceRef = useRef(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authedFetch(`/api/match/${applicationId}/simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!res.ok || cancelled) return;
        const snap = {
          requested_amount: Number(data.applicationSnapshot?.requested_amount) || 0,
          time_in_business_months: Number(data.applicationSnapshot?.time_in_business_months) || 0,
          annual_revenue: Number(data.applicationSnapshot?.annual_revenue) || 0,
        };
        setSnapshot(snap);
        setValues(snap);
        setSim(data);
        setReady(true);
      } catch {
        /* silently unavailable */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  function runSim(nextValues) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setPending(true);
    debounceRef.current = setTimeout(async () => {
      const myId = ++reqIdRef.current;
      // Only send levers the user actually moved off their real value.
      const overrides = {};
      for (const { key } of LEVERS) {
        if (nextValues[key] !== snapshot[key]) overrides[key] = nextValues[key];
      }
      try {
        const res = await authedFetch(`/api/match/${applicationId}/simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(overrides),
        });
        const data = await res.json();
        if (res.ok && myId === reqIdRef.current) setSim(data);
      } catch {
        /* keep the last good result */
      } finally {
        if (myId === reqIdRef.current) setPending(false);
      }
    }, 300);
  }

  function setLever(key, val) {
    const next = { ...values, [key]: val };
    setValues(next);
    runSim(next);
  }

  function reset() {
    setValues(snapshot);
    runSim(snapshot);
  }

  if (!ready || !sim || !values || !snapshot) return null;

  const changed = LEVERS.some(({ key }) => values[key] !== snapshot[key]);
  const scoreDelta = sim.readinessScore - sim.baseline.readinessScore;
  const matchDelta = sim.matchCount - sim.baseline.matchCount;

  return (
    <div className="whatif-card">
      <button
        type="button"
        className="whatif-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="whatif-toggle-text">
          <span className="whatif-toggle-title">What if you adjusted your plan?</span>
          <span className="whatif-toggle-sub">
            See how a different ask, more time in business, or higher revenue would move your score and matches
          </span>
        </span>
        <span className={`whatif-chevron ${open ? 'is-open' : ''}`} aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="whatif-body">
          <div className="whatif-levers">
            {LEVERS.map(({ key, label, kind }) => {
              const rng = rangeFor(kind, snapshot[key]);
              const val = Math.min(Math.max(values[key], rng.min), rng.max);
              const moved = values[key] !== snapshot[key];
              return (
                <div className="whatif-lever" key={key}>
                  <div className="whatif-lever-top">
                    <label htmlFor={`whatif-${key}`}>{label}</label>
                    <span className={`whatif-lever-val ${moved ? 'is-moved' : ''}`}>{fmtValue(kind, val)}</span>
                  </div>
                  <input
                    id={`whatif-${key}`}
                    type="range"
                    min={rng.min}
                    max={rng.max}
                    step={rng.step}
                    value={val}
                    onChange={(e) => setLever(key, Number(e.target.value))}
                  />
                  <div className="whatif-lever-foot">
                    <span>{fmtValue(kind, rng.min)}</span>
                    <span>
                      your actual: <strong>{fmtValue(kind, snapshot[key])}</strong>
                    </span>
                    <span>{fmtValue(kind, rng.max)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={`whatif-result ${pending ? 'is-pending' : ''}`}>
            <div className="whatif-result-score">
              <ScoreGauge value={sim.readinessScore} size={78} />
              <div>
                <div className="whatif-result-label">Readiness score</div>
                <div className="whatif-result-line">
                  <strong>{sim.readinessScore}</strong>
                  <span className="whatif-from">from {sim.baseline.readinessScore}</span>
                  <Delta value={scoreDelta} />
                </div>
              </div>
            </div>

            <div className="whatif-result-matches">
              <div className="whatif-result-label">Lenders that match</div>
              <div className="whatif-result-line">
                <strong>{sim.matchCount}</strong>
                <span className="whatif-from">from {sim.baseline.matchCount}</span>
                <Delta value={matchDelta} unit={Math.abs(matchDelta) === 1 ? 'lender' : 'lenders'} />
              </div>
              {sim.newlyMatched?.length > 0 && (
                <p className="whatif-change whatif-change-add">
                  ＋ Newly matches: {sim.newlyMatched.join(', ')}
                </p>
              )}
              {sim.nowExcluded?.length > 0 && (
                <p className="whatif-change whatif-change-drop">
                  － Would drop off: {sim.nowExcluded.join(', ')}
                </p>
              )}
              {changed && sim.newlyMatched?.length === 0 && sim.nowExcluded?.length === 0 && (
                <p className="whatif-change">Same set of lenders — only the match strength shifts.</p>
              )}
            </div>
          </div>

          <div className="whatif-foot">
            <p className="whatif-disclaimer">
              Hypothetical only — nothing here changes your saved application. Answer credibility is held fixed.
            </p>
            {changed && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={reset}>
                Reset to my numbers
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
