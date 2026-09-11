// Machine-to-machine endpoints for scheduled jobs. Not behind requireAuth, 
// guarded by a shared secret in the x-cron-secret header. If CRON_SECRET
// isn't set the endpoints are disabled (503) rather than open.

import { Router } from 'express';
import { runReminders } from '../services/reminders.js';

const router = Router();

function authorize(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ error: 'cron endpoints are disabled (no CRON_SECRET set)' });
  if (req.get('x-cron-secret') !== secret) return res.status(401).json({ error: 'unauthorized' });
  next();
}

router.post('/reminders', authorize, async (req, res) => {
  try {
    const result = await runReminders({ dryRun: req.query.dry === '1' });
    res.json(result);
  } catch (err) {
    console.error('[cron] reminders failed:', err.message);
    res.status(500).json({ error: 'reminder run failed' });
  }
});

export default router;
