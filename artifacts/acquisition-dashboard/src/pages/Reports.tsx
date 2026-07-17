import { useState } from "react";
import {
  FileText, TrendingUp, BarChart3, Building2, DollarSign,
  Users, ArrowUpRight, Lock, Download, Eye, Sparkles,
  AlertCircle, ChevronRight, X, Calendar, Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ReportAudience = "Internal" | "Lender" | "Investor" | "Exit Partner" | "CPA";
type ReportStatus = "available" | "locked" | "no-data";

type ReportDef = {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  audience: ReportAudience[];
  frequency: string;
  status: ReportStatus;
  lastGenerated?: string;
  preview: string[];
};

const REPORTS: ReportDef[] = [
  {
    id: "flash",
    icon: Sparkles,
    title: "Daily Flash Report",
    description: "Today's revenue, car count, and ARO snapshot — your morning brief on shop performance.",
    audience: ["Internal"],
    frequency: "Daily",
    status: "no-data",
    preview: ["Today's Revenue: $—", "Car Count: — tickets", "ARO: $—", "Gross Profit: —%"],
  },
  {
    id: "weekly",
    icon: TrendingUp,
    title: "Weekly Operator Scorecard",
    description: "7-day KPI performance vs targets with trend arrows and week-over-week comparison.",
    audience: ["Internal"],
    frequency: "Weekly",
    status: "no-data",
    preview: ["Revenue 7-Day: $—", "Cars Served: —", "ARO vs Target: —", "Gross Margin: —%"],
  },
  {
    id: "monthly",
    icon: FileText,
    title: "Monthly Management Report",
    description: "Full P&L with period comparison, expense analysis, and operational KPI summary.",
    audience: ["Internal", "CPA"],
    frequency: "Monthly",
    status: "no-data",
    preview: ["Full P&L Statement", "vs Prior Month", "vs Budget/Target", "Expense Breakdown"],
  },
  {
    id: "lender",
    icon: Building2,
    title: "Lender Financial Summary",
    description: "Bank and SBA-ready financial package with debt service coverage and key ratios.",
    audience: ["Lender"],
    frequency: "Monthly / On-Demand",
    status: "locked",
    preview: ["DSCR Calculation", "Revenue Trend", "Adjusted EBITDA", "Balance Sheet Summary"],
  },
  {
    id: "investor",
    icon: Users,
    title: "Investor Update Report",
    description: "PE-grade quarterly performance summary with narrative, metrics, and forward outlook.",
    audience: ["Investor"],
    frequency: "Quarterly",
    status: "locked",
    preview: ["Quarterly KPIs", "EBITDA vs Budget", "Strategic Highlights", "90-Day Outlook"],
  },
  {
    id: "ebitda",
    icon: DollarSign,
    title: "Normalized EBITDA Report",
    description: "Adjusted EBITDA with add-backs documented — critical for lender and sale conversations.",
    audience: ["Lender", "Investor", "Exit Partner"],
    frequency: "On-Demand",
    status: "locked",
    preview: ["Owner Comp Add-Back", "Non-Recurring Items", "Normalized EBITDA", "TTM View"],
  },
  {
    id: "acquisition-ready",
    icon: Target,
    title: "Acquisition Readiness Report",
    description: "Financial package for the next acquisition — demonstrates operating track record.",
    audience: ["Lender"],
    frequency: "On-Demand",
    status: "locked",
    preview: ["Operating History", "Cash Flow Proof", "Entity Structure", "Expansion Thesis"],
  },
  {
    id: "expense",
    icon: BarChart3,
    title: "Expense Trend Analysis",
    description: "Cost center deep-dive with vendor concentration, recurring vs variable, and anomalies.",
    audience: ["Internal", "CPA"],
    frequency: "Monthly",
    status: "no-data",
    preview: ["Top 10 Vendors", "Fixed vs Variable", "Month-over-Month", "Anomaly Flags"],
  },
  {
    id: "exit",
    icon: ArrowUpRight,
    title: "Exit Readiness Report",
    description: "Enterprise value multiples, sale readiness checklist, and buyer-ready diligence package.",
    audience: ["Exit Partner", "Investor"],
    frequency: "On-Demand",
    status: "locked",
    preview: ["EV/EBITDA Multiple", "TTM Revenue", "Readiness Score", "Data Room Status"],
  },
];

const AUDIENCE_COLORS: Record<ReportAudience, string> = {
  Internal:       "bg-slate-500/15 text-slate-500 border-slate-500/20",
  Lender:         "bg-blue-500/15 text-blue-600 border-blue-500/20",
  Investor:       "bg-violet-500/15 text-violet-600 border-violet-500/20",
  CPA:            "bg-amber-500/15 text-amber-600 border-amber-500/20",
  "Exit Partner": "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",
};

function AudienceBadge({ audience }: { audience: ReportAudience }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", AUDIENCE_COLORS[audience])}>
      {audience}
    </span>
  );
}

function ReportCard({ report, onPreview }: { report: ReportDef; onPreview: (r: ReportDef) => void }) {
  const { icon: Icon, title, description, audience, frequency, status } = report;
  const isLocked   = status === "locked";
  const isNoData   = status === "no-data";
  const isAvail    = status === "available";

  return (
    <div className={cn(
      "bg-card rounded-xl border p-5 flex flex-col gap-4 transition-shadow hover:shadow-md",
      isLocked ? "border-border opacity-70" : "border-border",
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
          isLocked ? "bg-muted" : "bg-primary/10"
        )}>
          {isLocked
            ? <Lock className="w-4.5 h-4.5 text-muted-foreground" />
            : <Icon className="w-4.5 h-4.5 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {audience.map((a) => <AudienceBadge key={a} audience={a} />)}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
          <Calendar className="w-3 h-3" /> {frequency}
        </span>
      </div>

      <div className="flex gap-2 mt-auto">
        <button
          onClick={() => onPreview(report)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"
        >
          <Eye className="w-3.5 h-3.5" /> Preview
        </button>
        <button
          disabled={isLocked || isNoData}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors",
            isAvail
              ? "bg-primary text-white hover:bg-primary/90"
              : isNoData
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          {isLocked ? (
            <><Lock className="w-3.5 h-3.5" /> Locked</>
          ) : isNoData ? (
            <><AlertCircle className="w-3.5 h-3.5" /> No Data</>
          ) : (
            <><Download className="w-3.5 h-3.5" /> Generate</>
          )}
        </button>
      </div>
    </div>
  );
}

function PreviewModal({ report, onClose }: { report: ReportDef; onClose: () => void }) {
  const { icon: Icon, title, description, audience, frequency, status, preview } = report;
  const isLocked = status === "locked";
  const isNoData = status === "no-data";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{title}</h2>
              <p className="text-xs text-muted-foreground">{frequency}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-muted-foreground">{description}</p>

          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs font-medium text-muted-foreground mr-1">Audience:</span>
            {audience.map((a) => <AudienceBadge key={a} audience={a} />)}
          </div>

          <div className="bg-muted/40 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Report Contains</p>
            {preview.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <ChevronRight className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span className={cn("text-sm", (isLocked || isNoData) && "text-muted-foreground/50")}>{item}</span>
              </div>
            ))}
          </div>

          {isLocked && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <Lock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-600">
                This report unlocks after Financial Management is activated and data sources are connected.
              </p>
            </div>
          )}
          {isNoData && !isLocked && (
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-600">
                Connect data sources (Tekmetric, QuickBooks, bank feed) in Financial Management to generate this report.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const [preview, setPreview] = useState<ReportDef | null>(null);
  const [filterAudience, setFilterAudience] = useState<ReportAudience | "all">("all");

  const audiences: ReportAudience[] = ["Internal", "Lender", "Investor", "CPA", "Exit Partner"];

  const filtered = filterAudience === "all"
    ? REPORTS
    : REPORTS.filter((r) => r.audience.includes(filterAudience));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Reports & Analytics
        </h1>
        <p className="text-sm text-muted-foreground">
          CFO-grade reporting for internal operations, lenders, investors, and future exit conversations.
        </p>
      </div>

      {/* Status banner */}
      <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-600">Connect data sources to unlock reports</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Activate Financial Management and connect Tekmetric, QuickBooks, and your bank feed to generate live reports.
          </p>
        </div>
      </div>

      {/* Audience filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground mr-1">Filter by audience:</span>
        {(["all", ...audiences] as const).map((a) => (
          <button
            key={a}
            onClick={() => setFilterAudience(a as ReportAudience | "all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              filterAudience === a
                ? "bg-primary text-white border-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {a === "all" ? "All Reports" : a}
          </button>
        ))}
      </div>

      {/* Report grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((r) => (
          <ReportCard key={r.id} report={r} onPreview={setPreview} />
        ))}
      </div>

      {/* Traceability info */}
      <div className="bg-card rounded-xl border border-border p-5 flex items-start gap-3">
        <TrendingUp className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Source-Traceable Reporting
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every metric in every report is traceable to its source — from the report number back to the original document or
            data feed. This audit-ready structure supports lender trust, investor confidence, and future sale due diligence.
          </p>
        </div>
      </div>

      {preview && <PreviewModal report={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
