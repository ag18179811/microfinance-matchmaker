import { useEffect, useRef, useState } from 'react';
import { authedFetch } from '../api.js';

// A 12-month cash-flow projection scaffold. Seeded from the application's
// numbers, then edited by the owner. Revenue / expenses / loan payment are
// editable; net and ending cash recompute. Verified CDFI and grant
// applications all ask for this and a blank sheet is where people stall.

const ROWS = [
  { key: 'revenue', label: 'Revenue', editable: true },
  { key: 'expenses', label: 'Expenses', editable: true },
  { key: 'loanPayment', label: 'Loan payment', editable: true },
  { key: 'net', label: 'Net', editable: false },
  { key: 'endingCash', label: 'Ending cash', editable: false },
];

function recalc(startingCash, months) {
  let cash = Number(startingCash) || 0;
  return months.map((m) => {
    const revenue = Math.round(Number(m.revenue) || 0);
    const expenses = Math.round(Number(m.expenses) || 0);
    const loanPayment = Math.round(Number(m.loanPayment) || 0);
    const net = revenue - expenses - loanPayment;
    cash += net;
    return { ...m, revenue, expenses, loanPayment, net, endingCash: cash };
  });
}

function fmt(n) {
  const v = Math.round(Number(n) || 0);
  return v < 0 ? `-$${Math.abs(v).toLocaleString()}` : `$${v.toLocaleString()}`;
}

export default function CashflowProjection({ applicationId }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [state, setState] = useState('idle'); // idle | loading | ready | error
  const [saved, setSaved] = useState(true);
  const saveTimer = useRef(null);
  const loadedRef = useRef(false);

  async function load() {
    setState('loading');
    try {
      const res = await authedFetch(`/api/business-case/${applicationId}/projection`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Could not load the projection');
      setData({ startingCash: d.startingCash, estimatedLoanPayment: d.estimatedLoanPayment, months: d.months, edited: d.edited });
      setSaved(true);
      setState('ready');
    } catch {
      setState('error');
    }
  }

  useEffect(() => {
    if (open && !loadedRef.current) {
      loadedRef.current = true;
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function edit(monthIdx, key, raw) {
    const value = raw.replace(/[^0-9-]/g, '');
    setData((d) => {
      const months = d.months.map((m, i) => (i === monthIdx ? { ...m, [key]: value } : m));
      return { ...d, months: recalc(d.startingCash, months) };
    });
    queueSave();
  }

  function editStart(raw) {
    const value = raw.replace(/[^0-9-]/g, '');
    setData((d) => ({ ...d, startingCash: value, months: recalc(value, d.months) }));
    queueSave();
  }

  function queueSave() {
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 900);
  }

  async function save() {
    setData((cur) => {
      authedFetch(`/api/business-case/${applicationId}/projection`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startingCash: cur.startingCash,
          estimatedLoanPayment: cur.estimatedLoanPayment,
          months: cur.months,
        }),
      })
        .then((r) => (r.ok ? setSaved(true) : null))
        .catch(() => {});
      return cur;
    });
  }

  const lowMonth = data?.months?.find((m) => m.endingCash < 0);

  return (
    <div className="cf-card">
      <button
        type="button"
        className="cf-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="cf-panel"
      >
        <span>
          <span className="cf-toggle-title">12-month cash-flow projection</span>
          <span className="cf-toggle-sub">
            A starting point from your numbers, most CDFI and grant applications ask for this
          </span>
        </span>
        <span className={`whatif-chevron ${open ? 'is-open' : ''}`} aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && state === 'loading' && (
        <div className="cf-body" id="cf-panel" role="region" aria-label="12-month cash-flow projection">
          <div className="lp-loading" aria-live="polite"><span className="status-spinner" /> <span>Building your starting projection…</span></div>
        </div>
      )}

      {open && state === 'error' && (
        <div className="cf-body" id="cf-panel" role="region" aria-label="12-month cash-flow projection">
          <p className="bc-error">Couldn't load the projection. <button type="button" className="btn btn-secondary btn-sm" onClick={load}>Try again</button></p>
        </div>
      )}

      {open && state === 'ready' && data && (
        <div className="cf-body" id="cf-panel" role="region" aria-label="12-month cash-flow projection">
          <p className="cf-disclaimer">
            Every number here is an estimate built from your revenue, revenue pattern, and requested amount.
            Replace each with your real figures before you submit. This is a scaffold, not a forecast.
          </p>

          <div className="cf-starting">
            <label>
              Cash on hand today
              <input inputMode="numeric" value={data.startingCash} onChange={(e) => editStart(e.target.value)} aria-label="Cash on hand today" />
            </label>
            <span className="cf-save" aria-live="polite">{saved ? 'Saved' : 'Saving…'}</span>
          </div>

          <div className="cf-scroll">
            <table className="cf-table">
              <caption className="sr-only">Monthly revenue, expenses, loan payment, net, and ending cash for 12 months</caption>
              <thead>
                <tr>
                  <th className="cf-rowhead" scope="col"><span className="sr-only">Line item</span></th>
                  {data.months.map((m) => (
                    <th key={m.label} scope="col">{m.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.key} className={row.editable ? '' : 'cf-derived'}>
                    <th className="cf-rowhead" scope="row">{row.label}</th>
                    {data.months.map((m, i) => (
                      <td key={i} className={row.key === 'endingCash' && m.endingCash < 0 ? 'cf-neg' : ''}>
                        {row.editable ? (
                          <input
                            inputMode="numeric"
                            value={m[row.key]}
                            onChange={(e) => edit(i, row.key, e.target.value)}
                            aria-label={`${row.label}, ${m.label}`}
                          />
                        ) : (
                          fmt(m[row.key])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {lowMonth && (
            <p className="cf-warn" role="alert">
              As it stands, cash goes negative in {lowMonth.label}. Lenders look hard at this, so adjust the
              numbers to reality, and if it's still tight, that's a sign to ask for less or a longer term.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
