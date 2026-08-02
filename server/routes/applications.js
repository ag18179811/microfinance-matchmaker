import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

const REQUIRED_FIELDS = [
  'business_name',
  'industry',
  'city',
  'state',
  'time_in_business_months',
  'annual_revenue',
  'requested_amount',
];

router.post('/', (req, res) => {
  const body = req.body || {};
  const missing = REQUIRED_FIELDS.filter((field) => body[field] === undefined || body[field] === null || body[field] === '');
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  const application = {
    business_name: String(body.business_name),
    industry: String(body.industry),
    city: String(body.city),
    state: String(body.state),
    time_in_business_months: Number(body.time_in_business_months),
    annual_revenue: Number(body.annual_revenue),
    requested_amount: Number(body.requested_amount),
    purpose: body.purpose ? String(body.purpose) : '',
    created_at: new Date().toISOString(),
  };

  const insert = db.prepare(`
    INSERT INTO applications (business_name, industry, city, state, time_in_business_months, annual_revenue, requested_amount, purpose, created_at)
    VALUES (@business_name, @industry, @city, @state, @time_in_business_months, @annual_revenue, @requested_amount, @purpose, @created_at)
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
