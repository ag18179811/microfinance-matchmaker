-- Run this once in Supabase's SQL editor (Project -> SQL Editor -> New query)
-- after creating the project. Safe to re-run: every statement is idempotent.
--
-- IMPORTANT: `CREATE TABLE IF NOT EXISTS` only creates a table the FIRST time
-- it's run — if a table already exists from an earlier version of this file,
-- re-running it does NOT retroactively add columns that were added later.
-- Every column added after a table's original CREATE TABLE must ALSO get an
-- explicit `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` below (see the
-- "Migrations for pre-existing tables" section near the bottom), or an
-- already-provisioned database silently drifts out of sync with the code
-- that expects these columns to exist.

-- ---------- Profiles ----------
-- Supabase creates and manages auth.users itself once Google auth is enabled.
-- This app only ever stores app-specific fields in a linked profiles row.

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create a profile row whenever a new user signs in for the first time.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- App tables ----------

CREATE TABLE IF NOT EXISTS lenders (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT, -- 'CDFI' | 'city_program' | 'nonprofit'
  geography TEXT, -- state or metro served
  min_loan INTEGER,
  max_loan INTEGER,
  industries TEXT, -- comma-separated
  eligibility_notes TEXT,
  source_url TEXT,
  min_months_in_business INTEGER, -- null = no stated tenure threshold
  min_months_in_business_type TEXT -- 'required' (hard gate) | 'preferred' (soft, scored down) | null
);

-- Live-discovered lenders (server/services/openai-lender-search.js), cached
-- by (search_state, search_industry) so the same combo isn't re-searched
-- for every applicant. Same shape as `lenders` plus provenance/freshness
-- columns. Kept as a separate table (not merged into `lenders`) so the
-- hand-verified static set and auto-discovered results stay distinguishable
-- everywhere they're used, including in the UI.
CREATE TABLE IF NOT EXISTS discovered_lenders (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  geography TEXT,
  min_loan INTEGER,
  max_loan INTEGER,
  industries TEXT,
  eligibility_notes TEXT,
  source_url TEXT NOT NULL,
  min_months_in_business INTEGER,
  min_months_in_business_type TEXT,
  search_state TEXT NOT NULL,
  search_industry TEXT,
  discovered_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discovered_lenders_cache ON discovered_lenders (search_state, search_industry);

CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT,
  industry TEXT,
  city TEXT,
  state TEXT,
  time_in_business_months INTEGER,
  annual_revenue INTEGER,
  requested_amount INTEGER,
  purpose TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Deeper profile gathered by the adaptive interview. All optional --
  -- none of these become a new hard requirement the way the fields above are.
  existing_monthly_debt_payment INTEGER,
  credit_band TEXT, -- 'under_600' | '600_680' | '680_720' | '720_plus' | 'not_sure'
  business_structure TEXT, -- 'sole_prop' | 'llc' | 's_corp' | 'c_corp' | 'partnership' | 'other'
  employee_count INTEGER,
  has_tax_returns TEXT, -- 'yes_2yr' | 'yes_1yr' | 'no'
  cash_flow_pattern TEXT, -- 'steady' | 'seasonal' | 'growing' | 'declining'
  prior_funding_history TEXT,
  use_of_funds_detail TEXT,
  ownership_demographics TEXT, -- self-reported, optional, never scored
  additional_notes TEXT -- JSON array of {topic, detail} — open-ended, business-specific facts the interview gathered beyond the fixed fields above
);

CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL, -- set once the interview completes
  status TEXT DEFAULT 'in_progress', -- 'in_progress' | 'complete'
  fields TEXT, -- JSON snapshot of everything gathered so far
  notes TEXT, -- JSON array of {topic, detail} — mirrors applications.additional_notes, accumulated live during the interview
  turn_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT, -- 'user' | 'assistant'
  content TEXT,
  reasoning TEXT, -- assistant-only: the model's stated rationale for this turn
  field_key TEXT, -- assistant-only: the field this question is chiefly about, if any
  field_key_source TEXT, -- 'fallback' (strict coercion, retry on bad input) | 'llm' (lenient safety-net only)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Files are parsed in memory and discarded — only the extracted text is kept,
-- not the raw bytes.
CREATE TABLE IF NOT EXISTS conversation_attachments (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  filename TEXT,
  mime_type TEXT,
  extracted_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- The Living Business Case: one evolving, first-person funding narrative per
-- application, drafted from the interview and refined by conversation. Also
-- created on server boot by db/migrate.js so a deploy needs no manual step.
CREATE TABLE IF NOT EXISTS business_cases (
  id SERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,     -- [{ key, heading, body, confidence, sources }]
  assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ id, text, resolved }]
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,       -- [{ at, summary }]
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Underwriter simulation: a per-(application, lender) review conversation
-- held as that lender's reviewer.
CREATE TABLE IF NOT EXISTS underwriter_reviews (
  id SERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lender_key TEXT NOT NULL,                         -- `${provenance}:${lender_id}`
  lender_name TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,      -- [{ role: 'underwriter'|'owner', content }]
  prepared_answers JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ question, answer }]
  verdict JSONB,                                    -- { timing, strengths, gaps, recommendation }
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (application_id, lender_key)
);

CREATE TABLE IF NOT EXISTS match_results (
  id SERIAL PRIMARY KEY,
  application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
  -- Points into `lenders` or `discovered_lenders`, per lender_source — a
  -- single FK can't target either table conditionally, so this is enforced
  -- at the application layer (routes/match.js) instead of by the schema.
  lender_id INTEGER NOT NULL,
  lender_source TEXT NOT NULL DEFAULT 'static', -- 'static' (lenders) | 'discovered' (discovered_lenders)
  match_score INTEGER,
  readiness_score INTEGER,
  ai_summary TEXT,
  match_details TEXT, -- JSON: { breakdown, reasons: [...], cautions: [...] } for this lender
  readiness_breakdown TEXT -- JSON: subScores, same value on every row for one application
);

-- ---------- Row-level security ----------
-- Defense in depth: the Express backend authorizes every request itself
-- (using the service-role key, which bypasses RLS by design), but this
-- ensures that even a leaked anon key or an app-layer bug can't expose one
-- user's data to another if something ever queries Postgres directly.

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE underwriter_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own applications" ON applications;
CREATE POLICY "own applications" ON applications FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own conversations" ON conversations;
CREATE POLICY "own conversations" ON conversations FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own conversation messages" ON conversation_messages;
CREATE POLICY "own conversation messages" ON conversation_messages FOR ALL USING (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
);

DROP POLICY IF EXISTS "own conversation attachments" ON conversation_attachments;
CREATE POLICY "own conversation attachments" ON conversation_attachments FOR ALL USING (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
);

DROP POLICY IF EXISTS "own match results" ON match_results;
CREATE POLICY "own match results" ON match_results FOR ALL USING (
  EXISTS (SELECT 1 FROM applications a WHERE a.id = application_id AND a.user_id = auth.uid())
);

DROP POLICY IF EXISTS "own business cases" ON business_cases;
CREATE POLICY "own business cases" ON business_cases FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own underwriter reviews" ON underwriter_reviews;
CREATE POLICY "own underwriter reviews" ON underwriter_reviews FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own profile" ON profiles;
CREATE POLICY "own profile" ON profiles FOR ALL USING (auth.uid() = id);

-- lenders has no RLS — it's shared reference data, readable by everyone.

-- ---------- Migrations for pre-existing tables ----------
-- Explicit, idempotent ALTERs for every column added after this file's
-- tables were first created — see the note at the top of this file. Each of
-- these is a no-op if already applied.

ALTER TABLE applications ADD COLUMN IF NOT EXISTS additional_notes TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE match_results ADD COLUMN IF NOT EXISTS lender_source TEXT NOT NULL DEFAULT 'static';

-- lender_id used to be a hard FK into `lenders` only; it now also needs to
-- point into `discovered_lenders` when lender_source = 'discovered', which
-- a single FK constraint can't express (see the column comment above). Drop
-- it if a pre-existing table still has the old constraint.
ALTER TABLE match_results DROP CONSTRAINT IF EXISTS match_results_lender_id_fkey;
