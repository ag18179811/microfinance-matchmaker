// Document vault. Files live in the Supabase Storage 'documents' bucket
// (private); this table is the index and every access goes through the
// server (service role) with a per-user ownership check. Downloads are
// short-lived signed URLs. The bucket is created lazily on first upload.

import { Router } from 'express';
import multer from 'multer';
import pool from '../db/connection.js';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { DOCUMENT_KINDS } from '../services/document-kinds.js';

const router = Router();
const BUCKET = 'documents';
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES } });

function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    next();
  });
}

async function loadOwnedApplication(applicationId, userId) {
  const { rows } = await pool.query('SELECT id FROM applications WHERE id = $1 AND user_id = $2', [applicationId, userId]);
  return rows[0] || null;
}

let bucketReady = false;
async function ensureBucket(admin) {
  if (bucketReady) return;
  try {
    const { data } = await admin.storage.getBucket(BUCKET);
    if (!data) await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_BYTES });
  } catch {
    // createBucket throws if it already exists, treat that as fine
    await admin.storage.createBucket(BUCKET, { public: false }).catch(() => {});
  }
  bucketReady = true;
}

function shape(row) {
  return {
    id: row.id,
    kind: row.kind,
    kindLabel: DOCUMENT_KINDS[row.kind] || row.kind,
    filename: row.filename,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}

router.get('/:applicationId', async (req, res) => {
  const app = await loadOwnedApplication(req.params.applicationId, req.userId);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  const { rows } = await pool.query('SELECT * FROM documents WHERE application_id = $1 ORDER BY created_at DESC', [app.id]);
  res.json({ documents: rows.map(shape), kinds: DOCUMENT_KINDS });
});

router.post('/:applicationId', handleUpload, async (req, res) => {
  const app = await loadOwnedApplication(req.params.applicationId, req.userId);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (!req.file) return res.status(400).json({ error: 'file is required' });

  const { originalname, mimetype, buffer, size } = req.file;
  if (!ALLOWED_MIME.has(mimetype)) {
    return res.status(400).json({ error: 'Supported: PDF, image, Excel/CSV, or Word.' });
  }
  const kind = DOCUMENT_KINDS[req.body?.kind] ? req.body.kind : 'other';
  const safeName = originalname.replace(/[^\w.\- ]+/g, '_').slice(0, 120);
  const storagePath = `${req.userId}/${app.id}/${Date.now()}-${safeName}`;

  const admin = getSupabaseAdmin();
  await ensureBucket(admin);
  const { error: upErr } = await admin.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: mimetype,
    upsert: false,
  });
  if (upErr) {
    console.error('[documents] storage upload failed:', upErr.message);
    return res.status(502).json({ error: 'Could not store that file. Try again.' });
  }

  const { rows } = await pool.query(
    `INSERT INTO documents (application_id, user_id, kind, filename, storage_path, size_bytes, mime_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [app.id, req.userId, kind, safeName, storagePath, size, mimetype]
  );
  res.status(201).json(shape(rows[0]));
});

router.get('/:applicationId/:docId/url', async (req, res) => {
  const app = await loadOwnedApplication(req.params.applicationId, req.userId);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  const { rows } = await pool.query('SELECT * FROM documents WHERE id = $1 AND application_id = $2 AND user_id = $3', [
    req.params.docId,
    app.id,
    req.userId,
  ]);
  if (!rows[0]) return res.status(404).json({ error: 'Document not found' });

  const { data, error } = await getSupabaseAdmin().storage.from(BUCKET).createSignedUrl(rows[0].storage_path, 120);
  if (error) return res.status(502).json({ error: 'Could not produce a download link.' });
  res.json({ url: data.signedUrl });
});

router.delete('/:applicationId/:docId', async (req, res) => {
  const app = await loadOwnedApplication(req.params.applicationId, req.userId);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  const { rows } = await pool.query('SELECT * FROM documents WHERE id = $1 AND application_id = $2 AND user_id = $3', [
    req.params.docId,
    app.id,
    req.userId,
  ]);
  if (!rows[0]) return res.status(404).json({ error: 'Document not found' });

  await getSupabaseAdmin().storage.from(BUCKET).remove([rows[0].storage_path]).catch(() => {});
  await pool.query('DELETE FROM documents WHERE id = $1', [rows[0].id]);
  res.json({ ok: true });
});

export default router;
