import { useState, useCallback, useRef } from "react";
import { BlobProvider } from "@react-pdf/renderer";
import { useForm } from "react-hook-form";
import {
  X, Download, Send, Upload, CheckCircle2, AlertTriangle, ArrowLeft,
  ArrowRight, FileText, Mail, RefreshCw, Eye, ChevronRight,
  Loader2, Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LoiDocument, DEFAULT_LOI_DATA, type LoiData } from "./LoiDocument";
import type { Business } from "@/lib/storage";
import {
  uploadDocumentToN8n, getWebhookUrl, getDriveFolderPath, getDriveFileName,
  WEBHOOK_KEY_DOC_INTAKE, PORTFOLIO_ID, PORTFOLIO_NAME, BUYER_NAME,
  type DocumentIntakeResponse,
} from "@/lib/documentPipeline";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type LoiFormModalProps = {
  business?:      Business;
  businessId:     string;
  onClose:        () => void;
  onLoiCompleted: (data: DocumentIntakeResponse | null) => void;
};

type Step = "form" | "preview" | "upload";

// ─── Helper: blob → base64 ────────────────────────────────────────────────────

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onloadend = () => res((r.result as string).split(",")[1]);
    r.onerror   = rej;
    r.readAsDataURL(blob);
  });
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepBar({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "form",    label: "Fill & Review" },
    { id: "preview", label: "PDF & Send"    },
    { id: "upload",  label: "Return Upload" },
  ];
  const idx = steps.findIndex((s) => s.id === step);
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
            i === idx   ? "bg-primary text-white"
            : i < idx   ? "bg-emerald-500/15 text-emerald-600"
            : "text-muted-foreground"
          )}>
            {i < idx
              ? <CheckCircle2 className="w-3 h-3" />
              : <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center text-[10px] leading-none"
                  style={{ borderColor: i === idx ? "white" : "currentColor" }}>
                  {i + 1}
                </span>
            }
            {s.label}
          </div>
          {i < steps.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-border mx-1" />}
        </div>
      ))}
    </div>
  );
}

// ─── Section divider ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-2 pb-1">
      <div className="h-px flex-1 bg-border" />
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider shrink-0">{children}</p>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// ─── Field component ──────────────────────────────────────────────────────────

function Field({
  label, children, hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-foreground/80">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const inputCls = "w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground";

// ─── Step 1: Form ─────────────────────────────────────────────────────────────

function FormStep({
  form, onNext,
}: {
  form: ReturnType<typeof useForm<LoiData>>;
  onNext: () => void;
}) {
  const { register, watch } = form;
  const pp = watch("purchasePrice") ?? 0;
  const id = watch("initialDeposit") ?? 0;

  return (
    <div className="space-y-4 flex-1 overflow-y-auto px-1">
      <SectionLabel>Parties</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Buyer Entity">
          <input {...register("buyerEntity")} className={inputCls} />
        </Field>
        <Field label="Buyer Name">
          <input {...register("buyerName")} className={inputCls} />
        </Field>
        <Field label="Buyer Title">
          <input {...register("buyerTitle")} className={inputCls} />
        </Field>
        <Field label="Buyer Email">
          <input {...register("buyerEmail")} type="email" className={inputCls} />
        </Field>
        <Field label="Seller Name">
          <input {...register("sellerName")} className={inputCls} />
        </Field>
        <Field label="Seller Entity (Business)">
          <input {...register("sellerEntity")} className={inputCls} />
        </Field>
        <Field label="Seller Title" hint="Leave blank for signature line">
          <input {...register("sellerTitle")} className={inputCls} placeholder="(blank = signature line)" />
        </Field>
        <Field label="Seller Email" hint="Used to send the LOI">
          <input {...register("sellerEmail")} type="email" className={inputCls} placeholder="seller@example.com" />
        </Field>
      </div>

      <SectionLabel>Deal Structure</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Transaction Type">
          <select {...register("transactionType")} className={inputCls}>
            <option value="Stock Purchase">Stock Purchase</option>
            <option value="Asset Purchase">Asset Purchase</option>
            <option value="Membership Interest Purchase">Membership Interest Purchase</option>
          </select>
        </Field>
        <Field label="Total Purchase Price ($)">
          <input {...register("purchasePrice", { valueAsNumber: true })} type="number" className={inputCls} />
        </Field>
        <Field label="Initial Deposit ($)" hint={pp > 0 ? `${Math.round((id / pp) * 100)}% of purchase price` : undefined}>
          <input {...register("initialDeposit", { valueAsNumber: true })} type="number" className={inputCls} />
        </Field>
        <Field label="Deposit Deadline">
          <input {...register("depositDeadline")} className={inputCls} placeholder="May 16, 2026" />
        </Field>
        <Field label="Escrow Period (days)">
          <input {...register("escrowPeriodDays", { valueAsNumber: true })} type="number" className={inputCls} />
        </Field>
        <Field label="Target Close Date">
          <input {...register("targetCloseDate")} className={inputCls} placeholder="July 16, 2026" />
        </Field>
        <Field label="LOI Acceptance Deadline">
          <input {...register("acceptanceDeadline")} className={inputCls} placeholder="April 15, 2026" />
        </Field>
      </div>

      <SectionLabel>Seller Financing</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Seller Note Balance ($)" hint={pp > 0 ? `Remaining after down payment` : undefined}>
          <input {...register("sellerNoteBalance", { valueAsNumber: true })} type="number" className={inputCls} />
        </Field>
        <Field label="Term">
          <input {...register("sellerNoteTerm")} className={inputCls} placeholder="Up to 10 years (120 months)" />
        </Field>
        <Field label="Monthly Payment ($)">
          <input {...register("monthlyPayment", { valueAsNumber: true })} type="number" className={inputCls} />
        </Field>
        <Field label="Grace Day of Month">
          <input {...register("graceDay", { valueAsNumber: true })} type="number" className={inputCls} min={1} max={31} />
        </Field>
        <Field label="Late Fee (%)">
          <input {...register("lateFeePercent", { valueAsNumber: true })} type="number" className={inputCls} min={0} max={100} />
        </Field>
        <Field label="Exclusivity Period (days)">
          <input {...register("exclusivityDays", { valueAsNumber: true })} type="number" className={inputCls} />
        </Field>
      </div>

      <SectionLabel>Transition & Other</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Consulting Compensation ($/month)">
          <input {...register("consultingMonthly", { valueAsNumber: true })} type="number" className={inputCls} />
        </Field>
      </div>

      {/* Spacer */}
      <div className="pb-4" />
    </div>
  );
}

// ─── Step 2: Preview + Send ────────────────────────────────────────────────────

function PreviewStep({
  data, businessId, onBack, onSent, onSkipToUpload,
}: {
  data:           LoiData;
  businessId:     string;
  onBack:         () => void;
  onSent:         () => void;
  onSkipToUpload: () => void;
}) {
  const [emailState, setEmailState]   = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [emailErr,   setEmailErr]     = useState("");
  const [customMsg,  setCustomMsg]    = useState(
    `Hi ${data.sellerName},\n\nPlease find attached the Letter of Intent for the proposed acquisition of ${data.sellerEntity}. Please review, sign, and return at your earliest convenience — acceptance requested by ${data.acceptanceDeadline}.\n\nThank you,\n${data.buyerName}\n${data.buyerEntity}`
  );

  const sendEmail = useCallback(async (blob: Blob) => {
    if (!data.sellerEmail) {
      setEmailErr("No seller email address set — go back and fill it in.");
      setEmailState("error");
      return;
    }
    setEmailState("sending");
    setEmailErr("");
    try {
      const base64 = await blobToBase64(blob);
      const filename = `LOI_${data.sellerEntity.replace(/\s+/g, "_")}.pdf`;
      const resp = await fetch("/api/email/send-loi", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          to:        data.sellerEmail,
          subject:   `Letter of Intent — ${data.sellerEntity} Acquisition`,
          body:      customMsg,
          pdfBase64: base64,
          filename,
        }),
      });
      const json = await resp.json() as { success?: boolean; error?: string; fallback?: string };

      if (json.fallback === "mailto") {
        // API not configured — open mailto
        const subject = encodeURIComponent(`Letter of Intent — ${data.sellerEntity} Acquisition`);
        const body    = encodeURIComponent(customMsg);
        window.open(`mailto:${data.sellerEmail}?subject=${subject}&body=${body}`, "_blank");
        // Also trigger download so they can attach manually
        const url = URL.createObjectURL(blob);
        const a   = document.createElement("a");
        a.href    = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setEmailState("sent");
        setTimeout(onSent, 1500);
        return;
      }

      if (!resp.ok || json.error) {
        throw new Error(json.error ?? `HTTP ${resp.status}`);
      }
      setEmailState("sent");
      setTimeout(onSent, 1500);
    } catch (e) {
      setEmailErr(String(e));
      setEmailState("error");
    }
  }, [data, customMsg, onSent]);

  const downloadPdf = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href    = url;
    a.download = `LOI_${data.sellerEntity.replace(/\s+/g, "_")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data.sellerEntity]);

  return (
    <BlobProvider document={<LoiDocument data={data} />}>
      {({ blob, url, loading, error }) => (
        <div className="flex flex-col gap-5 flex-1 overflow-hidden">
          {/* PDF preview iframe */}
          <div className="flex-1 rounded-xl border border-border overflow-hidden bg-muted/30 relative min-h-[300px]">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <span className="text-sm text-muted-foreground ml-2">Generating PDF…</span>
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <span className="text-sm text-red-500 ml-2">PDF render error: {String(error)}</span>
              </div>
            )}
            {url && !loading && (
              <iframe src={url} className="w-full h-full" title="LOI Preview" />
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3 flex-shrink-0">
            {/* Email compose */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                <p className="text-sm font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Send to {data.sellerName}
                  {data.sellerEmail && <span className="font-normal text-muted-foreground ml-1.5">({data.sellerEmail})</span>}
                </p>
              </div>

              <textarea
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                rows={4}
                className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground/80 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              />

              {emailErr && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {emailErr}
                </p>
              )}

              <div className="flex items-center gap-2">
                {blob && (
                  <button
                    onClick={() => downloadPdf(blob)}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-border bg-muted text-foreground/80 hover:bg-muted/80 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Download PDF
                  </button>
                )}
                <div className="flex-1" />
                <button
                  onClick={onSkipToUpload}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip — already sent externally
                </button>
                {blob && emailState !== "sent" && (
                  <button
                    onClick={() => sendEmail(blob)}
                    disabled={emailState === "sending" || loading}
                    className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
                  >
                    {emailState === "sending"
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</>
                      : <><Send className="w-3.5 h-3.5" /> Send to Seller</>
                    }
                  </button>
                )}
                {emailState === "sent" && (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" /> Sent!
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </BlobProvider>
  );
}

// ─── Step 3: Upload Signed Return ─────────────────────────────────────────────

function UploadStep({
  businessId, loiData, onBack, onCompleted,
}: {
  businessId: string;
  loiData:    LoiData;
  onBack:     () => void;
  onCompleted:(data: DocumentIntakeResponse | null) => void;
}) {
  const [file,        setFile]        = useState<File | null>(null);
  const [uploading,   setUploading]   = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [result,      setResult]      = useState<DocumentIntakeResponse | null>(null);
  const [error,       setError]       = useState("");
  const [dragging,    setDragging]    = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === "application/pdf" || f?.name.endsWith(".pdf")) setFile(f);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) return;
    const webhookUrl = getWebhookUrl(WEBHOOK_KEY_DOC_INTAKE);
    if (!webhookUrl) {
      // No webhook configured — mark locally and skip n8n
      setResult({ verificationStatus: "received", summary: "LOI filed locally (no n8n webhook configured)" });
      onCompleted(null);
      return;
    }
    setUploading(true);
    setProgress(0);
    setError("");
    try {
      const driveFolder = getDriveFolderPath(PORTFOLIO_NAME, loiData.sellerEntity, "loi");
      const driveFile   = getDriveFileName(loiData.sellerEntity, "LOI (Signed)", "d-loi");
      const resp = await uploadDocumentToN8n(
        webhookUrl,
        {
          file,
          portfolioId:     PORTFOLIO_ID,
          portfolioName:   PORTFOLIO_NAME,
          businessId,
          businessName:    loiData.sellerEntity,
          dealId:          businessId,
          dealName:        `${loiData.sellerEntity} Acquisition`,
          documentId:      "d-loi",
          documentType:    "LOI (Signed — Seller Return)",
          workflowStage:   "loi",
          acquisitionType: loiData.transactionType,
          buyerName:       loiData.buyerName,
          sellerName:      loiData.sellerName,
          uploadedBy:      loiData.buyerName,
          uploadDate:      new Date().toISOString(),
          targetCloseDate: loiData.targetCloseDate,
          driveFolderPath: driveFolder,
          driveFileName:   driveFile,
        },
        setProgress
      );
      setResult(resp);
      onCompleted(resp);
    } catch (e) {
      setError(String(e));
      setUploading(false);
    }
  }, [file, businessId, loiData, onCompleted]);

  if (result) {
    return (
      <div className="flex flex-col items-center gap-5 py-10">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-lg font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            LOI Filed &amp; Verified
          </h3>
          <p className="text-sm text-muted-foreground">
            Signed copy received. The LOI step is now complete.
          </p>
          {result.driveViewLink && (
            <a
              href={result.driveViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs text-primary hover:underline mt-2"
            >
              <Eye className="w-3.5 h-3.5" /> View in Google Drive
            </a>
          )}
          {result.summary && (
            <p className="text-xs text-muted-foreground mt-2 italic">{result.summary}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 flex-1">
      <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3 flex items-start gap-2">
        <Paperclip className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Once {loiData.sellerName} signs and returns the LOI, upload the signed PDF here. This will mark the LOI step complete and file it to Google Drive via n8n.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all",
          dragging  ? "border-primary bg-primary/5"
          : file    ? "border-emerald-500 bg-emerald-500/5"
          : "border-border hover:border-primary/50 hover:bg-muted/30"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }}
        />
        {file
          ? <><FileText className="w-8 h-8 text-emerald-500" /><p className="font-semibold text-sm text-emerald-600">{file.name}</p><p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB — click to change</p></>
          : <><Upload className="w-8 h-8 text-muted-foreground" /><p className="text-sm font-medium text-muted-foreground">Drop signed LOI PDF here or click to browse</p></>
        }
      </div>

      {uploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Uploading to n8n → Google Drive…</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-500/8 border border-red-500/20 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex-1" />
        <button
          onClick={() => onCompleted(null)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Mark complete without uploading
        </button>
        {file && !uploading && (
          <button
            onClick={handleUpload}
            className="flex items-center gap-1.5 text-sm font-bold px-5 py-2.5 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4" /> File &amp; Complete LOI
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main modal ────────────────────────────────────────────────────────────────

export default function LoiFormModal({ business, businessId, onClose, onLoiCompleted }: LoiFormModalProps) {
  const [step, setStep] = useState<Step>("form");

  // Seed form from business data
  const defaultValues: LoiData = {
    ...DEFAULT_LOI_DATA,
    sellerName:      business?.seller      ?? DEFAULT_LOI_DATA.sellerName,
    sellerEntity:    business?.name        ?? DEFAULT_LOI_DATA.sellerEntity,
    sellerEmail:     "",
    buyerEntity:     business?.entityName  ?? DEFAULT_LOI_DATA.buyerEntity,
    buyerName:       business?.buyer       ?? DEFAULT_LOI_DATA.buyerName,
    purchasePrice:   business?.dealPrice   ?? DEFAULT_LOI_DATA.purchasePrice,
    targetCloseDate: business?.targetCloseDate
      ? new Date(business.targetCloseDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : DEFAULT_LOI_DATA.targetCloseDate,
    sellerNoteBalance: business?.dealPrice
      ? Math.round(business.dealPrice * 0.9)
      : DEFAULT_LOI_DATA.sellerNoteBalance,
  };

  const form = useForm<LoiData>({ defaultValues });
  const formData = form.watch();

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-3xl shadow-2xl flex flex-col"
        style={{ height: "min(92vh, 900px)" }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Letter of Intent
              </h3>
              <p className="text-xs text-muted-foreground">
                {business?.name ?? "Acquisition"} · HAB Enterprises 3 LLC
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <StepBar step={step} />
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden flex flex-col px-6 py-5 gap-4">

          {step === "form" && (
            <>
              <FormStep form={form} onNext={() => setStep("preview")} />
              <div className="flex items-center justify-end flex-shrink-0 pt-2 border-t border-border">
                <button
                  onClick={() => setStep("preview")}
                  className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors shadow-sm"
                >
                  Preview &amp; Generate PDF <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {step === "preview" && (
            <>
              <PreviewStep
                data={formData}
                businessId={businessId}
                onBack={() => setStep("form")}
                onSent={() => setStep("upload")}
                onSkipToUpload={() => setStep("upload")}
              />
              <div className="flex items-center justify-start flex-shrink-0 pt-2 border-t border-border">
                <button
                  onClick={() => setStep("form")}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Edit Form
                </button>
              </div>
            </>
          )}

          {step === "upload" && (
            <UploadStep
              businessId={businessId}
              loiData={formData}
              onBack={() => setStep("preview")}
              onCompleted={(d) => { onLoiCompleted(d); }}
            />
          )}

        </div>
      </div>
    </div>
  );
}
