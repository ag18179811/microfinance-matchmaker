import { Router } from 'express';
import pool from '../db/connection.js';
import { draftBusinessCase, reviseBusinessCase, emptyCase, extractProfileFromNarrative } from '../services/business-case.js';

const router = Router();

// Scoped to req.userId (set by requireAuth) — an application id alone is
// never enough to read or write its business case.
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

async function loadCase(applicationId) {
  const { rows } = await pool.query('SELECT * FROM business_cases WHERE application_id = $1', [applicationId]);
  return rows[0] || null;
}

function shapeCase(row) {
  return {
    sections: row.sections || [],
    assumptions: (row.assumptions || []).filter((a) => !a.resolved),
    meta: row.meta || {},
    history: row.history || [],
    updatedAt: row.updated_at,
  };
}

// GET — return the case, drafting it lazily on first request. The draft is a
// single billed Groq call, so it only happens once and is then persisted.
router.get('/:applicationId', async (req, res) => {
  const application = await loadOwnedApplication(req.params.applicationId, req.userId);
  if (!application) return res.status(404).json({ error: 'Application not found' });

  const existing = await loadCase(application.id);
  if (existing) return res.json(shapeCase(existing));

  const additionalNotes = parseNotes(application);
  const draft = await draftBusinessCase({ application, additionalNotes, language: application.language || 'en', helpMode: application.help_mode });

  const base = draft.ok ? draft : emptyCase();
  const meta = {
    draftedAt: new Date().toISOString(),
    draftOk: draft.ok,
    ...(draft.ok ? {} : { draftError: draft.reason }),
  };

  const { rows } = await pool.query(
    `INSERT INTO business_cases (application_id, user_id, sections, assumptions, meta, history)
     VALUES ($1, $2, $3, $4, $5, '[]'::jsonb)
     ON CONFLICT (application_id) DO UPDATE SET updated_at = now()
     RETURNING *`,
    [application.id, req.userId, JSON.stringify(base.sections), JSON.stringify(base.assumptions), JSON.stringify(meta)]
  );

  res.json({ ...shapeCase(rows[0]), draftFailed: !draft.ok, draftError: draft.ok ? undefined : draft.reason });
});

// POST /message — the owner says something in plain language; revise the
// narrative to match, persist, and return the updated case + a short reply.
router.post('/:applicationId/message', async (req, res) => {
  const text = String(req.body?.text ?? '').trim();
  if (!text) return res.status(400).json({ error: 'text is required' });

  const application = await loadOwnedApplication(req.params.applicationId, req.userId);
  if (!application) return res.status(404).json({ error: 'Application not found' });

  let row = await loadCase(application.id);
  if (!row) {
    // No case yet — draft one first so there's something to revise.
    const additionalNotes = parseNotes(application);
    const draft = await draftBusinessCase({ application, additionalNotes, language: application.language || 'en', helpMode: application.help_mode });
    const base = draft.ok ? draft : emptyCase();
    const { rows } = await pool.query(
      `INSERT INTO business_cases (application_id, user_id, sections, assumptions, meta, history)
       VALUES ($1, $2, $3, $4, $5, '[]'::jsonb)
       ON CONFLICT (application_id) DO UPDATE SET updated_at = now()
       RETURNING *`,
      [application.id, req.userId, JSON.stringify(base.sections), JSON.stringify(base.assumptions), JSON.stringify({ draftedAt: new Date().toISOString(), draftOk: draft.ok })]
    );
    row = rows[0];
  }

  const additionalNotes = parseNotes(application);
  const revised = await reviseBusinessCase({
    application,
    additionalNotes,
    sections: row.sections || [],
    assumptions: row.assumptions || [],
    userMessage: text,
    language: application.language || 'en',
  });

  if (!revised.ok) {
    return res.status(502).json({ error: `Couldn't update the story right now — ${revised.reason}. Your last version is safe; try again in a moment.` });
  }

  const history = [
    ...(row.history || []),
    { at: new Date().toISOString(), summary: revised.changeSummary, said: text.slice(0, 200) },
  ].slice(-40);

  const { rows } = await pool.query(
    `UPDATE business_cases
       SET sections = $1, assumptions = $2, history = $3, updated_at = now()
     WHERE application_id = $4
     RETURNING *`,
    [JSON.stringify(revised.sections), JSON.stringify(revised.assumptions), JSON.stringify(history), application.id]
  );

  res.json({ ...shapeCase(rows[0]), reply: revised.reply, changeSummary: revised.changeSummary });
});

// POST /regenerate — throw away the current draft and redraft from the
// interview. Used when the owner wants a fresh start rather than edits.
router.post('/:applicationId/regenerate', async (req, res) => {
  const application = await loadOwnedApplication(req.params.applicationId, req.userId);
  if (!application) return res.status(404).json({ error: 'Application not found' });

  const additionalNotes = parseNotes(application);
  const draft = await draftBusinessCase({ application, additionalNotes, language: application.language || 'en', helpMode: application.help_mode });
  if (!draft.ok) {
    return res.status(502).json({ error: `Couldn't redraft right now — ${draft.reason}. Your current version is unchanged.` });
  }

  const { rows } = await pool.query(
    `UPDATE business_cases
       SET sections = $1, assumptions = $2, meta = $3, history = $4, updated_at = now()
     WHERE application_id = $5
     RETURNING *`,
    [
      JSON.stringify(draft.sections),
      JSON.stringify(draft.assumptions),
      JSON.stringify({ draftedAt: new Date().toISOString(), draftOk: true, regenerated: true }),
      JSON.stringify([{ at: new Date().toISOString(), summary: 'Redrafted from the interview' }]),
      application.id,
    ]
  );
  if (rows.length === 0) {
    // No prior row (shouldn't happen via the normal flow) — insert.
    const inserted = await pool.query(
      `INSERT INTO business_cases (application_id, user_id, sections, assumptions, meta, history)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        application.id,
        req.userId,
        JSON.stringify(draft.sections),
        JSON.stringify(draft.assumptions),
        JSON.stringify({ draftedAt: new Date().toISOString(), draftOk: true }),
        JSON.stringify([{ at: new Date().toISOString(), summary: 'Drafted from the interview' }]),
      ]
    );
    return res.json(shapeCase(inserted.rows[0]));
  }

  res.json(shapeCase(rows[0]));
});

// POST /:applicationId/sync-check — after the owner has refined their
// funding story, see whether its prose now implies numbers different from
// what's on the application. Returns proposed changes for the owner to
// confirm (or not); never mutates anything.
const SYNC_LABELS = {
  time_in_business_months: 'Time in business (months)',
  annual_revenue: 'Annual revenue',
  requested_amount: 'Funding requested',
  existing_monthly_debt_payment: 'Monthly debt payment',
};

router.post('/:applicationId/sync-check', async (req, res) => {
  const application = await loadOwnedApplication(req.params.applicationId, req.userId);
  if (!application) return res.status(404).json({ error: 'Application not found' });

  const row = await loadCase(application.id);
  if (!row) return res.json({ changes: [] });

  const fromNarrative = await extractProfileFromNarrative(row.sections || []);
  const changes = [];
  for (const [field, label] of Object.entries(SYNC_LABELS)) {
    const stated = fromNarrative[field];
    if (stated === undefined) continue;
    const current = application[field] === null || application[field] === undefined ? null : Number(application[field]);
    // Only surface a change if it's real and material (>5% or a null->value).
    if (current === null || (Math.abs(stated - current) > Math.max(1, current * 0.05))) {
      changes.push({ field, label, from: current, to: stated });
    }
  }
  res.json({ changes });
});

export default router;
