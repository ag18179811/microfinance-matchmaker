import { useEffect, useRef, useState } from 'react';
import { authedFetch } from '../api.js';

// A drafted business plan in the standard sections a bank, CDFI, or SBA
// microloan intermediary expects. Drafted from the funding story +
// interview + projection, then edited by talking to it. Collapsed by
// default: most owners only need it for the SBA / startup path.

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="bc-copy bc-copy-sm"
      style={{ position: 'static', opacity: 1 }}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function BusinessPlan({ applicationId, hint }) {
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState(null);
  const [state, setState] = useState('idle'); // idle | loading | ready | error
  const [note, setNote] = useState(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const loadedRef = useRef(false);

  async function load() {
    setState('loading');
    setErr(null);
    try {
      const res = await authedFetch(`/api/business-case/${applicationId}/plan`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not draft the plan');
      setSections(data.sections || []);
      setState('ready');
    } catch (e) {
      setErr(e.message);
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

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setNote(null);
    setErr(null);
    try {
      const res = await authedFetch(`/api/business-case/${applicationId}/plan/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'That update did not go through');
      setSections(data.sections || []);
      if (data.reply) setNote(data.reply);
      setInput('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const fullText = (sections || []).map((s) => `${s.heading.toUpperCase()}\n${s.body}`).join('\n\n');

  return (
    <div className="cf-card">
      <button type="button" className="cf-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="bp-panel">
        <span>
          <span className="cf-toggle-title">Business plan</span>
          <span className="cf-toggle-sub">
            {hint || 'A drafted plan in the standard sections, required by SBA microloan intermediaries and some CDFIs'}
          </span>
        </span>
        <span className={`whatif-chevron ${open ? 'is-open' : ''}`} aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="cf-body" id="bp-panel" role="region" aria-label="Business plan">
          {state === 'loading' && (
            <div className="lp-loading"><span className="status-spinner" /> <span>Drafting your plan from your funding story and numbers…</span></div>
          )}
          {state === 'error' && (
            <p className="bc-error">{err} <button type="button" className="btn btn-secondary btn-sm" onClick={load}>Try again</button></p>
          )}
          {state === 'ready' && sections && (
            <>
              <div className="bp-head">
                <p className="bc-sub" style={{ margin: 0 }}>
                  A first draft from what you've told us. Bracketed notes mark where you still need to add a
                  fact. Fix anything by telling me below.
                </p>
                <CopyBtn text={fullText} />
              </div>

              <div className="bc-sections" style={{ marginTop: '1rem' }}>
                {sections.map((s) => (
                  <div className="bc-section bc-tone-ok" key={s.key}>
                    <div className="bc-section-head">
                      <h3>{s.heading}</h3>
                    </div>
                    <p className="bc-body">{s.body}</p>
                    <CopyBtn text={s.body} />
                  </div>
                ))}
              </div>

              {note && <div className="bc-note">{note}</div>}
              {err && <div className="bc-error">{err}</div>}

              <form
                className="bc-compose"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <textarea
                  rows="2"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={busy ? 'Rewriting…' : 'e.g. "my main competitors are the two chains on Main St" or "the market section is wrong, we mostly do catering"'}
                  disabled={busy}
                />
                <button type="submit" className="btn btn-primary" disabled={busy || !input.trim()}>
                  {busy ? '…' : 'Update'}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
