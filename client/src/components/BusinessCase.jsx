import { useEffect, useRef, useState } from 'react';
import { authedFetch } from '../api.js';

// The Living Business Case — a first-person funding narrative drafted from
// the interview, refined only by conversation. No forms, no blank fields:
// the app always writes first, and the owner reacts.

const CONFIDENCE_META = {
  stated: { label: 'In your words', tone: 'ok' },
  inferred: { label: 'I filled this in — check it', tone: 'check' },
  thin: { label: 'Needs a bit from you', tone: 'thin' },
};

function CopyButton({ text, small }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`bc-copy ${small ? 'bc-copy-sm' : ''}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked — no-op */
        }
      }}
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function BusinessCase({ applicationId }) {
  const [state, setState] = useState('loading'); // loading | ready | error
  const [sections, setSections] = useState([]);
  const [assumptions, setAssumptions] = useState([]);
  const [history, setHistory] = useState([]);
  const [meta, setMeta] = useState({});
  const [note, setNote] = useState(null); // the AI's last conversational reply
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const inputRef = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const res = await authedFetch(`/api/business-case/${applicationId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load your funding story');
        setSections(data.sections || []);
        setAssumptions(data.assumptions || []);
        setHistory(data.history || []);
        setMeta(data.meta || {});
        setState('ready');
      } catch (err) {
        setErrorMsg(err.message);
        setState('error');
      }
    })();
  }, [applicationId]);

  function applyResult(data) {
    setSections(data.sections || []);
    setAssumptions(data.assumptions || []);
    setHistory(data.history || []);
    if (data.reply) setNote(data.reply);
  }

  async function send(text) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setNote(null);
    setErrorMsg(null);
    try {
      const res = await authedFetch(`/api/business-case/${applicationId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'That update did not go through');
      applyResult(data);
      setInput('');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  async function regenerate() {
    if (busy) return;
    if (!window.confirm('Rewrite your funding story from scratch, using your interview answers? Your edits since then will be lost.')) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await authedFetch(`/api/business-case/${applicationId}/regenerate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not rewrite it');
      applyResult(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  function useAssumption(text) {
    setInput(text.replace(/\?+$/, '') + ' — ');
    inputRef.current?.focus();
  }

  const fullText = sections.map((s) => `${s.heading}\n${s.body}`).join('\n\n');

  if (state === 'loading') {
    return (
      <div className="bc-card">
        <div className="bc-head">
          <h2 className="section-title" style={{ marginBottom: 0 }}>Your funding story</h2>
        </div>
        <div className="bc-loading">
          <span className="status-spinner" />
          <span>Drafting your story from what you told us…</span>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="bc-card">
        <div className="bc-head">
          <h2 className="section-title" style={{ marginBottom: 0 }}>Your funding story</h2>
        </div>
        <p className="bc-error">{errorMsg} <button type="button" className="btn btn-secondary btn-sm" onClick={() => { startedRef.current = false; setState('loading'); }}>Try again</button></p>
      </div>
    );
  }

  return (
    <div className="bc-card">
      <div className="bc-head">
        <div>
          <h2 className="section-title" style={{ marginBottom: '0.25rem' }}>Your funding story</h2>
          <p className="bc-sub">
            A first draft in your words, written from your interview. Nothing here is a form — just tell me what's
            wrong or missing and I'll rewrite it. This is what feeds your lender applications.
          </p>
        </div>
        <CopyButton text={fullText} />
      </div>

      {meta.draftOk === false && (
        <p className="bc-error">
          The AI draft didn't generate ({meta.draftError || 'unknown error'}). You can still build the story by
          talking to it below.
        </p>
      )}

      {assumptions.length > 0 && (
        <div className="bc-assumptions">
          <p className="bc-assumptions-title">I guessed on a few things — set me straight:</p>
          <div className="bc-chip-row">
            {assumptions.map((a) => (
              <button type="button" key={a.id} className="bc-chip" onClick={() => useAssumption(a.text)}>
                {a.text}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bc-sections">
        {sections.map((s) => {
          const cm = CONFIDENCE_META[s.confidence] || CONFIDENCE_META.inferred;
          return (
            <div className={`bc-section bc-tone-${cm.tone}`} key={s.key}>
              <div className="bc-section-head">
                <h3>{s.heading}</h3>
                <span className={`bc-badge bc-badge-${cm.tone}`}>{cm.label}</span>
              </div>
              <p className="bc-body">{s.body}</p>
              <CopyButton text={s.body} small />
            </div>
          );
        })}
      </div>

      {note && <div className="bc-note">{note}</div>}
      {errorMsg && state === 'ready' && <div className="bc-error">{errorMsg}</div>}

      <form
        className="bc-compose"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          ref={inputRef}
          rows="2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder={busy ? 'Rewriting…' : "e.g. \"the equipment is $12k not $8k\" or \"you missed that my landlord is giving me a second unit\""}
          disabled={busy}
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !input.trim()}>
          {busy ? '…' : 'Update'}
        </button>
      </form>

      <div className="bc-foot">
        {history.length > 0 && (
          <button type="button" className="bc-linkbtn" onClick={() => setShowLog((v) => !v)}>
            {showLog ? 'Hide' : 'Show'} what's changed ({history.length})
          </button>
        )}
        <button type="button" className="bc-linkbtn" onClick={regenerate} disabled={busy}>
          Start the story over
        </button>
      </div>

      {showLog && (
        <ul className="bc-log">
          {[...history].reverse().map((h, i) => (
            <li key={i}>
              <span className="bc-log-when">{new Date(h.at).toLocaleString()}</span>
              {h.summary}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
