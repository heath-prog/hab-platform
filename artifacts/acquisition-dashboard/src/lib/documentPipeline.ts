// ─── Portfolio / business constants ──────────────────────────────────────────

export const PORTFOLIO_ID   = "hab-enterprises";
export const PORTFOLIO_NAME = "HAB Enterprises 3 LLC";
export const BUYER_NAME     = "Heath Blake";

// ─── Webhook storage keys (legacy aliases — do not use for new code) ─────────
// These constants map to the integration config service keys defined in
// src/lib/integrationConfig.ts. They remain here for backward compat with
// existing call sites (AIDocumentUpload, LoiFormModal, FinancialManagement, etc.)
// All new code should import from integrationConfig.ts directly.

export const WEBHOOK_KEY_DOC_INTAKE     = "n8n_doc_intake_v2";
export const WEBHOOK_KEY_DOC_RETRIEVAL  = "n8n_doc_retrieval_v1";
export const WEBHOOK_KEY_FIN_INTAKE     = "n8n_fin_intake_v1";

// ─── Webhook access via centralized integration config ────────────────────────
// getWebhookUrl now delegates to the integration config service (DB-backed,
// server-side, admin-controlled). Falls back to localStorage during migration.

import { getWebhookUrlByLegacyKey, INTEGRATION_KEYS, getIntegrationUrl } from "./integrationConfig";

export function getWebhookUrl(key: string): string {
  return getWebhookUrlByLegacyKey(key);
}

// Prefer getIntegrationUrl(INTEGRATION_KEYS.XXX) for new code.
export { INTEGRATION_KEYS, getIntegrationUrl };

/** @deprecated Use saveIntegrationUrl() from integrationConfig.ts instead */
export function setWebhookUrl(key: string, url: string): void {
  // Legacy localStorage write maintained for backward compat during migration.
  // The IntegrationsPanel now writes to the DB via saveIntegrationUrl().
  if (url.trim()) localStorage.setItem(key, url.trim());
  else            localStorage.removeItem(key);
}

// ─── Drive naming conventions ─────────────────────────────────────────────────

export function getDriveFileName(
  businessName: string,
  documentType: string,
  documentId: string
): string {
  const date   = new Date().toISOString().split("T")[0];
  const safe   = (s: string) => s.replace(/[^a-zA-Z0-9 ]/g, "").trim();
  return `${safe(businessName)} - ${safe(documentType)} - ${documentId} - ${date}`;
}

export function getDriveFolderPath(
  portfolioName: string,
  businessName: string,
  workflowStage: string
): string {
  return `${portfolioName}/${businessName}/${workflowStage}`;
}

// ─── Canonical upload payload ─────────────────────────────────────────────────

export type DocumentUploadPayload = {
  file: File;
  // Canonical IDs
  portfolioId: string;
  portfolioName: string;
  businessId: string;
  businessName: string;
  dealId: string;
  dealName: string;
  documentId: string;
  documentType: string;
  workflowStage: string;
  acquisitionType: string;
  // Parties
  buyerName: string;
  sellerName: string;
  uploadedBy: string;
  uploadDate: string;
  targetCloseDate?: string;
  // Drive storage hints
  driveFolderPath: string;
  driveFileName: string;
};

// ─── Canonical N8n document intake response ───────────────────────────────────

export type DocumentDriveData = {
  driveFileId?: string;
  driveFileName?: string;
  driveViewLink?: string;
  driveDownloadLink?: string;
  sheetsRowId?: string;
  sheetsUrl?: string;
};

export type DocumentIntakeResponse = DocumentDriveData & {
  portfolioId?: string;
  businessId?: string;
  dealId?: string;
  documentId?: string;
  documentType?: string;
  workflowStage?: string;
  verificationStatus?: string;
  agentName?: string;
  confidenceScore?: number;
  summary?: string;
  findings?: Array<{ label: string; value: string; flag: "ok" | "warning" | "critical"; detail?: string }>;
  redFlags?: string[];
  recommendations?: string[];
  advisorNotes?: string;
  extractedData?: Record<string, unknown>;
};

// ─── Upload via XHR for progress tracking ────────────────────────────────────

export function uploadDocumentToN8n(
  webhookUrl: string,
  payload: DocumentUploadPayload,
  onProgress?: (pct: number) => void
): Promise<DocumentIntakeResponse> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file",            payload.file);
    fd.append("portfolioId",     payload.portfolioId);
    fd.append("portfolioName",   payload.portfolioName);
    fd.append("businessId",      payload.businessId);
    fd.append("businessName",    payload.businessName);
    fd.append("dealId",          payload.dealId);
    fd.append("dealName",        payload.dealName);
    fd.append("documentId",      payload.documentId);
    fd.append("documentType",    payload.documentType);
    fd.append("workflowStage",   payload.workflowStage);
    fd.append("acquisitionType", payload.acquisitionType);
    fd.append("buyerName",       payload.buyerName);
    fd.append("sellerName",      payload.sellerName);
    fd.append("uploadedBy",      payload.uploadedBy);
    fd.append("uploadDate",      payload.uploadDate);
    fd.append("driveFolderPath", payload.driveFolderPath);
    fd.append("driveFileName",   payload.driveFileName);
    if (payload.targetCloseDate) fd.append("targetCloseDate", payload.targetCloseDate);

    const xhr = new XMLHttpRequest();

    if (onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 90));
      });
    }

    xhr.addEventListener("load", () => {
      onProgress?.(100);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as DocumentIntakeResponse);
        } catch {
          resolve({ verificationStatus: "received", summary: xhr.responseText || "Document received." });
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

    xhr.open("POST", webhookUrl);
    xhr.send(fd);
  });
}

// ─── Original PDF retrieval ───────────────────────────────────────────────────

export async function retrieveOriginalPdf(opts: {
  driveViewLink?: string;
  retrievalWebhookUrl?: string;
  businessId: string;
  dealId: string;
  documentId: string;
}): Promise<{ opened: boolean; fallbackLink?: string }> {
  if (opts.driveViewLink) {
    window.open(opts.driveViewLink, "_blank");
    return { opened: true };
  }

  if (opts.retrievalWebhookUrl?.startsWith("http")) {
    const resp = await fetch(opts.retrievalWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId:  opts.businessId,
        dealId:      opts.dealId,
        documentId:  opts.documentId,
      }),
    });

    if (resp.ok) {
      const data = (await resp.json()) as DocumentDriveData;
      const link = data.driveViewLink ?? data.driveDownloadLink;
      if (link) {
        window.open(link, "_blank");
        return { opened: true, fallbackLink: link };
      }
    }
    throw new Error("N8n retrieval did not return a file link");
  }

  throw new Error("No Drive link or retrieval webhook configured for this document");
}

// ─── Workflow intelligence ────────────────────────────────────────────────────

export const CONFIDENCE_AUTO   = 85;  // auto-eligible
export const CONFIDENCE_REVIEW = 70;  // review recommended
// < 70 → manual review required

export type WorkflowIntelligenceLevel = "auto" | "review" | "manual";

export function getIntelligenceLevel(score: number): WorkflowIntelligenceLevel {
  if (score >= CONFIDENCE_AUTO)   return "auto";
  if (score >= CONFIDENCE_REVIEW) return "review";
  return "manual";
}

export type WorkflowHint = {
  section: string;
  label: string;
  description: string;
};

export const DOCUMENT_WORKFLOW_HINTS: Record<string, WorkflowHint> = {
  d6:  { section: "lease",       label: "Lease Tracker",           description: "Lease terms can be pre-loaded from extracted data" },
  d7:  { section: "license",     label: "License & Compliance",    description: "BAR license details available for compliance tracker" },
  d8:  { section: "license",     label: "License & Compliance",    description: "Smog license status available" },
  d1:  { section: "financials",  label: "Financials",              description: "3-year revenue and profit data extracted" },
  d2:  { section: "financials",  label: "Financials",              description: "P&L line items extracted and available" },
  d3:  { section: "financials",  label: "Financials",              description: "Balance sheet assets/liabilities extracted" },
  d4:  { section: "financials",  label: "Financials",              description: "Bank deposit totals and patterns extracted" },
  d9:  { section: "day1",        label: "Day 1 Takeover",          description: "Payroll structure available for transition planning" },
  d10: { section: "day1",        label: "Day 1 Takeover",          description: "Employee roster ready for review" },
  d11: { section: "day1",        label: "Day 1 Takeover",          description: "Vendor list available for relationship mapping" },
};

// ─── Financial records (business-scoped) ─────────────────────────────────────

export type FinancialRecord = {
  transactionId: string;
  portfolioId: string;
  businessId: string;
  dealId: string;
  shopId?: string;
  sourceType: string;
  period: string;
  transactionDate: string;
  category: string;
  subCategory: string;
  amount: number;
  reference: string;
  description: string;
  sourceDocumentId?: string;
  sourceSystem: string;
};

export type FinancialIngestionPayload = {
  portfolioId: string;
  businessId: string;
  dealId: string;
  shopId?: string;
  sourceType: string;
  period: string;
  records: FinancialRecord[];
};

function finKey(businessId: string) { return `fin_records_${businessId}_v1`; }

export function loadFinancialRecords(businessId: string): FinancialRecord[] {
  try { return JSON.parse(localStorage.getItem(finKey(businessId)) ?? "[]"); } catch { return []; }
}

export function ingestFinancialRecords(businessId: string, payload: FinancialIngestionPayload): void {
  const existing  = loadFinancialRecords(businessId);
  const existIds  = new Set(existing.map((r) => r.transactionId));
  const fresh     = payload.records.filter((r) => !existIds.has(r.transactionId));
  localStorage.setItem(finKey(businessId), JSON.stringify([...existing, ...fresh]));
}

// ─── Expense / reconciliation records (business-scoped) ───────────────────────

export type ReconciliationStatus = "matched" | "unmatched" | "review" | "approved" | "escalated";

export type ExpenseRecord = {
  id: string;
  businessId: string;
  vendorName: string;
  documentType: string;
  invoiceNumber?: string;
  statementDate?: string;
  dueDate?: string;
  amount: number;
  balance?: number;
  statusHint?: string;
  expenseCategory?: string;
  subCategory?: string;
  confidenceScore?: number;
  driveFileId?: string;
  driveFileName?: string;
  driveViewLink?: string;
  reconciliationStatus: ReconciliationStatus;
  matchedReference?: string;
  matchedAmount?: number;
  matchedDate?: string;
  notes?: string;
  sourceDocumentId?: string;
  createdAt: string;
};

function expKey(businessId: string) { return `expense_records_${businessId}_v1`; }

export function loadExpenseRecords(businessId: string): ExpenseRecord[] {
  try { return JSON.parse(localStorage.getItem(expKey(businessId)) ?? "[]"); } catch { return []; }
}

export function saveExpenseRecords(businessId: string, records: ExpenseRecord[]): void {
  localStorage.setItem(expKey(businessId), JSON.stringify(records));
}

export function addExpenseRecord(businessId: string, record: Omit<ExpenseRecord, "id" | "createdAt">): ExpenseRecord {
  const all = loadExpenseRecords(businessId);
  const entry: ExpenseRecord = {
    ...record,
    id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  saveExpenseRecords(businessId, [entry, ...all]);
  return entry;
}

export function updateExpenseRecord(businessId: string, id: string, update: Partial<ExpenseRecord>): void {
  const all = loadExpenseRecords(businessId).map((r) => r.id === id ? { ...r, ...update } : r);
  saveExpenseRecords(businessId, all);
}

// ─── Integration connections (business-scoped) ────────────────────────────────

export type ConnectionStatus = "not_connected" | "pending" | "connected" | "sync_error" | "manual_only";

export type SourceType = "tekmetric" | "quickbooks" | "bank" | "n8n" | "manual";

export type IntegrationConnection = {
  businessId: string;
  sourceType: SourceType;
  connectionStatus: ConnectionStatus;
  connectionValue?: string; // API key, webhook URL, etc.
  lastSyncAt?: string;
  lastSyncResult?: string;
  recordsIngested?: number;
  dataCoverage?: string;
  updatedAt: string;
};

function connKey(businessId: string) { return `integrations_${businessId}_v1`; }

export function loadConnections(businessId: string): IntegrationConnection[] {
  try { return JSON.parse(localStorage.getItem(connKey(businessId)) ?? "[]"); } catch { return []; }
}

export function saveConnections(businessId: string, conns: IntegrationConnection[]): void {
  localStorage.setItem(connKey(businessId), JSON.stringify(conns));
}

export function getConnection(businessId: string, sourceType: SourceType): IntegrationConnection {
  const all = loadConnections(businessId);
  return (
    all.find((c) => c.sourceType === sourceType) ?? {
      businessId,
      sourceType,
      connectionStatus: sourceType === "n8n" ? "connected" : sourceType === "manual" ? "manual_only" : "not_connected",
      updatedAt: new Date().toISOString(),
    }
  );
}

export function upsertConnection(businessId: string, conn: IntegrationConnection): void {
  const all = loadConnections(businessId).filter((c) => c.sourceType !== conn.sourceType);
  saveConnections(businessId, [{ ...conn, updatedAt: new Date().toISOString() }, ...all]);
}
