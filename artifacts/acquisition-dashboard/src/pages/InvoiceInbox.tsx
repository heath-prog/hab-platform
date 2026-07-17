import { useState, useRef, useCallback } from "react";
import {
  Upload, FileText, Image as ImageIcon, Archive,
  CheckCircle2, AlertTriangle, Loader2, X, ExternalLink,
  ArrowRight, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboard } from "@/lib/context";
import { apiFetch } from "@/lib/apiFetch";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

type DocResult = {
  status:        "filed" | "queued" | "error";
  vendor:        string | null;
  invoiceNumber: string | null;
  amount:        number | null;
  date:          string | null;
  confidence:    number;
  aiNote:        string;
  driveLink?:    string;
};

type ProcessingResult = {
  uploadId:   number;
  totalPages: number;
  filed:      number;
  queued:     number;
  failed:     number;
  documents:  DocResult[];
};

type ProcessStep = "idle" | "uploading" | "converting" | "analyzing" | "filing" | "done" | "error";

// ─── Processing status messages ───────────────────────────────────────────────

const STEP_MSGS: Record<ProcessStep, string> = {
  idle:       "",
  uploading:  "Uploading file to server…",
  converting: "Converting pages to images…",
  analyzing:  "AI is analyzing the pages — this may take 15–60 seconds…",
  filing:     "Filing documents to Google Drive…",
  done:       "Processing complete!",
  error:      "An error occurred during processing.",
};

// ─── File type info ───────────────────────────────────────────────────────────

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf")                    return <FileText className="w-8 h-8 text-red-400" />;
  if (ext === "jpg" || ext === "jpeg" || ext === "png") return <ImageIcon className="w-8 h-8 text-blue-400" />;
  if (ext === "zip")                    return <Archive className="w-8 h-8 text-amber-400" />;
  return <FileText className="w-8 h-8 text-muted-foreground" />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Document result card ─────────────────────────────────────────────────────

function DocCard({ doc, index }: { doc: DocResult; index: number }) {
  const isFilted = doc.status === "filed";
  const isQueued = doc.status === "queued";

  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-2",
      isFilted ? "border-emerald-500/30 bg-emerald-500/5"
      : isQueued ? "border-amber-500/30 bg-amber-500/5"
      : "border-red-500/30 bg-red-500/5"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {isFilted
            ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            : isQueued
              ? <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              : <X className="w-4 h-4 text-red-500 flex-shrink-0" />}
          <div className="min-w-0">
            <p className="font-bold text-sm truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {doc.vendor ?? `Document ${index + 1}`}
            </p>
            {doc.invoiceNumber && (
              <p className="text-xs text-muted-foreground">#{doc.invoiceNumber}</p>
            )}
          </div>
        </div>
        <span className={cn(
          "text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0",
          isFilted ? "bg-emerald-500/15 text-emerald-600"
          : isQueued ? "bg-amber-500/15 text-amber-600"
          : "bg-red-500/15 text-red-600"
        )}>
          {isFilted ? "✅ Filed" : isQueued ? "⚠️ Review" : "❌ Error"}
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {doc.amount  && <span className="font-semibold text-foreground">${doc.amount.toFixed(2)}</span>}
        {doc.date    && <span>{doc.date}</span>}
        <span className={cn(
          "font-medium",
          doc.confidence >= 80 ? "text-emerald-600" : "text-amber-600"
        )}>
          {doc.confidence}% confident
        </span>
      </div>

      {doc.aiNote && (
        <p className="text-xs text-muted-foreground leading-relaxed">{doc.aiNote}</p>
      )}

      {doc.driveLink && (
        <a
          href={doc.driveLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="w-3 h-3" /> View in Google Drive
        </a>
      )}

      {isQueued && (
        <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
          <ArrowRight className="w-3 h-3" /> Sent to review queue for manual verification
        </p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InvoiceInbox() {
  const { businessId } = useDashboard();
  const [dragOver,  setDragOver]  = useState(false);
  const [file,      setFile]      = useState<File | null>(null);
  const [step,      setStep]      = useState<ProcessStep>("idle");
  const [error,     setError]     = useState("");
  const [result,    setResult]    = useState<ProcessingResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setStep("idle");
    setResult(null);
    setError("");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleProcess = useCallback(async () => {
    if (!file) return;
    setStep("uploading");
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file",       file);
      formData.append("businessId", businessId);

      setStep("analyzing");

      const resp = await apiFetch(`${BASE}/api/documents/upload`, {
        method: "POST",
        body:   formData,
      });

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({})) as { error?: string };
        throw new Error(errBody.error ?? `Upload failed: HTTP ${resp.status}`);
      }

      const data = await resp.json() as ProcessingResult;
      setResult(data);
      setStep("done");
    } catch (err: unknown) {
      setStep("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [file, businessId]);

  const reset = () => {
    setFile(null);
    setStep("idle");
    setResult(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isProcessing = ["uploading", "converting", "analyzing", "filing"].includes(step);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Invoice Inbox
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Scan invoices into one PDF at end of day, upload here. The AI splits, extracts, and files everything automatically.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          "relative rounded-2xl border-2 border-dashed p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200",
          dragOver   ? "border-primary bg-primary/5 scale-[1.01]" :
          file       ? "border-emerald-500/50 bg-emerald-500/5"   :
                       "border-border hover:border-primary/50 hover:bg-muted/30"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !file && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.zip"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />

        {file ? (
          <div className="flex flex-col items-center gap-3 text-center">
            {getFileIcon(file.name)}
            <div>
              <p className="font-bold text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{file.name}</p>
              <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); reset(); }}
              className="text-xs text-muted-foreground hover:text-red-500 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Remove file
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Drop your scan here
              </p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse files</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> PDF</span>
              <span className="flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5" /> JPG / PNG</span>
              <span className="flex items-center gap-1"><Archive className="w-3.5 h-3.5" /> ZIP</span>
            </div>
            <p className="text-xs text-muted-foreground">Multi-page scans supported · Up to 50 MB</p>
          </div>
        )}
      </div>

      {/* Process button */}
      {file && step === "idle" && (
        <button
          onClick={handleProcess}
          className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:bg-primary/90 transition-colors"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Analyze &amp; File Documents
        </button>
      )}

      {/* Processing state */}
      {isProcessing && (
        <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <div className="text-center">
            <p className="font-bold text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {STEP_MSGS[step]}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Please keep this page open. Large batches can take up to a minute.
            </p>
          </div>
          <div className="flex gap-2">
            {(["uploading", "analyzing", "filing"] as ProcessStep[]).map((s) => (
              <div key={s} className={cn(
                "h-1.5 w-16 rounded-full transition-all",
                step === s ? "bg-primary" : ["done"].includes(step) ? "bg-primary" : "bg-muted"
              )} />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {step === "error" && error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-sm text-red-600">Processing failed</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
            {error.includes("OPENAI_API_KEY") && (
              <p className="text-xs text-amber-600 mt-2 font-medium">
                Set the OPENAI_API_KEY environment secret to enable AI processing.
              </p>
            )}
          </div>
          <button onClick={reset} className="text-muted-foreground hover:text-foreground">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Results */}
      {result && step === "done" && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-bold text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Processing Complete
            </h3>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-500">{result.filed}</p>
                <p className="text-xs text-muted-foreground">Filed automatically</p>
              </div>
              {result.queued > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-500">{result.queued}</p>
                  <p className="text-xs text-muted-foreground">Sent to review</p>
                </div>
              )}
              {result.failed > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-500">{result.failed}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              )}
            </div>
            {result.queued > 0 && (
              <p className="text-sm text-amber-600 font-medium">
                ⚠️ {result.queued} document{result.queued > 1 ? "s" : ""} need your attention — check the Review Queue in the sidebar.
              </p>
            )}
          </div>

          {/* Per-document cards */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Documents Found
            </p>
            {result.documents.map((doc, i) => (
              <DocCard key={i} doc={doc} index={i} />
            ))}
          </div>

          <button
            onClick={reset}
            className="w-full py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            Upload Another Batch
          </button>
        </div>
      )}

      {/* Tips */}
      {step === "idle" && !file && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tips for best results</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold flex-shrink-0">1.</span>
              Scan all invoices at the end of day into one multi-page PDF using your office scanner or phone app.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold flex-shrink-0">2.</span>
              Make sure each invoice is a complete page — don't cut off headers or totals.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold flex-shrink-0">3.</span>
              The AI will split the batch, extract vendor / amount / date, and file each invoice to Google Drive automatically.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold flex-shrink-0">4.</span>
              Anything the AI isn't sure about (under 80% confidence) goes to the Review Queue for your approval.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
