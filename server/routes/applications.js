import { Router } from 'express';
import pool from '../db/connection.js';
import { REQUIRED_APPLICATION_FIELDS, DEEP_PROFILE_FIELDS, DEEP_PROFILE_FIELD_ORDER, normalizeState } from '../constants.js';
import { coerceNumber, coerceSelect, coerceString } from '../services/field-coercion.js';

const router = Router();

// Never trust the deep-profile fields from the client body blindly, even
// though they're optional — same defensive coercion as everywhere else.
function coerceDeepProfile(body) {
  const out = {};
  for (const key of DEEP_PROFILE_FIELD_ORDER) {
    const meta = DEEP_PROFILE_FIELDS[key];
    const raw = body[key];
    if (meta.type === 'select') out[key] = coerceSelect(raw, meta.options);
    else if (meta.type === 'number') out[key] = coerceNumber(raw);
    else out[key] = coerceString(raw);
  }
  return out;
}

// The open-ended, business-specific facts the interview gathered beyond the
// fixed fields — this is where most of what makes the analysis genuinely
// tailored to this particular business lives.
function coerceAdditionalNotes(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((n) => ({ topic: coerceString(n?.topic), detail: coerceString(n?.detail) }))
    .filter((n) => n.topic && n.detail);
}

router.post('/', async (req, res) => {
  const body = req.body || {};
  const missing = REQUIRED_APPLICATION_FIELDS.filter((field) => body[field] === undefined || body[field] === null || body[field] === '');
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  const state = normalizeState(body.state);
  if (!state) {
    return res.status(400).json({ error: `Unrecognized state: ${body.state}` });
  }

  const deep = coerceDeepProfile(body);
  const additionalNotes = coerceAdditionalNotes(body.notes);
  const { rows } = await pool.query(
    `INSERT INTO applications (
       user_id, business_name, industry, city, state, time_in_business_months, annual_revenue, requested_amount, purpose,
       existing_monthly_debt_payment, business_structure, employee_count, has_tax_returns, cash_flow_pattern,
       credit_band, prior_funding_history, use_of_funds_detail, ownership_demographics, additional_notes
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
     RETURNING *`,
    [
      req.userId,
      String(body.business_name),
      String(body.industry),
      String(body.city),
      state,
      Number(body.time_in_business_months),
      Number(body.annual_revenue),
      Number(body.requested_amount),
      body.purpose ? String(body.purpose) : '',
      deep.existing_monthly_debt_payment,
      deep.business_structure,
      deep.employee_count,
      deep.has_tax_returns,
      deep.cash_flow_pattern,
      deep.credit_band,
      deep.prior_funding_history,
      deep.use_of_funds_detail,
      deep.ownership_demographics,
      JSON.stringify(additionalNotes),
    ]
  );

  const application = rows[0];

  // Link this application back to the conversation it came from, so a
  // resumed conversation can find its results and the post-results
  // follow-up chat has something to answer questions about. Scoped to the
  // caller's own conversations — a conversationId for someone else's thread
  // is silently ignored rather than trusted.
  const conversationId = req.body?.conversationId;
  if (conversationId) {
    await pool.query('UPDATE conversations SET application_id = $1 WHERE id = $2 AND user_id = $3', [
      application.id,
      conversationId,
      req.userId,
    ]);
  }

  res.status(201).json(application);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM applications WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  if (rows.length === 0) return res.status(404).json({ error: 'Application not found' });
  res.json(rows[0]);
});

export default router;
