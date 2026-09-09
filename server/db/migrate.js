// Idempotent schema migrations run on server boot (called from
// connection.js). schema.sql stays the canonical, hand-run definition for a
// fresh Supabase project — including the auth.users trigger, which needs
// privileges this pooled connection doesn't have — but the plain
// CREATE TABLE IF NOT EXISTS / ALTER ... IF NOT EXISTS statements for app
// tables added after launch are safe to apply automatically here, so a
// deploy doesn't require a manual trip to the SQL editor. Every statement
// below must be safe to run on every boot.

const STATEMENTS = [
  // ---------- Living Business Case ----------
  // One evolving, first-person funding narrative per application, drafted
  // from the interview and refined by conversation. sections/assumptions are
  // the document itself; history is a lightweight change log.
  `CREATE TABLE IF NOT EXISTS business_cases (
     id SERIAL PRIMARY KEY,
     application_id INTEGER NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
     user_id UUID NOT NULL,
     sections JSONB NOT NULL DEFAULT '[]'::jsonb,
     assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
     meta JSONB NOT NULL DEFAULT '{}'::jsonb,
     history JSONB NOT NULL DEFAULT '[]'::jsonb,
     created_at TIMESTAMPTZ DEFAULT now(),
     updated_at TIMESTAMPTZ DEFAULT now()
   )`,

  // ---------- Underwriter simulation ----------
  // A per-(application, lender) review conversation held as that lender's
  // reviewer. messages is the transcript, prepared_answers the cleaned-up
  // answers the owner can reuse in the real application, verdict the closing
  // read (timing + strengths + gaps).
  `CREATE TABLE IF NOT EXISTS underwriter_reviews (
     id SERIAL PRIMARY KEY,
     application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
     user_id UUID NOT NULL,
     lender_key TEXT NOT NULL,
     lender_name TEXT NOT NULL,
     messages JSONB NOT NULL DEFAULT '[]'::jsonb,
     prepared_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
     verdict JSONB,
     created_at TIMESTAMPTZ DEFAULT now(),
     updated_at TIMESTAMPTZ DEFAULT now(),
     UNIQUE (application_id, lender_key)
   )`,

  // The assembled, lender-shaped application pack (business summary,
  // use-of-funds, etc.) — cached on the review it's built from.
  `ALTER TABLE underwriter_reviews ADD COLUMN IF NOT EXISTS pack JSONB`,

  // The 12-month cash-flow projection scaffold, edited by the owner.
  `ALTER TABLE business_cases ADD COLUMN IF NOT EXISTS projection JSONB`,

  // A drafted business plan (standard sections), edited by conversation —
  // for SBA intermediaries and lenders that require a written plan.
  `ALTER TABLE business_cases ADD COLUMN IF NOT EXISTS plan JSONB`,

  // Document vault — files stored in Supabase Storage ('documents' bucket),
  // this table is the index. storage_path is the object key.
  `CREATE TABLE IF NOT EXISTS documents (
     id SERIAL PRIMARY KEY,
     application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
     user_id UUID NOT NULL,
     kind TEXT NOT NULL DEFAULT 'other',
     filename TEXT NOT NULL,
     storage_path TEXT NOT NULL,
     size_bytes INTEGER,
     mime_type TEXT,
     created_at TIMESTAMPTZ DEFAULT now()
   )`,
  `ALTER TABLE documents ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "own documents" ON documents`,
  `CREATE POLICY "own documents" ON documents FOR ALL USING (auth.uid() = user_id)`,

  // Funding type — most programs are loans, but grants (money that isn't
  // repaid) and other non-debt capital are matched and prepared for
  // differently. 'loan' | 'grant' | 'other'.
  `ALTER TABLE lenders ADD COLUMN IF NOT EXISTS funding_type TEXT NOT NULL DEFAULT 'loan'`,
  `ALTER TABLE discovered_lenders ADD COLUMN IF NOT EXISTS funding_type TEXT NOT NULL DEFAULT 'loan'`,

  // Adaptive follow-through: which kind of help this owner needs, inferred
  // from the interview — shapes the tone of the post-match features.
  `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS help_mode TEXT`,
  `ALTER TABLE applications ADD COLUMN IF NOT EXISTS help_mode TEXT`,

  // Email reminders: per-user opt-out + an unguessable unsubscribe token,
  // and a per-tracked-row "last reminded" stamp to avoid re-sending.
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_reminders_enabled BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT`,
  `ALTER TABLE tracked_applications ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ`,
  `ALTER TABLE applications ADD COLUMN IF NOT EXISTS revisit_reminded_at TIMESTAMPTZ`,
  `ALTER TABLE match_results ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()`,
  // Language the interview was conducted in (BCP-47-ish, e.g. 'en', 'es').
  `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en'`,
  `ALTER TABLE applications ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en'`,

  // Application tracker — which programs the owner is pursuing and where
  // each one stands. One row per (application, lender).
  `CREATE TABLE IF NOT EXISTS tracked_applications (
     id SERIAL PRIMARY KEY,
     application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
     user_id UUID NOT NULL,
     lender_key TEXT NOT NULL,
     lender_name TEXT NOT NULL,
     funding_type TEXT NOT NULL DEFAULT 'loan',
     status TEXT NOT NULL DEFAULT 'considering',
     note TEXT,
     deadline DATE,
     created_at TIMESTAMPTZ DEFAULT now(),
     updated_at TIMESTAMPTZ DEFAULT now(),
     UNIQUE (application_id, lender_key)
   )`,

  `ALTER TABLE business_cases ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE underwriter_reviews ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE tracked_applications ENABLE ROW LEVEL SECURITY`,

  `DROP POLICY IF EXISTS "own business cases" ON business_cases`,
  `CREATE POLICY "own business cases" ON business_cases FOR ALL USING (auth.uid() = user_id)`,

  `DROP POLICY IF EXISTS "own underwriter reviews" ON underwriter_reviews`,
  `CREATE POLICY "own underwriter reviews" ON underwriter_reviews FOR ALL USING (auth.uid() = user_id)`,

  `DROP POLICY IF EXISTS "own tracked applications" ON tracked_applications`,
  `CREATE POLICY "own tracked applications" ON tracked_applications FOR ALL USING (auth.uid() = user_id)`,
];

const TRANSIENT = /EPROTO|ECONNRESET|ETIMEDOUT|Connection terminated|socket hang up|SSL alert|read ECONN/i;

export async function runMigrations(pool) {
  // Run every statement on ONE dedicated client rather than borrowing a
  // fresh pooled connection per query. Supabase's transaction pooler
  // occasionally drops the first TLS handshake on a brand-new connection;
  // establishing a single client up front (with retries) and reusing it
  // avoids re-triggering that on each of ~30 idempotent statements.
  let client = null;
  for (let attempt = 1; attempt <= 5 && !client; attempt++) {
    try {
      const c = await pool.connect();
      await c.query('SELECT 1');
      client = c;
    } catch (err) {
      if (attempt === 5) {
        console.error('[db] could not establish a migration connection:', err.message);
        return;
      }
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }

  try {
    for (const sql of STATEMENTS) {
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          await client.query(sql);
          break;
        } catch (err) {
          if (TRANSIENT.test(err.message) && attempt < 5) {
            await new Promise((r) => setTimeout(r, 300 * attempt));
            continue;
          }
          // A migration failure shouldn't take the whole server down on
          // boot — the post-run check below reports anything actually
          // missing; everything here is idempotent so a stale transient
          // failure on an already-applied statement is harmless.
          console.warn('[db] a migration statement did not apply this boot (may already exist):', err.message.slice(0, 120));
          break;
        }
      }
    }

    // The one signal that matters: did the columns/tables the code needs
    // actually end up present?
    const REQUIRED = [
      ['business_cases', 'projection'],
      ['lenders', 'funding_type'],
      ['applications', 'language'],
      ['applications', 'help_mode'],
      ['tracked_applications', 'status'],
      ['documents', 'storage_path'],
      ['underwriter_reviews', 'pack'],
    ];
    const { rows } = await client.query(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [[...new Set(REQUIRED.map((r) => r[0]))]]
    );
    const present = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
    const missing = REQUIRED.filter(([t, c]) => !present.has(`${t}.${c}`));
    if (missing.length) {
      console.error(
        '[db] MIGRATION INCOMPLETE — missing:',
        missing.map(([t, c]) => `${t}.${c}`).join(', '),
        '— rerun server/db/schema.sql in the Supabase SQL editor.'
      );
    }
  } finally {
    client.release();
  }
}
