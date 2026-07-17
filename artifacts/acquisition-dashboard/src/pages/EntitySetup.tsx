import { useDashboard } from "@/lib/context";
import { CheckCircle2, Circle, Lock, Building2, FileText, Landmark, Receipt, BadgeCheck, ShieldCheck, AlertTriangle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { ENTITY_SETUP_BLOCKED_IDS } from "@/lib/storage";

const TASK_ICONS = [Building2, FileText, Landmark, Receipt, BadgeCheck, ShieldCheck];

const TASK_DETAILS: { why: string; resource?: string }[] = [
  {
    why: "You cannot legally operate the business, sign contracts, or hold licenses as an individual. You need a new LLC or corporation registered with the California Secretary of State before close.",
    resource: "bizfileonline.sos.ca.gov",
  },
  {
    why: "Your EIN is your business's tax ID — required to open a bank account, hire employees, and file taxes. Apply free online at IRS.gov. Usually issued instantly.",
    resource: "irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online",
  },
  {
    why: "All business income must flow through a bank account in the new entity's name. Keeps personal and business finances separate — legally required and essential for bookkeeping.",
  },
  {
    why: "You need a California seller's permit (CDTFA) to charge sales tax and a county business license. The CDTFA registration also triggers a tax clearance review on the seller's liability.",
    resource: "cdtfa.ca.gov",
  },
  {
    why: "The BAR (Bureau of Automotive Repair) license must be re-applied for under the new entity — it does not automatically transfer. File early; this can take 4–8 weeks.",
    resource: "bar.ca.gov",
  },
  {
    why: "General liability, workers' comp, and garage liability policies must be bound in the new entity's name before you can legally operate. Ask your broker to bind at close.",
  },
];

const BLOCKED_LABEL: Record<string, string> = {
  p5: "Legal Docs",
  p6: "Licenses (BAR etc.)",
  p7: "Insurance",
  p8: "Closing Ready",
};

export default function EntitySetup() {
  const { state, setState, business } = useDashboard();
  const isAssetPurchase = business?.acquisitionType === "asset";

  const items  = state.entitySetupItems;
  const done   = items.filter((i) => i.checked).length;
  const total  = items.length;
  const allDone = done === total;
  const pct    = Math.round((done / total) * 100);

  const toggle = (id: string) => {
    setState((prev) => ({
      ...prev,
      entitySetupItems: prev.entitySetupItems.map((i) =>
        i.id === id ? { ...i, checked: !i.checked } : i
      ),
    }));
  };

  const updateNotes = (id: string, notes: string) => {
    setState((prev) => ({
      ...prev,
      entitySetupItems: prev.entitySetupItems.map((i) =>
        i.id === id ? { ...i, notes } : i
      ),
    }));
  };

  return (
    <div className="space-y-8 max-w-3xl">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className={cn(
            "w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0",
            allDone ? "bg-emerald-100" : "bg-red-100"
          )}>
            {allDone
              ? <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              : <Lock className="w-6 h-6 text-red-500" />
            }
          </div>
          <div>
            <h2 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              New Entity Setup
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Required for asset purchases — must complete before closing milestones unlock
            </p>
          </div>
        </div>
      </div>

      {/* Deal type notice */}
      {!isAssetPurchase && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 flex gap-4 items-start">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">Deal type not set to Asset Purchase</p>
            <p className="text-sm text-amber-700 mt-1">
              This checklist is mandatory for asset purchases. If your deal is structured as a stock purchase,
              you can skip this — but confirm with your attorney first.
            </p>
          </div>
        </div>
      )}

      {/* Status banner */}
      <div className={cn(
        "rounded-2xl border-2 p-5",
        allDone
          ? "border-emerald-300 bg-emerald-50"
          : "border-red-300 bg-red-50"
      )}>
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <p className={cn("font-bold text-lg", allDone ? "text-emerald-800" : "text-red-800")}
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {allDone
                ? "🎉 Entity Setup Complete — Closing Milestones Unlocked"
                : `🔒 ${done} of ${total} tasks complete — Closing milestones are BLOCKED`
              }
            </p>
            {!allDone && (
              <p className="text-sm text-red-700 mt-1">
                The following milestones on your Master Status Board cannot be marked complete until all entity setup tasks are done:
              </p>
            )}
          </div>
          <div className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl font-bold",
            allDone ? "bg-emerald-200 text-emerald-800" : "bg-red-200 text-red-800"
          )} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {pct}%
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-3 bg-white/60 rounded-full overflow-hidden mb-3">
          <div
            className={cn("h-full rounded-full transition-all duration-700", allDone ? "bg-emerald-500" : "bg-red-500")}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Blocked milestones list */}
        {!allDone && (
          <div className="flex flex-wrap gap-2 mt-2">
            {ENTITY_SETUP_BLOCKED_IDS.map((id) => (
              <div key={id} className="flex items-center gap-1.5 bg-red-100 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-red-200">
                <Lock className="w-3 h-3" />
                {BLOCKED_LABEL[id] ?? id}
              </div>
            ))}
            <Link
              href=".."
              className="flex items-center gap-1 text-xs text-red-600 font-semibold hover:underline pl-1"
            >
              View on Master Status Board <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>

      {/* Task checklist */}
      <div className="space-y-4">
        <h3 className="font-semibold text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Entity Setup Tasks
        </h3>

        {items.map((item, idx) => {
          const Icon = TASK_ICONS[idx] ?? Building2;
          const detail = TASK_DETAILS[idx];
          return (
            <div
              key={item.id}
              className={cn(
                "rounded-2xl border-2 p-5 transition-all",
                item.checked
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-border bg-card"
              )}
            >
              <div className="flex gap-4">
                {/* Icon */}
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5",
                  item.checked ? "bg-emerald-100" : "bg-muted"
                )}>
                  <Icon className={cn("w-5 h-5", item.checked ? "text-emerald-600" : "text-muted-foreground")} />
                </div>

                <div className="flex-1 min-w-0">
                  {/* Checkbox + label row */}
                  <button
                    onClick={() => toggle(item.id)}
                    className="flex items-start gap-3 w-full text-left group"
                  >
                    {item.checked
                      ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      : <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                    }
                    <span className={cn(
                      "font-semibold text-sm leading-snug",
                      item.checked ? "text-emerald-700 line-through opacity-70" : "text-foreground"
                    )}>
                      {item.label}
                    </span>
                  </button>

                  {/* Why this matters */}
                  {detail?.why && (
                    <p className="text-xs text-muted-foreground mt-2 ml-8 leading-relaxed">
                      {detail.why}
                    </p>
                  )}

                  {/* Resource link */}
                  {detail?.resource && (
                    <p className="text-xs text-primary mt-1 ml-8 font-medium">
                      → {detail.resource}
                    </p>
                  )}

                  {/* Notes input */}
                  <div className="mt-3 ml-8">
                    <input
                      type="text"
                      value={item.notes ?? ""}
                      onChange={(e) => updateNotes(item.id, e.target.value)}
                      placeholder="Add a note, date, or reference number…"
                      className="w-full text-xs bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-primary text-muted-foreground placeholder:text-muted-foreground/50"
                    />
                  </div>
                </div>

                {/* Status badge */}
                <div className="flex-shrink-0">
                  <span className={cn(
                    "text-xs font-bold px-2.5 py-1 rounded-full",
                    item.checked
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-600"
                  )}>
                    {item.checked ? "Done" : "Required"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* What happens when complete */}
      <div className="rounded-2xl border border-border bg-muted/30 p-5 space-y-3">
        <h3 className="font-semibold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          When all tasks are done:
        </h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {[
            "Legal Docs milestone unlocks on the Master Status Board",
            "Licenses (BAR etc.) milestone unlocks",
            "Insurance milestone unlocks",
            "Closing Ready milestone unlocks — you can advance to close",
            "Closing readiness score increases in workflow analysis",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
}
