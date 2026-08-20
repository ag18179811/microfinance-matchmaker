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

export const STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA',
  'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
  'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

const STATE_NAMES = {
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

const STATE_NAME_LOOKUP = new Map(Object.entries(STATE_NAMES).map(([name, abbr]) => [name.toLowerCase(), abbr]));
const STATE_ABBR_SET = new Set(STATES.concat('DC'));

// Accepts a 2-letter code or a full state name (either case) and returns the
// canonical abbreviation, or null if it doesn't match a real US state.
export function normalizeState(input) {
  const trimmed = String(input ?? '').trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (STATE_ABBR_SET.has(upper)) return upper;
  return STATE_NAME_LOOKUP.get(trimmed.toLowerCase()) || null;
}

// Metadata for the dynamic follow-up form: only fields the backend reports
// as missing after extraction ever get rendered.
export const FIELD_META = {
  business_name: { label: "What's your business called?", type: 'text' },
  industry: { label: 'Which industry best fits your business?', type: 'select', options: INDUSTRIES },
  city: { label: 'What city is your business based in?', type: 'text' },
  state: { label: 'What state is it in?', type: 'select', options: STATES },
  time_in_business_months: { label: 'About how many months have you been in operation?', type: 'number' },
  annual_revenue: { label: "What's your approximate annual revenue, in dollars?", type: 'number' },
  requested_amount: { label: 'How much funding are you looking for, in dollars?', type: 'number' },
};
