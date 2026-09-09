// Document kinds the vault understands, and how to tell which ones a
// lender's verified checklist is asking for (keyword match on the
// free-text `need` items in lender-application-profiles.js).

export const DOCUMENT_KINDS = {
  bank_statement: 'Bank statements',
  tax_return: 'Tax returns',
  id: 'Government ID / ITIN',
  business_plan: 'Business plan',
  financial_statement: 'Financial statements (P&L, balance sheet)',
  projections: 'Financial projections',
  voided_check: 'Voided check',
  registration: 'Business registration / licenses / EIN',
  other: 'Other',
};

const KIND_PATTERNS = [
  ['bank_statement', /bank statement/i],
  ['tax_return', /tax return/i],
  ['id', /\b(government[- ]issued )?id\b|photo id|driver'?s license|itin|passport/i],
  ['business_plan', /business plan/i],
  ['financial_statement', /financial statement|profit ?& ?loss|p&l|balance sheet|year-to-date/i],
  ['projections', /projection|cash[- ]flow projection/i],
  ['voided_check', /voided check/i],
  ['registration', /registration|articles of incorporation|business licen|\bein\b|permits?\b|incorporation doc/i],
];

// Given a verified lender profile, return the set of document kinds its
// checklist implies. Empty for unverified lenders (no reliable checklist).
export function kindsForProfile(profile) {
  if (!profile?.verified || !Array.isArray(profile.need)) return [];
  const kinds = new Set();
  for (const item of profile.need) {
    const text = typeof item === 'string' ? item : item?.item || '';
    for (const [kind, re] of KIND_PATTERNS) {
      if (re.test(text)) kinds.add(kind);
    }
  }
  return [...kinds];
}

// Given the kinds a lender needs and the kinds the owner has uploaded,
// return { needed, have, missing }.
export function coverageFor(profile, uploadedKinds) {
  const needed = kindsForProfile(profile);
  const haveSet = new Set(uploadedKinds);
  return {
    needed,
    have: needed.filter((k) => haveSet.has(k)),
    missing: needed.filter((k) => !haveSet.has(k)),
  };
}
