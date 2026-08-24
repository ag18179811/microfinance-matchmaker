// Real, individually verified lenders — each entry was checked against the
// organization's own website via live web search before being added here
// (dates noted per entry). This replaced an earlier placeholder dataset of
// invented lender names that were never real; if that's the version you're
// reading history for, treat every entry before this comment as fictional
// and do not rely on it.
//
// This list is intentionally small rather than broad: 8 real, checkable
// programs beat 18 fabricated ones. Expanding it further should pull from
// the CDFI Fund Awards Database (https://www.cdfifund.gov/awards/state-awards)
// with the same per-entry verification discipline — never bulk-generate
// entries from a model's own "knowledge," which is exactly how the fake
// dataset happened in the first place.

export const lenders = [
  {
    name: 'Accion Opportunity Fund',
    type: 'CDFI',
    geography:
      'AL,AK,AZ,AR,CA,CO,CT,DE,FL,GA,HI,ID,IL,IN,IA,KS,KY,LA,ME,MD,MA,MI,MN,MS,MO,NE,NV,NH,NJ,NM,NY,NC,OH,OK,OR,PA,RI,SC,TX,UT,VA,WA,WV,WI,WY,DC',
    min_loan: 5000,
    max_loan: 250000,
    industries: '',
    eligibility_notes:
      'Verified via aofund.org (checked Aug 2026). Requires 1+ year in business and $50,000+ in annual revenue; owner must hold 20%+ ownership. Not available in MT, ND, SD, TN, or VT.',
    source_url: 'https://aofund.org/business-loans/small-business-term-loan/',
    min_months_in_business: 12,
    min_months_in_business_type: 'required',
  },
  {
    name: 'LiftFund',
    type: 'CDFI',
    geography: 'TX',
    min_loan: 500,
    max_loan: 250000,
    industries: '',
    eligibility_notes:
      'Verified via liftfund.com (checked Aug 2026). Nonprofit CDFI lender open to startups in eligible industries; applicant must be 21+ with at least 6 months of positive credit history.',
    source_url: 'https://www.liftfund.com/',
  },
  {
    name: 'Kiva U.S.',
    type: 'nonprofit',
    geography: 'National',
    min_loan: 0,
    max_loan: 15000,
    industries: '',
    eligibility_notes:
      'Verified via kiva.org/borrow (checked Aug 2026). 0% interest, crowdfunded by individual backers — no credit score, collateral, or minimum time in business required. Funding depends on backers actually funding your request, so it is not guaranteed.',
    source_url: 'https://www.kiva.org/borrow',
  },
  {
    name: 'SBA Microloan Program',
    type: 'nonprofit',
    geography: 'National',
    min_loan: 500,
    max_loan: 50000,
    industries: '',
    eligibility_notes:
      'Verified via sba.gov (checked Aug 2026). Delivered through SBA-approved nonprofit intermediary lenders, so exact terms and requirements vary by intermediary and location — use SBA\'s Lender Match tool to find the intermediary serving your area. Average microloan is around $13,000.',
    source_url: 'https://www.sba.gov/funding-programs/loans/microloans',
  },
  {
    name: 'Grameen America',
    type: 'nonprofit',
    geography: 'NY,NE,IN,NC,TX,AZ',
    min_loan: 500,
    max_loan: 2500,
    industries: '',
    eligibility_notes:
      'Verified via grameenamerica.org (checked Aug 2026). Serves women business owners only, in select cities within these states — not statewide, so confirm your specific city is served before applying. Group-lending model: you join a 5-member loan group; first loan is $500-$2,500, with larger loans available after a repayment track record. No collateral or credit history required. Excludes adult entertainment businesses.',
    source_url: 'https://www.grameenamerica.org/request-a-loan',
  },
  {
    name: 'Community Reinvestment Fund, USA (CRF)',
    type: 'nonprofit',
    geography: 'National',
    min_loan: 5000,
    max_loan: 500000,
    industries: '',
    eligibility_notes:
      'Verified via crfusa.com (checked Aug 2026). CRF is a matching/referral network of 160+ partner lenders and support organizations, not a single direct lender — applying routes your request to lenders in their network. Applying does not affect your credit.',
    source_url: 'https://smallbusiness.crfusa.com/apply/',
  },
  {
    name: 'Craft3',
    type: 'CDFI',
    geography: 'WA,OR',
    min_loan: 5000,
    max_loan: 15000000,
    industries: '',
    eligibility_notes:
      'Verified via craft3.org (checked Aug 2026). Nonprofit CDFI serving Oregon and Washington from regional offices; particularly focused on minority-, women-, and immigrant-owned businesses and applicants who don\'t qualify for bank financing. Loan sizes span a very wide range, from small working-capital loans to large commercial financing.',
    source_url: 'https://www.craft3.org/business-loans',
  },
  {
    name: 'Justine PETERSEN',
    type: 'CDFI',
    geography: 'MO,IL,KS',
    min_loan: 500,
    max_loan: 150000,
    industries: '',
    eligibility_notes:
      'Verified via justinepetersen.org (checked Aug 2026). Serves all of Missouri, plus 73 Illinois counties and 28 Kansas counties (not the entire states) — confirm your county is covered before applying. One of the SBA\'s largest microlenders by volume nationally.',
    source_url: 'https://justinepetersen.org/what-we-do/small-business/',
  },
];

export async function seedLenders(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of lenders) {
      const full = { min_months_in_business: null, min_months_in_business_type: null, ...row };
      await client.query(
        `INSERT INTO lenders (name, type, geography, min_loan, max_loan, industries, eligibility_notes, source_url, min_months_in_business, min_months_in_business_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          full.name,
          full.type,
          full.geography,
          full.min_loan,
          full.max_loan,
          full.industries,
          full.eligibility_notes,
          full.source_url,
          full.min_months_in_business,
          full.min_months_in_business_type,
        ]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return lenders.length;
}

// Allow running directly: `node db/seed-lenders.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: pool } = await import('./connection.js');
  await pool.query('DELETE FROM lenders');
  const count = await seedLenders(pool);
  console.log(`Seeded ${count} lenders.`);
  await pool.end();
}
