CREATE TABLE IF NOT EXISTS lenders (
  id INTEGER PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY,
  business_name TEXT,
  industry TEXT,
  city TEXT,
  state TEXT,
  time_in_business_months INTEGER,
  annual_revenue INTEGER,
  requested_amount INTEGER,
  purpose TEXT,
  created_at TEXT,
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
  ownership_demographics TEXT -- self-reported, optional, never scored
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY,
  status TEXT DEFAULT 'in_progress', -- 'in_progress' | 'complete'
  fields TEXT, -- JSON snapshot of everything gathered so far
  turn_count INTEGER DEFAULT 0,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id INTEGER PRIMARY KEY,
  conversation_id INTEGER,
  role TEXT, -- 'user' | 'assistant'
  content TEXT,
  reasoning TEXT, -- assistant-only: the model's stated rationale for this turn
  field_key TEXT, -- assistant-only: the field this question is chiefly about, if any
  field_key_source TEXT, -- 'fallback' (strict coercion, retry on bad input) | 'llm' (lenient safety-net only)
  created_at TEXT,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- Files are parsed in memory and discarded — only the extracted text is kept,
-- not the raw bytes (nothing to gain storing them: same ephemeral-disk
-- caveat as the SQLite file itself on a free Render instance).
CREATE TABLE IF NOT EXISTS conversation_attachments (
  id INTEGER PRIMARY KEY,
  conversation_id INTEGER,
  filename TEXT,
  mime_type TEXT,
  extracted_text TEXT,
  created_at TEXT,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE TABLE IF NOT EXISTS match_results (
  id INTEGER PRIMARY KEY,
  application_id INTEGER,
  lender_id INTEGER,
  match_score INTEGER,
  readiness_score INTEGER,
  ai_summary TEXT,
  match_details TEXT, -- JSON: { breakdown, reasons: [...], cautions: [...] } for this lender
  readiness_breakdown TEXT, -- JSON: subScores, same value on every row for one application
  FOREIGN KEY (application_id) REFERENCES applications(id),
  FOREIGN KEY (lender_id) REFERENCES lenders(id)
);
