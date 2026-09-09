// A 12-month cash-flow projection scaffold. Every number is an estimate
// derived from what the application already states (annual revenue, the
// revenue pattern, the requested amount) — the owner is expected to
// replace each one with their real figures. It exists because the verified
// CDFI and grant application profiles all ask for monthly projections, and
// a blank spreadsheet is where owners get stuck.
//
// Deterministic and pure. Never invents a figure it presents as fact — the
// UI labels the whole thing as a starting point.

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Rough monthly payment for the requested amount: 5-year term, ~11% APR.
function estimateLoanPayment(principal) {
  const p = Number(principal) || 0;
  if (p <= 0) return 0;
  const r = 0.11 / 12;
  const n = 60;
  return Math.round((p * r) / (1 - Math.pow(1 + r, -n)));
}

// A multiplier per month index (0-11) for the stated revenue pattern.
function patternCurve(pattern, monthIndex) {
  switch (pattern) {
    case 'seasonal':
      // peak mid-year, trough in winter — a gentle cosine
      return 1 + 0.35 * Math.cos(((monthIndex - 6) / 12) * 2 * Math.PI * -1);
    case 'growing':
      return 1 + 0.02 * monthIndex;
    case 'declining':
      return 1 - 0.015 * monthIndex;
    default:
      return 1;
  }
}

export function seedProjection(application) {
  const annualRevenue = Number(application.annual_revenue) || 0;
  const baseMonthly = annualRevenue / 12;
  const existingDebt = Number(application.existing_monthly_debt_payment) || 0;
  const newLoanPayment = estimateLoanPayment(application.requested_amount);
  const pattern = application.cash_flow_pattern || 'steady';

  // normalize the pattern curve so the year still sums to ~annualRevenue
  const rawCurve = MONTH_NAMES.map((_, i) => patternCurve(pattern, i));
  const curveSum = rawCurve.reduce((a, b) => a + b, 0);
  const norm = curveSum > 0 ? (12 / curveSum) : 1;

  let cash = Math.round(baseMonthly); // assume ~1 month of revenue on hand to start
  const startingCash = cash;

  const months = MONTH_NAMES.map((label, i) => {
    const revenue = Math.round(baseMonthly * rawCurve[i] * norm);
    // placeholder expense assumption: 72% of revenue in direct costs +
    // existing debt. Clearly an estimate for the owner to correct.
    const expenses = Math.round(revenue * 0.72) + existingDebt;
    // loan funds assumed to land at the end of month 1
    const loanPayment = i >= 1 ? newLoanPayment : 0;
    const net = revenue - expenses - loanPayment;
    cash += net;
    return { label, revenue, expenses, loanPayment, net, endingCash: cash };
  });

  return {
    startingCash,
    estimatedLoanPayment: newLoanPayment,
    months,
    seededAt: new Date().toISOString(),
    edited: false,
  };
}

// Recompute the derived columns (net, endingCash) after an owner edits the
// input columns. Trusts revenue/expenses/loanPayment; never lets a bad
// number crash the math.
export function recalcProjection(startingCash, months) {
  let cash = Number(startingCash) || 0;
  return (Array.isArray(months) ? months : []).slice(0, 12).map((m, i) => {
    const revenue = Math.round(Number(m?.revenue) || 0);
    const expenses = Math.round(Number(m?.expenses) || 0);
    const loanPayment = Math.round(Number(m?.loanPayment) || 0);
    const net = revenue - expenses - loanPayment;
    cash += net;
    return { label: m?.label || MONTH_NAMES[i] || `M${i + 1}`, revenue, expenses, loanPayment, net, endingCash: cash };
  });
}
