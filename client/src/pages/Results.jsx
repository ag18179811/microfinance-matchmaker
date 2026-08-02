export default function Results({ results, onStartOver }) {
  const { readinessScore, aiSummary, matches } = results;

  return (
    <div>
      <h2>Your funding readiness</h2>

      <div className="score-row">
        <div className="score-box">
          <div style={{ fontSize: '2rem' }}>{readinessScore}</div>
          <div>Readiness score</div>
        </div>
        <div className="score-box">
          <div style={{ fontSize: '2rem' }}>{matches.length}</div>
          <div>Matched lenders</div>
        </div>
      </div>

      <div className="summary-box">{aiSummary}</div>

      <h3>Matched lenders</h3>
      {matches.length === 0 && <p>No lenders matched your current profile.</p>}
      {matches.map((m) => (
        <div className="lender-card" key={m.id}>
          <h4>
            {m.name} — {m.match_score}% match
          </h4>
          <p><strong>Type:</strong> {m.type}</p>
          <p><strong>Geography served:</strong> {m.geography}</p>
          <p><strong>Loan range:</strong> ${m.min_loan?.toLocaleString()} – ${m.max_loan?.toLocaleString()}</p>
          <p><strong>Industries:</strong> {m.industries}</p>
          <p><strong>Eligibility notes:</strong> {m.eligibility_notes}</p>
        </div>
      ))}

      <button onClick={onStartOver}>Start a new application</button>
    </div>
  );
}
