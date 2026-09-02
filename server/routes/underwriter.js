import { Router } from 'express';
import pool from '../db/connection.js';
import { loadResults, loadSubScores } from './match.js';
import { deriveProfile, modelInfo } from '../services/lender-application-profiles.js';
import { startReview, continueReview } from '../services/underwriter-sim.js';
import { buildPack } from '../services/application-pack.js';

const router = Router();

async function loadOwnedApplication(applicationId, userId) {
  const { rows } = await pool.query('SELECT * FROM applications WHERE id = $1 AND user_id = $2', [applicationId, userId]);
  return rows[0] || null;
}

function parseNotes(application) {
  try {
    return typeof application.additional_notes === 'string'
      ? JSON.parse(application.additional_notes || '[]')
      : application.additional_notes || [];
  } catch {
    return [];
  }
}

function lenderKeyFor(m) {
  return `${m.provenance || 'verified'}:${m.id}`;
}

async function findMatchedLender(applicationId, lenderKey) {
  const matches = await loadResults(applicationId);
  return matches.find((m) => lenderKeyFor(m) === lenderKey) || null;
}

function shapeReview(row) {
  return {
    lenderKey: row.lender_key,
    lenderName: row.lender_name,
    messages: row.messages || [],
    preparedAnswers: row.prepared_answers || [],
    verdict: row.verdict || null,
    pack: row.pack || null,
    updatedAt: row.updated_at,
  };
}

// GET /:applicationId/lenders — the matched lenders, each with its verified
// (or clearly-marked unverified) application profile and any review progress.
router.get('/:applicationId/lenders', async (req, res) => {
  const application = await loadOwnedApplication(req.params.applicationId, req.userId);
  if (!application) return res.status(404).json({ error: 'Application not found' });

  const matches = await loadResults(application.id);
  const { rows: reviews } = await pool.query(
    'SELECT lender_key, verdict, jsonb_array_length(messages) AS turns FROM underwriter_reviews WHERE application_id = $1',
    [application.id]
  );
  const reviewByKey = new Map(reviews.map((r) => [r.lender_key, r]));

  res.json({
    lenders: matches.map((m) => {
      const key = lenderKeyFor(m);
      const profile = deriveProfile(m);
      const info = modelInfo(profile.model);
      const rev = reviewByKey.get(key);
      return {
        key,
        name: m.name,
        type: m.type,
        matchScore: m.match_score,
        provenance: m.provenance,
        applyUrl: profile.applyUrl || m.source_url || null,
        model: profile.model,
        modelLabel: info?.label || null,
        modelBlurb: info?.blurb || null,
        verified: profile.verified,
        howItWorks: profile.howItWorks,
        need: profile.need || [],
        steps: profile.steps || [],
        gotchas: profile.gotchas || [],
        timeline: profile.timeline || null,
        sources: profile.sources || [],
        review: rev
          ? { started: Number(rev.turns) > 0, turns: Number(rev.turns), hasVerdict: Boolean(rev.verdict) }
          : { started: false, turns: 0, hasVerdict: false },
      };
    }),
  });
});

// POST /:applicationId/:lenderKey/start — begin (or resume) the review.
router.post('/:applicationId/:lenderKey/start', async (req, res) => {
  const application = await loadOwnedApplication(req.params.applicationId, req.userId);
  if (!application) return res.status(404).json({ error: 'Application not found' });

  const lender = await findMatchedLender(application.id, req.params.lenderKey);
  if (!lender) return res.status(404).json({ error: 'That lender is not among your matches.' });

  const existing = await pool.query(
    'SELECT * FROM underwriter_reviews WHERE application_id = $1 AND lender_key = $2',
    [application.id, req.params.lenderKey]
  );
  if (existing.rows[0] && (existing.rows[0].messages || []).length > 0) {
    return res.json(shapeReview(existing.rows[0]));
  }

  const [subScores, additionalNotes] = [await loadSubScores(application.id), parseNotes(application)];
  const profile = deriveProfile(lender);
  const matchDetail = { reasons: lender.reasons || [], cautions: lender.cautions || [] };

  const started = await startReview({ application, additionalNotes, lender, profile, subScores, matchDetail });
  if (!started.ok) return res.status(502).json({ error: `Couldn't start the review right now — ${started.reason}.` });

  const messages = [{ role: 'underwriter', content: started.opening }];
  const { rows } = await pool.query(
    `INSERT INTO underwriter_reviews (application_id, user_id, lender_key, lender_name, messages)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (application_id, lender_key) DO UPDATE SET messages = EXCLUDED.messages, updated_at = now()
     RETURNING *`,
    [application.id, req.userId, req.params.lenderKey, lender.name, JSON.stringify(messages)]
  );

  res.json({ ...shapeReview(rows[0]), focusPoints: started.focusPoints, hardBlocker: started.hardBlocker });
});

// POST /:applicationId/:lenderKey/message — the owner answers; the reviewer
// reacts, captures the answer, and either asks the next question or closes.
router.post('/:applicationId/:lenderKey/message', async (req, res) => {
  const text = String(req.body?.text ?? '').trim();
  if (!text) return res.status(400).json({ error: 'text is required' });

  const application = await loadOwnedApplication(req.params.applicationId, req.userId);
  if (!application) return res.status(404).json({ error: 'Application not found' });

  const reviewRow = (
    await pool.query('SELECT * FROM underwriter_reviews WHERE application_id = $1 AND lender_key = $2', [
      application.id,
      req.params.lenderKey,
    ])
  ).rows[0];
  if (!reviewRow) return res.status(409).json({ error: 'Start the review before replying to it.' });

  const lender = await findMatchedLender(application.id, req.params.lenderKey);
  if (!lender) return res.status(404).json({ error: 'That lender is not among your matches.' });

  const [subScores, additionalNotes] = [await loadSubScores(application.id), parseNotes(application)];
  const profile = deriveProfile(lender);
  const matchDetail = { reasons: lender.reasons || [], cautions: lender.cautions || [] };

  const turn = await continueReview({
    application,
    additionalNotes,
    lender,
    profile,
    subScores,
    matchDetail,
    history: reviewRow.messages || [],
    userMessage: text,
  });
  if (!turn.ok) return res.status(502).json({ error: `The reviewer didn't respond — ${turn.reason}. Your progress is saved; try again.` });

  const messages = [
    ...(reviewRow.messages || []),
    { role: 'owner', content: text },
    { role: 'underwriter', content: turn.message },
  ];
  const preparedAnswers = turn.capturedAnswer
    ? [...(reviewRow.prepared_answers || []), turn.capturedAnswer]
    : reviewRow.prepared_answers || [];
  const verdict = turn.verdict || reviewRow.verdict || null;

  const { rows } = await pool.query(
    `UPDATE underwriter_reviews
       SET messages = $1, prepared_answers = $2, verdict = $3, updated_at = now()
     WHERE application_id = $4 AND lender_key = $5
     RETURNING *`,
    [JSON.stringify(messages), JSON.stringify(preparedAnswers), verdict ? JSON.stringify(verdict) : null, application.id, req.params.lenderKey]
  );

  res.json({ ...shapeReview(rows[0]), readyToClose: turn.readyToClose });
});

// POST /:applicationId/:lenderKey/pack — assemble (or return the cached)
// lender-shaped application pack from the business case + prepared answers.
router.post('/:applicationId/:lenderKey/pack', async (req, res) => {
  const application = await loadOwnedApplication(req.params.applicationId, req.userId);
  if (!application) return res.status(404).json({ error: 'Application not found' });

  const reviewRow = (
    await pool.query('SELECT * FROM underwriter_reviews WHERE application_id = $1 AND lender_key = $2', [
      application.id,
      req.params.lenderKey,
    ])
  ).rows[0];
  if (!reviewRow) return res.status(409).json({ error: 'Practice the review first — the pack is built from your prepared answers.' });

  if (reviewRow.pack && !req.body?.rebuild) return res.json(reviewRow.pack);

  const lender = await findMatchedLender(application.id, req.params.lenderKey);
  if (!lender) return res.status(404).json({ error: 'That lender is not among your matches.' });

  const businessCase = (
    await pool.query('SELECT sections FROM business_cases WHERE application_id = $1', [application.id])
  ).rows[0] || { sections: [] };

  const profile = deriveProfile(lender);
  const pack = await buildPack({ businessCase, review: reviewRow, profile, lender });
  if (!pack.ok) return res.status(502).json({ error: `Couldn't assemble the pack — ${pack.reason}.` });

  await pool.query('UPDATE underwriter_reviews SET pack = $1, updated_at = now() WHERE application_id = $2 AND lender_key = $3', [
    JSON.stringify(pack),
    application.id,
    req.params.lenderKey,
  ]);

  res.json(pack);
});

export default router;
