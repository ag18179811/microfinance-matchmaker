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

  `ALTER TABLE business_cases ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE underwriter_reviews ENABLE ROW LEVEL SECURITY`,

  `DROP POLICY IF EXISTS "own business cases" ON business_cases`,
  `CREATE POLICY "own business cases" ON business_cases FOR ALL USING (auth.uid() = user_id)`,

  `DROP POLICY IF EXISTS "own underwriter reviews" ON underwriter_reviews`,
  `CREATE POLICY "own underwriter reviews" ON underwriter_reviews FOR ALL USING (auth.uid() = user_id)`,
];

export async function runMigrations(pool) {
  for (const sql of STATEMENTS) {
    try {
      await pool.query(sql);
    } catch (err) {
      // A migration failure shouldn't take the whole server down on boot —
      // log it loudly and let the features that need the table fail their
      // own requests with a clear error instead.
      console.error('[db] migration statement failed:', err.message, '\n  ', sql.split('\n')[0]);
    }
  }
}
