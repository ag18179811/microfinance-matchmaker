export const INDUSTRIES = [
  'Retail',
  'Food Service',
  'Personal Services',
  'Professional Services',
  'Manufacturing',
  'Construction',
  'Transportation',
  'Wholesale',
  'Agriculture',
  'Tourism',
  'Health Care',
  'Child Care',
  'Arts and Entertainment',
  'Technology',
  'Real Estate',
];

export const REQUIRED_APPLICATION_FIELDS = [
  'business_name',
  'industry',
  'city',
  'state',
  'time_in_business_months',
  'annual_revenue',
  'requested_amount',
];

// The deeper profile the adaptive interview gathers beyond the core required
// fields above. None of these are hard-required — they enrich the readiness
// analysis but the app still functions if any are left null. Order here is
// the order the deterministic fallback (no GROQ_API_KEY, or a failed call)
// walks them in, with ownership_demographics deliberately last since it's
// optional and framed as a bonus, never a gate.
export const DEEP_PROFILE_FIELDS = {
  existing_monthly_debt_payment: {
    type: 'number',
    label: 'Roughly how much do you pay each month toward existing business debt (loans, credit cards, etc.)? If none, just say zero.',
  },
  business_structure: {
    type: 'select',
    options: ['sole_prop', 'llc', 's_corp', 'c_corp', 'partnership', 'other'],
    label: "What's the legal structure of your business?",
  },
  employee_count: {
    type: 'number',
    label: 'Including yourself, how many people work at the business?',
  },
  has_tax_returns: {
    type: 'select',
    options: ['yes_2yr', 'yes_1yr', 'no'],
    label: 'Do you have business tax returns ready — for the last two years, one year, or none yet?',
  },
  cash_flow_pattern: {
    type: 'select',
    options: ['steady', 'seasonal', 'growing', 'declining'],
    label: 'How would you describe your revenue pattern — steady, seasonal, growing, or declining?',
  },
  credit_band: {
    type: 'select',
    options: ['under_600', '600_680', '680_720', '720_plus', 'not_sure'],
    label: 'Roughly what range is your personal or business credit score in?',
  },
  prior_funding_history: {
    type: 'text',
    label: 'Have you applied for or received business funding before? If so, what happened?',
  },
  use_of_funds_detail: {
    type: 'text',
    label: 'Can you break down more specifically what the funding would go toward?',
  },
  ownership_demographics: {
    type: 'text',
    optional: true,
    label:
      "Optional — do you identify as a woman-owned, minority-owned, or veteran-owned business? Answering can unlock a few extra lender matches, but it's entirely up to you.",
  },
};

export const DEEP_PROFILE_FIELD_ORDER = Object.keys(DEEP_PROFILE_FIELDS);

export const US_STATES = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
  Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA',
  Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
  Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD',
  Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO',
  Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH',
  Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT',
  Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY',
  'District of Columbia': 'DC',
};

export const STATE_ABBREVIATIONS = new Set(Object.values(US_STATES));

const STATE_NAME_LOOKUP = new Map(Object.entries(US_STATES).map(([name, abbr]) => [name.toLowerCase(), abbr]));

export function normalizeState(input) {
  if (input === null || input === undefined) return null;
  const trimmed = String(input).trim();
  if (trimmed.length === 0) return null;
  const upper = trimmed.toUpperCase();
  if (STATE_ABBREVIATIONS.has(upper)) return upper;
  const byName = STATE_NAME_LOOKUP.get(trimmed.toLowerCase());
  return byName || null;
}
