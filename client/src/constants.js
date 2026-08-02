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
