import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const risks = [
  {
    id: "r1",
    risk: "Hidden Debt",
    severity: "High" as const,
    action: "Verify UCC search + financials",
    detail: "Run a UCC lien search on the business entity and seller. Cross-reference all disclosed liabilities against bank statements and tax returns.",
  },
  {
    id: "r2",
    risk: "Lease Issues",
    severity: "High" as const,
    action: "Secure landlord approval",
    detail: "Confirm landlord will approve assignment. Negotiate favorable terms before closing. A failed lease assignment can kill the deal.",
  },
  {
    id: "r3",
    risk: "License Transfer Delay",
    severity: "High" as const,
    action: "Call BAR early — 4-6 week lead time",
    detail: "BAR license transfers require new owner application. Start the process immediately. Operating without a license is illegal.",
  },
  {
    id: "r4",
    risk: "Overstated Revenue",
    severity: "High" as const,
    action: "Validate bank deposits vs reported revenue",
    detail: "Compare bank deposits to stated revenue for all 12 months. Significant gaps indicate understated income or inflated claims.",
  },
  {
    id: "r5",
    risk: "Employee Walkout",
    severity: "Medium" as const,
    action: "Build communication plan for ownership transition",
    detail: "Key technicians are the business. Plan your intro, retention conversation, and what you'll maintain/improve for staff.",
  },
  {
    id: "r6",
    risk: "Tax Liabilities (CDTFA/EDD)",
    severity: "High" as const,
    action: "Request tax clearance certificates",
    detail: "California CDTFA and EDD liabilities can attach to the business and follow a new owner. Get clearance before close.",
  },
  {
    id: "r7",
    risk: "Equipment Failure",
    severity: "Medium" as const,
    action: "Inspect all equipment before close",
    detail: "Have a trusted mechanic or shop owner inspect all major equipment (lifts, alignment, diagnostic tools) for condition and age.",
  },
];

const severityConfig = {
  High: {
    label: "High",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900",
    badge: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400",
    icon: AlertTriangle,
  },
  Medium: {
    label: "Medium",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900",
    badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400",
    icon: AlertCircle,
  },
  Low: {
    label: "Low",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900",
    badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400",
    icon: Info,
  },
};

export default function Risks() {
  const highRisks = risks.filter((r) => r.severity === "High").length;
  const mediumRisks = risks.filter((r) => r.severity === "Medium").length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Risk Tracker
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          {highRisks} high severity · {mediumRisks} medium severity
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "High Risk", value: highRisks, color: "text-red-600 dark:text-red-400" },
          { label: "Medium Risk", value: mediumRisks, color: "text-amber-600 dark:text-amber-400" },
          { label: "Total Risks", value: risks.length, color: "text-foreground" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-card-border rounded-xl p-4 text-center shadow-sm">
            <p className={cn("text-3xl font-bold", color)} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {risks.map((risk) => {
          const config = severityConfig[risk.severity];
          const Icon = config.icon;
          return (
            <div
              key={risk.id}
              data-testid={`risk-${risk.id}`}
              className={cn("border rounded-xl p-5", config.bg)}
            >
              <div className="flex items-start gap-4">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white dark:bg-black/20", config.color)}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-semibold text-sm">{risk.risk}</h4>
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", config.badge)}>
                      {risk.severity}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground/80 mb-2">{risk.action}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{risk.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
