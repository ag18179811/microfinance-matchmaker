import { useEffect, useRef, useState } from 'react';
import { authedFetch } from '../api.js';

// All answer validation now happens server-side (services/groq-interview.js
// and interview-fallback.js) — the client just renders whatever question
// comes back and sends whatever the user typed or clicked.

const OPTION_LABELS = {
  sole_prop: 'Sole Proprietorship',
  llc: 'LLC',
  s_corp: 'S-Corp',
  c_corp: 'C-Corp',
  yes_2yr: 'Yes, last 2 years',
  yes_1yr: 'Yes, last year only',
  under_600: 'Under 600',
  '600_680': '600–680',
  '680_720': '680–720',
  '720_plus': '720+',
  not_sure: 'Not sure',
};

function prettifyOption(raw) {
  if (OPTION_LABELS[raw]) return OPTION_LABELS[raw];
  if (/^[a-z0-9_]+$/.test(raw)) {
    return raw.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  }
  return raw;
}

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return idCounter;
}

// Shows what the engine is actually doing right now plus a live elapsed
// timer, so waiting reads as genuine work happening (this app now runs a
// real two-step reasoning-then-structuring pipeline per turn, which takes
// longer than an instant canned response on purpose) rather than an opaque
// spinner that could just as easily mean nothing is happening at all.
function TypingBubble({ label, elapsedSeconds }) {
  return (
    <div className="chat-row chat-row-ai">
      <span className="chat-avatar" aria-hidden="true">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M2 10.5l3-4 2.5 2.5L13 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div className="chat-msg chat-msg-ai typing-indicator has-label" aria-label={label || 'Thinking'}>
        <span className="status-spinner" />
        <span className="status-label">
          {label || 'Thinking'}
          {elapsedSeconds > 0 ? ` (${elapsedSeconds}s)` : ''}
        </span>
      </div>
    </div>
  );
}

// Horizontal progress toward "here are your matches". The interview is
// adaptive so there's no exact question count — the server blends field
// completeness, facts gathered, and turn count into a single 0–100 value
// (services/interview-progress.js) that only ever moves forward. This gives
// the user a read on how much longer the interview will run before the
// readiness score and lender matches appear.
function MatchProgress({ percent, phase }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="chat-progress"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Progress toward your funding matches: ${phase}`}
    >
      <div className="chat-progress-head">
        <span className="chat-progress-phase">{phase}</span>
        <span className="chat-progress-target">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="8" cy="8" r="2.5" fill="currentColor" />
          </svg>
          Funding matches
        </span>
      </div>
      <div className="chat-progress-track">
        <div className="chat-progress-fill" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

// The reasoning chain, collapsed by default but always showing how long it
// took — click to expand the actual sequence of distinct reasoning steps.
// Visually distinct when source is 'fallback': that's the deterministic,
// no-AI safety net, and it must never look like it's the same thing as
// genuine analysis.
function ThinkingChain({ reasoningSteps, thinkingSeconds, source }) {
  if (!reasoningSteps?.length) return null;
  const isFallback = source === 'fallback';
  return (
    <details className={`thinking-chain ${isFallback ? 'thinking-chain-fallback' : ''}`}>
      <summary>
        {isFallback ? 'AI analysis unavailable — basic mode' : `Thought for ${thinkingSeconds ?? 'a few'}s`}
      </summary>
      <ol className="thinking-steps">
        {reasoningSteps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </details>
  );
}

export default function Chat({ initialDescription, onComplete }) {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [typing, setTyping] = useState(false);
  const [statusLabel, setStatusLabel] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [inputDisabled, setInputDisabled] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [retry, setRetry] = useState(null);
  const [progress, setProgress] = useState({ percent: 3, phase: 'Getting started' });
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const startedRef = useRef(false);
  const thinkingStartRef = useRef(null);
  const thinkingIntervalRef = useRef(null);

  function addMessage(role, text, extra = {}) {
    const id = nextId();
    setMessages((prev) => [...prev, { id, role, text, ...extra }]);
    return id;
  }

  // The server value is monotonic by construction, but guard here too so a
  // fallback turn following an AI turn can never visibly walk the bar
  // backward.
  function advanceProgress(next) {
    if (!next || typeof next.percent !== 'number') return;
    setProgress((prev) => (next.percent >= prev.percent ? next : prev));
  }

  // showStatus can be called more than once in a row for one logical wait
  // (e.g. "Saving…" then "Checking eligibility…" during finalizeAndMatch) —
  // the elapsed timer keeps running across those label changes rather than
  // resetting, since it's timing the whole wait, not just the current label.
  function showStatus(label) {
    setStatusLabel(label);
    setTyping(true);
    if (!thinkingStartRef.current) {
      thinkingStartRef.current = Date.now();
      setElapsedSeconds(0);
      thinkingIntervalRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - thinkingStartRef.current) / 1000));
      }, 1000);
    }
  }

  // Returns the final elapsed seconds for this wait, so callers can attach
  // it to the message that's about to be added.
  function hideStatus() {
    setTyping(false);
    setStatusLabel(null);
    if (thinkingIntervalRef.current) {
      clearInterval(thinkingIntervalRef.current);
      thinkingIntervalRef.current = null;
    }
    const elapsed = thinkingStartRef.current ? Math.max(1, Math.round((Date.now() - thinkingStartRef.current) / 1000)) : null;
    thinkingStartRef.current = null;
    return elapsed;
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, typing]);

  useEffect(() => {
    if (!inputDisabled) inputRef.current?.focus();
  }, [inputDisabled]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    beginConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (thinkingIntervalRef.current) clearInterval(thinkingIntervalRef.current);
    };
  }, []);

  function applyTurn(payload, thinkingSeconds) {
    advanceProgress(payload.progress);
    if (payload.done) {
      setActiveMessageId(null);
      addMessage('ai', "That's everything I need.");
      advanceProgress({ percent: 100, phase: 'Building your matches' });
      finalizeAndMatch({ ...payload.fields, notes: payload.notes || [] });
      return;
    }
    const { message } = payload;
    const id = addMessage('ai', message.text, {
      reasoningSteps: message.reasoningSteps,
      source: message.source,
      thinkingSeconds,
      chips: message.questionType === 'select' ? message.options : null,
      fileHint: message.fileHint,
    });
    setActiveMessageId(id);
    setInputDisabled(false);
  }

  async function beginConversation() {
    addMessage('user', initialDescription);
    setProgress({ percent: 5, phase: 'Reading your description' });
    showStatus('Reading your description…');
    try {
      const res = await authedFetch('/api/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: initialDescription }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start the interview');
      const elapsed = hideStatus();
      setConversationId(data.conversationId);
      applyTurn(data, elapsed);
    } catch (err) {
      hideStatus();
      showError('I had trouble reading that description.', err.message, () => beginConversation());
    }
  }

  async function submitReply(text, displayText = text) {
    addMessage('user', displayText);
    setActiveMessageId(null);
    setInputDisabled(true);
    showStatus('Thinking…');
    try {
      const res = await authedFetch(`/api/interview/${conversationId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to continue the interview');
      const elapsed = hideStatus();
      applyTurn(data, elapsed);
    } catch (err) {
      hideStatus();
      showError('I ran into a problem with that answer.', err.message, () => submitReply(text));
    }
  }

  async function finalizeAndMatch(fields) {
    setInputDisabled(true);
    showStatus('Saving your application…');
    try {
      await onComplete(fields, conversationId, (stage) => {
        if (stage === 'matching') {
          showStatus('Checking eligibility and scoring your readiness against our lender database…');
        }
      });
    } catch (err) {
      hideStatus();
      showError('I ran into a problem finding your matches.', err.message, () => finalizeAndMatch(fields));
    }
  }

  function showError(intro, detail, retryFn) {
    addMessage('ai', `${intro} ${detail ? `(${detail})` : ''} Want to try again?`, { isError: true });
    setRetry(() => retryFn);
    setInputDisabled(true);
  }

  function handleRetryClick() {
    const fn = retry;
    setRetry(null);
    fn?.();
  }

  function handleChip(raw) {
    if (inputDisabled) return;
    submitReply(raw, prettifyOption(raw));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (inputDisabled || !inputValue.trim()) return;
    const text = inputValue;
    setInputValue('');
    submitReply(text);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function triggerFilePicker() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !conversationId) return;

    setUploading(true);
    showStatus(`Reading ${file.name}…`);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await authedFetch(`/api/interview/${conversationId}/attachments`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload that file');
      hideStatus();
      addMessage(
        'system',
        data.textExtracted
          ? `📎 ${data.filename} attached — I can read its contents.`
          : `📎 ${data.filename} attached, though I couldn't pull readable text from it.`
      );
    } catch (err) {
      hideStatus();
      addMessage('system', `Couldn't attach that file (${err.message}).`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="chat-page">
      <div className="chat-messages">
        {messages.map((m) => {
          if (m.role === 'system') {
            return (
              <div className="chat-system-note" key={m.id}>
                {m.text}
              </div>
            );
          }

          const isActive = m.id === activeMessageId;
          return (
            <div className={`chat-row ${m.role === 'ai' ? 'chat-row-ai' : 'chat-row-user'}`} key={m.id}>
              {m.role === 'ai' && (
                <span className="chat-avatar" aria-hidden="true">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <path d="M2 10.5l3-4 2.5 2.5L13 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
              <div className="chat-msg-col">
                <div className={`chat-msg ${m.role === 'ai' ? 'chat-msg-ai' : 'chat-msg-user'} ${m.isError ? 'chat-msg-error' : ''}`}>
                  {m.text}
                </div>

                <ThinkingChain reasoningSteps={m.reasoningSteps} thinkingSeconds={m.thinkingSeconds} source={m.source} />

                {m.chips && (
                  <div className="reply-chips">
                    {m.chips.map((opt) => (
                      <button
                        type="button"
                        className="reply-chip"
                        key={opt}
                        disabled={inputDisabled || !isActive}
                        onClick={() => handleChip(opt)}
                      >
                        {prettifyOption(opt)}
                      </button>
                    ))}
                  </div>
                )}

                {m.fileHint && (
                  <div className="attach-hint">
                    <span>{m.fileHint}</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={triggerFilePicker}
                      disabled={uploading || inputDisabled || !isActive}
                    >
                      📎 Attach a file
                    </button>
                  </div>
                )}

                {m.isError && retry && (
                  <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: '0.5rem' }} onClick={handleRetryClick}>
                    Try again
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {typing && <TypingBubble label={statusLabel} elapsedSeconds={elapsedSeconds} />}
        <div ref={bottomRef} />
      </div>

      <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={handleFileSelected} />

      <div className="chat-composer">
        <MatchProgress percent={progress.percent} phase={progress.phase} />

        <form className="chat-input-bar" onSubmit={handleSubmit}>
          <div className="chat-input-inner">
            <textarea
              ref={inputRef}
              rows="1"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={inputDisabled ? 'Waiting…' : 'Type your answer…'}
              disabled={inputDisabled}
            />
            <button className="send-btn" type="submit" disabled={inputDisabled || !inputValue.trim()} aria-label="Send">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
