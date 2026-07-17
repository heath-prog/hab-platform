import { useDashboard } from "@/lib/context";
import { CheckCircle2, Circle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const kpiPrefix = (metric: string) => {
  if (metric.includes("%")) return "%";
  if (
    metric.toLowerCase().includes("count") ||
    metric.toLowerCase().includes("cars")
  )
    return "#";
  return "$";
};

export default function Financials() {
  const { state, setState } = useDashboard();

  const updateKPI = (
    id: string,
    field: "value" | "status",
    value: string | boolean,
  ) => {
    setState((prev) => ({
      ...prev,
      kpis: prev.kpis.map((k) => (k.id === id ? { ...k, [field]: value } : k)),
    }));
  };

  const filledKPIs = state.kpis.filter((k) => k.value.trim() !== "").length;

  return (
    <div className="space-y-8">
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Financial Validation
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          {filledKPIs}/{state.kpis.length} KPIs filled in
        </p>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3
            className="font-semibold"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Key Performance Indicators
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="w-3.5 h-3.5" />
            Fill once data received
          </div>
        </div>
        <div className="divide-y divide-border">
          {state.kpis.map((kpi) => (
            <div
              key={kpi.id}
              data-testid={`kpi-row-${kpi.id}`}
              className="px-6 py-4"
            >
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium">{kpi.metric}</p>
                  {kpi.target && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Target: {kpi.target}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      {kpiPrefix(kpi.metric)}
                    </span>
                    <input
                      type="text"
                      placeholder="Enter value"
                      value={kpi.value}
                      onChange={(e) =>
                        updateKPI(kpi.id, "value", e.target.value)
                      }
                      data-testid={`kpi-value-${kpi.id}`}
                      className={cn(
                        "pl-6 pr-3 py-2 rounded-lg border text-sm font-medium bg-background transition-all w-40 focus:outline-none focus:ring-2 focus:ring-primary/30",
                        kpi.value
                          ? "border-primary/30 text-foreground"
                          : "border-border text-muted-foreground",
                      )}
                    />
                  </div>
                  <button
                    data-testid={`kpi-status-${kpi.id}`}
                    onClick={() => updateKPI(kpi.id, "status", !kpi.status)}
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-all",
                      kpi.status
                        ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground hover:bg-muted/80",
                    )}
                  >
                    {kpi.status ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Circle className="w-3.5 h-3.5" />
                    )}
                    {kpi.status ? "Verified" : "Verify"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Financial Benchmarks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
          <h4
            className="font-semibold mb-1"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Performance Targets
          </h4>
          <p className="text-xs text-muted-foreground mb-4">
            Post-acquisition monthly goals
          </p>
          <div className="space-y-3">
            {[
              { label: "Monthly Revenue", value: "$200,000" },
              { label: "Car Count", value: "200 cars / mo" },
              { label: "ARO (Avg Repair Order)", value: "$1,000" },
              { label: "Gross Profit Margin", value: "70%" },
              { label: "Net Profit Margin", value: "17% of Revenue" },
              { label: "Monthly Net Profit", value: "$34,000" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
          <h4
            className="font-semibold mb-4"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Monthly Obligations
          </h4>
          <div className="space-y-3">
            {[
              { label: "Seller Note", value: "$2,250" },
              { label: "Rent (estimated)", value: "$8,000" },
              { label: "Payroll", value: "TBD" },
              { label: "Parts & Supplies", value: "TBD" },
              { label: "Your Draw", value: "TBD" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-semibold">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Risk Indicators */}
      <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
        <h4
          className="font-semibold mb-4"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Validation Checklist
        </h4>
        <div className="space-y-2 text-sm">
          {[
            "Bank deposits match stated revenue",
            "Tax returns align with P&L statements",
            "No undisclosed debt on UCC search",
            "Payroll matches employee count",
            "Inventory & equipment valued correctly",
            "No open compliance violations",
          ].map((item) => (
            <div
              key={item}
              className="flex items-center gap-2 text-muted-foreground"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 flex-shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
