import { useDashboard } from "@/lib/context";
import { CheckCircle2, Circle, Clock, DollarSign, Calendar, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysRemaining(iso: string): string {
  const target = new Date(iso + "T12:00:00Z");
  const diff   = Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? `${diff} days` : "Closed";
}

export default function Overview() {
  const { state, setState, business, businessId } = useDashboard();

  const toggleProgress = (id: string) => {
    setState((prev) => ({
      ...prev,
      progress: prev.progress.map((p) =>
        p.id === id ? { ...p, checked: !p.checked } : p
      ),
    }));
  };

  const completedCount = state.progress.filter((p) => p.checked).length;
  const totalCount     = state.progress.length;

  const docsReceived   = state.documents.filter((d) => d.received).length;
  const docsTotal      = state.documents.length;

  const contactsCalled = state.contacts.filter((c) => c.called).length;
  const contactsTotal  = state.contacts.length;

  const day1Done       = state.day1Items.filter((d) => d.checked).length;
  const day1Total      = state.day1Items.length;

  const stats = [
    {
      label: "Deal Stage Progress",
      value: `${completedCount}/${totalCount}`,
      pct: Math.round((completedCount / totalCount) * 100),
      color: "bg-blue-500",
      href: `/b/${businessId}`,
    },
    {
      label: "Documents Received",
      value: `${docsReceived}/${docsTotal}`,
      pct: Math.round((docsReceived / docsTotal) * 100),
      color: "bg-emerald-500",
      href: `/b/${businessId}/documents`,
    },
    {
      label: "Contacts Called",
      value: `${contactsCalled}/${contactsTotal}`,
      pct: Math.round((contactsCalled / contactsTotal) * 100),
      color: "bg-amber-500",
      href: `/b/${businessId}/contacts`,
    },
    {
      label: "Day 1 Ready",
      value: `${day1Done}/${day1Total}`,
      pct: Math.round((day1Done / day1Total) * 100),
      color: "bg-purple-500",
      href: `/b/${businessId}/day1`,
    },
  ];

  const dealBannerItems = [
    {
      icon: DollarSign,
      label: "Purchase Price",
      value: business?.dealPrice ? fmtCurrency(business.dealPrice) : "—",
    },
    ...(business?.escrowDate ? [{
      icon: Calendar,
      label: "Escrow Start",
      value: fmtDate(business.escrowDate as string),
    }] : []),
    {
      icon: Target,
      label: "Target Close",
      value: business?.targetCloseDate ? fmtDate(business.targetCloseDate) : "—",
    },
    {
      icon: Clock,
      label: "Days Remaining",
      value: business?.targetCloseDate ? daysRemaining(business.targetCloseDate) : "—",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Acquisition Overview
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          {business?.entityName ?? business?.name ?? ""}
          {business?.seller ? ` · ${business.seller}` : ""}
        </p>
      </div>

      {/* Deal Info Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {dealBannerItems.map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                <Icon className="w-4 h-4 text-primary" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-lg font-bold mt-0.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Progress Stats */}
      <div className="grid grid-cols-2 gap-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="bg-card border border-card-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow block"
            data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <div className="flex justify-between items-start mb-3">
              <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
              <span className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {s.pct}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-700", s.color)}
                style={{ width: `${s.pct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{s.value} complete</p>
          </Link>
        ))}
      </div>

      {/* Master Progress Checklist */}
      <div className="bg-card border border-card-border rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Master Status Board
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click any milestone to toggle completion
          </p>
        </div>
        <div className="p-4 space-y-2">
          {state.progress.map((item) => (
            <button
              key={item.id}
              data-testid={`progress-${item.id}`}
              onClick={() => toggleProgress(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 text-left",
                item.checked
                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                  : "bg-muted/40 hover:bg-muted text-foreground"
              )}
            >
              {item.checked ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              )}
              <span className={cn("flex-1 text-left", item.checked && "line-through opacity-70")}>
                {item.label}
              </span>
              <span className={cn(
                "ml-auto text-xs font-semibold px-2 py-0.5 rounded-full",
                item.checked
                  ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              )}>
                {item.checked ? "Done" : "Pending"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Deal Test */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-6">
        <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Deal Test — Critical Check
        </h3>
        <p className="text-sm text-amber-700 dark:text-amber-400 mb-4 font-medium">
          Can the business support all of these obligations?
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Seller Note",      value: "$2,250/mo" },
            { label: "Payroll",          value: "Full team" },
            { label: "Rent",             value: "$8,000/mo" },
            { label: "Parts & Supplies", value: "Ongoing"   },
            { label: "Your Income",      value: "Required"  },
            { label: "Debt Service",     value: "Any loans" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-600 dark:text-amber-500">{label}</p>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-amber-600 dark:text-amber-500 mt-4 font-medium">
          If NOT → renegotiate price or terms before closing
        </p>
      </div>
    </div>
  );
}
