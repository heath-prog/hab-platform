// ─── Types ────────────────────────────────────────────────────────────────────

export type FindingFlag = "ok" | "warning" | "critical";

export type VerificationFinding = {
  label: string;
  value: string;
  flag: FindingFlag;
  detail?: string;
};

export type ConfidenceLevel = "High" | "Medium" | "Low";

export type VerificationReport = {
  id: string;
  // Business scoping
  businessId: string;
  portfolioId?: string;
  dealId?: string;
  // Document identity
  documentId: string;
  documentLabel: string;
  fileName: string;
  // Agent result
  agentName: string;
  analyzedAt: string;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  summary: string;
  findings: VerificationFinding[];
  redFlags: string[];
  recommendations: string[];
  advisorNotes: string;
  extractedData: Record<string, unknown>;
  // Drive / Sheets
  driveFileId?: string;
  driveFileName?: string;
  driveViewLink?: string;
  driveDownloadLink?: string;
  sheetsRowId?: string;
  sheetsUrl?: string;
  // Raw
  rawResponse?: string;
};

// ─── Business-scoped storage ─────────────────────────────────────────────────

const LEGACY_KEY = "trueblue_verification_reports_v1";

function reportsKey(businessId: string) {
  return `reports_${businessId}_v1`;
}

export function loadReports(businessId = "true-blue"): Record<string, VerificationReport> {
  try {
    const key = reportsKey(businessId);
    let raw = localStorage.getItem(key);
    if (!raw && businessId === "true-blue") raw = localStorage.getItem(LEGACY_KEY);
    return raw ? (JSON.parse(raw) as Record<string, VerificationReport>) : {};
  } catch {
    return {};
  }
}

export function saveReport(report: VerificationReport, businessId = "true-blue"): void {
  const all = loadReports(businessId);
  all[report.documentId] = report;
  localStorage.setItem(reportsKey(businessId), JSON.stringify(all));
}

export function getReport(documentId: string, businessId = "true-blue"): VerificationReport | null {
  return loadReports(businessId)[documentId] ?? null;
}

// ─── Confidence helpers ───────────────────────────────────────────────────────

export function confidenceColor(score: number): "green" | "yellow" | "red" {
  if (score >= 75) return "green";
  if (score >= 45) return "yellow";
  return "red";
}

export function confidenceLevel(score: number): ConfidenceLevel {
  if (score >= 75) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

// ─── Parse N8n response (full canonical schema) ───────────────────────────────

export function parseN8nResponse(
  raw: unknown,
  documentId: string,
  documentLabel: string,
  fileName: string,
  businessId = "true-blue"
): VerificationReport {
  const d = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;

  const score =
    typeof d.confidenceScore === "number" ? Math.max(0, Math.min(100, d.confidenceScore)) :
    typeof d.confidence_score === "number" ? Math.max(0, Math.min(100, d.confidence_score)) : 50;

  const findings: VerificationFinding[] = Array.isArray(d.findings) ? (d.findings as VerificationFinding[]) : [];
  const redFlags: string[]   = Array.isArray(d.redFlags)        ? (d.redFlags as string[]) :
                                Array.isArray(d.red_flags)       ? (d.red_flags as string[]) : [];
  const recommendations: string[] = Array.isArray(d.recommendations) ? (d.recommendations as string[]) : [];

  return {
    id:              `report-${Date.now()}`,
    businessId,
    portfolioId:     typeof d.portfolioId === "string" ? d.portfolioId : undefined,
    dealId:          typeof d.dealId      === "string" ? d.dealId      : undefined,
    documentId,
    documentLabel,
    fileName,
    agentName:
      typeof d.agentName   === "string" ? d.agentName   :
      typeof d.agent_name  === "string" ? d.agent_name  : "AI Analysis Agent",
    analyzedAt:      new Date().toISOString(),
    confidenceScore: score,
    confidenceLevel: confidenceLevel(score),
    summary:
      typeof d.summary === "string" ? d.summary : "Document analyzed. See findings below.",
    findings,
    redFlags,
    recommendations,
    advisorNotes:
      typeof d.advisorNotes  === "string" ? d.advisorNotes  :
      typeof d.advisor_notes === "string" ? d.advisor_notes : "",
    extractedData:
      typeof d.extractedData   === "object" && d.extractedData   ? (d.extractedData  as Record<string, unknown>) :
      typeof d.extracted_data  === "object" && d.extracted_data  ? (d.extracted_data as Record<string, unknown>) : {},
    // Drive / Sheets
    driveFileId:      typeof d.driveFileId      === "string" ? d.driveFileId      : undefined,
    driveFileName:    typeof d.driveFileName    === "string" ? d.driveFileName    : undefined,
    driveViewLink:    typeof d.driveViewLink    === "string" ? d.driveViewLink    : undefined,
    driveDownloadLink: typeof d.driveDownloadLink === "string" ? d.driveDownloadLink : undefined,
    sheetsRowId:      typeof d.sheetsRowId      === "string" ? d.sheetsRowId      : undefined,
    sheetsUrl:        typeof d.sheetsUrl        === "string" ? d.sheetsUrl        : undefined,
    rawResponse: JSON.stringify(raw, null, 2),
  };
}
