import { Router } from 'express';
import db from '../db/connection.js';
import { computeReadiness, matchLenders } from '../services/matching-engine.js';
import { generateCoachingSummary } from '../services/groq-coach.js';

const router = Router();

function loadResults(applicationId) {
  const rows = db
    .prepare(
      `
      SELECT mr.match_score, mr.readiness_score, mr.ai_summary, mr.match_details, mr.readiness_breakdown, l.*
      FROM match_results mr
      JOIN lenders l ON l.id = mr.lender_id
      WHERE mr.application_id = ?
      ORDER BY mr.match_score DESC
    `
    )
    .all(applicationId);

  return rows.map((row) => {
    const { match_details, readiness_breakdown, ...rest } = row;
    const details = match_details ? JSON.parse(match_details) : { breakdown: {}, reasons: [], cautions: [] };
    return { ...rest, ...details };
  });
}

function loadSubScores(applicationId) {
  const row = db
    .prepare('SELECT readiness_breakdown FROM match_results WHERE application_id = ? LIMIT 1')
    .get(applicationId);
  return row?.readiness_breakdown ? JSON.parse(row.readiness_breakdown) : null;
}

router.post('/:applicationId', async (req, res) => {
  const application = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.applicationId);
  if (!application) return res.status(404).json({ error: 'Application not found' });

  const lenders = db.prepare('SELECT * FROM lenders').all();
  const { readinessScore, subScores } = computeReadiness(application);
  const matches = matchLenders(application, lenders);

  const aiSummary = await generateCoachingSummary(application, subScores, readinessScore);

  const clearExisting = db.prepare('DELETE FROM match_results WHERE application_id = ?');
  const insertMatch = db.prepare(`
    INSERT INTO match_results (application_id, lender_id, match_score, readiness_score, ai_summary, match_details, readiness_breakdown)
    VALUES (@application_id, @lender_id, @match_score, @readiness_score, @ai_summary, @match_details, @readiness_breakdown)
  `);

  const readinessBreakdownJson = JSON.stringify(subScores);

  const persist = db.transaction(() => {
    clearExisting.run(application.id);
    for (const match of matches) {
      insertMatch.run({
        application_id: application.id,
        lender_id: match.lender.id,
        match_score: match.matchScore,
        readiness_score: readinessScore,
        ai_summary: aiSummary,
        match_details: JSON.stringify({ breakdown: match.breakdown, reasons: match.reasons, cautions: match.cautions }),
        readiness_breakdown: readinessBreakdownJson,
      });
    }
  });
  persist();

  res.json({
    applicationId: application.id,
    readinessScore,
    subScores,
    aiSummary,
    matches: loadResults(application.id),
  });
});

router.get('/:applicationId', (req, res) => {
  const results = loadResults(req.params.applicationId);
  if (results.length === 0) {
    return res.status(404).json({ error: 'No match results yet. POST to this endpoint first.' });
  }
  res.json({
    applicationId: Number(req.params.applicationId),
    readinessScore: results[0].readiness_score,
    subScores: loadSubScores(req.params.applicationId),
    aiSummary: results[0].ai_summary,
    matches: results,
  });
});

export default router;
