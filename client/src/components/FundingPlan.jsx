import { useEffect, useRef, useState } from 'react';
import { authedFetch } from '../api.js';

// "How to actually get to $X" — the capital stack (which programs cover
// how much) and the order to pursue them. Hidden when there's nothing
// meaningful to show (e.g. one program covers the whole ask).

function money(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString()}`;
}

export default function FundingPlan({ applicationId }) {
  const [plan, setPlan] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | hidden
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const res = await authedFetch(`/api/match/${applicationId}/funding-plan`);
        const data = await res.json();
        // Only worth showing if the stack has 2+ pieces or there's a gap to name.
        if (!res.ok || !data.stack || (data.stack.length < 2 && data.gap <= 0)) {
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

  const orderIndex = (name) => plan.order.indexOf(name);

  return (
    <div className="fp-card">
      <h2 className="section-title" style={{ marginBottom: '0.35rem' }}>How to get to {money(plan.need)}</h2>
      <p className="bc-sub" style={{ marginBottom: '1.25rem' }}>
        No single program here covers your whole ask, so this is a combination — and the order to work it.
      </p>

      <div className="fp-stack">
        {[...plan.stack]
          .sort((a, b) => orderIndex(a.name) - orderIndex(b.name))
          .map((p) => (
            <div className={`fp-piece ${p.speculative ? 'fp-piece-grant' : ''}`} key={p.name}>
              <div className="fp-piece-step">{orderIndex(p.name) + 1}</div>
              <div className="fp-piece-body">
                <div className="fp-piece-top">
                  <span className="fp-piece-name">{p.name}</span>
                  <span className="fp-piece-amount">
                    {p.speculative ? `up to ${money(p.amount)}` : money(p.amount)}
                    {p.speculative && <span className="fp-if"> if awarded</span>}
                  </span>
                </div>
                {p.timeline && <p className="fp-piece-timeline">{p.timeline}</p>}
                {p.note && <p className="fp-piece-note">{p.note}</p>}
                {p.verdictTiming && (
                  <span className={`fp-timing fp-timing-${p.verdictTiming}`}>
                    reviewer said: {p.verdictTiming === 'now' ? 'apply now' : p.verdictTiming === 'soon' ? 'almost ready' : 'build up first'}
                  </span>
                )}
              </div>
            </div>
          ))}
      </div>

      {plan.gap > 0 && (
        <p className="fp-gap">
          That leaves about <strong>{money(plan.gap)}</strong> to come from savings, a partner, or by trimming
          the ask — the loan pieces above realistically cover {money(plan.coveredByLoans)}.
        </p>
      )}

      {plan.rationale && <div className="fp-rationale">{plan.rationale}</div>}
    </div>
  );
}
