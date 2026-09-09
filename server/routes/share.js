// Read-only shareable report. The owner mints a token; anyone with the
// link sees a fixed, non-editable bundle — the score, the coaching
// summary, the funding story, the matched programs, and the funding plan.
// Never the interview transcript, the documents, or any way to change
// anything.

import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import pool from '../db/connection.js';
import { requireAuth } from '../middleware/auth.js';
import { loadResults, loadSubScores } from './match.js';
import { helpModeInfo } from '../services/help-mode.js';
import { computeFundingPlan } from '../services/funding-plan.js';
import { deriveProfile } from '../services/lender-application-profiles.js';

const router = Router();

// --- owner-only: mint / revoke ---
router.post('/applications/:applicationId/share', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT id, share_token FROM applications WHERE id = $1 AND user_id = $2', [
    req.params.applicationId,
    req.userId,
  ]);
  if (!rows[0]) return res.status(404).json({ error: 'Application not found' });
  let token = rows[0].share_token;
  if (!token) {
    token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '').slice(0, 8);
    await pool.query('UPDATE applications SET share_token = $1 WHERE id = $2', [token, rows[0].id]);
  }
  res.json({ token, path: `/shared/${token}` });
});

router.delete('/applications/:applicationId/share', requireAuth, async (req, res) => {
  await pool.query('UPDATE applications SET share_token = NULL WHERE id = $1 AND user_id = $2', [
    req.params.applicationId,
    req.userId,
  ]);
  res.json({ ok: true });
});

router.get('/applications/:applicationId/share', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT share_token FROM applications WHERE id = $1 AND user_id = $2', [
    req.params.applicationId,
    req.userId,
  ]);
  if (!rows[0]) return res.status(404).json({ error: 'Application not found' });
  res.json({ token: rows[0].share_token || null, path: rows[0].share_token ? `/shared/${rows[0].share_token}` : null });
});

// --- public: view a shared report ---
router.get('/shared/:token', async (req, res) => {
  const token = String(req.params.token || '');
  if (!/^[a-f0-9]{20,80}$/.test(token)) return res.status(404).json({ error: 'Not found' });

  const { rows } = await pool.query('SELECT * FROM applications WHERE share_token = $1', [token]);
  const application = rows[0];
  if (!application) return res.status(404).json({ error: 'This report link is not valid or was turned off.' });

  const [matches, subScores] = await Promise.all([loadResults(application.id), loadSubScores(application.id)]);
  if (matches.length === 0) return res.status(404).json({ error: 'This report has no results yet.' });

  const caseRow = (await pool.query('SELECT sections FROM business_cases WHERE application_id = $1', [application.id])).rows[0];

  const fundingPlan = computeFundingPlan({
    application,
    matches,
    profileFor: (m) => deriveProfile(m),
    verdicts: {},
  });

  res.json({
    businessName: application.business_name,
    industry: application.industry,
    location: [application.city, application.state].filter(Boolean).join(', '),
    requestedAmount: application.requested_amount,
    readinessScore: matches[0].readiness_score,
    subScores: subScores ? { ...subScores } : null,
    aiSummary: matches[0].ai_summary,
    helpMode: helpModeInfo(application.help_mode),
    fundingStory: (caseRow?.sections || []).map((s) => ({ heading: s.heading, body: s.body })),
    fundingPlan: fundingPlan.stack.length >= 2 || fundingPlan.gap > 0 ? fundingPlan : null,
    matches: matches.map((m) => ({
      name: m.name,
      type: m.type,
      fundingType: m.funding_type,
      matchScore: m.match_score,
      minLoan: m.min_loan,
      maxLoan: m.max_loan,
      applyUrl: m.source_url || null,
      reasons: m.reasons || [],
      cautions: m.cautions || [],
    })),
  });
});

export default router;
