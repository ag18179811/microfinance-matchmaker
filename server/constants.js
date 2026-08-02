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
