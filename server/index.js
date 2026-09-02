import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { default: applicationsRouter } = await import('./routes/applications.js');
const { default: matchRouter } = await import('./routes/match.js');
const { default: interviewRouter } = await import('./routes/interview.js');
const { default: conversationsRouter } = await import('./routes/conversations.js');
const { default: businessCaseRouter } = await import('./routes/business-case.js');
const { default: underwriterRouter } = await import('./routes/underwriter.js');
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
app.use('/api/applications', requireAuth, applicationsRouter);
app.use('/api/match', requireAuth, matchRouter);
app.use('/api/interview', requireAuth, interviewLimiter, interviewRouter);
app.use('/api/conversations', requireAuth, conversationsRouter);
app.use('/api/business-case', requireAuth, aiWorkLimiter, businessCaseRouter);
app.use('/api/underwriter', requireAuth, aiWorkLimiter, underwriterRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Microfinance Matchmaker server listening on port ${PORT}`);
});
