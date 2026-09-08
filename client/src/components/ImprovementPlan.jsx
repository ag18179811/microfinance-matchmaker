import { useEffect, useRef, useState } from 'react';
import { authedFetch } from '../api.js';

// "How to raise your score" — the prioritized levers actually dragging this
// application down, each with a real projected impact (the server re-ran the
// scoring engine with that one change applied). Hidden when there's nothing
// meaningful to improve.

function GainBar({ current, projected, base }) {
  const from = base;
  const to = projected;
  const gain = to - from;
  return (
    <div className="ip-gain">
      <div className="ip-gain-track">
        <div className="ip-gain-base" style={{ width: `${Math.max(0, Math.min(100, from))}%` }} />
        {gain > 0 && (
          <div
            className="ip-gain-add"
            style={{ left: `${Math.max(0, Math.min(100, from))}%`, width: `${Math.max(0, Math.min(100 - from, gain))}%` }}
          />
        )}
      </div>
      <span className="ip-gain-label">
        {from} <span aria-hidden="true">→</span> <strong>{to}</strong>
        {gain > 0 && <span className="ip-gain-delta">+{gain}</span>}
      </span>
    </div>
  );
}

export default function ImprovementPlan({ applicationId }) {
  const [plan, setPlan] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | hidden
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const res = await authedFetch(`/api/match/${applicationId}/improvement-plan`);
        const data = await res.json();
        if (!res.ok || !data.items || data.items.length === 0) {
          setState('hidden');
          return;
        }
        setPlan(data);
        setState('ready');
      } catch {
        setState('hidden');
      }
    })();
  }, [applicationId]);

  if (state !== 'ready' || !plan) return null;

  return (
    <div className="ip-card">
      <div className="breakdown-header">
        <h2 className="section-title" style={{ marginBottom: 0 }}>How to raise your score</h2>
        <p className="breakdown-subtitle">
          The levers actually holding you back, most impactful first. Each projection is your score re-run with
          that one change applied — real math, not a guess.
        </p>
      </div>

      <ol className="ip-list">
        {plan.items.map((it, i) => (
          <li className="ip-item" key={it.key}>
            <div className="ip-item-head">
              <span className="ip-rank">{i + 1}</span>
              <h3>{it.title}</h3>
              <span className="ip-timeframe">{it.timeframe}</span>
            </div>
            <p className="ip-detail">{it.detail}</p>
            <p className="ip-action">{it.action}</p>
            {it.projectedReadiness != null && it.projectedReadiness > plan.readinessScore && (
              <GainBar current={it.current} projected={it.projectedReadiness} base={plan.readinessScore} />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
