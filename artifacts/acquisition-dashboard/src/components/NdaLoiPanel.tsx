import {
  FileText, CheckCircle2, Clock, Upload, Sparkles, ChevronRight,
  Check, Eye, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Business } from "@/lib/storage";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type NdaLoiStatus = {
  ndaReceived:  boolean;
  loiReceived:  boolean;
  loiWithNda:   boolean;
};

export type NdaLoiUploadType = "nda" | "loi" | "loi-with-nda";

// ─── Status card ──────────────────────────────────────────────────────────────

function StatusCard({
  title, subtitle, status, statusLabel, statusColor,
  onUpload, onOpenForm, isLoi, nextAction,
}: {
  title:       string;
  subtitle:    string;
  status:      "done" | "pending" | "blocked";
  statusLabel: string;
  statusColor: string;
  onUpload:    () => void;
  onOpenForm?: () => void;
  isLoi?:      boolean;
  nextAction?: string;
}) {
  return (
    <div className={cn(
      "rounded-2xl border p-5 flex flex-col gap-3 transition-all",
      status === "done"
        ? "bg-emerald-500/5 border-emerald-500/25"
        : status === "blocked"
        ? "bg-amber-500/5 border-amber-500/25"
        : "bg-card border-border"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
            status === "done" ? "bg-emerald-500/15" : "bg-muted"
          )}>
            {status === "done"
              ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              : <FileText className="w-5 h-5 text-muted-foreground" />
            }
          </div>
          <div>
            <p className="font-bold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{title}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <span className={cn("flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0", statusColor)}>
          {status === "done" ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          {statusLabel}
        </span>
      </div>

      {nextAction && status === "blocked" && (
        <div className="flex items-center gap-2 bg-amber-500/10 rounded-lg px-3 py-2">
          <ArrowRight className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">{nextAction}</p>
        </div>
      )}

      {status !== "done" && (
        <div className="flex items-center gap-2">
          {isLoi && onOpenForm && (
            <button
              onClick={onOpenForm}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary/5 text-primary border border-primary/20 hover:bg-primary/10 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" /> Fill &amp; Send LOI
            </button>
          )}
          {!isLoi && (
            <button
              onClick={onUpload}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted text-foreground/80 border border-border hover:bg-muted/80 hover:text-foreground transition-colors"
            >
              <Upload className="w-3.5 h-3.5" /> Upload Signed NDA
            </button>
          )}
        </div>
      )}

      {status === "done" && (
        <button
          onClick={isLoi ? onOpenForm : onUpload}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          {isLoi
            ? <><Eye className="w-3 h-3" /> View / Re-issue LOI</>
            : <><Upload className="w-3 h-3" /> Replace / Re-upload</>
          }
        </button>
      )}
    </div>
  );
}

// ─── Combined LOI+NDA card ────────────────────────────────────────────────────

function CombinedCard({
  onOpenForm, onUpload, bothDone,
}: {
  onOpenForm: () => void;
  onUpload:   () => void;
  bothDone:   boolean;
}) {
  if (bothDone) return null;
  return (
    <div className="col-span-2 bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-primary">LOI includes NDA clause?</p>
          <p className="text-xs text-muted-foreground">Upload once to satisfy both steps simultaneously.</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onOpenForm}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-primary bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" /> Fill &amp; Send LOI
        </button>
        <button
          onClick={onUpload}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors"
        >
          <Upload className="w-3.5 h-3.5" /> Upload Signed LOI+NDA <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main NdaLoiPanel ─────────────────────────────────────────────────────────

export default function NdaLoiPanel({
  ndaReceived,
  loiReceived,
  loiWithNda,
  business,
  onMarkNda,
  onMarkLoi,
  onMarkBoth,
  onRequestUpload,
  onOpenLoiForm,
  compact = false,
}: {
  ndaReceived:     boolean;
  loiReceived:     boolean;
  loiWithNda:      boolean;
  business?:       Business;
  onMarkNda:       (received: boolean) => void;
  onMarkLoi:       (received: boolean) => void;
  onMarkBoth:      () => void;
  onRequestUpload: (type: NdaLoiUploadType) => void;
  onOpenLoiForm:   () => void;
  compact?:        boolean;
}) {
  const bothDone = ndaReceived && loiReceived;

  const ndaStatus: "done" | "pending" | "blocked" = ndaReceived ? "done" : "pending";
  const loiStatus: "done" | "pending" | "blocked" = loiReceived ? "done" : ndaReceived ? "blocked" : "pending";

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
        <div className={cn("flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full",
          ndaReceived ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"
        )}>
          {ndaReceived ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          NDA {ndaReceived ? "Signed" : "Pending"}
        </div>
        <div className={cn("flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full",
          loiReceived ? "bg-emerald-500/15 text-emerald-600"
          : ndaReceived ? "bg-amber-500/15 text-amber-600"
          : "bg-muted text-muted-foreground"
        )}>
          {loiReceived ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          LOI {loiReceived ? "Signed" : ndaReceived ? "Next Step" : "Pending"}
        </div>
        {loiWithNda && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="w-3 h-3 text-primary" /> Combined doc
          </span>
        )}
        {!loiReceived && (
          <button
            onClick={onOpenLoiForm}
            className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Eye className="w-3 h-3" /> Fill LOI
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border" />
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider shrink-0">Deal Agreements</p>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatusCard
          title="NDA"
          subtitle="Non-Disclosure Agreement"
          status={ndaStatus}
          statusLabel={ndaReceived ? "Executed" : "Pending"}
          statusColor={ndaReceived
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            : "bg-muted text-muted-foreground"
          }
          onUpload={() => onRequestUpload("nda")}
          onOpenForm={onOpenLoiForm}
        />
        <StatusCard
          title="LOI"
          subtitle="Letter of Intent"
          status={loiStatus}
          statusLabel={loiReceived ? "Executed" : ndaReceived ? "Complete Next" : "Pending"}
          statusColor={loiReceived
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            : ndaReceived
            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
            : "bg-muted text-muted-foreground"
          }
          onUpload={() => onRequestUpload("loi")}
          onOpenForm={onOpenLoiForm}
          isLoi
          nextAction={ndaReceived && !loiReceived ? "NDA is signed — fill and send the LOI to advance the deal." : undefined}
        />

        <CombinedCard
          onOpenForm={onOpenLoiForm}
          onUpload={() => onRequestUpload("loi-with-nda")}
          bothDone={bothDone}
        />
      </div>

      {/* Both done confirmation */}
      {bothDone && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            NDA {loiWithNda ? "and LOI executed via combined document" : "and LOI both executed"}.
            Deal is authorized to proceed to full due diligence.
          </p>
          <button
            onClick={onOpenLoiForm}
            className="ml-auto text-xs text-emerald-600 hover:underline flex-shrink-0"
          >
            <Eye className="w-3 h-3 inline mr-1" />View LOI
          </button>
        </div>
      )}
    </div>
  );
}
