// Deterministic, rules-based matching + readiness scoring.
// No LLM calls in this file. Eligibility and scoring decisions must stay
// auditable and reproducible.

function parseGeography(geography) {
  return (geography || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

function parseIndustries(industries) {
  return (industries || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function geographyMatches(lender, application) {
  const served = parseGeography(lender.geography);
  if (served.includes('NATIONAL') || served.includes('NATIONWIDE')) return true;
  const state = (application.state || '').trim().toUpperCase();
  return state.length > 0 && served.includes(state);
}

function industryMatches(lender, application) {
  const served = parseIndustries(lender.industries);
  const industry = (application.industry || '').trim().toLowerCase();
  if (served.length === 0) return true;
  if (served.some((i) => i === 'all' || i === 'all industries')) return true;
  return industry.length > 0 && served.includes(industry);
}

function loanSizeFit(lender, application) {
  const requested = Number(application.requested_amount) || 0;
  const min = Number(lender.min_loan) || 0;
  const max = Number(lender.max_loan) || Infinity;

  if (requested >= min && requested <= max) {
    // Flag amounts sitting right at the edge of the window as worth a second look,
    // even though they technically clear the bar.
    const nearMin = min > 0 && requested <= min * 1.1;
    const nearMax = Number.isFinite(max) && requested >= max * 0.9;
    return { eligible: true, score: 100, edge: nearMin || nearMax };
  }

  // Too far outside the lender's range to be a realistic match.
  if (requested < min * 0.5 || requested > max * 2) return { eligible: false, score: 0, edge: false };

  // Just outside the range: partial credit, decaying with distance.
  const distance = requested < min ? (min - requested) / min : (requested - max) / max;
  const score = Math.max(0, Math.round(100 - distance * 150));
  return { eligible: true, score, edge: true };
}

// Many lenders state a minimum time-in-business either as a hard cutoff
// ("6+ months required") or a soft preference ("12+ months preferred"). This
// was previously buried in free-text notes and never actually enforced,
// which meant a 2-month-old business could be ranked as a strong match
// against a lender that would reject it outright. Required thresholds now
// disqualify; preferred thresholds stay eligible but score lower and surface
// as a caution, so the ranking reflects real underwriting friction either way.
function timeInBusinessGate(lender, application) {
  const required = Number(lender.min_months_in_business) || 0;
  if (required <= 0) return { eligible: true, score: 100, reason: null, caution: null };

  const actual = Number(application.time_in_business_months) || 0;
  const isHardRequirement = lender.min_months_in_business_type === 'required';
  const years = required % 12 === 0 ? `${required / 12}+ year${required === 12 ? '' : 's'}` : `${required}+ months`;

  if (actual >= required) {
    return {
      eligible: true,
      score: 100,
      reason: `Meets this lender's ${years} time-in-business ${isHardRequirement ? 'requirement' : 'preference'}`,
      caution: null,
    };
  }

  if (isHardRequirement) {
    return { eligible: false, score: 0, reason: null, caution: null };
  }

  const shortfall = required - actual;
  const score = Math.max(20, Math.round(100 - (shortfall / required) * 100));
  return {
    eligible: true,
    score,
    reason: null,
    caution: `Prefers ${years} in business — you're at ${actual} month${actual === 1 ? '' : 's'}, so approval may take extra documentation`,
  };
}

export function scoreLenderMatch(lender, application) {
  if (!geographyMatches(lender, application)) return null;
  if (!industryMatches(lender, application)) return null;

  const loanFit = loanSizeFit(lender, application);
  if (!loanFit.eligible) return null;

  const tenureGate = timeInBusinessGate(lender, application);
  if (!tenureGate.eligible) return null;

  const served = parseGeography(lender.geography);
  const isNational = served.includes('NATIONAL') || served.includes('NATIONWIDE');
  const geoScore = isNational ? 90 : 100;

  const industriesServed = parseIndustries(lender.industries);
  const isAllIndustries = industriesServed.some((i) => i === 'all' || i === 'all industries');
  const industryScore = isAllIndustries ? 70 : 100;

  const matchScore = Math.round(
    loanFit.score * 0.35 + industryScore * 0.2 + geoScore * 0.2 + tenureGate.score * 0.25
  );

  const min = Number(lender.min_loan) || 0;
  const max = Number(lender.max_loan);
  const requested = Number(application.requested_amount) || 0;

  const reasons = [];
  const cautions = [];

  if (loanFit.score === 100 && !loanFit.edge) {
    reasons.push(`Your $${requested.toLocaleString()} request comfortably fits this lender's $${min.toLocaleString()}–$${Number.isFinite(max) ? max.toLocaleString() : 'no max'} range`);
  } else if (loanFit.edge) {
    cautions.push(`Your request sits near the ${requested <= min * 1.1 ? 'minimum' : 'maximum'} of this lender's loan range — approval may hinge on additional documentation`);
  }

  reasons.push(isNational ? 'National program — lends in every state' : `Directly serves ${application.state || 'your state'}`);
  reasons.push(isAllIndustries ? 'Open to all industries' : `Actively lends to ${application.industry || 'your industry'} businesses`);

  if (tenureGate.reason) reasons.push(tenureGate.reason);
  if (tenureGate.caution) cautions.push(tenureGate.caution);

  return {
    matchScore,
    breakdown: {
      geography: geoScore,
      industry: industryScore,
      loanFit: loanFit.score,
      timeInBusiness: tenureGate.score,
    },
    reasons,
    cautions,
  };
}

export function matchLenders(application, lenders) {
  return lenders
    .map((lender) => {
      const result = scoreLenderMatch(lender, application);
      return result
        ? {
            lender,
            matchScore: result.matchScore,
            breakdown: result.breakdown,
            reasons: result.reasons,
            cautions: result.cautions,
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.matchScore - a.matchScore);
}

function timeInBusinessScore(months) {
  const m = Number(months) || 0;
  if (m < 6) return 20;
  if (m < 12) return 40;
  if (m < 24) return 60;
  if (m < 60) return 80;
  return 100;
}

function revenueStabilityScore(annualRevenue) {
  const r = Number(annualRevenue) || 0;
  if (r <= 0) return 10;
  if (r < 25000) return 40;
  if (r < 75000) return 60;
  if (r < 200000) return 80;
  return 100;
}

function requestToRevenueScore(requestedAmount, annualRevenue) {
  const requested = Number(requestedAmount) || 0;
  const revenue = Number(annualRevenue) || 0;
  if (revenue <= 0) return requested > 0 ? 15 : 50;

  const ratio = requested / revenue;
  if (ratio <= 0.1) return 100;
  if (ratio <= 0.25) return 85;
  if (ratio <= 0.5) return 65;
  if (ratio <= 1) return 40;
  return 15;
}

function completenessScore(application) {
  const fields = [
    'business_name',
    'industry',
    'city',
    'state',
    'time_in_business_months',
    'annual_revenue',
    'requested_amount',
    'purpose',
  ];
  const filled = fields.filter((field) => {
    const value = application[field];
    return value !== undefined && value !== null && String(value).trim() !== '';
  });
  return Math.round((filled.length / fields.length) * 100);
}

export function computeReadiness(application) {
  const subScores = {
    timeInBusiness: timeInBusinessScore(application.time_in_business_months),
    revenueStability: revenueStabilityScore(application.annual_revenue),
    requestToRevenueRatio: requestToRevenueScore(application.requested_amount, application.annual_revenue),
    completeness: completenessScore(application),
  };

  const readinessScore = Math.round(
    subScores.timeInBusiness * 0.25 +
      subScores.revenueStability * 0.25 +
      subScores.requestToRevenueRatio * 0.25 +
      subScores.completeness * 0.25
  );

  return { readinessScore, subScores };
}
