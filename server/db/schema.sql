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
  created_at TEXT
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
