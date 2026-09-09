// Real, individually verified LOAN programs — each entry was checked against
// the organization's own website before being added here (dates noted per
// entry). This replaced an earlier placeholder dataset of invented lender
// names that were never real; treat any pre-this-comment history as fiction.
//
// GRANTS are deliberately not here. A hand-kept grant list shown to every
// applicant is the "checklist" approach this product exists to avoid —
// grants are the most case-specific funding type (city, county, industry,
// use of funds, ownership background all change what a business qualifies
// for). They come only from the per-application live search in
// routes/match.js / services/openai-lender-search.js.
//
// This list is intentionally small rather than broad: real, checkable
// programs beat a long list of fabricated ones. Expanding it should keep
// that discipline — ideally from the CDFI Fund Awards Database
// (https://www.cdfifund.gov/awards/state-awards) — and never bulk-generate
// entries from a model's own "knowledge," which is exactly how the earlier
// fake dataset happened.

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
  {
    name: 'DreamSpring',
    type: 'CDFI',
    geography: 'AL,AZ,CA,CO,FL,GA,IL,IA,KS,LA,MI,MO,MS,NE,NV,NM,NY,NC,OH,OK,PA,SC,TN,TX,UT,WA,WY',
    min_loan: 1000,
    max_loan: 250000,
    industries: '',
    eligibility_notes:
      'Verified via dreamspring.org (checked Sep 2026). Nonprofit CDFI microlender serving 27 states. Open to both startups and existing businesses — you must be 18+, have an SSN or ITIN, and be located in a served state; there is no minimum time in business. Microloans and lines of credit up to $100,000, small business loans up to $250,000. For loans under $20,000, a credit score above 650 gets an expedited application.',
    source_url: 'https://www.dreamspring.org/welcome',
  },
  {
    name: 'Ascendus',
    type: 'CDFI',
    geography:
      'AL,AK,AZ,AR,CA,CO,CT,DE,FL,GA,HI,ID,IL,IN,IA,KS,KY,LA,ME,MD,MA,MI,MN,MS,MO,MT,NE,NV,NH,NJ,NM,NY,NC,ND,OH,OK,OR,PA,RI,SC,SD,TN,TX,UT,VA,WA,WV,WI,WY,DC',
    min_loan: 500,
    max_loan: 100000,
    industries: '',
    eligibility_notes:
      'Verified via ascendus.org (checked Sep 2026). Nonprofit CDFI microlender, nationwide except Vermont. Business term loan up to $100,000 needs 6+ months in business, consistent revenue for 6 months, a FICO of 575+, and no more than $3,000 in past-due debt. The Get Ready credit-building loan starts at $500 (rising to $5,000 with on-time repayment). Lines of credit up to $50,000.',
    source_url: 'https://www.ascendus.org/products/small-business/',
    min_months_in_business: 6,
    min_months_in_business_type: 'required',
  },
  {
    name: 'Pursuit',
    type: 'CDFI',
    geography: 'CT,DE,IL,NJ,NY,PA',
    min_loan: 10000,
    max_loan: 5000000,
    industries: '',
    eligibility_notes:
      'Verified via pursuitlending.com (checked Sep 2026). Nonprofit lender (formerly New York Business Development Corporation / Excelsior Growth Fund), 70+ years old, serving CT, DE, IL, NJ, NY, and PA. Runs many products — SBA 504 and 7(a), an SBA Microloan, FlexLoan and the Main Street Capital Loan Fund (up to $100,000 each), and lines of credit — so amounts and requirements vary by product; the online FlexLoan is built for faster approvals. Apply at pursuitlending.com/apply to be routed to the right one.',
    source_url: 'https://pursuitlending.com/apply/',
  },
];

// Grants used to live in this catalog too (Amber Grant, Comcast RISE), but
// a hand-kept grant list shown to every applicant is exactly the "checklist"
// approach this product avoids — grants are the most case-specific funding
// type. They now come only from the per-application live search in
// routes/match.js. These names are removed from the table on boot; their
// verified application profiles in lender-application-profiles.js stay and
// re-attach by name if the live search rediscovers them.
const RETIRED_LENDER_NAMES = ['Amber Grant for Women (WomensNet)', 'Comcast RISE Small Business Grant'];

// Insert any catalog entry that isn't already in the table, matched by
// name; remove any retired entry. Other existing rows are left untouched (a
// hand-verified note fix in the DB won't be clobbered). Safe to run on
// every boot; a full `node db/seed-lenders.js` drops first for a clean reseed.
export async function seedLenders(pool) {
  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query('DELETE FROM lenders WHERE name = ANY($1)', [RETIRED_LENDER_NAMES]);
    const { rows: existing } = await client.query('SELECT name FROM lenders');
    const have = new Set(existing.map((r) => r.name));
    await client.query('BEGIN');
    for (const row of lenders) {
      if (have.has(row.name)) continue;
      const full = { min_months_in_business: null, min_months_in_business_type: null, funding_type: 'loan', ...row };
      await client.query(
        `INSERT INTO lenders (name, type, funding_type, geography, min_loan, max_loan, industries, eligibility_notes, source_url, min_months_in_business, min_months_in_business_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          full.name,
          full.type,
          full.funding_type,
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
      inserted += 1;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return inserted;
}

// Allow running directly: `node db/seed-lenders.js` — force-reseeds the
// static lender catalog (drop + insert).
if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: pool } = await import('./connection.js');
  try {
    await pool.query('DELETE FROM lenders');
    const count = await seedLenders(pool);
    console.log(`Seeded ${count} lenders.`);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
    // connection.js starts pool watchers / migration work on import; a hard
    // exit avoids the "unsettled top-level await" hang after we're done.
    process.exit(process.exitCode || 0);
  }
}
