// One clear "do this next" line, synthesized from the score, the help
// mode, and the tracker. Sits at the top of the results page so the
// density below has an entry point.

function daysUntil(iso) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}
function daysSince(iso) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default function NextStep({ readinessScore, helpMode, matches, tracked }) {
  const topMatch = matches?.[0];
  const active = tracked || [];

  // 1. deadline pressure wins
  const soonDeadline = active
    .filter((t) => t.deadline && daysUntil(t.deadline) >= 0 && daysUntil(t.deadline) <= 14 && !['submitted', 'in_review', 'approved', 'funded', 'declined'].includes(t.status))
    .sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline))[0];

  // 2. something submitted a while ago with no update
  const staleSubmitted = active
    .filter((t) => ['submitted', 'in_review'].includes(t.status) && daysSince(t.updatedAt) >= 10)
    .sort((a, b) => daysSince(b.updatedAt) - daysSince(a.updatedAt))[0];

  let headline;
  let body;

  if (helpMode?.mode === 'rebuilder') {
    headline = "Don't apply yet: strengthen the file first";
    body = 'Work the plan in "How to raise your score" below. When you\'ve done the top item or two, come back and re-run your readiness.';
  } else if (soonDeadline) {
    const d = daysUntil(soonDeadline.deadline);
    headline = `${soonDeadline.lenderName}'s deadline is in ${d} day${d === 1 ? '' : 's'}`;
    body = `Finish that application pack and submit. Everything else can wait a few days.`;
  } else if (staleSubmitted) {
    headline = `Check in with ${staleSubmitted.lenderName}`;
    body = `You marked it ${staleSubmitted.status.replace('_', ' ')} ${daysSince(staleSubmitted.updatedAt)} days ago. A short, friendly email asking about timing is completely normal.`;
  } else if (active.length === 0) {
    if (topMatch) {
      headline = `Practice a review with ${topMatch.name}`;
      body = `It's your strongest match at ${topMatch.match_score}%. Open "Prepare for a specific lender" below, sit down with its reviewer, then build the application pack. Track it as you go.`;
    } else {
      headline = 'Work on your readiness';
      body = 'No programs matched your current profile. The plan below shows what would change that.';
    }
  } else {
    const preparing = active.filter((t) => ['considering', 'preparing'].includes(t.status));
    if (preparing.length > 0) {
      headline = `Finish and submit your ${preparing[0].lenderName} application`;
      body = `You're preparing ${preparing.length} application${preparing.length === 1 ? '' : 's'}. Gather the last documents it needs (check "Prepare for a specific lender"), then submit and mark it done here.`;
    } else {
      headline = "You've got applications in motion";
      body = 'Keep the tracker updated as you hear back. If a decision comes, come back: approved or not, there\'s a next move.';
    }
  }

  return (
    <div className="nextstep-card">
      <div className="nextstep-label">Your next step</div>
      <div className="nextstep-headline">{headline}</div>
      <p className="nextstep-body">{body}</p>
    </div>
  );
}
