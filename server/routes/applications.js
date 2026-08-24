import { Router } from 'express';
import db from '../db/connection.js';
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

router.post('/', (req, res) => {
  const body = req.body || {};
  const missing = REQUIRED_APPLICATION_FIELDS.filter((field) => body[field] === undefined || body[field] === null || body[field] === '');
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  const state = normalizeState(body.state);
  if (!state) {
    return res.status(400).json({ error: `Unrecognized state: ${body.state}` });
  }

  const application = {
    business_name: String(body.business_name),
    industry: String(body.industry),
    city: String(body.city),
    state,
    time_in_business_months: Number(body.time_in_business_months),
    annual_revenue: Number(body.annual_revenue),
    requested_amount: Number(body.requested_amount),
    purpose: body.purpose ? String(body.purpose) : '',
    created_at: new Date().toISOString(),
    ...coerceDeepProfile(body),
  };

  const insert = db.prepare(`
    INSERT INTO applications (
      business_name, industry, city, state, time_in_business_months, annual_revenue, requested_amount, purpose, created_at,
      existing_monthly_debt_payment, business_structure, employee_count, has_tax_returns, cash_flow_pattern,
      credit_band, prior_funding_history, use_of_funds_detail, ownership_demographics
    )
    VALUES (
      @business_name, @industry, @city, @state, @time_in_business_months, @annual_revenue, @requested_amount, @purpose, @created_at,
      @existing_monthly_debt_payment, @business_structure, @employee_count, @has_tax_returns, @cash_flow_pattern,
      @credit_band, @prior_funding_history, @use_of_funds_detail, @ownership_demographics
    )
  `);
  const info = insert.run(application);

  res.status(201).json({ id: info.lastInsertRowid, ...application });
});

router.get('/:id', (req, res) => {
  const application = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  if (!application) return res.status(404).json({ error: 'Application not found' });
  res.json(application);
});

export default router;
