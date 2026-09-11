// Where a real person beats this tool: a complex or unusual deal, a legal
// question, a business plan a bank will actually scrutinize, or just being
// stuck. Routes to the free advisors (SBDC, SCORE, the CDFI's own coaching,
// SBA local assistance) and offers the readiness report + funding story to
// bring along, so the owner doesn't walk in cold.

const RESOURCES = [
  {
    name: 'Small Business Development Center (SBDC)',
    what: 'Free, in-depth advising: financials, projections, the business plan a lender wants to see. Every state has centers.',
    url: 'https://americassbdc.org/find-your-sbdc/',
  },
  {
    name: 'SCORE mentor',
    what: 'Free 1-on-1 mentoring from experienced business owners. Good for strategy, a second opinion, and practicing the lender conversation.',
    url: 'https://www.score.org/find-mentor',
  },
  {
    name: "The lender's own coaching",
    what: 'Accion Opportunity Fund, LiftFund, Justine PETERSEN, and most SBA microloan intermediaries provide free help preparing your application. Ask when you contact them.',
    url: 'https://aofund.org/resources/',
  },
  {
    name: 'SBA local assistance',
    what: 'Find every SBA-affiliated advisor, Women’s Business Center, and Veterans Business Outreach Center near you.',
    url: 'https://www.sba.gov/local-assistance/find',
  },
];

export default function AdvisorBridge({ prominent }) {
  return (
    <div className={`advisor-card ${prominent ? 'advisor-card-prominent' : ''}`}>
      <h2 className="section-title" style={{ marginBottom: '0.35rem' }}>Talk to a real advisor</h2>
      <p className="bc-sub" style={{ marginBottom: '1.1rem' }}>
        This tool gets you a long way, but a person is better for a complex or unusual deal, a legal or tax
        question, a full business plan, or when you're just stuck. These are all free.
      </p>

      <ul className="advisor-list">
        {RESOURCES.map((r) => (
          <li key={r.name}>
            <a href={r.url} target="_blank" rel="noreferrer" className="advisor-name">
              {r.name} ↗
            </a>
            <p>{r.what}</p>
          </li>
        ))}
      </ul>

      <div className="advisor-foot">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
          Save your report to bring
        </button>
        <span>Your readiness score, breakdown, and funding story: one document to hand over.</span>
      </div>
    </div>
  );
}
