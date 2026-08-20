import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../api.js';
import { FIELD_META, normalizeState } from '../constants.js';

const REQUIRED_ORDER = ['business_name', 'industry', 'city', 'state', 'time_in_business_months', 'annual_revenue', 'requested_amount'];

const QUESTION_HINTS = {
  state: ' You can use the 2-letter code (like CA) or the full name.',
  annual_revenue: ' Rough numbers are fine — you can just say something like "180k".',
  requested_amount: ' A ballpark figure is fine.',
  time_in_business_months: ' Feel free to answer in months or years — e.g. "3 years".',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function questionFor(key) {
  const meta = FIELD_META[key];
  return `${meta.label}${QUESTION_HINTS[key] || ''}`;
}

// Accepts loose input ("180k", "$50,000", "3 years", "2 yrs") for the numeric
// fields so the chat doesn't force a rigid format on the user.
function parseLooseNumber(raw, key) {
  const text = raw.trim().toLowerCase();
  const yearsMatch = key === 'time_in_business_months' && text.match(/([\d.]+)\s*(year|yr)/);
  if (yearsMatch) return Math.round(parseFloat(yearsMatch[1]) * 12);

  const kMatch = text.match(/\$?([\d,]*\.?\d+)\s*k\b/);
  if (kMatch) return Math.round(parseFloat(kMatch[1].replace(/,/g, '')) * 1000);

  const cleaned = text.replace(/[$,]/g, '').match(/[\d.]+/);
  if (!cleaned) return null;
  const num = Number(cleaned[0]);
  return Number.isFinite(num) ? num : null;
}

function coerceAnswer(key, raw) {
  const meta = FIELD_META[key];
  const text = raw.trim();
  if (!text) return { ok: false };

  if (meta.type === 'select') {
    if (key === 'state') {
      const abbr = normalizeState(text);
      return abbr ? { ok: true, value: abbr, display: abbr } : { ok: false };
    }
    const match = meta.options.find((o) => o.toLowerCase() === text.toLowerCase());
    return match ? { ok: true, value: match, display: match } : { ok: false };
  }

  if (meta.type === 'number') {
    const num = parseLooseNumber(text, key);
    return num !== null && num >= 0 ? { ok: true, value: num, display: text } : { ok: false };
  }

  return { ok: true, value: text, display: text };
}

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return idCounter;
}

function TypingBubble() {
  return (
    <div className="chat-row chat-row-ai">
      <span className="chat-avatar" aria-hidden="true">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M2 10.5l3-4 2.5 2.5L13 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div className="chat-msg chat-msg-ai typing-indicator" aria-label="Assistant is typing">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  );
}

export default function Chat({ initialDescription, onComplete }) {
  const [messages, setMessages] = useState([]);
  const [queue, setQueue] = useState([]);
  const [fields, setFields] = useState({});
  const [typing, setTyping] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [inputDisabled, setInputDisabled] = useState(true);
  const [retry, setRetry] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const startedRef = useRef(false);

  function addMessage(role, text, extra = {}) {
    setMessages((prev) => [...prev, { id: nextId(), role, text, ...extra }]);
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

  async function beginConversation() {
    addMessage('user', initialDescription);
    setTyping(true);
    try {
      const res = await fetch(apiUrl('/api/intake/extract'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: initialDescription }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze your description');
      setTyping(false);
      await handleExtracted(data.fields, data.missingFields);
    } catch (err) {
      setTyping(false);
      showError("I had trouble reading that description.", err.message, () => beginConversation());
    }
  }

  async function handleExtracted(extractedFields, missingFields) {
    setFields(extractedFields);
    const ordered = REQUIRED_ORDER.filter((k) => missingFields.includes(k));

    if (ordered.length === 0) {
      await sleep(450);
      addMessage('ai', "Perfect, that's everything I need. Give me a moment to find your best-fit lenders...");
      finalizeAndMatch(extractedFields);
      return;
    }

    await sleep(450);
    addMessage(
      'ai',
      `Thanks! I picked up most of that. I just need ${ordered.length} more ${ordered.length === 1 ? 'thing' : 'things'} to find your best matches.`
    );
    setQueue(ordered);
    await sleep(600);
    askQuestion(ordered[0]);
  }

  function askQuestion(key) {
    const meta = FIELD_META[key];
    const chips = key === 'industry' ? meta.options : null;
    addMessage('ai', questionFor(key), chips ? { chips } : {});
    setInputDisabled(false);
  }

  async function submitAnswer(key, raw) {
    const { ok, value, display } = coerceAnswer(key, raw);
    if (!ok) {
      addMessage('user', raw);
      const meta = FIELD_META[key];
      await sleep(350);
      if (meta.type === 'select') {
        addMessage('ai', `Hmm, I didn't recognize that. ${questionFor(key)}`, key === 'industry' ? { chips: meta.options } : {});
      } else {
        addMessage('ai', `Sorry, I need a number for that one. ${questionFor(key)}`);
      }
      return;
    }

    addMessage('user', display);
    const newFields = { ...fields, [key]: value };
    setFields(newFields);
    const newQueue = queue.slice(1);
    setQueue(newQueue);
    setInputDisabled(true);

    if (newQueue.length === 0) {
      await sleep(500);
      addMessage('ai', "That's everything — give me a moment to find your best-fit lenders...");
      finalizeAndMatch(newFields);
    } else {
      setTyping(true);
      await sleep(550);
      setTyping(false);
      askQuestion(newQueue[0]);
    }
  }

  async function finalizeAndMatch(finalFields) {
    setTyping(true);
    setInputDisabled(true);
    try {
      await onComplete(finalFields);
    } catch (err) {
      setTyping(false);
      showError('I ran into a problem finding your matches.', err.message, () => finalizeAndMatch(finalFields));
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

  function handleChip(key, value) {
    if (inputDisabled) return;
    submitAnswer(key, value);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const key = queue[0];
    if (!key || inputDisabled || !inputValue.trim()) return;
    const raw = inputValue;
    setInputValue('');
    submitAnswer(key, raw);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  const currentKey = queue[0];

  return (
    <div className="chat-page">
      <div className="chat-messages">
        {messages.map((m) => (
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
              {m.chips && (
                <div className="reply-chips">
                  {m.chips.map((opt) => (
                    <button
                      type="button"
                      className="reply-chip"
                      key={opt}
                      disabled={inputDisabled || currentKey !== 'industry'}
                      onClick={() => handleChip('industry', opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
              {m.isError && retry && (
                <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: '0.5rem' }} onClick={handleRetryClick}>
                  Try again
                </button>
              )}
            </div>
          </div>
        ))}
        {typing && <TypingBubble />}
        <div ref={bottomRef} />
      </div>

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
