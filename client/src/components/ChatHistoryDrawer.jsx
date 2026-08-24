import { useEffect, useState } from 'react';
import { authedFetch } from '../api.js';

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ChatHistoryDrawer({ open, onClose, onSelect, onNewChat }) {
  const [conversations, setConversations] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    authedFetch('/api/conversations')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setConversations(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="history-drawer">
        <div className="history-drawer-header">
          <h2>Your conversations</h2>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <button type="button" className="btn btn-primary btn-block" style={{ margin: '0 1.25rem 1rem', width: 'calc(100% - 2.5rem)' }} onClick={onNewChat}>
          + New chat
        </button>

        <div className="history-list">
          {error && <div className="alert alert-danger" style={{ margin: '0 1.25rem' }}>{error}</div>}
          {conversations === null && !error && <p className="history-empty">Loading…</p>}
          {conversations?.length === 0 && <p className="history-empty">No conversations yet — start one to see it here.</p>}
          {conversations?.map((c) => (
            <button
              type="button"
              key={c.id}
              className={`history-item ${c.status !== 'complete' ? 'history-item-pending' : ''}`}
              disabled={c.status !== 'complete'}
              onClick={() => onSelect(c.id)}
            >
              <span className="history-item-title">{c.title}</span>
              <span className="history-item-meta">
                {formatDate(c.createdAt)}
                {c.status !== 'complete' && ' · unfinished'}
              </span>
            </button>
          ))}
        </div>
      </aside>
    </>
  );
}
