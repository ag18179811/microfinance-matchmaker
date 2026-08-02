import { Router } from 'express';
import { extractApplicationFields } from '../services/groq-extract.js';
import { REQUIRED_APPLICATION_FIELDS } from '../constants.js';

const router = Router();

const MAX_DESCRIPTION_LENGTH = 4000;

function isBlank(value) {
  return value === null || value === undefined || value === '';
}

router.post('/extract', async (req, res) => {
  const description = String(req.body?.description ?? '').trim();
  if (!description) return res.status(400).json({ error: 'description is required' });
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return res.status(400).json({ error: `description is too long (max ${MAX_DESCRIPTION_LENGTH} characters)` });
  }

  const known = req.body?.known && typeof req.body.known === 'object' ? req.body.known : {};

  const extracted = await extractApplicationFields(description);
  // Answers the user has already confirmed (via a prior follow-up round) win
  // over a fresh extraction pass.
  const fields = { ...extracted, ...known };

  const missingFields = REQUIRED_APPLICATION_FIELDS.filter((field) => isBlank(fields[field]));

  res.json({ fields, missingFields });
});

export default router;
