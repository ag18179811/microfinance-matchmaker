const resources = [
  {
    name: "SBA Microloan Intermediary",
    type: "Microloan",
    states: ["ALL"],
    maxAmount: 50000,
    minMonths: 0,
    goals: ["startup", "equipment", "working-capital"],
    profiles: ["first-time", "minority", "woman", "low-income", "veteran"],
    creditFlex: "medium",
    requiresCitizenOwners: true,
    description: "Community-based intermediaries that can pair smaller loans with technical assistance.",
    tags: ["Up to $50k", "Coaching common", "Federal rules"],
    action: "Confirm current SBA microloan eligibility with the intermediary before applying.",
  },
  {
    name: "Local CDFI Small Business Loan",
    type: "Microloan",
    states: ["NY", "CA", "IL", "TX", "FL", "GA", "PA", "WA", "OTHER"],
    maxAmount: 35000,
    minMonths: 0,
    goals: ["equipment", "working-capital", "startup"],
    profiles: ["first-time", "minority", "immigrant", "low-income", "woman"],
    creditFlex: "high",
    requiresCitizenOwners: false,
    description: "Mission-driven financing for entrepreneurs who may not qualify for traditional bank credit.",
    tags: ["Flexible underwriting", "Local lender", "Credit building"],
    action: "Ask about required counseling, collateral, and expected application timeline.",
  },
  {
    name: "City Small Business Services Grant",
    type: "Grant",
    states: ["NY", "CA", "IL", "TX", "FL", "GA", "PA", "WA"],
    maxAmount: 15000,
    minMonths: 0,
    goals: ["startup", "equipment", "working-capital"],
    profiles: ["minority", "immigrant", "low-income", "woman", "first-time"],
    creditFlex: "high",
    requiresCitizenOwners: false,
    description: "City-backed grant or recovery programs that often prioritize neighborhood businesses.",
    tags: ["No repayment", "Local eligibility", "Competitive"],
    action: "Check deadlines, required receipts, and whether funds are reimbursed after purchase.",
  },
  {
    name: "Women-Owned Business Center",
    type: "Coaching",
    states: ["ALL"],
    maxAmount: 10000,
    minMonths: 0,
    goals: ["coaching", "startup", "working-capital"],
    profiles: ["woman", "first-time", "immigrant", "minority"],
    creditFlex: "high",
    requiresCitizenOwners: false,
    description: "Business planning, application help, and lender introductions for women entrepreneurs.",
    tags: ["Training", "Advising", "Lender prep"],
    action: "Book an advising session before submitting grant or loan paperwork.",
  },
  {
    name: "Minority Business Development Program",
    type: "Coaching",
    states: ["ALL"],
    maxAmount: 25000,
    minMonths: 0,
    goals: ["coaching", "startup", "equipment", "working-capital"],
    profiles: ["minority", "immigrant", "first-time"],
    creditFlex: "high",
    requiresCitizenOwners: false,
    description: "Advising and procurement support for founders from underserved communities.",
    tags: ["Advising", "Contracts", "Growth support"],
    action: "Prepare questions about lender readiness, certification, and procurement options.",
  },
  {
    name: "Kiva Community Crowdfunded Loan",
    type: "Crowdfunded loan",
    states: ["ALL"],
    maxAmount: 15000,
    minMonths: 0,
    goals: ["startup", "equipment", "working-capital"],
    profiles: ["first-time", "immigrant", "minority", "woman", "low-income"],
    creditFlex: "high",
    requiresCitizenOwners: false,
    description: "Character-based microloans that can work well for very early businesses.",
    tags: ["0% interest", "Story-driven", "Early stage"],
    action: "Draft a clear public story and identify early supporters before launching.",
  },
  {
    name: "Veteran Business Outreach Center",
    type: "Coaching",
    states: ["ALL"],
    maxAmount: 25000,
    minMonths: 0,
    goals: ["coaching", "startup", "equipment", "working-capital"],
    profiles: ["veteran", "first-time"],
    creditFlex: "high",
    requiresCitizenOwners: false,
    description: "Training, mentoring, and resource navigation for veterans and military spouses.",
    tags: ["Veteran support", "Business plan", "Mentorship"],
    action: "Ask which partner lenders or workshops fit your stage.",
  },
  {
    name: "Main Street Equipment Mini-Grant",
    type: "Grant",
    states: ["NY", "IL", "PA", "GA"],
    maxAmount: 8000,
    minMonths: 6,
    goals: ["equipment"],
    profiles: ["low-income", "minority", "immigrant", "woman"],
    creditFlex: "high",
    requiresCitizenOwners: false,
    description: "Small grants for storefront, equipment, or operating upgrades in commercial corridors.",
    tags: ["Equipment", "Neighborhood", "Receipt needed"],
    action: "Collect vendor quotes and photos showing how the equipment improves operations.",
  },
  {
    name: "Chamber Microbusiness Accelerator",
    type: "Coaching",
    states: ["NY", "CA", "IL", "TX", "FL", "GA", "PA", "WA", "OTHER"],
    maxAmount: 5000,
    minMonths: 0,
    goals: ["coaching", "startup"],
    profiles: ["first-time", "immigrant", "minority", "woman"],
    creditFlex: "high",
    requiresCitizenOwners: false,
    description: "Local mentoring, workshops, and warm introductions to public and nonprofit funding programs.",
    tags: ["Warm referrals", "Workshops", "Local network"],
    action: "Bring your top funding goal and a one-page business snapshot.",
  },
  {
    name: "Responsible Working Capital Line",
    type: "Microloan",
    states: ["ALL"],
    maxAmount: 25000,
    minMonths: 12,
    goals: ["working-capital"],
    profiles: ["minority", "woman", "veteran", "low-income"],
    creditFlex: "medium",
    requiresCitizenOwners: false,
    description: "A smaller revolving line can help smooth inventory, payroll, or seasonal cash gaps.",
    tags: ["Cash flow", "12+ months", "Compare APR"],
    action: "Compare APR, fees, repayment frequency, and prepayment terms before signing.",
  },
];

const baseDocuments = [
  "Government ID for each principal owner",
  "Business registration, DBA filing, or formation document",
  "EIN or tax identification details",
  "Recent business bank statements",
  "Basic profit and loss summary",
  "Use-of-funds budget",
  "Short business story and owner bio",
];

const extraDocuments = {
  startup: ["Lean business plan", "Startup cost estimate", "Projected first-year revenue assumptions"],
  equipment: ["Equipment quote or invoice", "Expected revenue or efficiency impact", "Photos or notes showing the current need"],
  "working-capital": ["Cash-flow forecast", "List of current business debts", "Inventory, payroll, or rent schedule"],
  coaching: ["Top three coaching questions", "Current business challenge summary", "One-page business snapshot"],
};

const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const form = document.querySelector("#match-form");
const amountInput = document.querySelector("#amount");
const amountOutput = document.querySelector("#amountOutput");
const matchList = document.querySelector("#matchList");
const documentList = document.querySelector("#documentList");
const nextSteps = document.querySelector("#nextSteps");
const readinessScore = document.querySelector("#readinessScore");
const readinessSummary = document.querySelector("#readinessSummary");
const meterProgress = document.querySelector("#meterProgress");
const matchCount = document.querySelector("#matchCount");
const docCount = document.querySelector("#docCount");
const timelineText = document.querySelector("#timelineText");
const eligibilityWarnings = document.querySelector("#eligibilityWarnings");

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return replacements[character];
  });
}

function goalLabel(goal) {
  return goal.replace("-", " ");
}

function getFormData() {
  const formData = new FormData(form);
  return {
    businessName: formData.get("businessName") || "Your business",
    zipCode: formData.get("zipCode") || "your ZIP",
    state: formData.get("state"),
    revenue: formData.get("revenue"),
    timeInBusiness: Number(formData.get("timeInBusiness")),
    creditProfile: formData.get("creditProfile"),
    ownerStatus: formData.get("ownerStatus"),
    amount: Number(formData.get("amount")),
    goal: formData.get("goal"),
    profiles: formData.getAll("profile"),
  };
}

function revenueWeight(revenue) {
  const weights = {
    pre: 7,
    under50: 14,
    "50to250": 17,
    "250to1m": 12,
    over1m: 4,
  };
  return weights[revenue] || 8;
}

function creditWeight(resource, creditProfile) {
  if (resource.creditFlex === "high") return creditProfile === "thin" ? 10 : 7;
  if (resource.creditFlex === "medium") return creditProfile === "strong" ? 7 : creditProfile === "fair" ? 5 : 2;
  return creditProfile === "strong" ? 8 : -3;
}

function scoreResource(resource, answers) {
  let score = 34;
  const reasons = [];
  const cautions = [];

  if (resource.states.includes("ALL") || resource.states.includes(answers.state)) {
    score += 18;
    reasons.push(resource.states.includes("ALL") ? "available nationally" : "matches your selected state");
  } else {
    score -= 14;
    cautions.push("may not serve your selected state");
  }

  if (answers.amount <= resource.maxAmount) {
    score += 16;
    reasons.push(`fits a ${formatter.format(answers.amount)} funding need`);
  } else {
    score -= Math.min(20, Math.round((answers.amount - resource.maxAmount) / 1800));
    cautions.push(`typical cap is around ${formatter.format(resource.maxAmount)}`);
  }

  if (resource.goals.includes(answers.goal)) {
    score += 14;
    reasons.push(`supports ${goalLabel(answers.goal)}`);
  } else {
    score -= 8;
  }

  const profileMatches = answers.profiles.filter((profile) => resource.profiles.includes(profile));
  score += Math.min(18, profileMatches.length * 6);
  if (profileMatches.length) {
    reasons.push(`prioritizes ${profileMatches.slice(0, 2).join(" and ")} founders`);
  }

  if (answers.timeInBusiness >= resource.minMonths) {
    score += 6;
  } else {
    score -= 9;
    cautions.push(`may prefer ${resource.minMonths}+ months in business`);
  }

  if (resource.requiresCitizenOwners && answers.ownerStatus !== "citizen") {
    score -= 28;
    cautions.push("federal ownership eligibility may need review");
  }

  score += revenueWeight(answers.revenue);
  score += creditWeight(resource, answers.creditProfile);

  if (answers.goal === "coaching" && resource.type === "Coaching") score += 12;
  if (answers.revenue === "pre" && resource.type === "Grant") score += 4;
  if (answers.amount > 20000 && resource.type === "Microloan") score += 7;

  return {
    ...resource,
    score: Math.max(0, Math.min(99, score)),
    reason: reasons.slice(0, 3).join("; "),
    cautions,
  };
}

function readinessFromAnswers(answers, matches) {
  let score = 45;
  if (answers.businessName !== "Your business") score += 7;
  if (/^\d{5}$/.test(answers.zipCode)) score += 8;
  if (answers.revenue !== "pre") score += 10;
  if (answers.timeInBusiness >= 6) score += 6;
  if (answers.creditProfile !== "unknown") score += 5;
  if (answers.ownerStatus === "citizen") score += 4;
  score += Math.min(10, answers.profiles.length * 2);
  score += answers.amount <= 15000 ? 8 : answers.amount <= 35000 ? 5 : 2;
  if (matches[0]?.score > 80) score += 6;
  return Math.max(32, Math.min(96, score));
}

function buildDocuments(answers) {
  const docs = [...baseDocuments, ...(extraDocuments[answers.goal] || [])];
  if (answers.profiles.includes("immigrant") || answers.ownerStatus !== "citizen") docs.push("Accepted lender identification and ownership eligibility details");
  if (answers.profiles.includes("veteran")) docs.push("Veteran status documentation if requested");
  if (answers.amount > 25000) docs.push("12-month cash-flow projection");
  if (answers.timeInBusiness >= 6) docs.push("Recent sales, invoice, or point-of-sale records");
  return [...new Set(docs)];
}

function buildWarnings(answers, matches) {
  const warnings = [];
  if (answers.ownerStatus !== "citizen") {
    warnings.push("Some federal programs may require all owners to meet current citizenship or nationality rules. Confirm before applying.");
  }
  if (answers.amount > 35000) {
    warnings.push("Larger microloans usually need stronger cash-flow documentation and may take longer to prepare.");
  }
  if (answers.revenue === "pre") {
    warnings.push("Pre-revenue founders often benefit from coaching or grant prep before pursuing debt.");
  }
  if (matches[0]?.cautions.length) {
    warnings.push(`Top-match caution: ${matches[0].cautions[0]}.`);
  }
  return warnings.length ? warnings : ["No major eligibility flags based on this intake. Still verify deadlines, geography, and owner requirements."];
}

function renderMatches(matches) {
  matchList.innerHTML = matches
    .slice(0, 6)
    .map((match) => {
      const cautionText = match.cautions.length ? `<div class="risk-note">${escapeHtml(match.cautions[0])}</div>` : "";
      return `
        <article class="match-card">
          <header>
            <div>
              <h3>${escapeHtml(match.name)}</h3>
              <span class="program-type">${escapeHtml(match.type)}</span>
            </div>
            <span class="score-badge">${match.score}%</span>
          </header>
          <p>${escapeHtml(match.description)}</p>
          <div class="tag-row">${match.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
          <div class="match-reason">${escapeHtml(match.reason || "Good general fit based on your current profile.")}</div>
          ${cautionText}
          <footer>${escapeHtml(match.action)}</footer>
        </article>
      `;
    })
    .join("");
}

function renderPacket(answers, docs) {
  const safeBusinessName = escapeHtml(answers.businessName);
  documentList.innerHTML = docs.map((doc) => `<li>${escapeHtml(doc)}</li>`).join("");
  const steps = [
    "Confirm eligibility for the top three matches before starting applications.",
    `Gather the packet documents and save them in one folder named for ${safeBusinessName}.`,
    "Book one free advising session before submitting a loan or grant application.",
    "Prepare a one-paragraph explanation of how the funds will increase sales, stability, or capacity.",
  ];
  nextSteps.innerHTML = steps.map((step) => `<li>${step}</li>`).join("");
}

function renderWarnings(warnings) {
  eligibilityWarnings.innerHTML = warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("");
}

function renderReadiness(score, matches, docs, answers) {
  readinessScore.textContent = score;
  matchCount.textContent = matches.slice(0, 6).length;
  docCount.textContent = docs.length;
  timelineText.textContent = score >= 80 ? "1-2 wks" : score >= 65 ? "2-4 wks" : "4+ wks";
  readinessSummary.textContent =
    score >= 80
      ? "Strong fit for immediate applications and coaching-backed programs."
      : score >= 65
        ? "Promising fit with a few documents to gather before applying."
        : "Start with coaching and readiness help before pursuing larger funding.";

  const circumference = 301.6;
  meterProgress.style.strokeDashoffset = String(circumference - (circumference * score) / 100);
  meterProgress.style.stroke = answers.amount > 30000 ? "var(--teal)" : "var(--green)";
}

function updateApp(event) {
  event?.preventDefault();
  amountOutput.textContent = formatter.format(Number(amountInput.value));
  const answers = getFormData();
  const matches = resources
    .map((resource) => scoreResource(resource, answers))
    .sort((first, second) => second.score - first.score);
  const docs = buildDocuments(answers);
  const readiness = readinessFromAnswers(answers, matches);
  const warnings = buildWarnings(answers, matches);

  renderMatches(matches);
  renderPacket(answers, docs);
  renderWarnings(warnings);
  renderReadiness(readiness, matches, docs, answers);
}

function downloadPacket() {
  const answers = getFormData();
  const matches = resources
    .map((resource) => scoreResource(resource, answers))
    .sort((first, second) => second.score - first.score)
    .slice(0, 5);
  const docs = buildDocuments(answers);
  const warnings = buildWarnings(answers, matches);
  const lines = [
    "Microfinance Matchmaker Readiness Packet",
    "",
    `Business: ${answers.businessName}`,
    `Location: ${answers.zipCode}, ${answers.state}`,
    `Funding need: ${formatter.format(answers.amount)}`,
    `Primary goal: ${goalLabel(answers.goal)}`,
    `Revenue stage: ${answers.revenue}`,
    `Time in business: ${answers.timeInBusiness} months or selected equivalent`,
    "",
    "Top matches:",
    ...matches.map((match, index) => `${index + 1}. ${match.name} (${match.type}) - ${match.score}% fit. ${match.action}`),
    "",
    "Eligibility cautions:",
    ...warnings.map((warning) => `- ${warning}`),
    "",
    "Documents to gather:",
    ...docs.map((doc) => `- ${doc}`),
    "",
    "Suggested next steps:",
    "- Verify program terms, deadlines, geography, and ownership rules.",
    "- Gather all documents in one folder.",
    "- Contact an advisor before submitting applications.",
    "",
    "Important: This packet is planning guidance, not an approval or financial advice.",
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "microfinance-readiness-packet.txt";
  link.click();
  URL.revokeObjectURL(url);
}

form.addEventListener("submit", updateApp);
form.addEventListener("input", updateApp);
document.querySelector("#resetButton").addEventListener("click", () => {
  form.reset();
  amountInput.value = 12000;
  updateApp();
});
document.querySelector("#downloadPacket").addEventListener("click", downloadPacket);

updateApp();
