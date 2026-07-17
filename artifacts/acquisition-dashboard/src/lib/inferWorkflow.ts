import type { Business, CheckItem } from "./storage";

export type ReadinessScores = {
  document: number;
  financing: number;
  diligence: number;
  close: number;
};

export type WorkflowInference = {
  dealSummary: string;
  financingPath: string;
  workflowTrack: string;
  buyerActions: string[];
  sellerRequests: string[];
  missingItems: string[];
  riskFlags: string[];
  nextStep: string;
  readiness: ReadinessScores;
};

function pct(n: number, d: number) {
  if (d === 0) return 0;
  return Math.round((n / d) * 100);
}

export function inferWorkflow(b: Business, entitySetupItems?: CheckItem[]): WorkflowInference {
  const entitySetupDone   = (entitySetupItems ?? []).filter((i) => i.checked).length;
  const entitySetupTotal  = (entitySetupItems ?? []).length || 6;
  const entitySetupComplete = entitySetupDone === entitySetupTotal;
  const docs = b.docsReceived ?? {
    financials: false, taxReturns: false, pnls: false,
    bankStatements: false, lease: false, payroll: false,
    debtSchedule: false, equipmentList: false, licensesPermits: false,
  };

  const docsReceivedCount = Object.values(docs).filter(Boolean).length;
  const totalDocs = 9;

  // ── Financing path ──────────────────────────────────────────────────────
  const ft = b.financingTypes ?? [];
  let financingPath = "Undecided";
  const financingParts: string[] = [];
  if (b.sbaRequired || ft.includes("sba")) financingParts.push("SBA 7(a) loan");
  if (b.sellerFinancingExpected || ft.includes("seller-note")) financingParts.push("Seller note");
  if (ft.includes("cash")) financingParts.push("Cash");
  if (ft.includes("conventional")) financingParts.push("Conventional loan");
  if (ft.includes("investor-equity")) financingParts.push("Investor equity");
  if (financingParts.length > 0) financingPath = financingParts.join(" + ");

  // ── Workflow track ───────────────────────────────────────────────────────
  let workflowTrack = "Standard Acquisition";
  if (b.sbaRequired || ft.includes("sba")) workflowTrack = "SBA Acquisition Track";
  else if (ft.includes("seller-note") && ft.length === 1) workflowTrack = "Seller-Finance Track";
  else if (ft.includes("cash") && ft.length === 1) workflowTrack = "Cash Close Track";
  if (b.acquisitionType === "asset") workflowTrack += " · Asset Purchase";
  else if (b.acquisitionType === "stock") workflowTrack += " · Stock Purchase";
  if (b.rollupIntent) workflowTrack += " · Rollup Pipeline";

  // ── Deal summary ─────────────────────────────────────────────────────────
  const stageLabels: Record<string, string> = {
    lead: "Lead stage",
    diligence: "active due diligence",
    loi: "LOI signed",
    "close-ready": "close-ready",
    closed: "closed",
    operating: "operating",
    archived: "archived",
  };
  const stageText = stageLabels[b.stage] ?? b.stage;

  let dealSummary = `${b.name} is currently in ${stageText}`;
  if (financingPath !== "Undecided") {
    dealSummary += `, likely financed via ${financingPath}`;
  }
  if (b.acquisitionType && b.acquisitionType !== "undecided") {
    dealSummary += `, structured as an ${b.acquisitionType === "asset" ? "asset purchase" : "stock purchase"}`;
  }
  if (b.seller) dealSummary += `. Seller: ${b.seller}`;
  if (b.targetCloseDate) {
    const d = new Date(b.targetCloseDate + "T00:00:00");
    dealSummary += `. Target close: ${d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
  }
  if (docsReceivedCount > 0 && docsReceivedCount < totalDocs) {
    dealSummary += `. ${docsReceivedCount} of ${totalDocs} document categories received — upload and review still pending.`;
  } else if (docsReceivedCount === 0) {
    dealSummary += `. No seller documents have been received yet.`;
  } else {
    dealSummary += `. Initial document set appears complete.`;
  }
  if (b.currentStepNote) dealSummary += ` Current note: "${b.currentStepNote}".`;

  // ── Missing items ────────────────────────────────────────────────────────
  const missingItems: string[] = [];
  if (!docs.taxReturns)     missingItems.push("Tax returns (3 years)");
  if (!docs.pnls)           missingItems.push("P&L statements");
  if (!docs.bankStatements) missingItems.push("Bank statements (12 months)");
  if (!docs.lease)          missingItems.push("Lease agreement");
  if (!docs.debtSchedule)   missingItems.push("Debt schedule");
  if (!docs.payroll)        missingItems.push("Payroll reports");
  if (!docs.equipmentList)  missingItems.push("Equipment list");
  if (!docs.licensesPermits)missingItems.push("Licenses & permits");
  if (!b.seller)            missingItems.push("Seller name not entered");
  if (!b.targetCloseDate)   missingItems.push("Target close date not set");
  if (!b.acquisitionType || b.acquisitionType === "undecided") missingItems.push("Acquisition type not confirmed");
  if (b.acquisitionType === "asset" && !entitySetupComplete) missingItems.push(`New Entity Setup incomplete (${entitySetupDone}/${entitySetupTotal} tasks done)`);
  if ((b.sbaRequired || ft.includes("sba")) && !b.lenderContact) missingItems.push("SBA lender contact not recorded");
  if (b.landlordApprovalRequired && !b.landlordContact) missingItems.push("Landlord contact not recorded");

  // ── Buyer actions ────────────────────────────────────────────────────────
  const buyerActions: string[] = [];

  if (docsReceivedCount > 0 && !docs.taxReturns) {
    buyerActions.push("Upload received financials before advancing SBA prep");
  }
  if ((b.sbaRequired || ft.includes("sba")) && docsReceivedCount < 5) {
    buyerActions.push("Open SBA readiness checklist — lender package not yet ready");
  }
  if ((b.sbaRequired || ft.includes("sba")) && docsReceivedCount >= 5) {
    buyerActions.push("Begin SBA lender package compilation");
  }
  if (b.stage === "lead") {
    buyerActions.push("Confirm deal interest and advance to active due diligence");
    if (!docs.financials) buyerActions.push("Request preliminary financials from seller");
  }
  if (b.stage === "diligence" || b.stage === "loi") {
    if (!docs.taxReturns) buyerActions.push("Request 3-year tax returns");
    if (!docs.bankStatements) buyerActions.push("Request 12-month bank statements");
    if (!docs.debtSchedule) buyerActions.push("Request debt schedule from seller");
  }
  if (b.leaseAssignmentExpected || b.landlordApprovalRequired) {
    buyerActions.push("Initiate landlord contact for lease assignment");
  }
  if (b.acquisitionType === "undecided" || !b.acquisitionType) {
    buyerActions.push("Confirm asset purchase vs. stock purchase with attorney");
  }
  if (b.acquisitionType === "asset" && !entitySetupComplete) {
    buyerActions.push(`Complete New Entity Setup — ${entitySetupDone}/${entitySetupTotal} tasks done (blocking closing milestones)`);
  } else if (b.acquisitionType === "asset") {
    buyerActions.push("New Entity Setup complete ✓ — closing milestones are unlocked");
  }
  if (buyerActions.length === 0) {
    buyerActions.push("Review current deal status and confirm next stage requirements");
    buyerActions.push("Schedule check-in with key advisors");
  }

  // ── Seller requests ──────────────────────────────────────────────────────
  const sellerRequests: string[] = [];
  if (!docs.pnls)           sellerRequests.push("Provide P&L statements (3 years)");
  if (!docs.taxReturns)     sellerRequests.push("Provide signed tax returns (3 years)");
  if (!docs.bankStatements) sellerRequests.push("Provide bank statements (12 months)");
  if (!docs.lease)          sellerRequests.push("Provide current lease agreement");
  if (!docs.debtSchedule)   sellerRequests.push("Provide complete debt schedule");
  if (!docs.payroll)        sellerRequests.push("Provide payroll reports / employee roster");
  if (!docs.equipmentList)  sellerRequests.push("Provide equipment list and condition report");
  if (!docs.licensesPermits)sellerRequests.push("Confirm license / permit status");
  if (b.stage === "lead") {
    sellerRequests.splice(3);
    sellerRequests.push("(Seller portal held in minimal mode — deal still in lead stage)");
  }

  // ── Risk flags ───────────────────────────────────────────────────────────
  const riskFlags: string[] = [];
  if ((b.sbaRequired || ft.includes("sba")) && docsReceivedCount < 4) {
    riskFlags.push("SBA timeline at risk — document package is incomplete");
  }
  if (b.landlordApprovalRequired && !docs.lease) {
    riskFlags.push("Landlord approval required but lease not yet received");
  }
  if (b.targetCloseDate) {
    const closeDate = new Date(b.targetCloseDate + "T00:00:00");
    const today = new Date();
    const daysLeft = Math.ceil((closeDate.getTime() - today.getTime()) / 86_400_000);
    if (daysLeft < 60 && docsReceivedCount < 6) {
      riskFlags.push(`Close target is ${daysLeft} days away — document pace is behind`);
    }
  }
  if (b.acquisitionType === "stock") {
    riskFlags.push("Stock purchase — conduct corporate liability, tax, and entity continuity review");
  }
  if (b.acquisitionType === "asset" && !entitySetupComplete) {
    riskFlags.push(`Asset purchase — New Entity Setup is ${entitySetupDone}/${entitySetupTotal} complete. Legal docs, licenses, insurance, and closing readiness are BLOCKED.`);
  }
  if (!b.dayOneOperatorKnown && (b.stage === "close-ready" || b.stage === "loi")) {
    riskFlags.push("Day 1 operator not confirmed — operational risk at close");
  }
  if (!b.exclusivityInPlace && (b.stage === "lead" || b.stage === "diligence")) {
    riskFlags.push("No exclusivity in place — seller may be talking to other buyers");
  }

  // ── Next step ────────────────────────────────────────────────────────────
  let nextStep = "Review deal status and confirm acquisition path";
  if (b.stage === "lead" && docsReceivedCount === 0) {
    nextStep = "Send initial NDA and request preliminary financials from seller";
  } else if (b.stage === "lead" && docsReceivedCount > 0) {
    nextStep = "Upload received financials and advance deal to Due Diligence";
  } else if (b.stage === "diligence" && (b.sbaRequired || ft.includes("sba"))) {
    nextStep = "Complete document collection and begin SBA lender package";
  } else if (b.stage === "diligence") {
    nextStep = "Complete due diligence document review and prepare for LOI";
  } else if (b.stage === "loi") {
    nextStep = "Finalize financing, complete diligence, and prepare closing documents";
  } else if (b.stage === "close-ready") {
    nextStep = "Coordinate closing logistics and confirm Day 1 operating plan";
  } else if (b.stage === "operating") {
    nextStep = "Activate Financial Management dashboard and begin post-close reporting";
  }

  // ── Readiness scores ─────────────────────────────────────────────────────
  const docScore = pct(docsReceivedCount, totalDocs);
  let finScore = 0;
  if (financingPath !== "Undecided") finScore += 20;
  if (b.sbaRequired && b.lenderContact) finScore += 25;
  if (b.sbaRequired && docsReceivedCount >= 5) finScore += 30;
  if (ft.includes("cash") && ft.length === 1) finScore = 70;
  if (b.sellerFinancingExpected) finScore += 15;
  finScore = Math.min(finScore, 100);

  let diligenceScore = 0;
  diligenceScore += pct(docsReceivedCount, totalDocs) * 0.7;
  if (b.acquisitionType && b.acquisitionType !== "undecided") diligenceScore += 15;
  if (b.stage !== "lead") diligenceScore += 10;
  diligenceScore = Math.min(Math.round(diligenceScore), 100);

  let closeScore = 0;
  if (diligenceScore > 60) closeScore += 20;
  if (finScore > 50) closeScore += 20;
  if (b.dayOneOperatorKnown) closeScore += 15;
  if (docs.lease) closeScore += 15;
  if (b.stage === "close-ready") closeScore += 30;
  else if (b.stage === "loi") closeScore += 15;
  // Block closing score progression for asset purchases with incomplete entity setup
  if (b.acquisitionType === "asset" && !entitySetupComplete) {
    closeScore = Math.min(closeScore, 30);
  }
  closeScore = Math.min(closeScore, 100);

  return {
    dealSummary,
    financingPath,
    workflowTrack,
    buyerActions: buyerActions.slice(0, 6),
    sellerRequests: sellerRequests.slice(0, 6),
    missingItems: missingItems.slice(0, 8),
    riskFlags: riskFlags.slice(0, 4),
    nextStep,
    readiness: {
      document: docScore,
      financing: finScore,
      diligence: diligenceScore,
      close: closeScore,
    },
  };
}
