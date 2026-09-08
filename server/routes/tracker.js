// The application tracker — which programs the owner is pursuing and where
// each one stands. Deliberately light: no email, no cron. The "did you
// submit yet?" nudge is passive (the UI shows how long since a row last
// changed). Every query is scoped to req.userId.

import { Router } from 'express';
import pool from '../db/connection.js';

const router = Router();

const STATUSES = ['considering', 'preparing', 'submitted', 'in_review', 'approved', 'declined', 'funded'];

async function loadOwnedApplication(applicationId, userId) {
  const { rows } = await pool.query('SELECT id FROM applications WHERE id = $1 AND user_id = $2', [applicationId, userId]);
  return rows[0] || null;
}

function shape(row) {
  return {
    lenderKey: row.lender_key,
    lenderName: row.lender_name,
    fundingType: row.funding_type,
    status: row.status,
    note: row.note || '',
    deadline: row.deadline ? row.deadline.toISOString().slice(0, 10) : null,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

router.get('/:applicationId', async (req, res) => {
  const app = await loadOwnedApplication(req.params.applicationId, req.userId);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  const { rows } = await pool.query(
    'SELECT * FROM tracked_applications WHERE application_id = $1 ORDER BY updated_at DESC',
    [app.id]
  );
  res.json({ tracked: rows.map(shape) });
});

// Upsert one tracked program. Also used internally (auto-track on pack build).
router.post('/:applicationId', async (req, res) => {
  const app = await loadOwnedApplication(req.params.applicationId, req.userId);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const lenderKey = String(req.body?.lenderKey ?? '').trim();
  const lenderName = String(req.body?.lenderName ?? '').trim();
  if (!lenderKey || !lenderName) return res.status(400).json({ error: 'lenderKey and lenderName are required' });

  const status = STATUSES.includes(req.body?.status) ? req.body.status : 'considering';
  const fundingType = ['loan', 'grant', 'other'].includes(req.body?.fundingType) ? req.body.fundingType : 'loan';
  const note = req.body?.note != null ? String(req.body.note).slice(0, 1000) : null;
  const deadline = /^\d{4}-\d{2}-\d{2}$/.test(req.body?.deadline || '') ? req.body.deadline : null;

  const { rows } = await pool.query(
    `INSERT INTO tracked_applications (application_id, user_id, lender_key, lender_name, funding_type, status, note, deadline)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (application_id, lender_key) DO UPDATE SET
       status = EXCLUDED.status,
       note = COALESCE(EXCLUDED.note, tracked_applications.note),
       deadline = COALESCE(EXCLUDED.deadline, tracked_applications.deadline),
       updated_at = now()
     RETURNING *`,
    [app.id, req.userId, lenderKey, lenderName, fundingType, status, note, deadline]
  );
  res.json(shape(rows[0]));
});

router.delete('/:applicationId/:lenderKey', async (req, res) => {
  const app = await loadOwnedApplication(req.params.applicationId, req.userId);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  await pool.query('DELETE FROM tracked_applications WHERE application_id = $1 AND lender_key = $2', [
    app.id,
    req.params.lenderKey,
  ]);
  res.json({ ok: true });
});

// Called from the underwriter pack route — quietly start tracking a lender
// as "preparing" once the owner has built its application pack. Never
// downgrades an existing status.
export async function autoTrack(applicationId, userId, lenderKey, lenderName, fundingType = 'loan') {
  try {
    await pool.query(
      `INSERT INTO tracked_applications (application_id, user_id, lender_key, lender_name, funding_type, status)
       VALUES ($1, $2, $3, $4, $5, 'preparing')
       ON CONFLICT (application_id, lender_key) DO UPDATE SET
         status = CASE WHEN tracked_applications.status = 'considering' THEN 'preparing' ELSE tracked_applications.status END,
         updated_at = now()`,
      [applicationId, userId, lenderKey, lenderName, fundingType]
    );
  } catch (err) {
    console.error('[tracker] autoTrack failed (non-fatal):', err.message);
  }
}

export default router;
