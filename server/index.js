import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { default: applicationsRouter } = await import('./routes/applications.js');
const { default: matchRouter } = await import('./routes/match.js');
const { default: intakeRouter } = await import('./routes/intake.js');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/applications', applicationsRouter);
app.use('/api/match', matchRouter);
app.use('/api/intake', intakeRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Microfinance Matchmaker server listening on port ${PORT}`);
});
