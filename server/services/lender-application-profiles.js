// How each verified lender ACTUALLY intakes an application — the honest data
// layer under the business-case and underwriter-simulation features. Same
// discipline as db/seed-lenders.js: every entry was checked against the
// organization's own pages via live web search (dates noted), and anything
// not clearly stated there is left out rather than guessed.
//
// The eight programs fall into five genuinely different application models,
// and the help each one needs is shaped by its model, not a shared
// checklist:
//
//   cdfi_term_loan   — an online application + document upload; a real
//                      underwriter reads cash flow, debt, and use-of-funds
//                      (Accion, LiftFund, Craft3, Justine PETERSEN)
//   crowdfunding      — no credit check; a story, a photo, and a network you
//                      must personally activate (Kiva)
//   sba_intermediary — you don't apply to "the SBA"; you find your local
//                      approved intermediary, who often requires training
//                      (SBA Microloan Program)
//   referral_network — applying routes your request to partner lenders
//                      (Community Reinvestment Fund)
//   group_lending    — join a peer group, attend weekly meetings; almost no
//                      paperwork but a real time commitment (Grameen America)
//
// For lenders discovered by live web search we don't have verified intake
// details, so deriveProfile() returns a model guess from the lender type and
// marks verified:false — the UI must say so and never show a fabricated
// checklist.

export const APPLICATION_MODELS = {
  cdfi_term_loan: {
    label: 'Online application, then a real underwriter',
    blurb:
      'You apply online and upload (or connect) documents. A loan officer then reviews your cash flow, the debt already on your books, and whether the money has a clear path to being repaid. Mission-driven — they want to say yes — but the numbers have to make sense.',
  },
  crowdfunding: {
    label: 'Character-based crowdfunding',
    blurb:
      'No credit check and no collateral. What matters is a specific, genuine story, a real photo, and whether you can personally get 5–40 people to lend during a private fundraising window before it opens to the public.',
  },
  sba_intermediary: {
    label: 'Routed through a local nonprofit intermediary',
    blurb:
      "There's no single application. You find the SBA-approved intermediary that serves your area and apply to them — each sets its own rules, and many require you to complete a business training or mentorship before funding.",
  },
  referral_network: {
    label: 'One application, routed to partner lenders',
    blurb:
      'This is a network, not a single lender. Applying screens you for basic fit and then routes your request to lenders and support organizations in the network.',
  },
  group_lending: {
    label: 'Peer group + weekly meetings',
    blurb:
      'Loans are made to a small group of entrepreneurs who support each other. Almost no paperwork, but you commit to onboarding training and a short weekly meeting for the life of the loan.',
  },
};

// slug         — stable id
// matchNames   — lowercased names this profile applies to (matched against lender.name)
// model        — key of APPLICATION_MODELS
// applyUrl     — where the real application actually starts
// timeline     — plain-language, from the org's own pages
// howItWorks   — 1–2 sentences on the actual mechanics
// need         — [{ item, when: 'always'|'larger_loans'|'startups'|'established', note? }]
// steps        — ordered, concrete
// gotchas      — the things that quietly sink applications
// underwriterFocus — what the person reviewing THIS file weighs most (drives the sim persona)
// verifiedOn / sources — provenance, same as seed-lenders.js
const PROFILES = [
  {
    slug: 'accion-opportunity-fund',
    matchNames: ['accion opportunity fund', 'accion'],
    model: 'cdfi_term_loan',
    applyUrl: 'https://aofund.org/business-loans/small-business-term-loan/',
    timeline: 'Decision in about 1–3 business days; funds 1–4 business days after approval.',
    howItWorks:
      'One online application. You securely connect your business bank account (or upload statements) so they can review recent transaction history themselves.',
    need: [
      { item: 'Up to 3 months of business bank statements', when: 'always', note: 'connected directly or uploaded as PDFs' },
      { item: 'Government-issued ID or ITIN', when: 'always' },
      { item: 'Business registration documents and any licenses', when: 'always' },
      { item: 'A voided check from your primary business bank account', when: 'always' },
      { item: 'EIN, if your business has one', when: 'always' },
      { item: 'Articles of Incorporation, commercial lease, franchise or key contracts', when: 'larger_loans' },
      { item: '2–3 years of personal and business tax returns', when: 'larger_loans' },
      { item: 'Business financial statements and sales / cash-flow projections', when: 'larger_loans' },
      { item: 'A personal financial statement for any owner with 20%+ stake', when: 'larger_loans' },
    ],
    steps: [
      'Check you clear the basics: 12+ months in business and roughly $50,000+ in annual revenue.',
      'Gather ID, a voided check, and your last 3 months of bank statements.',
      'Start the online application and connect your business bank account.',
      'Respond quickly if a loan officer asks for anything else — review is only 1–3 days.',
    ],
    gotchas: [
      'Not available in Montana, North Dakota, South Dakota, Tennessee, or Vermont.',
      'They read your actual bank transactions — large unexplained transfers or lots of negative-balance days will come up.',
      'An owner must hold at least 20% of the business.',
    ],
    underwriterFocus:
      'Cash flow first, pulled straight from your bank transaction history. Then how much debt you already carry each month, and whether the use of funds has an obvious payback. Credit score matters less than the account activity.',
    verifiedOn: '2026-09',
    sources: [
      'https://aofund.org/business-loans/small-business-term-loan/',
      'https://aofund.org/resource/how-do-i-get-business-loan/',
    ],
  },
  {
    slug: 'liftfund',
    matchNames: ['liftfund'],
    model: 'cdfi_term_loan',
    applyUrl: 'https://www.liftfund.com/funding/get-funded',
    timeline: 'Application takes ~20 minutes; funding typically in 3–5 business days.',
    howItWorks:
      'A short online application. LiftFund publishes an "Am I Ready?" page with a downloadable document checklist — pull it before you start.',
    need: [
      { item: 'EIN (or SSN if you have no EIN)', when: 'always' },
      { item: 'SSN or ITIN for you and any co-borrowers', when: 'always' },
      { item: 'State-issued driver’s license or ID number', when: 'always' },
      { item: '3 most recent months of personal and/or business bank statements', when: 'always', note: 'which one depends on the loan size' },
      { item: 'A monthly budget: household income, business revenue, business expenses', when: 'always' },
      { item: 'Recent tax returns', when: 'larger_loans' },
      { item: 'Collateral — usually a lien on business assets and whatever the loan buys', when: 'always' },
    ],
    steps: [
      'Open LiftFund’s "Am I Ready?" page and download their document checklist.',
      'Make sure you’ve had no credit issues in the last 6 months (there’s no minimum score).',
      'Put together your monthly budget numbers and last 3 months of statements.',
      'Complete the ~20-minute online application.',
    ],
    gotchas: [
      'No minimum credit score, but recent credit trouble (last 6 months) is close to disqualifying.',
      'Collateral is required on every loan, even small ones.',
      'Startups are only eligible in certain industries — check before you invest time.',
    ],
    underwriterFocus:
      'Your credit conduct over the last 6 months (clean, not high), then cash flow against the monthly budget you provide, then what collateral secures the loan.',
    verifiedOn: '2026-09',
    sources: ['https://www.liftfund.com/funding/am-i-ready', 'https://www.liftfund.com/funding/get-funded'],
  },
  {
    slug: 'kiva-us',
    matchNames: ['kiva u.s.', 'kiva us', 'kiva'],
    model: 'crowdfunding',
    applyUrl: 'https://www.kiva.org/borrow',
    timeline: 'Up to ~2 weeks to review the application, then a 15-day private fundraising period, then ~30 days of public fundraising.',
    howItWorks:
      'You apply online in under 30 minutes. There is no credit check. If approved you must first rally 5–40 lenders from your own network during a 15-day private period; only then does the loan open to the public.',
    need: [
      { item: 'A PayPal account (how you receive and repay the loan)', when: 'always' },
      { item: 'Proof the business is real: incorporation docs, government registration, permits, or a business tax return', when: 'always' },
      { item: 'Your real financial numbers — every field filled in, or entered as $0', when: 'always' },
      { item: 'A clear photo of you with your business', when: 'always' },
      { item: 'A personal story, about 2 paragraphs', when: 'always' },
      { item: 'A business description, about 2 paragraphs', when: 'always' },
      { item: 'A specific breakdown of what the loan pays for', when: 'always' },
      { item: 'A list of people you can ask to lend during the private period', when: 'always', note: '5–40 depending on loan size' },
    ],
    steps: [
      'Set up a PayPal account if you don’t have one.',
      'Write your personal story and business description, and take a real photo with your business.',
      'List the friends, family, customers, and suppliers you’ll invite to lend in the private period.',
      'Submit the application and reply fast to any follow-up from Kiva’s team.',
      'When approved, personally invite your list until you hit the private-lender goal.',
    ],
    gotchas: [
      'The private fundraising period is the real test — if your network doesn’t lend, the loan never goes public.',
      'Not available in Nevada or North Dakota.',
      'Can’t be used to refinance debt or buy stock/equity; several industries are excluded (tobacco, weapons, gambling, crypto, MLM).',
      'A generic or vague story gets far less funding than a specific one.',
    ],
    underwriterFocus:
      'Is the story real, specific, and engaging? Is there a genuine photo? And — most of all — do you actually have a network of people who will lend? This is "social underwriting": your standing in your community stands in for a credit score.',
    verifiedOn: '2026-09',
    sources: [
      'https://www.kiva.org/borrow',
      'https://www.kiva.org/lp/faq-kiva-us-application-faqs',
      'https://www.kiva.org/businesscenter/what-is-social-underwriting',
    ],
  },
  {
    slug: 'sba-microloan',
    matchNames: ['sba microloan program', 'sba microloan'],
    model: 'sba_intermediary',
    applyUrl: 'https://www.sba.gov/funding-programs/loans/microloans',
    timeline: 'Varies by intermediary — often 30–90 days, longer if a training requirement is involved.',
    howItWorks:
      'The SBA funds nonprofit intermediary lenders who actually make the loans. You apply to the intermediary serving your area, and they make every credit decision locally.',
    need: [
      { item: 'Whatever your local intermediary asks for — usually a business plan', when: 'always' },
      { item: 'Collateral and a personal guarantee (most intermediaries require both)', when: 'always' },
      { item: 'Completion of a business training or mentorship program', when: 'always', note: 'many intermediaries require this before funding' },
    ],
    steps: [
      'Use the SBA intermediary locator to find the microlender serving your area.',
      'Contact them directly and ask for their specific application and document list.',
      'Ask up front whether they require a training workshop, and how long it takes.',
      'Prepare a business plan — most intermediaries expect one.',
    ],
    gotchas: [
      'There is no national application — going to sba.gov alone gets you nowhere without finding your intermediary.',
      'A required training program can add weeks; skipping it usually means no funding.',
      'Average microloan is around $13,000, not the $50,000 maximum.',
    ],
    underwriterFocus:
      'The intermediary is a mission-driven nonprofit that also provides coaching. They want to see you engage with their technical assistance, and they usually expect a written business plan and some collateral.',
    verifiedOn: '2026-09',
    sources: ['https://www.sba.gov/funding-programs/loans/microloans', 'https://www.nerdwallet.com/business/loans/learn/sba-microloans'],
  },
  {
    slug: 'grameen-america',
    matchNames: ['grameen america'],
    model: 'group_lending',
    applyUrl: 'https://www.grameenamerica.org/request-a-loan',
    timeline: 'Onboarding takes 2–4 weeks, then a 30-minute meeting once a week for the life of the loan.',
    howItWorks:
      'A four-step process: form a group of five women entrepreneurs who trust each other, complete a week of onboarding training, pass a home/business verification visit, then attend weekly group meetings.',
    need: [
      { item: 'A group of five women entrepreneurs who know and trust each other', when: 'always' },
      { item: 'Government-issued photo ID', when: 'always' },
      { item: 'Proof of address issued within the last 60 days (utility, medical, paystub, or phone bill)', when: 'always' },
    ],
    steps: [
      'Confirm Grameen operates in your city (they serve select cities within NY, NE, IN, NC, TX, AZ — not statewide).',
      'Form or join a group of five women entrepreneurs.',
      'Attend the week-long onboarding training and bring physical copies of your documents.',
      'Host the verification visit, then start weekly meetings.',
    ],
    gotchas: [
      'Women-owned businesses only.',
      'You cannot get a loan without a group — and the whole group shares the commitment.',
      'It is a real ongoing time commitment: a meeting every single week.',
      'First loan is small ($500–$2,500); larger loans come after a repayment track record.',
    ],
    underwriterFocus:
      'There is no traditional underwriting — no credit check, no collateral. What matters is forming a real group and showing up consistently.',
    verifiedOn: '2026-09',
    sources: ['https://www.grameenamerica.org/program', 'https://www.grameenamerica.org/request-a-loan'],
  },
  {
    slug: 'crf-usa',
    matchNames: ['community reinvestment fund, usa (crf)', 'community reinvestment fund', 'crf'],
    model: 'referral_network',
    applyUrl: 'https://smallbusiness.crfusa.com/apply/',
    timeline: 'Initial screening is quick; timeline after that depends on which network lender your request is routed to.',
    howItWorks:
      'CRF is a network of 160+ partner lenders and support organizations, not a direct lender. One application screens you and routes your request to lenders in the network. Applying does not affect your credit.',
    need: [
      { item: 'Basic business and owner information for the initial screen', when: 'always' },
      { item: 'Whatever the matched network lender then asks for', when: 'always', note: 'varies by lender' },
    ],
    steps: [
      'Complete CRF’s online screening application.',
      'Get matched to one or more lenders or support organizations in their network.',
      'Work directly with that lender on their full application and documents.',
    ],
    gotchas: [
      'CRF itself does not fund you — the match quality depends on their network for your area and industry.',
      'You may still go through a full application with the lender you’re routed to.',
    ],
    underwriterFocus:
      'The first pass is a light fit-and-completeness screen. The real underwriting happens at whichever network lender you’re routed to.',
    verifiedOn: '2026-09',
    sources: ['https://smallbusiness.crfusa.com/apply/'],
  },
  {
    slug: 'craft3',
    matchNames: ['craft3'],
    model: 'cdfi_term_loan',
    applyUrl: 'https://www.craft3.org/get-started',
    timeline: 'A team member reaches out within 3 business days to schedule a call; loans up to $250,000 can close in ~45 days.',
    howItWorks:
      'You fill out a short online intake form. If it looks like a fit, a Craft3 lender calls you to talk through your business plan, use of funds, and collateral before inviting a full application.',
    need: [
      { item: 'A business plan', when: 'startups', note: 'required for startup financing' },
      { item: 'Monthly financial projections', when: 'always', note: 'helpful but not required — Craft3 will still consider you without them' },
      { item: '2 years of financial statements (P&L and balance sheet) plus year-to-date', when: 'established' },
    ],
    steps: [
      'Confirm you’re in Oregon or Washington.',
      'Fill out the online intake form.',
      'Take the fit call — be ready to talk through your plan, use of funds, and any collateral.',
      'If invited, complete the full application with your financials.',
    ],
    gotchas: [
      'Oregon and Washington only.',
      'It starts with a conversation, not a form — how you talk through the business on that call matters.',
      'Loan sizes range enormously; a small working-capital request is treated very differently from a large one.',
    ],
    underwriterFocus:
      'Relationship-based. The first call is a real screen — they’re listening for a coherent plan, a sensible use of funds, and how you think about repayment. Especially open to minority-, women-, and immigrant-owned businesses that banks turned down.',
    verifiedOn: '2026-09',
    sources: ['https://www.craft3.org/get-started', 'https://www.craft3.org/business-loans/business'],
  },
  {
    slug: 'justine-petersen',
    matchNames: ['justine petersen', 'justine petersen housing and reinvestment corporation'],
    model: 'cdfi_term_loan',
    applyUrl: 'https://justinepetersen.org/our-loan-process/',
    timeline: 'Includes one-on-one counseling before the loan; expect several weeks with coaching built in.',
    howItWorks:
      'An SBA microloan intermediary that builds credit counseling into the application itself. Staff work with you one-on-one on your credit, debt, business plan, and financials — and offer credit-building products if your score needs work.',
    need: [
      { item: 'Willingness to do one-on-one credit and business counseling', when: 'always' },
      { item: 'Business plan and financials (developed with their staff if needed)', when: 'always' },
      { item: 'Whatever their counselor identifies for your specific situation', when: 'always' },
    ],
    steps: [
      'Confirm you’re covered: all of Missouri, 73 Illinois counties, or 28 Kansas counties.',
      'Contact their office to start the loan process and get assigned a counselor.',
      'Work through credit, debt, and business-plan counseling with staff.',
      'Complete the application with their support.',
    ],
    gotchas: [
      'Coverage is county-level in Illinois and Kansas — confirm your county, not just your state.',
      'This is a slower, coaching-heavy process by design — good if your credit is thin or bruised, slower if you just want fast cash.',
      'The microloan arm tops out around $35,000.',
    ],
    underwriterFocus:
      'They expect to help you get ready rather than judge you on day one. They’ll work with poor or thin credit, but they want to see you engage with the counseling and credit-building steps.',
    verifiedOn: '2026-09',
    sources: ['https://justinepetersen.org/our-loan-process/', 'https://justinepetersen.org/what-we-do/small-business/'],
  },
];

const PROFILE_BY_NAME = new Map();
for (const p of PROFILES) {
  for (const n of p.matchNames) PROFILE_BY_NAME.set(n, p);
}

function inferModelFromType(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('cdfi')) return 'cdfi_term_loan';
  if (t.includes('city') || t.includes('state') || t.includes('municipal')) return 'cdfi_term_loan';
  if (t.includes('nonprofit') || t.includes('non-profit')) return 'cdfi_term_loan';
  return 'cdfi_term_loan';
}

// Returns a profile for any lender object (static or discovered). Verified
// entries come from the table above; everything else gets a model guess and
// verified:false, and callers MUST surface that rather than present the
// generic guidance as fact.
export function deriveProfile(lender) {
  const name = (lender?.name || '').trim().toLowerCase();
  const exact = PROFILE_BY_NAME.get(name);
  if (exact) return { ...exact, verified: true };

  // loose contains-match for slight name variations
  for (const [key, profile] of PROFILE_BY_NAME) {
    if (name && (name.includes(key) || key.includes(name))) return { ...profile, verified: true };
  }

  const model = inferModelFromType(lender?.type);
  return {
    slug: `discovered-${lender?.id ?? 'unknown'}`,
    matchNames: [name],
    model,
    verified: false,
    applyUrl: lender?.source_url || null,
    timeline: null,
    howItWorks:
      'We found this program through a live web search, so we haven’t verified exactly how it takes applications. Confirm the process on its official page before relying on any of this.',
    need: [],
    steps: [
      'Open the program’s official page.',
      'Confirm you meet their stated eligibility (state, industry, time in business, revenue).',
      'Use their application form, or contact them directly to ask for one.',
    ],
    gotchas: lender?.eligibility_notes ? [lender.eligibility_notes] : [],
    underwriterFocus: APPLICATION_MODELS[model]?.blurb || null,
    sources: lender?.source_url ? [lender.source_url] : [],
  };
}

export function modelInfo(modelKey) {
  return APPLICATION_MODELS[modelKey] || null;
}
