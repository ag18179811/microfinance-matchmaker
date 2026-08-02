// Placeholder CDFI / city-program / nonprofit lender seed data.
// Replace with real curated entries from the CDFI Fund Awards Database
// (https://www.cdfifund.gov/programs-training/programs/cdfi-fund-awards) before launch.

export const lenders = [
  {
    name: 'Northeast Community Capital Fund',
    type: 'CDFI',
    geography: 'NY,NJ,CT',
    min_loan: 5000,
    max_loan: 250000,
    industries: 'Retail,Food Service,Personal Services,Professional Services',
    eligibility_notes: 'Placeholder data. Prioritizes low-to-moderate income census tracts; 6+ months in business required.',
    source_url: '',
  },
  {
    name: 'Bay Area Small Business Loan Fund',
    type: 'CDFI',
    geography: 'CA',
    min_loan: 10000,
    max_loan: 500000,
    industries: 'Retail,Manufacturing,Food Service,Construction,Professional Services',
    eligibility_notes: 'Placeholder data. Serves businesses in San Francisco, Oakland, and San Jose metro areas.',
    source_url: '',
  },
  {
    name: 'Gulf Coast Microloan Program',
    type: 'city_program',
    geography: 'TX',
    min_loan: 2000,
    max_loan: 50000,
    industries: 'Retail,Food Service,Personal Services,Arts and Entertainment',
    eligibility_notes: 'Placeholder data. City of Houston program; requires business license within city limits.',
    source_url: '',
  },
  {
    name: 'Great Lakes Development Loan Fund',
    type: 'CDFI',
    geography: 'MI,OH,IN,IL,WI',
    min_loan: 15000,
    max_loan: 350000,
    industries: 'Manufacturing,Construction,Transportation,Wholesale',
    eligibility_notes: 'Placeholder data. Focus on job creation and manufacturing revitalization.',
    source_url: '',
  },
  {
    name: 'Piedmont Nonprofit Business Fund',
    type: 'nonprofit',
    geography: 'NC,SC,GA',
    min_loan: 1000,
    max_loan: 75000,
    industries: 'Retail,Food Service,Personal Services,Health Care,Professional Services',
    eligibility_notes: 'Placeholder data. Offers free technical assistance alongside loans; owner must complete 4-hour orientation.',
    source_url: '',
  },
  {
    name: 'Rocky Mountain Rural Enterprise Fund',
    type: 'CDFI',
    geography: 'CO,WY,MT,ID',
    min_loan: 5000,
    max_loan: 150000,
    industries: 'Agriculture,Retail,Tourism,Construction',
    eligibility_notes: 'Placeholder data. Preference for rural (non-metro) businesses; agriculture-adjacent ventures welcomed.',
    source_url: '',
  },
  {
    name: 'Twin Cities Micro Fund',
    type: 'city_program',
    geography: 'MN',
    min_loan: 2500,
    max_loan: 60000,
    industries: 'Retail,Food Service,Personal Services,Child Care',
    eligibility_notes: 'Placeholder data. City of Minneapolis/St. Paul program; owner-occupancy of storefront required.',
    source_url: '',
  },
  {
    name: 'Pacific Northwest Community Lenders',
    type: 'CDFI',
    geography: 'WA,OR',
    min_loan: 10000,
    max_loan: 400000,
    industries: 'Manufacturing,Retail,Food Service,Technology,Professional Services',
    eligibility_notes: 'Placeholder data. Emphasis on women- and minority-owned businesses; 12+ months in business preferred.',
    source_url: '',
  },
  {
    name: 'Southwest Border Business Fund',
    type: 'CDFI',
    geography: 'AZ,NM,TX',
    min_loan: 5000,
    max_loan: 200000,
    industries: 'Retail,Agriculture,Construction,Transportation,Food Service',
    eligibility_notes: 'Placeholder data. Bilingual application support available; serves colonias and border communities.',
    source_url: '',
  },
  {
    name: 'Appalachian Opportunity Loan Fund',
    type: 'nonprofit',
    geography: 'WV,KY,VA,TN',
    min_loan: 1000,
    max_loan: 100000,
    industries: 'Retail,Manufacturing,Tourism,Agriculture,Arts and Entertainment',
    eligibility_notes: 'Placeholder data. Targets economically distressed counties per CDFI Fund distress criteria.',
    source_url: '',
  },
  {
    name: 'Chicago Neighborhood Business Fund',
    type: 'city_program',
    geography: 'IL',
    min_loan: 5000,
    max_loan: 100000,
    industries: 'Retail,Food Service,Personal Services,Professional Services',
    eligibility_notes: 'Placeholder data. City of Chicago program; must operate in a designated neighborhood opportunity zone.',
    source_url: '',
  },
  {
    name: 'National Main Street Loan Program',
    type: 'nonprofit',
    geography: 'National',
    min_loan: 10000,
    max_loan: 250000,
    industries: 'Retail,Food Service,Personal Services,Professional Services,Manufacturing',
    eligibility_notes: 'Placeholder data. Nationwide nonprofit lender; requires 2 years of business tax returns.',
    source_url: '',
  },
  {
    name: 'Florida Coastal Enterprise Fund',
    type: 'CDFI',
    geography: 'FL',
    min_loan: 5000,
    max_loan: 300000,
    industries: 'Tourism,Retail,Food Service,Construction,Real Estate',
    eligibility_notes: 'Placeholder data. Hurricane-recovery fast-track track available for disaster-affected businesses.',
    source_url: '',
  },
  {
    name: 'New England Women-Owned Business Fund',
    type: 'nonprofit',
    geography: 'MA,RI,NH,VT,ME',
    min_loan: 2000,
    max_loan: 150000,
    industries: 'Retail,Personal Services,Professional Services,Health Care,Arts and Entertainment',
    eligibility_notes: 'Placeholder data. Priority for majority women-owned businesses; mentorship program included.',
    source_url: '',
  },
  {
    name: 'Detroit Small Business Recovery Fund',
    type: 'city_program',
    geography: 'MI',
    min_loan: 3000,
    max_loan: 80000,
    industries: 'Retail,Food Service,Manufacturing,Personal Services',
    eligibility_notes: 'Placeholder data. City of Detroit program; targets businesses in revitalization corridors.',
    source_url: '',
  },
  {
    name: 'Heartland Agricultural Business Fund',
    type: 'CDFI',
    geography: 'IA,NE,KS,MO,SD,ND',
    min_loan: 10000,
    max_loan: 300000,
    industries: 'Agriculture,Wholesale,Transportation,Manufacturing',
    eligibility_notes: 'Placeholder data. Serves agribusiness and rural supply-chain enterprises.',
    source_url: '',
  },
  {
    name: 'National Immigrant Entrepreneur Fund',
    type: 'nonprofit',
    geography: 'National',
    min_loan: 1000,
    max_loan: 50000,
    industries: 'Retail,Food Service,Personal Services,Transportation,Professional Services',
    eligibility_notes: 'Placeholder data. No SSN required if ITIN provided; multilingual loan officers available.',
    source_url: '',
  },
  {
    name: 'Southeast Metro Economic Development Fund',
    type: 'city_program',
    geography: 'GA',
    min_loan: 5000,
    max_loan: 120000,
    industries: 'Retail,Food Service,Professional Services,Technology',
    eligibility_notes: 'Placeholder data. City of Atlanta program; requires participation in a free 6-week business bootcamp.',
    source_url: '',
  },
];

export function seedLenders(db) {
  const insert = db.prepare(`
    INSERT INTO lenders (name, type, geography, min_loan, max_loan, industries, eligibility_notes, source_url)
    VALUES (@name, @type, @geography, @min_loan, @max_loan, @industries, @eligibility_notes, @source_url)
  `);

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });

  insertMany(lenders);
  return lenders.length;
}

// Allow running directly: `node db/seed-lenders.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: db } = await import('./connection.js');
  db.prepare('DELETE FROM lenders').run();
  const count = seedLenders(db);
  console.log(`Seeded ${count} lenders.`);
}
