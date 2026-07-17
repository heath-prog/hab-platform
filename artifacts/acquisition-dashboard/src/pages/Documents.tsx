import { useDashboard } from "@/lib/context";
import {
  CheckCircle2, Circle, Copy, Check, ExternalLink, AlertTriangle,
  XCircle, Bot, FileText, ChevronDown, ChevronUp, Download, AlertCircle,
  Database, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useCallback, useRef } from "react";
import { AIDocumentUpload } from "@/components/AIDocumentUpload";
import { VerificationReportModal } from "@/components/VerificationReportModal";
import NdaLoiPanel, { type NdaLoiUploadType } from "@/components/NdaLoiPanel";
import LoiFormModal from "@/components/LoiFormModal";
import DealStructureAnalyzer from "@/components/DealStructureAnalyzer";
import { loadReports, getReport, confidenceColor, type VerificationReport } from "@/lib/reports";
import { loadPortfolio, getBusiness } from "@/lib/storage";
import {
  retrieveOriginalPdf, getWebhookUrl, WEBHOOK_KEY_DOC_RETRIEVAL,
  DOCUMENT_WORKFLOW_HINTS, CONFIDENCE_AUTO, CONFIDENCE_REVIEW,
  getIntelligenceLevel,
  type DocumentIntakeResponse,
} from "@/lib/documentPipeline";

// ─── Email template ───────────────────────────────────────────────────────────

const EMAIL_TEMPLATE = `Hi Saj,

Thank you again for the opportunity to move forward on the acquisition of True Blue Auto Care.

As part of our due diligence process, please provide the following documents at your earliest convenience:

• Last 3 years of business tax returns
• Last 3 years P&L and balance sheets
• Last 12 months of bank statements
• Current lease agreement and landlord contact
• BAR registration and any smog/STAR licenses
• Payroll reports and employee roster
• Accounts payable and receivable aging reports
• Debt schedule (loans, equipment financing, etc.)
• Equipment and inventory list
• Title for company-owned vehicles (including Jeep)
• Vendor list
• Tekmetric (or shop management) export/report
• Access to digital assets (website, Google profile, etc.)
• Any outstanding legal, tax, or compliance issues

Please upload these to a shared folder or send directly.

Looking forward to working through this together and keeping momentum.

Best regards,
Heath Blake
CEO / President
HAB Enterprises 3 LLC`;

// ─── Confidence badge ─────────────────────────────────────────────────────────

function VerifiedButton({
  report, onClick,
}: { report: VerificationReport | null; onClick: (r: VerificationReport) => void }) {
  if (!report) return (
    <div className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-muted text-muted-foreground">
      <Circle className="w-3.5 h-3.5" /> Unverified
    </div>
  );

  const color = confidenceColor(report.confidenceScore);
  const base  = "flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all group";

  if (color === "green") return (
    <button onClick={() => onClick(report)} className={cn(base, "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/60")}>
      <CheckCircle2 className="w-3.5 h-3.5" />
      {report.confidenceScore}% Verified
      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60" />
    </button>
  );
  if (color === "yellow") return (
    <button onClick={() => onClick(report)} className={cn(base, "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/60")}>
      <AlertTriangle className="w-3.5 h-3.5" />
      {report.confidenceScore}% Review
      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60" />
    </button>
  );
  return (
    <button onClick={() => onClick(report)} className={cn(base, "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60")}>
      <XCircle className="w-3.5 h-3.5" />
      {report.confidenceScore}% Issues
      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60" />
    </button>
  );
}

// ─── Workflow intelligence hint ───────────────────────────────────────────────

function WorkflowHintBadge({ docId, report }: { docId: string; report: VerificationReport }) {
  const hint = DOCUMENT_WORKFLOW_HINTS[docId];
  if (!hint) return null;
  const level = getIntelligenceLevel(report.confidenceScore);
  if (level === "auto") return (
    <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
      <Sparkles className="w-3 h-3" />
      {hint.label}: Auto-eligible for workflow assist
    </span>
  );
  if (level === "review") return (
    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
      <AlertCircle className="w-3 h-3" />
      {hint.label}: Review recommended before applying
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <AlertCircle className="w-3 h-3" />
      {hint.label}: Manual review required
    </span>
  );
}

// ─── Extracted data panel ─────────────────────────────────────────────────────

function ExtractedDataPanel({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return <p className="text-xs text-muted-foreground italic">No structured data extracted.</p>;
  return (
    <div className="grid grid-cols-2 gap-2">
      {entries.map(([k, v]) => (
        <div key={k} className="bg-background border border-border rounded-lg px-3 py-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{k.replace(/_/g, " ")}</p>
          <p className="text-xs font-semibold mt-0.5 truncate">{String(v)}</p>
        </div>
      ))}
    </div>
  );
}

// ─── PDF retrieval hook ───────────────────────────────────────────────────────

function usePdfRetrieval(businessId: string) {
  const [retrieving, setRetrieving] = useState<Record<string, boolean>>({});
  const [pdfErrors,  setPdfErrors]  = useState<Record<string, string>>({});

  async function openPdf(docId: string, driveViewLink?: string) {
    setRetrieving((p) => ({ ...p, [docId]: true }));
    setPdfErrors((p) => { const n = { ...p }; delete n[docId]; return n; });
    try {
      const retrievalUrl = getWebhookUrl(WEBHOOK_KEY_DOC_RETRIEVAL);
      await retrieveOriginalPdf({
        driveViewLink,
        retrievalWebhookUrl: retrievalUrl || undefined,
        businessId,
        dealId:     `deal-${businessId}`,
        documentId: docId,
      });
    } catch (err) {
      setPdfErrors((p) => ({
        ...p,
        [docId]: err instanceof Error ? err.message : "Could not retrieve file",
      }));
    } finally {
      setRetrieving((p) => ({ ...p, [docId]: false }));
    }
  }

  return { openPdf, retrieving, pdfErrors };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Documents() {
  const { state, setState, businessId } = useDashboard();
  const [copied,      setCopied]    = useState(false);
  const [reports,     setReports]   = useState<Record<string, VerificationReport>>(() => loadReports(businessId));
  const [openReport,  setOpenReport] = useState<VerificationReport | null>(null);
  const [expanded,    setExpanded]  = useState<Record<string, boolean>>({});
  const [showLoiForm, setShowLoiForm] = useState(false);
  const uploadRef = useRef<HTMLDivElement>(null);
  const { openPdf, retrieving, pdfErrors } = usePdfRetrieval(businessId);

  // Business info for LOI template pre-fill
  const business = getBusiness(loadPortfolio(), businessId);

  // NDA / LOI derived state
  const ndaDoc  = state.documents.find((d) => d.id === "d-nda");
  const loiDoc  = state.documents.find((d) => d.id === "d-loi");
  const loiNdaDoc = state.documents.find((d) => d.id === "d-loi-nda");
  const ndaReceived  = !!(ndaDoc?.received  || loiNdaDoc?.received);
  const loiReceived  = !!(loiDoc?.received  || loiNdaDoc?.received);
  const loiWithNda   = !!(loiNdaDoc?.received);

  // Mark NDA in both documents and progress
  const markNda = useCallback((received: boolean) => {
    setState((prev) => ({
      ...prev,
      documents: prev.documents.map((d) =>
        d.id === "d-nda" ? { ...d, received } : d
      ),
      progress: prev.progress.map((p) =>
        p.id === "p-nda" ? { ...p, checked: received } : p
      ),
    }));
  }, [setState]);

  // Mark LOI in both documents and progress
  const markLoi = useCallback((received: boolean) => {
    setState((prev) => ({
      ...prev,
      documents: prev.documents.map((d) =>
        d.id === "d-loi" ? { ...d, received } : d
      ),
      progress: prev.progress.map((p) =>
        p.id === "p1" ? { ...p, checked: received } : p
      ),
    }));
  }, [setState]);

  // Mark BOTH NDA + LOI (for combined doc)
  const markBoth = useCallback(() => {
    setState((prev) => ({
      ...prev,
      documents: prev.documents.map((d) => {
        if (d.id === "d-nda" || d.id === "d-loi" || d.id === "d-loi-nda") return { ...d, received: true };
        return d;
      }),
      progress: prev.progress.map((p) => {
        if (p.id === "p-nda" || p.id === "p1") return { ...p, checked: true };
        return p;
      }),
    }));
  }, [setState]);

  // Handle upload request from NDA/LOI panel — scroll to upload area
  const handleNdaLoiUploadRequest = useCallback((_type: NdaLoiUploadType) => {
    uploadRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const refreshReports = useCallback((docId: string) => {
    const r = getReport(docId, businessId);
    if (r) {
      setReports((prev) => ({ ...prev, [docId]: r }));
      setState((prev) => {
        // Smart cross-check: d-loi-nda satisfies both NDA and LOI
        const isLoi    = docId === "d-loi" || docId === "d-loi-nda";
        const isNda    = docId === "d-nda" || docId === "d-loi-nda";
        const isCombined = docId === "d-loi-nda";

        const updatedDocs = prev.documents.map((d) => {
          if (d.id === docId) return { ...d, received: true };
          if (isCombined && (d.id === "d-nda" || d.id === "d-loi")) return { ...d, received: true };
          return d;
        });
        const updatedProgress = prev.progress.map((p) => {
          if (isNda && p.id === "p-nda") return { ...p, checked: true };
          if (isLoi && p.id === "p1")    return { ...p, checked: true };
          return p;
        });
        return { ...prev, documents: updatedDocs, progress: updatedProgress };
      });
    }
  }, [setState, businessId]);

  const handleDriveUpdate = useCallback((docId: string, data: DocumentIntakeResponse) => {
    setState((prev) => ({
      ...prev,
      documents: prev.documents.map((d) =>
        d.id === docId
          ? {
              ...d,
              driveFileId:           data.driveFileId,
              driveFileName:         data.driveFileName,
              driveViewLink:         data.driveViewLink,
              confidenceScore:       data.confidenceScore,
              extractedDataSnapshot: data.extractedData
                ? JSON.stringify(data.extractedData).slice(0, 500)
                : undefined,
            }
          : d
      ),
    }));
  }, [setState]);

  const toggleReceived = (id: string) =>
    setState((prev) => ({
      ...prev,
      documents: prev.documents.map((d) => d.id === id ? { ...d, received: !d.received } : d),
    }));

  const updateNotes = (id: string, notes: string) =>
    setState((prev) => ({
      ...prev,
      documents: prev.documents.map((d) => d.id === id ? { ...d, notes } : d),
    }));

  // Filter NDA/LOI out of the main checklist (shown separately in NdaLoiPanel)
  const NDA_LOI_IDS = new Set(["d-nda", "d-loi", "d-loi-nda"]);
  const checklistDocs = state.documents.filter((d) => !NDA_LOI_IDS.has(d.id));

  const received      = state.documents.filter((d) => d.received).length;
  const verifiedCount = Object.values(reports).filter((r) => r.confidenceScore >= 75).length;
  const total         = state.documents.length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Document Center
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          {received}/{total} received · {verifiedCount} AI-verified · Originals in Google Drive · Extracted data in Sheets
        </p>
      </div>

      {/* ── NDA / LOI Panel ─────────────────────────────────────────────────── */}
      <NdaLoiPanel
        ndaReceived={ndaReceived}
        loiReceived={loiReceived}
        loiWithNda={loiWithNda}
        business={business}
        onMarkNda={markNda}
        onMarkLoi={markLoi}
        onMarkBoth={markBoth}
        onRequestUpload={handleNdaLoiUploadRequest}
        onOpenLoiForm={() => setShowLoiForm(true)}
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Required", value: total,           color: "text-foreground" },
          { label: "Received",       value: received,        color: "text-emerald-600 dark:text-emerald-400" },
          { label: "AI Verified",    value: verifiedCount,   color: "text-blue-600 dark:text-blue-400" },
          { label: "Outstanding",    value: total - received, color: total - received > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className={cn("text-3xl font-bold", color)} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* AI Upload */}
      <div ref={uploadRef}>
        <AIDocumentUpload
          businessId={businessId}
          onReportSaved={refreshReports}
          onDocumentDriveUpdate={handleDriveUpdate}
        />
      </div>

      {/* Deal Structure Analyzer */}
      <DealStructureAnalyzer business={business} />

      {/* Confidence legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground px-1">
        <span className="font-medium text-foreground">Confidence key:</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />{CONFIDENCE_AUTO}–100 Auto-eligible</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />{CONFIDENCE_REVIEW}–{CONFIDENCE_AUTO - 1} Review first</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />0–{CONFIDENCE_REVIEW - 1} Manual required</span>
        <span className="flex items-center gap-1.5"><Bot className="w-3 h-3" />Click to open report</span>
      </div>

      {/* Document checklist */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Due Diligence Checklist
          </h3>
          <span className={cn(
            "text-xs font-medium px-2.5 py-1 rounded-full",
            total - received > 0
              ? "bg-destructive/10 text-destructive"
              : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
          )}>
            {total - received > 0 ? `${total - received} outstanding` : "All received"}
          </span>
        </div>

        <div className="divide-y divide-border">
          {checklistDocs.map((doc) => {
            const report     = reports[doc.id] ?? null;
            const hasReport  = !!report;
            const isExpanded = expanded[doc.id];
            const extractedData  = hasReport ? report.extractedData : {};
            const hasExtracted   = Object.keys(extractedData).length > 0;
            const driveLink      = doc.driveViewLink || report?.driveViewLink;
            const driveFileName  = doc.driveFileName  || report?.driveFileName;

            return (
              <div
                key={doc.id}
                data-testid={`doc-row-${doc.id}`}
                className={cn(
                  hasReport && confidenceColor(report.confidenceScore) === "red" && "bg-red-50/30 dark:bg-red-950/10"
                )}
              >
                <div className="px-6 py-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={cn(
                          "text-sm font-medium",
                          doc.received && hasReport && confidenceColor(report.confidenceScore) === "green"
                            ? "line-through text-muted-foreground" : ""
                        )}>
                          {doc.label}
                        </p>
                        {hasReport && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Bot className="w-3 h-3" /> {report.agentName}
                          </span>
                        )}
                      </div>

                      {driveFileName && (
                        <p className="text-xs text-muted-foreground/60 mt-0.5 font-mono">{driveFileName}</p>
                      )}

                      <input
                        type="text"
                        placeholder="Add notes..."
                        value={doc.notes || ""}
                        onChange={(e) => updateNotes(doc.id, e.target.value)}
                        data-testid={`doc-notes-${doc.id}`}
                        className="mt-1 text-xs text-muted-foreground bg-transparent border-none outline-none w-full placeholder:text-muted-foreground/40 focus:text-foreground"
                      />

                      {hasReport && (
                        <div className="mt-1">
                          <WorkflowHintBadge docId={doc.id} report={report} />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                      {/* View Original PDF */}
                      {driveLink ? (
                        <button
                          onClick={() => openPdf(doc.id, driveLink)}
                          disabled={retrieving[doc.id]}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/40 border border-blue-200/50 dark:border-blue-900/50 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {retrieving[doc.id] ? "Opening…" : "View PDF"}
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </button>
                      ) : hasReport ? (
                        <button
                          onClick={() => openPdf(doc.id)}
                          disabled={retrieving[doc.id]}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground border border-border transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          {retrieving[doc.id] ? "Fetching…" : "Retrieve PDF"}
                        </button>
                      ) : null}

                      {/* Extracted data toggle */}
                      {hasExtracted && (
                        <button
                          onClick={() => setExpanded((p) => ({ ...p, [doc.id]: !p[doc.id] }))}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground border border-border transition-colors"
                        >
                          <Database className="w-3.5 h-3.5" />
                          Extracted
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}

                      {/* Received toggle */}
                      <button
                        data-testid={`doc-received-${doc.id}`}
                        onClick={() => toggleReceived(doc.id)}
                        className={cn(
                          "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all",
                          doc.received
                            ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                      >
                        {doc.received ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                        Received
                      </button>

                      {/* Verification badge */}
                      <div data-testid={`doc-verified-${doc.id}`}>
                        <VerifiedButton report={report} onClick={setOpenReport} />
                      </div>
                    </div>
                  </div>

                  {pdfErrors[doc.id] && (
                    <p className="mt-2 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {pdfErrors[doc.id]}
                    </p>
                  )}
                </div>

                {/* Extracted data panel */}
                {isExpanded && hasExtracted && (
                  <div className="px-6 pb-4 bg-muted/20 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide my-3 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5" />
                      Extracted Data — auto-populated by AI agent
                    </p>
                    <ExtractedDataPanel data={extractedData} />
                    {report?.sheetsUrl && (
                      <a
                        href={report.sheetsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:underline mt-3"
                      >
                        <Database className="w-3 h-3" />
                        View full record in Google Sheets
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Email template */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Document Request Email Template
          </h3>
          <button
            data-testid="button-copy-email"
            onClick={async () => {
              await navigator.clipboard.writeText(EMAIL_TEMPLATE);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy Email"}
          </button>
        </div>
        <div className="p-6">
          <pre className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed font-sans">
            {EMAIL_TEMPLATE}
          </pre>
        </div>
      </div>

      {openReport && (
        <VerificationReportModal report={openReport} onClose={() => setOpenReport(null)} />
      )}

      {showLoiForm && (
        <LoiFormModal
          business={business}
          businessId={businessId}
          onClose={() => setShowLoiForm(false)}
          onLoiCompleted={(driveData) => {
            setShowLoiForm(false);
            markLoi(true);
            if (driveData?.driveFileId) {
              setState((prev) => ({
                ...prev,
                documents: prev.documents.map((d) =>
                  d.id === "d-loi"
                    ? {
                        ...d,
                        received:              true,
                        driveFileId:           driveData.driveFileId,
                        driveFileName:         driveData.driveFileName,
                        driveViewLink:         driveData.driveViewLink,
                        confidenceScore:       driveData.confidenceScore,
                      }
                    : d
                ),
              }));
            }
          }}
        />
      )}
    </div>
  );
}
