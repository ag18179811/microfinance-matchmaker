import { useEffect, useState } from 'react';
import { authedFetch } from '../api.js';

const STATUS_OPTIONS = [
  ['considering', 'Considering'],
  ['preparing', 'Preparing my application'],
  ['submitted', 'Submitted'],
  ['in_review', 'In review'],
  ['approved', 'Approved'],
  ['declined', 'Declined'],
  ['funded', 'Funded'],
];

const STALE_NUDGE = {
  preparing: 'Been preparing this a while. Anything blocking you from submitting?',
  submitted: "It's been a bit since you marked this submitted. Heard anything back?",
  in_review: 'Still in review. Worth a friendly check-in with them.',
};

function daysSince(iso) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function relativeTime(iso) {
  const d = daysSince(iso);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d} days ago`;
  return `${Math.floor(d / 30)} mo ago`;
}

function ReminderToggle() {
  const [prefs, setPrefs] = useState(null);
  useEffect(() => {
    authedFetch('/api/me/prefs')
      .then((r) => (r.ok ? r.json() : null))
      .then(setPrefs)
      .catch(() => {});
  }, []);
  if (!prefs) return null;

  async function toggle() {
    const next = !prefs.emailRemindersEnabled;
    setPrefs((p) => ({ ...p, emailRemindersEnabled: next }));
    try {
      await authedFetch('/api/me/prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailRemindersEnabled: next }),
      });
    } catch {
      setPrefs((p) => ({ ...p, emailRemindersEnabled: !next }));
    }
  }

  return (
    <label className="tracker-reminders">
      <input type="checkbox" checked={prefs.emailRemindersEnabled} onChange={toggle} />
      Email me about deadlines and check-ins{prefs.email ? ` (${prefs.email})` : ''}
    </label>
  );
}

export default function Tracker({ applicationId, tracked, onChange }) {
  if (!tracked || tracked.length === 0) return null;

  async function update(item, patch) {
    try {
      const res = await authedFetch(`/api/tracker/${applicationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lenderKey: item.lenderKey, lenderName: item.lenderName, fundingType: item.fundingType, ...item, ...patch }),
      });
      if (res.ok) onChange();
    } catch {
      /* non-critical */
    }
  }

  async function remove(item) {
    try {
      const res = await authedFetch(`/api/tracker/${applicationId}/${encodeURIComponent(item.lenderKey)}`, { method: 'DELETE' });
      if (res.ok) onChange();
    } catch {
      /* non-critical */
    }
  }

  return (
    <div className="tracker-card">
      <h2 className="section-title" style={{ marginBottom: '0.35rem' }}>Your applications</h2>
      <p className="bc-sub" style={{ marginBottom: '1.1rem' }}>
        Where each program stands. Update the status as you go. This is just for you.
      </p>

      <div className="tracker-list">
        {tracked.map((item) => {
          const stale = daysSince(item.updatedAt) >= 7 && STALE_NUDGE[item.status];
          return (
            <div className="tracker-row" key={item.lenderKey}>
              <div className="tracker-row-main">
                <span className="tracker-name">
                  {item.lenderName}
                  {item.fundingType === 'grant' && <span className="tag tag-grant" style={{ marginLeft: '0.5rem' }}>Grant</span>}
                </span>
                <button type="button" className="tracker-remove" onClick={() => remove(item)} aria-label="Stop tracking">
                  ×
                </button>
              </div>
              <div className="tracker-controls">
                <select value={item.status} onChange={(e) => update(item, { status: e.target.value })}>
                  {STATUS_OPTIONS.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                <label className="tracker-deadline">
                  Deadline
                  <input
                    type="date"
                    value={item.deadline || ''}
                    onChange={(e) => update(item, { deadline: e.target.value })}
                  />
                </label>
                <span className="tracker-updated">updated {relativeTime(item.updatedAt)}</span>
              </div>
              {stale && <p className="tracker-nudge">{STALE_NUDGE[item.status]}</p>}
            </div>
          );
        })}
      </div>

      <ReminderToggle />
    </div>
  );
}
