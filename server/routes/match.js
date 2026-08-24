import { Router } from 'express';
import pool from '../db/connection.js';
import { computeReadiness, matchLenders } from '../services/matching-engine.js';
import { generateCoachingSummary } from '../services/groq-coach.js';

const router = Router();

export async function loadResults(applicationId) {
  const { rows } = await pool.query(
    `SELECT mr.match_score, mr.readiness_score, mr.ai_summary, mr.match_details, mr.readiness_breakdown, l.*
     FROM match_results mr
     JOIN lenders l ON l.id = mr.lender_id
     WHERE mr.application_id = $1
     ORDER BY mr.match_score DESC`,
    [applicationId]
  );

  return rows.map((row) => {
    const { match_details, readiness_breakdown, ...rest } = row;
    const details = match_details ? JSON.parse(match_details) : { breakdown: {}, reasons: [], cautions: [] };
    return { ...rest, ...details };
  });
}

export async function loadSubScores(applicationId) {
  const { rows } = await pool.query('SELECT readiness_breakdown FROM match_results WHERE application_id = $1 LIMIT 1', [applicationId]);
  return rows[0]?.readiness_breakdown ? JSON.parse(rows[0].readiness_breakdown) : null;
}

// Every route here is scoped to req.userId (set by requireAuth) — an
// application id alone is never enough to read or match against it.
async function loadOwnedApplication(applicationId, userId) {
  const { rows } = await pool.query('SELECT * FROM applications WHERE id = $1 AND user_id = $2', [applicationId, userId]);
  return rows[0] || null;
}

router.post('/:applicationId', async (req, res) => {
  const application = await loadOwnedApplication(req.params.applicationId, req.userId);
  if (!application) return res.status(404).json({ error: 'Application not found' });

  const { rows: lenders } = await pool.query('SELECT * FROM lenders');
  const { readinessScore, subScores } = computeReadiness(application);
  const matches = matchLenders(application, lenders);

  const aiSummary = await generateCoachingSummary(application, subScores, readinessScore);
  const readinessBreakdownJson = JSON.stringify(subScores);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM match_results WHERE application_id = $1', [application.id]);
    for (const match of matches) {
      await client.query(
        `INSERT INTO match_results (application_id, lender_id, match_score, readiness_score, ai_summary, match_details, readiness_breakdown)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          application.id,
          match.lender.id,
          match.matchScore,
          readinessScore,
          aiSummary,
          JSON.stringify({ breakdown: match.breakdown, reasons: match.reasons, cautions: match.cautions }),
          readinessBreakdownJson,
        ]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.json({
    applicationId: application.id,
    readinessScore,
    subScores,
    aiSummary,
    matches: await loadResults(application.id),
  });
});

router.get('/:applicationId', async (req, res) => {
  const application = await loadOwnedApplication(req.params.applicationId, req.userId);
  if (!application) return res.status(404).json({ error: 'Application not found' });

  const results = await loadResults(application.id);
  if (results.length === 0) {
    return res.status(404).json({ error: 'No match results yet. POST to this endpoint first.' });
  }
  res.json({
    applicationId: application.id,
    readinessScore: results[0].readiness_score,
    subScores: await loadSubScores(application.id),
    aiSummary: results[0].ai_summary,
    matches: results,
  });
});

export default router;
