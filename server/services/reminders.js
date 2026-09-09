// Computes which reminder emails are due and sends them, one grouped email
// per user. Driven by a scheduled call to POST /api/cron/reminders. Every
// send updates a "last reminded" stamp so nothing repeats. Respects the
// per-user opt-out. A no-op end to end when no email provider is
// configured (services/email.js reports skipped).

import pool from '../db/connection.js';
import { sendEmail, wrapHtml, appUrl, emailConfigured } from './email.js';
import { randomUUID } from 'node:crypto';

const DECIDED = ['approved', 'declined', 'funded'];

async function ensureUnsubToken(userId) {
  const { rows } = await pool.query('SELECT unsubscribe_token FROM profiles WHERE id = $1', [userId]);
  if (rows[0]?.unsubscribe_token) return rows[0].unsubscribe_token;
  const token = randomUUID().replace(/-/g, '');
  await pool.query('UPDATE profiles SET unsubscribe_token = $1 WHERE id = $2', [token, userId]);
  return token;
}

// Whole days from `from` to `to` (positive if `to` is later).
export function daysBetween(from, to) {
  return Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
}

// The single most relevant reminder for one tracked-application row, or
// null. Pure — the DB query + email sending live in runReminders.
export function reminderForTracked(t, now = new Date()) {
  if (DECIDED.includes(t.status)) return null;

  if (t.deadline && !['submitted', 'in_review'].includes(t.status)) {
    const d = daysBetween(now, t.deadline);
    if (d >= 0 && d <= 4) {
      return { kind: 'deadline', lender: t.lender_name, text: `${t.lender_name}'s deadline is ${d === 0 ? 'today' : `in ${d} day${d === 1 ? '' : 's'}`}. Finish that application pack and submit.` };
    }
  }
  const daysStale = daysBetween(t.updated_at, now);
  if (t.status === 'preparing' && daysStale >= 12) {
    return { kind: 'stale_prep', lender: t.lender_name, text: `You've been preparing your ${t.lender_name} application for ${daysStale} days. If something's blocking you, an SBDC advisor can help — or just submit what you have.` };
  }
  if (['submitted', 'in_review'].includes(t.status) && daysStale >= 16) {
    return { kind: 'stale_submitted', lender: t.lender_name, text: `It's been ${daysStale} days since you marked ${t.lender_name} ${t.status.replace('_', ' ')}. A short, friendly email asking about timing is completely normal.` };
  }
  return null;
}

// Returns { candidates: [{ userId, email, items: [...] }], sent, skipped, errors }.
export async function runReminders({ dryRun = false } = {}) {
  const now = new Date();
  const byUser = new Map();
  const add = (userId, email, item) => {
    if (!email) return;
    if (!byUser.has(userId)) byUser.set(userId, { userId, email, items: [] });
    byUser.get(userId).items.push(item);
  };

  // --- tracked-application reminders ---
  const { rows: tracked } = await pool.query(
    `SELECT t.*, p.email, p.email_reminders_enabled
       FROM tracked_applications t
       JOIN profiles p ON p.id = t.user_id
      WHERE COALESCE(p.email_reminders_enabled, true) = true
        AND (t.last_reminded_at IS NULL OR t.last_reminded_at < now() - interval '5 days')`
  );
  const remindedTrackIds = [];
  for (const t of tracked) {
    if (DECIDED.includes(t.status)) continue;
    let item = null;

    if (t.deadline && !['submitted', 'in_review'].includes(t.status)) {
      const d = daysBetween(now, t.deadline); // days until the deadline
      if (d >= 0 && d <= 4) {
        item = { kind: 'deadline', lender: t.lender_name, text: `${t.lender_name}'s deadline is ${d === 0 ? 'today' : `in ${d} day${d === 1 ? '' : 's'}`}. Finish that application pack and submit.` };
      }
    }
    const daysStale = daysBetween(t.updated_at, now);
    if (!item && t.status === 'preparing' && daysStale >= 12) {
      item = { kind: 'stale_prep', lender: t.lender_name, text: `You've been preparing your ${t.lender_name} application for ${daysStale} days. If something's blocking you, an SBDC advisor can help — or just submit what you have.` };
    }
    if (!item && ['submitted', 'in_review'].includes(t.status) && daysStale >= 16) {
      item = { kind: 'stale_submitted', lender: t.lender_name, text: `It's been ${daysStale} days since you marked ${t.lender_name} ${t.status.replace('_', ' ')}. A short, friendly email asking about timing is completely normal.` };
    }

    if (item) {
      add(t.user_id, t.email, item);
      remindedTrackIds.push(t.id);
    }
  }

  // --- "revisit your score" ---
  const { rows: stale } = await pool.query(
    `SELECT a.id, a.user_id, a.business_name, p.email, MAX(mr.created_at) AS matched_at
       FROM applications a
       JOIN profiles p ON p.id = a.user_id
       JOIN match_results mr ON mr.application_id = a.id
      WHERE COALESCE(p.email_reminders_enabled, true) = true
        AND (a.revisit_reminded_at IS NULL OR a.revisit_reminded_at < now() - interval '30 days')
      GROUP BY a.id, a.user_id, a.business_name, p.email
     HAVING MAX(mr.created_at) < now() - interval '35 days'`
  );
  const remindedAppIds = [];
  for (const s of stale) {
    add(s.user_id, s.email, {
      kind: 'revisit',
      text: `It's been over a month since you ran your funding readiness for ${s.business_name || 'your business'}. If your revenue or time in business has grown, your score and matches may have improved — worth a fresh run.`,
    });
    remindedAppIds.push(s.id);
  }

  const result = { candidates: [...byUser.values()], sent: 0, skipped: 0, errors: 0 };
  if (dryRun) return result;

  for (const { userId, email, items } of byUser.values()) {
    const token = await ensureUnsubToken(userId);
    const unsubUrl = appUrl(`/api/unsubscribe?token=${token}`);
    const list = items.map((i) => `<li style="margin-bottom:10px">${i.text}</li>`).join('');
    const html = wrapHtml(
      `<h2 style="font-size:18px">Your funding applications</h2><ul style="padding-left:18px">${list}</ul>` +
        `<p><a href="${appUrl('/')}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Open Microfinance Matchmaker</a></p>`,
      unsubUrl
    );
    const text = `Your funding applications:\n\n${items.map((i) => `- ${i.text}`).join('\n')}\n\nOpen: ${appUrl('/')}\nTurn off reminders: ${unsubUrl}`;
    const r = await sendEmail({ to: email, subject: 'A check-in on your funding applications', html, text });
    if (r.ok) result.sent++;
    else if (r.skipped) result.skipped++;
    else result.errors++;
  }

  if (remindedTrackIds.length) {
    await pool.query('UPDATE tracked_applications SET last_reminded_at = now() WHERE id = ANY($1)', [remindedTrackIds]);
  }
  if (remindedAppIds.length) {
    await pool.query('UPDATE applications SET revisit_reminded_at = now() WHERE id = ANY($1)', [remindedAppIds]);
  }
  result.emailProvider = emailConfigured() ? 'configured' : 'not configured (all skipped)';
  return result;
}
