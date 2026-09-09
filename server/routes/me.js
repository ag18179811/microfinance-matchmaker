// The signed-in user's own settings. Scoped to req.userId.

import { Router } from 'express';
import pool from '../db/connection.js';

const router = Router();

router.get('/prefs', async (req, res) => {
  const { rows } = await pool.query('SELECT email, email_reminders_enabled FROM profiles WHERE id = $1', [req.userId]);
  res.json({
    email: rows[0]?.email || null,
    emailRemindersEnabled: rows[0] ? rows[0].email_reminders_enabled !== false : true,
  });
});

router.put('/prefs', async (req, res) => {
  const enabled = req.body?.emailRemindersEnabled;
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'emailRemindersEnabled must be a boolean' });
  await pool.query(
    `INSERT INTO profiles (id, email_reminders_enabled) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET email_reminders_enabled = EXCLUDED.email_reminders_enabled`,
    [req.userId, enabled]
  );
  res.json({ emailRemindersEnabled: enabled });
});

export default router;
