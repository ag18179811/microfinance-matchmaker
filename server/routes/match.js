import { Router } from 'express';
import pool from '../db/connection.js';
import { computeReadiness, matchLenders } from '../services/matching-engine.js';
import { generateCoachingSummary } from '../services/groq-coach.js';
import { assessAnswerQuality } from '../services/groq-quality-check.js';
import { searchLiveLenders } from '../services/openai-lender-search.js';
import { computeImprovementPlan, personalizeImprovementPlan } from '../services/improvement-plan.js';
import { classifyHelpMode, helpModeInfo } from '../services/help-mode.js';
import { computeFundingPlan, narrateFundingPlan } from '../services/funding-plan.js';
import { deriveProfile } from '../services/lender-application-profiles.js';

const router = Router();

const DISCOVERED_CACHE_DAYS = 30;
const DISCOVERED_LENDER_COLUMNS =
  'id, name, type, funding_type, geography, min_loan, max_loan, industries, eligibility_notes, source_url, min_months_in_business, min_months_in_business_type';

// Cache-only read of previously discovered lenders for this (state,
// industry). Split out from getDiscoveredLenders so the what-if simulator
// can reuse whatever's already been found without ever triggering a fresh
// (billed) web search on every slider move.
async function getCachedDiscoveredLenders(state, industry) {
  if (!state) return [];
  try {
    const { rows } = await pool.query(
      `SELECT ${DISCOVERED_LENDER_COLUMNS} FROM discovered_lenders
       WHERE search_state = $1 AND search_industry IS NOT DISTINCT FROM $2
         AND discovered_at > now() - interval '${DISCOVERED_CACHE_DAYS} days'`,
      [state, industry || null]
    );
    return rows;
  } catch (err) {
    console.error('[match] cached discovered-lender read failed:', err.message);
    return [];
  }
}

// Live-searched lenders (server/services/openai-lender-search.js), cached by
// (state, industry) so the same combo isn't re-searched for every applicant
// that shares it. Never blocks the match response — a search failure just
// means this request runs on the static table alone, same as if no
// OPENAI_API_KEY were configured at all.
async function getDiscoveredLenders(state, industry) {
  if (!state) return [];

  try {
    const cached = await getCachedDiscoveredLenders(state, industry);
    if (cached.length > 0) return cached;

    const found = await searchLiveLenders({ state, industry });
    if (found.length === 0) return [];

    const inserted = [];
    for (const lender of found) {
      const { rows } = await pool.query(
        `INSERT INTO discovered_lenders
           (name, type, funding_type, geography, min_loan, max_loan, industries, eligibility_notes, source_url,
            min_months_in_business, min_months_in_business_type, search_state, search_industry)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING ${DISCOVERED_LENDER_COLUMNS}`,
        [
          lender.name,
          lender.type,
          lender.funding_type || 'loan',
          lender.geography,
          lender.min_loan,
          lender.max_loan,
          lender.industries,
          lender.eligibility_notes,
          lender.source_url,
          lender.min_months_in_business,
          lender.min_months_in_business_type,
          state,
          industry || null,
        ]
      );
      inserted.push(rows[0]);
    }
    return inserted;
  } catch (err) {
    console.error('[match] discovered-lender lookup/insert failed, continuing on static table only:', err.message);
    return [];
  }
}

export async function loadResults(applicationId) {
  const { rows } = await pool.query(
    `SELECT mr.match_score, mr.readiness_score, mr.ai_summary, mr.match_details, mr.readiness_breakdown,
            l.id, l.name, l.type, l.funding_type, l.geography, l.min_loan, l.max_loan, l.industries, l.eligibility_notes,
            l.source_url, l.min_months_in_business, l.min_months_in_business_type, 'verified' AS provenance
     FROM match_results mr
     JOIN lenders l ON l.id = mr.lender_id AND mr.lender_source = 'static'
     WHERE mr.application_id = $1

     UNION ALL

     SELECT mr.match_score, mr.readiness_score, mr.ai_summary, mr.match_details, mr.readiness_breakdown,
            dl.id, dl.name, dl.type, dl.funding_type, dl.geography, dl.min_loan, dl.max_loan, dl.industries, dl.eligibility_notes,
            dl.source_url, dl.min_months_in_business, dl.min_months_in_business_type, 'discovered' AS provenance
     FROM match_results mr
     JOIN discovered_lenders dl ON dl.id = mr.lender_id AND mr.lender_source = 'discovered'
     WHERE mr.application_id = $1

     ORDER BY match_score DESC`,
    [applicationId]
  );

  const mapped = rows.map((row) => {
    const { match_details, readiness_breakdown, ...rest } = row;
    const details = match_details ? JSON.parse(match_details) : { breakdown: {}, reasons: [], cautions: [] };
    return { ...rest, ...details };
  });

  return dedupeByName(mapped, (m) => m.name, (m) => m.provenance === 'verified', (m) => m.match_score);
}

// A live web search can surface a program that's already in the
// hand-verified static table (e.g. "SBA Microloan Program"), which would
// otherwise show up as two near-identical results. Collapse by normalized
// name, preferring the verified entry on a clash and otherwise the higher
// score.
export function dedupeByName(items, nameOf, isPreferred, scoreOf) {
  const seen = new Map();
  for (const item of items) {
    const key = (nameOf(item) || '').trim().toLowerCase();
    if (!key) {
      seen.set(Symbol(), item);
      continue;
    }
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, item);
    } else if (!isPreferred(existing) && isPreferred(item)) {
      seen.set(key, item);
    } else if (isPreferred(existing) === isPreferred(item) && scoreOf(item) > scoreOf(existing)) {
      seen.set(key, item);
    }
  }
  return [...seen.values()].sort((a, b) => scoreOf(b) - scoreOf(a));
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

// The full match pipeline for one application — readiness scoring, help-mode
// classification, lender matching (static + live-discovered), the coaching
// summary, and persistence of match_results. Used by both the initial
// POST /:applicationId and the recompute endpoint.
async function runMatchPipeline(application) {
  const [{ rows: staticLenders }, discoveredLenders, contentQuality] = await Promise.all([
    pool.query('SELECT * FROM lenders'),
    getDiscoveredLenders(application.state, application.industry),
    assessAnswerQuality(application),
  ]);
  const { readinessScore, subScores: rawSubScores } = computeReadiness(application, contentQuality);
  const help = classifyHelpMode(application, rawSubScores, readinessScore);
  await pool.query('UPDATE applications SET help_mode = $1, plan_cache = NULL WHERE id = $2', [help.mode, application.id]);
  const subScores = { ...rawSubScores, answerQualityConcerns: contentQuality.concerns };

  const taggedLenders = [
    ...staticLenders.map((l) => ({ ...l, provenance: 'verified' })),
    ...discoveredLenders.map((l) => ({ ...l, provenance: 'discovered' })),
  ];
  const matches = matchLenders(application, taggedLenders);

  const aiSummary = await generateCoachingSummary(
    application,
    rawSubScores,
    readinessScore,
    contentQuality.concerns,
    application.language || 'en',
    help.mode
  );
  const readinessBreakdownJson = JSON.stringify(subScores);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM match_results WHERE application_id = $1', [application.id]);
    for (const match of matches) {
      await client.query(
        `INSERT INTO match_results (application_id, lender_id, lender_source, match_score, readiness_score, ai_summary, match_details, readiness_breakdown)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          application.id,
          match.lender.id,
          match.lender.provenance === 'discovered' ? 'discovered' : 'static',
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

  return {
    applicationId: application.id,
    readinessScore,
    subScores,
    aiSummary,
    helpMode: helpModeInfo(help.mode),
    matches: await loadResults(application.id),
  };
}

router.post('/:applicationId', async (req, res) => {
  const application = await loadOwnedApplication(req.params.applicationId, req.userId);
  if (!application) return res.status(404).json({ error: 'Application not found' });
  res.json(await runMatchPipeline(application));
});

// POST /:applicationId/recompute — apply owner-confirmed numeric changes
// (from syncing their refined funding story) to the application, then
// re-run the whole match pipeline so the score and matches reflect them.
const RECOMPUTABLE_FIELDS = new Set([
  'time_in_business_months',
  'annual_revenue',
  'requested_amount',
  'existing_monthly_debt_payment',
]);

router.post('/:applicationId/recompute', async (req, res) => {
  const application = await loadOwnedApplication(req.params.applicationId, req.userId);
  if (!application) return res.status(404).json({ error: 'Application not found' });

  const apply = req.body?.apply || {};
  const updates = {};
  for (const [key, value] of Object.entries(apply)) {
    if (!RECOMPUTABLE_FIELDS.has(key)) continue;
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) updates[key] = Math.round(n);
  }

  if (Object.keys(updates).length > 0) {
    const setClause = Object.keys(updates)
      .map((k, i) => `${k} = $${i + 1}`)
      .join(', ');
    await pool.query(`UPDATE applications SET ${setClause} WHERE id = $${Object.keys(updates).length + 1}`, [
      ...Object.values(updates),
      application.id,
    ]);
  }

  const fresh = await loadOwnedApplication(req.params.applicationId, req.userId);
  res.json({ ...(await runMatchPipeline(fresh)), applied: updates });
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
    helpMode: helpModeInfo(application.help_mode),
    matches: results,
  });
});

function parseNotes(application) {
  try {
    return typeof application.additional_notes === 'string'
      ? JSON.parse(application.additional_notes || '[]')
      : application.additional_notes || [];
  } catch {
    return [];
  }
}

// The two Groq-narrated plans below are cached on applications.plan_cache,
// keyed by the newest match_results timestamp — a rematch or recompute
// rewrites those rows with a fresh timestamp, which invalidates the cache
// on its own. Without this the Results page re-bills both calls every view.
async function matchesStamp(applicationId) {
  const { rows } = await pool.query(
    'SELECT max(created_at) AS stamp FROM match_results WHERE application_id = $1',
    [applicationId]
  );
  return rows[0]?.stamp ? new Date(rows[0].stamp).toISOString() : null;
}

function cachedPlan(application, key, stamp) {
  const entry = application.plan_cache?.[key];
  return entry && entry.stamp && entry.stamp === stamp ? entry.data : null;
}

async function storePlan(applicationId, key, stamp, data) {
  await pool.query(
    `UPDATE applications
       SET plan_cache = jsonb_set(COALESCE(plan_cache, '{}'::jsonb), $2, $3::jsonb, true)
     WHERE id = $1`,
    [applicationId, `{${key}}`, JSON.stringify({ stamp, data })]
  );
}

// GET /:applicationId/funding-plan — the capital stack + application order
// to actually raise the amount needed when no single program covers it.
router.get('/:applicationId/funding-plan', async (req, res) => {
  const application = await loadOwnedApplication(req.params.applicationId, req.userId);
  if (!application) return res.status(404).json({ error: 'Application not found' });

  const matches = await loadResults(application.id);
  if (matches.length === 0) return res.status(409).json({ error: 'Run matching first.' });

  const stamp = await matchesStamp(application.id);
  const cached = cachedPlan(application, 'fundingPlan', stamp);
  if (cached) return res.json(cached);

  const { rows: reviewRows } = await pool.query(
    'SELECT lender_key, verdict FROM underwriter_reviews WHERE application_id = $1 AND verdict IS NOT NULL',
    [application.id]
  );
  const verdicts = Object.fromEntries(reviewRows.map((r) => [r.lender_key, r.verdict]));

  const plan = computeFundingPlan({
    application,
    matches,
    profileFor: (m) => deriveProfile(m),
    verdicts,
  });
  const narrated = await narrateFundingPlan(plan, {
    application,
    additionalNotes: parseNotes(application),
    language: application.language || 'en',
  });
  if (stamp) await storePlan(application.id, 'fundingPlan', stamp, narrated);
  res.json(narrated);
});

// GET /:applicationId/improvement-plan — prioritized, concrete steps to
// raise the readiness score, each with a real projected impact computed by
// re-running the scoring engine.
router.get('/:applicationId/improvement-plan', async (req, res) => {
  const application = await loadOwnedApplication(req.params.applicationId, req.userId);
  if (!application) return res.status(404).json({ error: 'Application not found' });

  const subScores = await loadSubScores(application.id);
  const baseline = await loadResults(application.id);
  if (!subScores || baseline.length === 0) {
    return res.status(409).json({ error: 'Run matching first, then you can see how to improve.' });
  }

  const stamp = await matchesStamp(application.id);
  const cached = cachedPlan(application, 'improvementPlan', stamp);
  if (cached) return res.json(cached);

  const readinessScore = baseline[0].readiness_score;
  const plan = computeImprovementPlan(application, subScores, readinessScore, subScores.answerQualityConcerns || []);
  const personalized = await personalizeImprovementPlan(plan, application, parseNotes(application), application.language || 'en');
  if (stamp) await storePlan(application.id, 'improvementPlan', stamp, personalized);
  res.json(personalized);
});

// The financial levers the what-if simulator is allowed to change. Location
// and industry are deliberately excluded: changing them would require a
// fresh (billed) lender search, and they aren't really "what if I adjusted
// my plan" levers the way these three are.
const SIMULATABLE_FIELDS = ['requested_amount', 'time_in_business_months', 'annual_revenue'];

function readOverrides(body) {
  const overrides = {};
  for (const key of SIMULATABLE_FIELDS) {
    const raw = body?.[key];
    if (raw === undefined || raw === null || raw === '') continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) overrides[key] = Math.round(n);
  }
  return overrides;
}

// Re-runs the deterministic readiness + matching engine against a
// hypothetical version of the application, WITHOUT persisting anything.
// Lets the user see "if I asked for less / waited a few months / grew
// revenue, where would I land and who else would match" directly on the
// results screen. answerQuality is held at its stored value on purpose — a
// hypothetical number can't change how credible the user's typed answers
// were.
router.post('/:applicationId/simulate', async (req, res) => {
  const application = await loadOwnedApplication(req.params.applicationId, req.userId);
  if (!application) return res.status(404).json({ error: 'Application not found' });

  const storedSubScores = await loadSubScores(application.id);
  const baseline = await loadResults(application.id);
  if (!storedSubScores || baseline.length === 0) {
    return res.status(409).json({ error: 'Run matching first, then you can simulate changes to it.' });
  }

  const overrides = readOverrides(req.body);
  const simulated = { ...application, ...overrides };

  const heldQuality = { qualityScore: storedSubScores.answerQuality };
  const { readinessScore, subScores } = computeReadiness(simulated, heldQuality);

  const [{ rows: staticLenders }, discoveredLenders] = await Promise.all([
    pool.query('SELECT * FROM lenders'),
    getCachedDiscoveredLenders(application.state, application.industry),
  ]);
  const taggedLenders = [
    ...staticLenders.map((l) => ({ ...l, provenance: 'verified' })),
    ...discoveredLenders.map((l) => ({ ...l, provenance: 'discovered' })),
  ];
  const simMatches = dedupeByName(
    matchLenders(simulated, taggedLenders),
    (m) => m.lender.name,
    (m) => m.lender.provenance === 'verified',
    (m) => m.matchScore
  );

  const baselineNames = new Set(baseline.map((m) => m.name));
  const simNames = new Set(simMatches.map((m) => m.lender.name));

  res.json({
    overrides,
    applicationSnapshot: {
      requested_amount: application.requested_amount,
      time_in_business_months: application.time_in_business_months,
      annual_revenue: application.annual_revenue,
    },
    baseline: {
      readinessScore: baseline[0].readiness_score,
      matchCount: baseline.length,
    },
    readinessScore,
    subScores: { ...subScores, answerQualityConcerns: storedSubScores.answerQualityConcerns || [] },
    matchCount: simMatches.length,
    matches: simMatches.map((m) => ({
      name: m.lender.name,
      type: m.lender.type,
      match_score: m.matchScore,
      provenance: m.lender.provenance,
      min_loan: m.lender.min_loan,
      max_loan: m.lender.max_loan,
      source_url: m.lender.source_url,
    })),
    newlyMatched: simMatches.filter((m) => !baselineNames.has(m.lender.name)).map((m) => m.lender.name),
    nowExcluded: baseline.filter((m) => !simNames.has(m.name)).map((m) => m.name),
  });
});

export default router;
