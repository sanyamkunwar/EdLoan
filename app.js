export const COLLEGE_PRESETS = {
  iit: {
    label: "IIT B.Tech",
    loan: 1100000,
    salaryLow: 150000,
    salaryHigh: 250000,
    note: "Illustrative IIT B.Tech cost and starting salary range. Verify branch, campus, hostel, and placement data."
  },
  nit: {
    label: "NIT B.Tech",
    loan: 850000,
    salaryLow: 117000,
    salaryHigh: 190000,
    note: "Illustrative NIT B.Tech range. Use your actual fee circular and branch placement report before deciding."
  },
  bits: {
    label: "BITS Pilani B.E.",
    loan: 3000000,
    salaryLow: 166000,
    salaryHigh: 240000,
    note: "Illustrative self-funded private institute range. Include hostel, mess, annual fee increases, and travel."
  },
  msusa: {
    label: "MS abroad",
    loan: 4500000,
    salaryLow: 650000,
    salaryHigh: 1000000,
    note: "Illustrative abroad range. Stress-test currency movement, visa timing, location, and no-offer months."
  }
};

export const LENDER_PRESETS = {
  govt: {
    label: "Public sector bank",
    rate: 9.25,
    fee: 0,
    note: "Usually lower priced, documentation-heavy, and commonly routed through government loan portals."
  },
  private: {
    label: "Private bank",
    rate: 10.75,
    fee: 10000,
    note: "Often quicker but rate, margin, and collateral policy vary by profile and institute."
  },
  nbfc: {
    label: "NBFC",
    rate: 12.75,
    fee: 25000,
    note: "Useful for speed or edge cases; compare APR, processing fee, insurance, and foreclosure terms."
  },
  collateralFree: {
    label: "Collateral-free",
    rate: 10.5,
    fee: 0,
    note: "Eligibility depends on scheme, bank policy, institute, co-borrower profile, and loan amount."
  }
};

const MAX_SCENARIOS = 3;
const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

let scenarios = [
  createScenario("Scenario A", {
    loan: 800000,
    rate: 9.5,
    moratorium: 48,
    tenure: 84,
    salaryLow: 30000,
    salaryHigh: 45000,
    prepay: 0,
    fee: 0,
    serviceInterest: false
  })
];

let lastResults = [];

export function createScenario(name, overrides = {}) {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    name,
    loan: 800000,
    rate: 10,
    moratorium: 48,
    tenure: 84,
    salaryLow: 30000,
    salaryHigh: 45000,
    prepay: 0,
    fee: 0,
    serviceInterest: false,
    presetNote: "",
    ...overrides
  };
}

export function formatINR(value) {
  return INR_FORMATTER.format(Math.round(Number.isFinite(value) ? value : 0)).replace("₹", "Rs ");
}

export function amortize(principal, annualRate, months, extraPayment = 0) {
  const safePrincipal = Math.max(0, principal);
  const safeMonths = Math.max(1, Math.round(months));
  const monthlyRate = Math.max(0, annualRate) / 12 / 100;
  const emi = monthlyRate === 0
    ? safePrincipal / safeMonths
    : safePrincipal * monthlyRate * (1 + monthlyRate) ** safeMonths / ((1 + monthlyRate) ** safeMonths - 1);

  if (extraPayment <= 0) {
    const totalRepaid = emi * safeMonths;
    return {
      emi,
      months: safeMonths,
      totalInterest: totalRepaid - safePrincipal,
      totalRepaid
    };
  }

  let balance = safePrincipal;
  let monthsPaid = 0;
  let totalInterest = 0;
  const payment = emi + extraPayment;

  while (balance > 0.5 && monthsPaid < 1200) {
    const interest = balance * monthlyRate;
    const principalPaid = Math.min(balance, Math.max(0, payment - interest));
    if (principalPaid <= 0) break;
    balance -= principalPaid;
    totalInterest += interest;
    monthsPaid += 1;
  }

  return {
    emi,
    months: monthsPaid,
    totalInterest,
    totalRepaid: safePrincipal + totalInterest
  };
}

export function calculateScenario(scenario, assumptions) {
  const delay = assumptions.worstCase ? assumptions.delayMonths : 0;
  const salaryCut = assumptions.worstCase ? assumptions.salaryCut / 100 : 0;
  const moratorium = Math.max(0, scenario.moratorium + delay);
  const monthlyRate = Math.max(0, scenario.rate) / 12 / 100;
  const moratoriumInterest = scenario.loan * monthlyRate * moratorium;
  const capitalisedPrincipal = scenario.serviceInterest
    ? scenario.loan
    : scenario.loan * (1 + monthlyRate) ** moratorium;
  const upfrontCost = Math.max(0, scenario.fee) + (scenario.serviceInterest ? moratoriumInterest : 0);
  const base = amortize(capitalisedPrincipal, scenario.rate, scenario.tenure, 0);
  const withPrepay = scenario.prepay > 0
    ? amortize(capitalisedPrincipal, scenario.rate, scenario.tenure, scenario.prepay)
    : null;
  const repayment = withPrepay || base;
  const salaryLow = Math.max(0, scenario.salaryLow * (1 - salaryCut));
  const salaryHigh = Math.max(0, scenario.salaryHigh * (1 - salaryCut));
  const salaryMid = (salaryLow + salaryHigh) / 2;
  const emiToSalary = salaryMid > 0 ? repayment.emi / salaryMid * 100 : 0;
  const deductibleInterest = Math.max(0, repayment.totalInterest + (scenario.serviceInterest ? moratoriumInterest : 0));
  const taxSaved = deductibleInterest * assumptions.taxSlab / 100;
  const effectiveCost = repayment.totalRepaid + upfrontCost - taxSaved;
  const margin = estimateMarginRequirement(scenario.loan);
  const collateral = estimateCollateralNeed(scenario.loan);
  const verdict = getVerdict(emiToSalary, salaryMid);

  return {
    ...scenario,
    moratorium,
    salaryLow,
    salaryHigh,
    salaryMid,
    capitalisedPrincipal,
    moratoriumInterest,
    upfrontCost,
    base,
    withPrepay,
    repayment,
    emiToSalary,
    taxSaved,
    effectiveCost,
    margin,
    collateral,
    verdict,
    worstCase: assumptions.worstCase
  };
}

export function estimateMarginRequirement(loanAmount) {
  if (loanAmount <= 400000) return "Often nil up to Rs 4L";
  if (loanAmount <= 750000) return "Check 5-15% margin by study location";
  return "Expect margin and collateral discussion";
}

export function estimateCollateralNeed(loanAmount) {
  if (loanAmount <= 750000) return "Usually collateral-free if eligible";
  return "Bank policy may require collateral";
}

function getVerdict(emiToSalary, salaryMid) {
  if (salaryMid <= 0) return { label: "Add salary", color: "var(--muted)" };
  if (emiToSalary < 30) return { label: "Comfortable", color: "var(--safe)" };
  if (emiToSalary < 45) return { label: "Tight Stretch", color: "var(--stretch)" };
  return { label: "High Risk", color: "var(--risk)" };
}

function readAssumptions() {
  return {
    worstCase: document.querySelector("#worst-case").checked,
    delayMonths: readNumber("#delay-months"),
    salaryCut: readNumber("#salary-cut"),
    taxSlab: readNumber("#tax-slab")
  };
}

function readNumber(selector) {
  const node = document.querySelector(selector);
  return Number.parseFloat(node?.value || "0") || 0;
}

function readScenarioFromCard(card, current) {
  return {
    ...current,
    name: card.querySelector(".scenario-name").value.trim() || current.name,
    loan: readCardNumber(card, ".loan"),
    rate: readCardNumber(card, ".rate"),
    moratorium: readCardNumber(card, ".moratorium"),
    tenure: Math.max(1, readCardNumber(card, ".tenure")),
    salaryLow: readCardNumber(card, ".salary-low"),
    salaryHigh: readCardNumber(card, ".salary-high"),
    prepay: readCardNumber(card, ".prepay"),
    fee: readCardNumber(card, ".fee"),
    serviceInterest: card.querySelector(".service-interest").checked
  };
}

function readCardNumber(card, selector) {
  return Number.parseFloat(card.querySelector(selector).value || "0") || 0;
}

function syncStateFromDom() {
  const cards = [...document.querySelectorAll("#scenario-list > .scenario-card")];
  scenarios = cards.map((card) => {
    const id = card.dataset.id;
    const current = scenarios.find((scenario) => scenario.id === id) || createScenario(card.querySelector(".scenario-name")?.value || "Scenario");
    return readScenarioFromCard(card, current);
  });
}

function renderScenarioCards() {
  const list = document.querySelector("#scenario-list");
  const template = document.querySelector("#scenario-template");
  list.innerHTML = "";

  scenarios.forEach((scenario) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".scenario-card");
    card.dataset.id = scenario.id;
    card.querySelector(".scenario-name").value = scenario.name;
    card.querySelector(".loan").value = scenario.loan;
    card.querySelector(".rate").value = scenario.rate;
    card.querySelector(".moratorium").value = scenario.moratorium;
    card.querySelector(".tenure").value = scenario.tenure;
    card.querySelector(".salary-low").value = scenario.salaryLow;
    card.querySelector(".salary-high").value = scenario.salaryHigh;
    card.querySelector(".prepay").value = scenario.prepay;
    card.querySelector(".fee").value = scenario.fee;
    card.querySelector(".service-interest").checked = scenario.serviceInterest;
    card.querySelector(".preset-note").textContent = scenario.presetNote;
    card.querySelector(".remove-scenario").hidden = scenarios.length === 1;

    fillPresetSelect(card.querySelector(".college-preset"), COLLEGE_PRESETS);
    fillPresetSelect(card.querySelector(".lender-preset"), LENDER_PRESETS);
    list.appendChild(fragment);
  });

  document.querySelector("[data-action='add-scenario']").disabled = scenarios.length >= MAX_SCENARIOS;
}

function fillPresetSelect(select, presets) {
  Object.entries(presets).forEach(([key, preset]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = preset.label;
    select.appendChild(option);
  });
}

function addScenario() {
  syncStateFromDom();
  if (scenarios.length >= MAX_SCENARIOS) return;
  const label = `Scenario ${String.fromCharCode(65 + scenarios.length)}`;
  scenarios.push(createScenario(label));
  renderScenarioCards();
}

function removeScenario(card) {
  scenarios = scenarios.filter((scenario) => scenario.id !== card.dataset.id);
  renderScenarioCards();
  calculateAndRender();
}

function applyPreset(card, type, key) {
  const preset = type === "college" ? COLLEGE_PRESETS[key] : LENDER_PRESETS[key];
  if (!preset) return;

  if (type === "college") {
    card.querySelector(".loan").value = preset.loan;
    card.querySelector(".salary-low").value = preset.salaryLow;
    card.querySelector(".salary-high").value = preset.salaryHigh;
  } else {
    card.querySelector(".rate").value = preset.rate;
    card.querySelector(".fee").value = preset.fee;
  }

  card.querySelector(".preset-note").textContent = preset.note;
}

function calculateAndRender() {
  try {
    syncStateFromDom();
    const assumptions = readAssumptions();
    lastResults = scenarios.map((scenario) => calculateScenario(scenario, assumptions));
    renderResults(lastResults);
    renderInsights(lastResults);
    window.__passbookDebug = { scenarioCount: scenarios.length, resultCount: lastResults.length };
  } catch (error) {
    console.error(error);
    showToast("Could not calculate. Check the highlighted inputs.");
  }
}

function renderResults(results) {
  const bestIndex = results.reduce((best, result, index) => {
    if (result.emiToSalary <= 0) return best;
    if (best === -1) return index;
    return result.emiToSalary < results[best].emiToSalary ? index : best;
  }, -1);

  document.querySelector("#results").innerHTML = results.map((result, index) => `
    <article class="result-card ${index === bestIndex ? "best" : ""}" style="--status-color: ${result.verdict.color}">
      <h3>${escapeHtml(result.name)}${index === bestIndex ? " - Lowest strain" : ""}</h3>
      <span class="badge">${result.verdict.label}${result.worstCase ? " / worst case" : ""}</span>
      <div class="metric-list">
        <div class="metric"><span>Monthly EMI</span><strong>${formatINR(result.repayment.emi)}</strong></div>
        <div class="metric"><span>EMI / salary</span><strong>${result.emiToSalary.toFixed(0)}%</strong></div>
        <div class="metric"><span>Principal after moratorium</span><strong>${formatINR(result.capitalisedPrincipal)}</strong></div>
        <div class="metric"><span>Total interest</span><strong>${formatINR(result.repayment.totalInterest)}</strong></div>
        <div class="metric"><span>80E estimate</span><strong>-${formatINR(result.taxSaved)}</strong></div>
        <div class="metric"><span>Effective cost</span><strong>${formatINR(result.effectiveCost)}</strong></div>
        <div class="metric"><span>Payoff</span><strong>${result.repayment.months} mo</strong></div>
      </div>
    </article>
  `).join("");
}

function renderInsights(results) {
  document.querySelector("#insights").innerHTML = results.map((result) => {
    const savings = result.withPrepay
      ? Math.max(0, result.base.totalInterest - result.withPrepay.totalInterest)
      : 0;
    const message = buildInsightMessage(result, savings);
    return `
      <article class="insight">
        <h3>${escapeHtml(result.name)} Bank Questions</h3>
        <p>${message} Ask the lender to confirm: ${result.margin}; ${result.collateral}; processing fee, insurance bundling, foreclosure charges, and whether simple interest can be serviced during moratorium.</p>
      </article>
    `;
  }).join("");
}

function buildInsightMessage(result, savings) {
  if (result.verdict.label === "High Risk") {
    return "This repayment load is above the safer planning band. Consider lower debt, scholarship, co-op income, longer tenure, or a cheaper lender before committing.";
  }
  if (result.verdict.label === "Tight Stretch") {
    return "This can work, but the buffer is thin. Keep a contingency fund for delayed joining, relocation, and exam or visa costs.";
  }
  if (savings > 0) {
    return `Prepaying shortens the schedule by ${result.tenure - result.repayment.months} months and saves about ${formatINR(savings)} interest.`;
  }
  return "The EMI ratio is within the planning band, assuming the salary range is realistic and starts on time.";
}

function buildShareText() {
  if (lastResults.length === 0) calculateAndRender();
  const lines = ["Education Loan Passbook Summary", ""];
  lastResults.forEach((result) => {
    lines.push(result.name);
    lines.push(`Verdict: ${result.verdict.label}`);
    lines.push(`EMI: ${formatINR(result.repayment.emi)} (${result.emiToSalary.toFixed(0)}% of expected salary)`);
    lines.push(`Effective cost: ${formatINR(result.effectiveCost)}`);
    lines.push("");
  });
  lines.push("Verify final rate, margin, collateral, moratorium, fees, and 80E eligibility before signing.");
  return lines.join("\n");
}

async function shareSummary() {
  const text = buildShareText();
  if (navigator.share) {
    await navigator.share({ title: "Education Loan Passbook", text }).catch(() => undefined);
    return;
  }
  await navigator.clipboard.writeText(text);
  showToast("Summary copied");
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "add-scenario") addScenario();
    if (action === "calculate") calculateAndRender();
    if (action === "print") window.print();
    if (action === "share") shareSummary();
    const removeButton = event.target.closest(".remove-scenario");
    if (removeButton) removeScenario(removeButton.closest(".scenario-card"));
  });

  document.querySelector("#scenario-list").addEventListener("change", (event) => {
    const card = event.target.closest(".scenario-card");
    if (!card) return;
    if (event.target.matches(".college-preset")) applyPreset(card, "college", event.target.value);
    if (event.target.matches(".lender-preset")) applyPreset(card, "lender", event.target.value);
  });

  document.querySelector("#worst-case").addEventListener("change", (event) => {
    document.querySelector("[data-worst-case-fields]").hidden = !event.target.checked;
  });
}

if (typeof document !== "undefined") {
  bindEvents();
  renderScenarioCards();
  calculateAndRender();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  }
}
