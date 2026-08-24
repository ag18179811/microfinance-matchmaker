import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../api.js';

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

// Shows either a generic "typing" (three dots) indicator, or — whenever we
// have something concrete to say about what the engine is actually doing
// right now — a labeled status line, so the process reads as a real pipeline
// rather than an opaque "thinking..." spinner.
function TypingBubble({ label }) {
  return (
    <div className="chat-row chat-row-ai">
      <span className="chat-avatar" aria-hidden="true">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M2 10.5l3-4 2.5 2.5L13 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div className={`chat-msg chat-msg-ai typing-indicator ${label ? 'has-label' : ''}`} aria-label={label || 'Assistant is typing'}>
        {label ? (
          <>
            <span className="status-spinner" />
            <span className="status-label">{label}</span>
          </>
        ) : (
          <>
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </>
        )}
      </div>
    </div>
  );
}

export default function Chat({ initialDescription, onComplete }) {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [typing, setTyping] = useState(false);
  const [statusLabel, setStatusLabel] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [inputDisabled, setInputDisabled] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [retry, setRetry] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const startedRef = useRef(false);

  function addMessage(role, text, extra = {}) {
    const id = nextId();
    setMessages((prev) => [...prev, { id, role, text, ...extra }]);
    return id;
  }

  function showStatus(label) {
    setStatusLabel(label);
    setTyping(true);
  }

  function hideStatus() {
    setTyping(false);
    setStatusLabel(null);
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

  function applyTurn(payload) {
    if (payload.done) {
      setActiveMessageId(null);
      addMessage('ai', "That's everything I need.");
      finalizeAndMatch(payload.fields);
      return;
    }
    const { message } = payload;
    const id = addMessage('ai', message.text, {
      reasoning: message.reasoning,
      chips: message.questionType === 'select' ? message.options : null,
      fileHint: message.fileHint,
    });
    setActiveMessageId(id);
    setInputDisabled(false);
  }

  async function beginConversation() {
    addMessage('user', initialDescription);
    showStatus('Reading your description…');
    try {
      const res = await fetch(apiUrl('/api/interview/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: initialDescription }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start the interview');
      hideStatus();
      setConversationId(data.conversationId);
      applyTurn(data);
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
      const res = await fetch(apiUrl(`/api/interview/${conversationId}/reply`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to continue the interview');
      hideStatus();
      applyTurn(data);
    } catch (err) {
      hideStatus();
      showError('I ran into a problem with that answer.', err.message, () => submitReply(text));
    }
  }

  async function finalizeAndMatch(fields) {
    setInputDisabled(true);
    showStatus('Saving your application…');
    try {
      await onComplete(fields, (stage) => {
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
      const res = await fetch(apiUrl(`/api/interview/${conversationId}/attachments`), { method: 'POST', body: form });
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

                {m.reasoning && (
                  <details className="reasoning-toggle">
                    <summary>Show reasoning</summary>
                    <p>{m.reasoning}</p>
                  </details>
                )}

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
        {typing && <TypingBubble label={statusLabel} />}
        <div ref={bottomRef} />
      </div>

      <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={handleFileSelected} />

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
  );
}
