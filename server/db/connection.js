import pg from 'pg';
import { seedLenders } from './seed-lenders.js';
import { runMigrations } from './migrate.js';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Copy the Postgres connection string from Supabase (Project Settings -> Database -> Connection string) into your .env file.'
  );
}

// Supabase requires SSL; rejectUnauthorized: false matches Supabase's own
// connection guidance for standard client libraries.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// A pg.Pool emits 'error' when an IDLE client in the pool hits a network-
// level error (a dropped connection, a transient SSL hiccup with a pooler,
// etc.) — this happens independently of any in-flight query and isn't
// something a try/catch around a query can ever catch. Node's EventEmitter
// treats an unhandled 'error' event as fatal and crashes the process; this
// is the one required listener that turns "the whole server dies on a
// transient network blip" into "log it, the pool recovers on its own." Found
// live: a single dropped connection to Supabase's pooler took the entire
// server down mid-request with no listener here.
pool.on('error', (err) => {
  console.error('[db] idle client error (pool recovers automatically):', err.message);
});

// The base schema (including the auth.users trigger) is run once by hand via
// Supabase's SQL editor rather than auto-executed here — see
// server/db/schema.sql. runMigrations() applies only the idempotent
// CREATE TABLE IF NOT EXISTS statements for app tables added after launch,
// so a deploy doesn't need a manual SQL-editor step for those.
await runMigrations(pool);

// Reconcile the lender catalog on boot: insert any verified program that
// isn't in the table yet (matched by name), leaving existing rows alone.
// This seeds an empty table and also picks up catalog additions on a plain
// redeploy, without a manual reseed step.
const seeded = await seedLenders(pool);
if (seeded > 0) console.log(`[db] added ${seeded} lender(s) from the verified catalog`);

export default pool;
