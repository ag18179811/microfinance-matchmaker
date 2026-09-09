import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import 'express-async-errors'; // makes async route handlers forward throws to the error middleware
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// A transient Supabase-pooler SSL/connection error thrown from an in-flight
// query used to take the whole server down (Express 4 doesn't catch async
// handler rejections without the import above; a bare rejection is fatal).
// Belt-and-suspenders: log and keep serving rather than exit.
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled rejection (kept alive):', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('[server] uncaught exception (kept alive):', err?.message || err);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { default: applicationsRouter } = await import('./routes/applications.js');
const { default: matchRouter } = await import('./routes/match.js');
const { default: interviewRouter } = await import('./routes/interview.js');
const { default: conversationsRouter } = await import('./routes/conversations.js');
const { default: businessCaseRouter } = await import('./routes/business-case.js');
const { default: underwriterRouter } = await import('./routes/underwriter.js');
const { default: previewRouter } = await import('./routes/preview.js');
const { default: trackerRouter } = await import('./routes/tracker.js');
const { default: documentsRouter } = await import('./routes/documents.js');
const { default: cronRouter } = await import('./routes/cron.js');
const { default: meRouter } = await import('./routes/me.js');
const { default: shareRouter } = await import('./routes/share.js');
const { default: pool } = await import('./db/connection.js');
const { requireAuth } = await import('./middleware/auth.js');

const app = express();

// Locked to known frontend origins now that real user sessions are
// involved, instead of the previous wide-open cors(). Set
// ALLOWED_ORIGINS as a comma-separated list (e.g. your Vercel URL(s) +
// http://localhost:5173 for local dev).
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());

// Every interview turn is a billed Groq call — this is a lightweight
// abuse/cost guard, not a precise quota system.
const interviewLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
// The business-case and underwriter features are also billed AI calls per
// request — same lightweight per-minute abuse/cost guard.
const aiWorkLimiter = rateLimit({ windowMs: 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false });

app.get('/api/health', (req, res) => res.json({ ok: true }));
// No-account readiness estimate — the one public, unauthenticated route.
// Deterministic and unpersisted; rate-limited harder than the rest.
const previewLimiter = rateLimit({ windowMs: 60 * 1000, max: 12, standardHeaders: true, legacyHeaders: false });
app.use('/api/preview', previewLimiter, previewRouter);
app.use('/api/applications', requireAuth, applicationsRouter);
app.use('/api/match', requireAuth, matchRouter);
app.use('/api/interview', requireAuth, interviewLimiter, interviewRouter);
app.use('/api/conversations', requireAuth, conversationsRouter);
app.use('/api/business-case', requireAuth, aiWorkLimiter, businessCaseRouter);
app.use('/api/underwriter', requireAuth, aiWorkLimiter, underwriterRouter);
app.use('/api/tracker', requireAuth, trackerRouter);
app.use('/api/documents', requireAuth, documentsRouter);
app.use('/api/me', requireAuth, meRouter);
app.use('/api/cron', cronRouter);
// share.js mixes owner-only routes (requireAuth applied per-route) and one
// public GET /shared/:token, so it's mounted without a blanket requireAuth.
app.use('/api', shareRouter);

// Public, token-based reminder opt-out (from an email link).
app.get('/api/unsubscribe', async (req, res) => {
  const token = String(req.query.token || '');
  if (!/^[a-f0-9]{16,64}$/.test(token)) return res.status(400).type('text/plain').send('Invalid link.');
  const { rowCount } = await pool.query(
    'UPDATE profiles SET email_reminders_enabled = false WHERE unsubscribe_token = $1',
    [token]
  );
  res
    .type('text/html')
    .send(
      rowCount
        ? '<p style="font-family:sans-serif;max-width:420px;margin:60px auto">You won’t get application reminder emails anymore. You can turn them back on in your tracker settings anytime.</p>'
        : '<p style="font-family:sans-serif;max-width:420px;margin:60px auto">That link didn’t match anything — you may already be unsubscribed.</p>'
    );
});

// Terminal error handler — with the express-async-errors import above, a
// throw from any async route handler lands here instead of crashing the
// process. Transient DB/connection blips become a 503 the client can retry.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const transient = /EPROTO|ECONNRESET|ETIMEDOUT|Connection terminated|socket hang up|SSL alert|read ECONN|timed out/i.test(err?.message || '');
  console.error(`[server] ${transient ? 'transient ' : ''}error on ${req.method} ${req.path}:`, err?.message || err);
  if (res.headersSent) return;
  res.status(transient ? 503 : 500).json({
    error: transient
      ? 'A temporary hiccup on our end — please try that again in a moment.'
      : 'Something went wrong on our end.',
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Microfinance Matchmaker server listening on port ${PORT}`);
});
