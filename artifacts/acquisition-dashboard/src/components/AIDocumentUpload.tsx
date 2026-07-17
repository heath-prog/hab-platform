import { useState, useRef, useCallback } from "react";
import {
  Upload, FileText, CheckCircle2, XCircle, Loader2, Settings,
  Zap, X, Link2, AlertCircle, ChevronDown, ChevronUp, File,
  FileSpreadsheet, FileImage, Eye, EyeOff, Bot, ExternalLink,
  Sparkles, Info, Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseN8nResponse, saveReport, type VerificationReport } from "@/lib/reports";
import {
  PORTFOLIO_ID, PORTFOLIO_NAME, BUYER_NAME,
  WEBHOOK_KEY_DOC_INTAKE, WEBHOOK_KEY_DOC_RETRIEVAL,
  getWebhookUrl, setWebhookUrl,
  getDriveFileName, getDriveFolderPath,
  uploadDocumentToN8n, retrieveOriginalPdf,
  getIntelligenceLevel, DOCUMENT_WORKFLOW_HINTS,
  type DocumentIntakeResponse,
} from "@/lib/documentPipeline";
import { loadPortfolio, getBusiness } from "@/lib/storage";
import { apiFetch } from "@/lib/apiFetch";

// ─── Document options ─────────────────────────────────────────────────────────

export const DOCUMENT_OPTIONS = [
  { id: "d-nda",     label: "NDA (Non-Disclosure Agreement)"  },
  { id: "d-loi",     label: "LOI (Letter of Intent)"          },
  { id: "d-loi-nda", label: "LOI with NDA Clause (Combined)"  },
  { id: "d1",  label: "3 Years Tax Returns" },
  { id: "d2",  label: "P&L Statements" },
  { id: "d3",  label: "Balance Sheets" },
  { id: "d4",  label: "Bank Statements (12 mo)" },
  { id: "d5",  label: "Debt Schedule" },
  { id: "d6",  label: "Lease Agreement" },
  { id: "d7",  label: "BAR License" },
  { id: "d8",  label: "Smog License (if applicable)" },
  { id: "d9",  label: "Payroll Reports" },
  { id: "d10", label: "Employee List" },
  { id: "d11", label: "Vendor List" },
  { id: "d12", label: "Inventory List" },
  { id: "d13", label: "Equipment List" },
  { id: "d14", label: "Vehicle Title (Jeep)" },
  { id: "d15", label: "Tekmetric Export" },
  { id: "d16", label: "Google / Website Access" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type UploadStatus = "queued" | "uploading" | "success" | "error";

type ApiDocResult = {
  status: "filed" | "queued" | "error";
  vendor: string | null;
  amount: number | null;
  date: string | null;
  confidence: number;
  aiNote: string;
  driveLink?: string;
};

type ApiProcessingResult = {
  uploadId: number;
  totalPages: number;
  filed: number;
  queued: number;
  failed: number;
  documents: ApiDocResult[];
};

type UploadedFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  status: UploadStatus;
  progress: number;
  error?: string;
  uploadedAt?: string;
  linkedDocId?: string;
  linkedDocLabel?: string;
  driveData?: DocumentIntakeResponse;
  report?: VerificationReport;
  apiResult?: ApiProcessingResult;
};

type Props = {
  onReportSaved?: (docId: string) => void;
  onDocumentDriveUpdate?: (docId: string, data: DocumentIntakeResponse) => void;
  businessId?: string;
  businessName?: string;
  sellerName?: string;
  targetCloseDate?: string;
  acquisitionType?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(b: number) {
  if (b < 1024)           return `${b} B`;
  if (b < 1024 * 1024)    return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type.includes("image"))                                              return FileImage;
  if (type.includes("sheet") || type.includes("csv") || type.includes("excel")) return FileSpreadsheet;
  if (type.includes("pdf") || type.includes("text") || type.includes("doc"))    return FileText;
  return File;
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="mt-1.5 h-1 bg-blue-200/50 dark:bg-blue-900/30 rounded-full overflow-hidden">
      <div
        className="h-full bg-blue-500 rounded-full transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AIDocumentUpload({
  onReportSaved,
  onDocumentDriveUpdate,
  businessId: propBusinessId = "true-blue",
  businessName: propBusinessName,
  sellerName: propSellerName,
  targetCloseDate: propTargetClose,
  acquisitionType = "Asset Purchase",
}: Props) {
  const businessId = propBusinessId;

  // Load business metadata from portfolio if not provided as props
  const portfolio = loadPortfolio();
  const business  = getBusiness(portfolio, businessId);
  const businessName   = propBusinessName   ?? business?.name        ?? "True Blue Auto Care";
  const sellerName     = propSellerName     ?? business?.seller      ?? "Saj Zoghet";
  const targetCloseDate = propTargetClose   ?? business?.targetCloseDate ?? "";

  // Webhook URLs
  const [intakeUrl,    setIntakeUrlState]    = useState(() => getWebhookUrl(WEBHOOK_KEY_DOC_INTAKE));
  const [retrievalUrl, setRetrievalUrlState] = useState(() => getWebhookUrl(WEBHOOK_KEY_DOC_RETRIEVAL));
  const [intakeInput,    setIntakeInput]    = useState(intakeUrl);
  const [retrievalInput, setRetrievalInput] = useState(retrievalUrl);
  const [showSettings,   setShowSettings]   = useState(false);
  const [showIntakeUrl,    setShowIntakeUrl]    = useState(false);
  const [showRetrievalUrl, setShowRetrievalUrl] = useState(false);

  const [files, setFiles]       = useState<UploadedFile[]>([]);
  const [isDragging, setDragging] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState(DOCUMENT_OPTIONS[0].id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isConfigured = intakeUrl.startsWith("http");
  const selectedDoc  = DOCUMENT_OPTIONS.find((d) => d.id === selectedDocId) ?? DOCUMENT_OPTIONS[0];

  function saveWebhooks() {
    setWebhookUrl(WEBHOOK_KEY_DOC_INTAKE,     intakeInput);
    setWebhookUrl(WEBHOOK_KEY_DOC_RETRIEVAL,  retrievalInput);
    setIntakeUrlState(intakeInput.trim());
    setRetrievalUrlState(retrievalInput.trim());
    setShowSettings(false);
  }

  function updateFile(id: string, patch: Partial<UploadedFile>) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  const uploadFile = useCallback(
    async (file: File, docId: string, docLabel: string) => {
      const id: string = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setFiles((prev) => [{
        id, name: file.name, size: file.size, type: file.type,
        status: "queued", progress: 0,
        linkedDocId: docId, linkedDocLabel: docLabel,
      }, ...prev]);

      updateFile(id, { status: "uploading" });

      // When no n8n webhook is configured, use the built-in OpenAI pipeline
      if (!intakeUrl.startsWith("http")) {
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("businessId", businessId);
          updateFile(id, { progress: 20 });
          // apiFetch attaches the Clerk Bearer token — a bare fetch() left the
          // multipart request unauthenticated and the server returned 401.
          const res = await apiFetch(`${API_BASE}/api/documents/upload`, {
            method: "POST",
            body: formData,
          });
          updateFile(id, { progress: 90 });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "Upload failed" }));
            throw new Error(err.error || "Upload failed");
          }
          const result: ApiProcessingResult = await res.json();
          updateFile(id, {
            status: "success",
            progress: 100,
            uploadedAt: new Date().toLocaleTimeString(),
            apiResult: result,
          });
          onReportSaved?.(docId);
        } catch (err) {
          updateFile(id, { status: "error", progress: 0, error: err instanceof Error ? err.message : "Upload failed" });
        }
        return;
      }

      const driveFileName  = getDriveFileName(businessName, docLabel, docId);
      const driveFolderPath = getDriveFolderPath(PORTFOLIO_NAME, businessName, "Due Diligence");
      const dealId         = `deal-${businessId}`;

      try {
        const response = await uploadDocumentToN8n(
          intakeUrl,
          {
            file,
            portfolioId:     PORTFOLIO_ID,
            portfolioName:   PORTFOLIO_NAME,
            businessId,
            businessName,
            dealId,
            dealName:        businessName,
            documentId:      docId,
            documentType:    docLabel,
            workflowStage:   "Due Diligence",
            acquisitionType,
            buyerName:       BUYER_NAME,
            sellerName,
            uploadedBy:      BUYER_NAME,
            uploadDate:      new Date().toISOString(),
            targetCloseDate: targetCloseDate || undefined,
            driveFolderPath,
            driveFileName,
          },
          (pct) => updateFile(id, { progress: pct })
        );

        // Parse and save the verification report (with Drive data)
        const report = parseN8nResponse(response, docId, docLabel, file.name, businessId);
        saveReport(report, businessId);

        updateFile(id, {
          status: "success",
          progress: 100,
          uploadedAt: new Date().toLocaleTimeString(),
          driveData: response,
          report,
        });

        onReportSaved?.(docId);
        onDocumentDriveUpdate?.(docId, response);
      } catch (err) {
        updateFile(id, {
          status: "error",
          progress: 0,
          error: err instanceof Error ? err.message : "Upload failed",
        });
      }
    },
    [intakeUrl, businessId, businessName, sellerName, targetCloseDate, acquisitionType, onReportSaved, onDocumentDriveUpdate]
  );

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    Array.from(fileList).forEach((f) => uploadFile(f, selectedDoc.id, selectedDoc.label));
  }

  const successCount = files.filter((f) => f.status === "success").length;
  const errorCount   = files.filter((f) => f.status === "error").length;
  const pendingCount = files.filter((f) => f.status === "uploading" || f.status === "queued").length;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                AI Document Processing
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isConfigured
                  ? `Connected · uploads go to OpenAI → N8n → Google Drive → Sheets`
                  : "OpenAI Vision analysis · Drive sync available via N8n webhook"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConfigured && (
              <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Connected
              </div>
            )}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all",
                showSettings ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
              {showSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="px-6 py-5 border-b border-border bg-muted/30 space-y-5">
          {/* Document intake webhook */}
          <div>
            <label className="text-sm font-medium flex items-center gap-2 mb-1.5">
              <Zap className="w-4 h-4 text-primary" />
              Document Intake Webhook (N8n)
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              POST endpoint — receives file + canonical fields. Stores to Google Drive, extracts to Sheets, returns verification report.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showIntakeUrl ? "text" : "password"}
                  value={intakeInput}
                  onChange={(e) => setIntakeInput(e.target.value)}
                  placeholder="https://your-n8n.com/webhook/document-intake"
                  data-testid="input-webhook-url"
                  className="w-full px-3 pr-10 py-2.5 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button onClick={() => setShowIntakeUrl(!showIntakeUrl)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showIntakeUrl ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* PDF retrieval webhook */}
          <div>
            <label className="text-sm font-medium flex items-center gap-2 mb-1.5">
              <Link2 className="w-4 h-4 text-muted-foreground" />
              PDF Retrieval Webhook (N8n) — optional
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              POST endpoint — fetches file from Drive by documentId. Used when "View Original PDF" is clicked without a cached Drive link.
            </p>
            <div className="relative">
              <input
                type={showRetrievalUrl ? "text" : "password"}
                value={retrievalInput}
                onChange={(e) => setRetrievalInput(e.target.value)}
                placeholder="https://your-n8n.com/webhook/document-retrieve"
                className="w-full px-3 pr-10 py-2.5 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button onClick={() => setShowRetrievalUrl(!showRetrievalUrl)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showRetrievalUrl ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button data-testid="button-save-webhook" onClick={saveWebhooks}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">
              Save & Connect
            </button>
            <button onClick={() => setShowSettings(false)}
              className="px-4 py-2 border border-border text-sm rounded-lg hover:bg-muted transition-colors">
              Cancel
            </button>
          </div>

          {/* N8n field reference */}
          <div className="bg-background border border-border rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Fields sent to N8n (multipart/form-data)
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono">
              {[
                "file", "portfolioId", "portfolioName", "businessId",
                "businessName", "dealId", "documentId", "documentType",
                "workflowStage", "acquisitionType", "buyerName", "sellerName",
                "uploadedBy", "uploadDate", "driveFolderPath", "driveFileName",
              ].map((f) => (
                <span key={f} className="bg-muted px-1.5 py-0.5 rounded">{f}</span>
              ))}
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-3">
              Expected N8n response schema
            </p>
            <pre className="text-xs text-muted-foreground overflow-x-auto leading-relaxed">{`{
  // Drive storage
  "driveFileId": "abc123",
  "driveFileName": "True Blue - Tax Returns - d1 - 2026-04-07.pdf",
  "driveViewLink": "https://drive.google.com/file/d/abc123/view",
  // Google Sheets (extracted data table)
  "sheetsRowId": "row_42",
  "sheetsUrl": "https://docs.google.com/spreadsheets/...",
  // AI verification
  "agentName": "Financial Analysis Agent",
  "confidenceScore": 85,
  "summary": "Three years of tax returns reviewed...",
  "findings": [{ "label": "Revenue 2023", "value": "$1.2M", "flag": "ok" }],
  "redFlags": [],
  "recommendations": [],
  "advisorNotes": "...",
  "extractedData": {}
}`}</pre>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "85–100", desc: "Auto-eligible", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" },
                { label: "70–84",  desc: "Review recommended", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" },
                { label: "0–69",   desc: "Manual review required", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" },
              ].map(({ label, desc, color }) => (
                <div key={label} className={cn("rounded-lg px-3 py-2 text-xs font-medium", color)}>
                  <div className="font-bold">{label}</div>
                  <div className="opacity-80">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Upload Zone */}
      <div className="p-6 space-y-4">
        {/* Document selector */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Link to document type
          </label>
          <select
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
            data-testid="select-document-type"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {DOCUMENT_OPTIONS.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </div>

        {/* Drive destination preview */}
        {isConfigured && (
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-lg text-xs text-muted-foreground">
            <Database className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Drive: <code className="text-foreground">{getDriveFolderPath(PORTFOLIO_NAME, businessName, "Due Diligence")}</code></span>
            <span className="mx-1">·</span>
            <span>Sheets: extracted data table</span>
          </div>
        )}

        {/* Drop zone */}
        <div
          data-testid="dropzone-upload"
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200",
            isDragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            data-testid="input-file-upload"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.txt"
          />
          <div className="flex flex-col items-center gap-3">
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
              isDragging ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {isDragging ? "Drop to send to AI agent" : "Drag document here"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                or <span className="text-primary underline underline-offset-2">browse files</span>{" "}
                — sends to specialized AI agent for <span className="font-medium">{selectedDoc.label}</span>
              </p>
            </div>
            {!isConfigured && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-full border border-border">
                <Info className="w-3.5 h-3.5" />
                AI analysis active · Drive sync requires N8n webhook
              </div>
            )}
          </div>
        </div>

        {/* File stats */}
        {files.length > 0 && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{files.length} file{files.length !== 1 ? "s" : ""}</span>
            {successCount > 0 && <span className="text-emerald-600 dark:text-emerald-400 font-medium">{successCount} verified</span>}
            {pendingCount > 0 && <span className="text-primary font-medium">{pendingCount} processing</span>}
            {errorCount > 0 && <span className="text-destructive font-medium">{errorCount} failed</span>}
            <button onClick={() => setFiles([])} className="ml-auto text-muted-foreground hover:text-foreground">Clear all</button>
          </div>
        )}

        {/* File list */}
        {files.map((file) => {
          const Icon  = getFileIcon(file.type);
          const hint  = file.report && DOCUMENT_WORKFLOW_HINTS[file.linkedDocId ?? ""];
          const level = file.report ? getIntelligenceLevel(file.report.confidenceScore) : null;

          return (
            <div
              key={file.id}
              data-testid={`file-item-${file.id}`}
              className={cn(
                "flex flex-col gap-2 p-3 rounded-lg border transition-all",
                file.status === "success" ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900"
                  : file.status === "error"   ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900"
                  : file.status === "uploading" ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900"
                  : "bg-muted border-border"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  file.status === "success"  ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600"
                    : file.status === "error"  ? "bg-red-100 dark:bg-red-900/40 text-red-600"
                    : file.status === "uploading" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600"
                    : "bg-background text-muted-foreground"
                )}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {file.status === "uploading" && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                      {file.status === "success"   && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                      {file.status === "error"     && <XCircle className="w-4 h-4 text-red-500" />}
                      <button onClick={() => setFiles((p) => p.filter((f) => f.id !== file.id))} className="text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                    {file.linkedDocLabel && <span className="text-xs text-primary">{file.linkedDocLabel}</span>}
                    {file.status === "uploading" && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                        <Bot className="w-3 h-3" /> AI agents analyzing…
                      </span>
                    )}
                    {file.status === "error" && <span className="text-xs text-red-600 dark:text-red-400">{file.error}</span>}
                  </div>
                  {file.status === "uploading" && file.progress > 0 && file.progress < 100 && (
                    <ProgressBar pct={file.progress} />
                  )}
                </div>
              </div>

              {/* Post-upload details — API pipeline result (no n8n) */}
              {file.status === "success" && file.apiResult && (
                <div className="flex flex-col gap-1.5 pl-11">
                  <div className="flex flex-wrap gap-2">
                    {file.apiResult.documents.map((doc, i) => (
                      <span key={i} className={cn(
                        "text-xs font-semibold px-2.5 py-1 rounded-full",
                        doc.confidence >= 80
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                          : doc.confidence >= 60
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                      )}>
                        {doc.vendor ?? doc.aiNote ?? "Document"} · {doc.confidence}%
                        {doc.status === "queued" ? " · Review Queue" : doc.status === "filed" ? " · Filed" : ""}
                      </span>
                    ))}
                    {file.apiResult.queued > 0 && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {file.apiResult.queued} sent to Review Queue
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Document processed · Drive sync unavailable — configure N8n webhook in Integrations to enable
                  </p>
                </div>
              )}

              {/* Post-upload details — n8n pipeline result */}
              {file.status === "success" && file.report && (
                <div className="flex flex-wrap gap-2 pl-11">
                  {/* Confidence badge */}
                  <span className={cn(
                    "text-xs font-semibold px-2.5 py-1 rounded-full",
                    file.report.confidenceScore >= 85
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                      : file.report.confidenceScore >= 70
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                  )}>
                    {file.report.confidenceScore}% · {file.report.confidenceLevel}
                  </span>

                  {/* Drive link */}
                  {file.driveData?.driveViewLink && (
                    <button
                      onClick={() => window.open(file.driveData!.driveViewLink, "_blank")}
                      className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" /> View in Drive
                    </button>
                  )}

                  {/* Sheets link */}
                  {file.driveData?.sheetsUrl && (
                    <button
                      onClick={() => window.open(file.driveData!.sheetsUrl, "_blank")}
                      className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      <Database className="w-3 h-3" /> Sheets data
                    </button>
                  )}
                </div>
              )}

              {/* Workflow intelligence hint */}
              {file.status === "success" && hint && level && (
                <div className={cn(
                  "flex items-start gap-2 pl-11 py-2 px-3 rounded-lg border text-xs",
                  level === "auto"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400"
                    : level === "review"
                    ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900 dark:text-amber-400"
                    : "bg-muted border-border text-muted-foreground"
                )}>
                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">{hint.label}: </span>
                    {hint.description}
                    {level === "auto" && " — eligible for workflow assist."}
                    {level === "review" && " — review recommended before applying."}
                    {level === "manual" && " — manual review required before use."}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
