import { useEffect, useRef, useState } from 'react';
import { authedFetch } from '../api.js';

// "Prepare for a specific lender" — for each matched lender: how that
// program ACTUALLY takes applications (verified, dated), and a practice
// review conversation held as that lender's own reviewer, which ends with
// prepared answers in the owner's voice and an honest timing call.

const WHEN_LABEL = {
  always: 'Always needed',
  larger_loans: 'For larger loans',
  startups: 'If you\'re a startup',
  established: 'If you\'re established',
};

const TIMING_META = {
  now: { label: 'Apply now', tone: 'ok' },
  soon: { label: 'Almost — tighten a few things first', tone: 'check' },
  later: { label: 'Build up first, then apply', tone: 'thin' },
};

function groupNeeds(need) {
  const groups = {};
  for (const n of need) {
    const key = n.when || 'always';
    (groups[key] = groups[key] || []).push(n);
  }
  return groups;
}

function HowTheyApply({ lender }) {
  const groups = groupNeeds(lender.need || []);
  return (
    <div className="lp-how">
      <p className="lp-how-model">
        <strong>{lender.modelLabel}</strong>
        {!lender.verified && <span className="lp-unverified">process not verified — confirm on their site</span>}
      </p>
      <p className="lp-how-blurb">{lender.howItWorks || lender.modelBlurb}</p>

      {Object.keys(groups).length > 0 && (
        <div className="lp-needs">
          {Object.entries(groups).map(([when, items]) => (
            <div className="lp-need-group" key={when}>
              <div className="lp-need-when">{WHEN_LABEL[when] || when}</div>
              <ul>
                {items.map((n, i) => (
                  <li key={i}>
                    {n.item}
                    {n.note && <span className="lp-need-note"> — {n.note}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {lender.steps?.length > 0 && (
        <ol className="lp-steps">
          {lender.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}

      {lender.timeline && <p className="lp-timeline"><strong>Timeline:</strong> {lender.timeline}</p>}

      {lender.gotchas?.length > 0 && (
        <ul className="lp-gotchas">
          {lender.gotchas.map((g, i) => (
            <li key={i}>{g}</li>
          ))}
        </ul>
      )}

      <div className="lp-how-foot">
        {lender.applyUrl && (
          <a className="btn btn-primary btn-sm" href={lender.applyUrl} target="_blank" rel="noreferrer">
            Start the real application ↗
          </a>
        )}
        {lender.sources?.length > 0 && (
          <span className="lp-sources">
            Verified against{' '}
            {lender.sources.map((u, i) => (
              <span key={u}>
                {i > 0 && ', '}
                <a href={u} target="_blank" rel="noreferrer">
                  {(() => {
                    try {
                      return new URL(u).hostname.replace(/^www\./, '');
                    } catch {
                      return 'source';
                    }
                  })()}
                </a>
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

function copy(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

function Pack({ applicationId, lender }) {
  const [pack, setPack] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | building | ready | error
  const [err, setErr] = useState(null);

  async function build(rebuild) {
    setPhase('building');
    setErr(null);
    try {
      const res = await authedFetch(`/api/underwriter/${applicationId}/${encodeURIComponent(lender.key)}/pack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rebuild ? { rebuild: true } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not assemble the pack');
      setPack(data);
      setPhase('ready');
    } catch (e) {
      setErr(e.message);
      setPhase('error');
    }
  }

  if (phase === 'idle' || phase === 'error') {
    return (
      <div className="lp-pack-cta">
        <p>
          Pull your funding story and everything you just worked out into the exact pieces {lender.name}'s
          application asks for.
        </p>
        {err && <p className="bc-error">{err}</p>}
        <button type="button" className="btn btn-primary btn-sm" onClick={() => build(false)}>
          Assemble my {lender.name} pack
        </button>
      </div>
    );
  }
  if (phase === 'building') {
    return (
      <div className="lp-loading">
        <span className="status-spinner" />
        <span>Assembling your {lender.name} pack…</span>
      </div>
    );
  }

  const allText = [
    ...pack.blocks.map((b) => `## ${b.label}\n${b.text}`),
    pack.preparedAnswers?.length
      ? `## Prepared answers\n${pack.preparedAnswers.map((p) => `${p.question}\n${p.answer}`).join('\n\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  return (
    <div className="lp-pack">
      <div className="lp-pack-head">
        <span className="lp-prepared-title" style={{ margin: 0 }}>Your {lender.name} application pack</span>
        <div className="lp-pack-actions">
          <button type="button" className="bc-copy bc-copy-sm" style={{ position: 'static', opacity: 1 }} onClick={() => copy(allText)}>
            Copy all
          </button>
          <button type="button" className="bc-linkbtn" onClick={() => build(true)}>
            Rebuild
          </button>
        </div>
      </div>

      {!pack.ok && (
        <p className="bc-error">Some of the pack couldn't be generated, but your checklist and steps below are still accurate.</p>
      )}

      {pack.blocks.map((b) => (
        <div className="lp-pack-block" key={b.key}>
          <div className="lp-pack-block-head">
            <h4>{b.label}</h4>
            <button type="button" className="bc-copy bc-copy-sm" style={{ position: 'static', opacity: 1 }} onClick={() => copy(b.text)}>
              Copy
            </button>
          </div>
          <p className="lp-pack-block-body">{b.text}</p>
        </div>
      ))}

      {pack.checklist?.length > 0 && (
        <div className="lp-pack-block">
          <h4>Documents to gather</h4>
          <ul className="lp-pack-checklist">
            {pack.checklist.map((c, i) => (
              <li key={i}>
                {c.item}
                {c.note && <span className="lp-need-note"> — {c.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pack.steps?.length > 0 && (
        <div className="lp-pack-block">
          <h4>Then</h4>
          <ol className="lp-steps" style={{ marginBottom: 0 }}>
            {pack.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      {pack.applyUrl && (
        <a className="btn btn-primary btn-sm" href={pack.applyUrl} target="_blank" rel="noreferrer" style={{ marginTop: '0.75rem' }}>
          Start the real application at {lender.name} ↗
        </a>
      )}
      <p className="whatif-disclaimer" style={{ marginTop: '0.75rem' }}>
        Drafted from your own words for you to review and edit — not a finished application. Always confirm the
        current requirements on {lender.name}'s site.
      </p>
    </div>
  );
}

function Review({ applicationId, lender }) {
  const [messages, setMessages] = useState([]);
  const [prepared, setPrepared] = useState([]);
  const [verdict, setVerdict] = useState(null);
  const [focusPoints, setFocusPoints] = useState([]);
  const [hardBlocker, setHardBlocker] = useState(null);
  const [phase, setPhase] = useState(lender.review?.started ? 'starting' : 'idle'); // idle | starting | active | error
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const bottomRef = useRef(null);
  const resumedRef = useRef(false);

  // A review already exists from a previous visit — /start is idempotent and
  // returns the existing transcript, so just call it to resume.
  useEffect(() => {
    if (lender.review?.started && !resumedRef.current) {
      resumedRef.current = true;
      start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages, busy]);

  async function start() {
    setPhase('starting');
    setErr(null);
    try {
      const res = await authedFetch(`/api/underwriter/${applicationId}/${encodeURIComponent(lender.key)}/start`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start the review');
      setMessages(data.messages || []);
      setPrepared(data.preparedAnswers || []);
      setVerdict(data.verdict || null);
      setFocusPoints(data.focusPoints || []);
      setHardBlocker(data.hardBlocker || null);
      setPhase('active');
    } catch (e) {
      setErr(e.message);
      setPhase('error');
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setErr(null);
    setMessages((m) => [...m, { role: 'owner', content: text }]);
    setInput('');
    try {
      const res = await authedFetch(`/api/underwriter/${applicationId}/${encodeURIComponent(lender.key)}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'The reviewer did not respond');
      setMessages(data.messages || []);
      setPrepared(data.preparedAnswers || []);
      setVerdict(data.verdict || null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (phase === 'idle' || phase === 'error') {
    return (
      <div className="lp-review-start">
        <p>
          Sit down with {lender.name}'s reviewer for a few minutes. They'll dig into the specific spots where
          your file meets friction with this program, and you'll walk away with answers you can paste straight
          into the application.
        </p>
        {err && <p className="bc-error">{err}</p>}
        <button type="button" className="btn btn-primary btn-sm" onClick={start}>
          Practice with {lender.name}'s reviewer
        </button>
      </div>
    );
  }

  if (phase === 'starting') {
    return (
      <div className="lp-loading">
        <span className="status-spinner" />
        <span>{lender.name}'s reviewer is opening your file…</span>
      </div>
    );
  }

  return (
    <div className="lp-review">
      {hardBlocker && <div className="lp-blocker">⚠ {hardBlocker}</div>}
      {focusPoints.length > 0 && (
        <div className="lp-focus">
          <span>They want to dig into:</span>
          {focusPoints.map((f) => (
            <span className="lp-focus-tag" key={f}>
              {f}
            </span>
          ))}
        </div>
      )}

      <div className="lp-thread">
        {messages.map((m, i) => (
          <div className={`lp-msg lp-msg-${m.role}`} key={i}>
            {m.role === 'underwriter' && <span className="lp-msg-who">{lender.name} reviewer</span>}
            <div className="lp-msg-body">{m.content}</div>
          </div>
        ))}
        {busy && (
          <div className="lp-msg lp-msg-underwriter">
            <div className="lp-msg-body lp-typing">
              <span className="status-spinner" /> thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {err && <p className="bc-error">{err}</p>}

      {!verdict && (
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
            placeholder={busy ? 'Sending…' : 'Answer in your own words…'}
            disabled={busy}
          />
          <button type="submit" className="btn btn-primary" disabled={busy || !input.trim()}>
            {busy ? '…' : 'Reply'}
          </button>
        </form>
      )}

      {prepared.length > 0 && (
        <div className="lp-prepared">
          <p className="lp-prepared-title">Your prepared answers</p>
          {prepared.map((p, i) => (
            <div className="lp-prepared-item" key={i}>
              <div className="lp-prepared-q">{p.question}</div>
              <div className="lp-prepared-a">{p.answer}</div>
              <button
                type="button"
                className="bc-copy bc-copy-sm"
                onClick={() => navigator.clipboard?.writeText(p.answer).catch(() => {})}
              >
                Copy
              </button>
            </div>
          ))}
        </div>
      )}

      {verdict && (
        <div className={`lp-verdict lp-verdict-${TIMING_META[verdict.timing]?.tone || 'check'}`}>
          <div className="lp-verdict-timing">{TIMING_META[verdict.timing]?.label || verdict.timing}</div>
          {verdict.strengths?.length > 0 && (
            <div className="lp-verdict-block">
              <span className="lp-verdict-h">Strong for this reviewer</span>
              <ul>
                {verdict.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {verdict.gaps?.length > 0 && (
            <div className="lp-verdict-block">
              <span className="lp-verdict-h">Still thin</span>
              <ul>
                {verdict.gaps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {verdict.recommendation && <p className="lp-verdict-rec">{verdict.recommendation}</p>}
        </div>
      )}

      {(verdict || prepared.length >= 2) && <Pack applicationId={applicationId} lender={lender} />}
    </div>
  );
}

export default function LenderPrep({ applicationId }) {
  const [lenders, setLenders] = useState(null);
  const [openKey, setOpenKey] = useState(null);
  const [tab, setTab] = useState({}); // key -> 'how' | 'review'
  const [err, setErr] = useState(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const res = await authedFetch(`/api/underwriter/${applicationId}/lenders`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load lender prep');
        setLenders(data.lenders || []);
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, [applicationId]);

  if (err) return null; // non-critical section — hide on failure
  if (!lenders) {
    return (
      <div className="lp-card">
        <h2 className="section-title" style={{ marginBottom: '0.5rem' }}>Prepare for a specific lender</h2>
        <div className="lp-loading">
          <span className="status-spinner" />
          <span>Loading how each program takes applications…</span>
        </div>
      </div>
    );
  }
  if (lenders.length === 0) return null;

  return (
    <div className="lp-card">
      <h2 className="section-title" style={{ marginBottom: '0.35rem' }}>Prepare for a specific lender</h2>
      <p className="bc-sub" style={{ marginBottom: '1rem' }}>
        Each of these programs takes applications differently. Open one to see exactly how — and to sit down
        with its reviewer before you apply for real.
      </p>

      <div className="lp-list">
        {lenders.map((l) => {
          const isOpen = openKey === l.key;
          const activeTab = tab[l.key] || 'how';
          return (
            <div className={`lp-item ${isOpen ? 'is-open' : ''}`} key={l.key}>
              <button
                type="button"
                className="lp-item-head"
                onClick={() => setOpenKey(isOpen ? null : l.key)}
                aria-expanded={isOpen}
              >
                <span className="lp-item-name">
                  {l.name}
                  <span className="lp-item-model">{l.modelLabel}</span>
                </span>
                <span className="lp-item-right">
                  {l.review?.hasVerdict && <span className="lp-done-tag">reviewed</span>}
                  <span className="lp-item-score">{l.matchScore}%</span>
                  <span className={`whatif-chevron ${isOpen ? 'is-open' : ''}`}>
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </span>
              </button>

              {isOpen && (
                <div className="lp-item-body">
                  <div className="lp-tabs">
                    <button
                      type="button"
                      className={activeTab === 'how' ? 'is-active' : ''}
                      onClick={() => setTab((t) => ({ ...t, [l.key]: 'how' }))}
                    >
                      How they take applications
                    </button>
                    <button
                      type="button"
                      className={activeTab === 'review' ? 'is-active' : ''}
                      onClick={() => setTab((t) => ({ ...t, [l.key]: 'review' }))}
                    >
                      Practice the review
                    </button>
                  </div>
                  {activeTab === 'how' ? (
                    <HowTheyApply lender={l} />
                  ) : (
                    <Review applicationId={applicationId} lender={l} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
