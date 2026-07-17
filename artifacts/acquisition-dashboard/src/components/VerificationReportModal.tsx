import { X, Shield, AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp, Bot, Clock, FileText, TrendingUp, BarChart2, Info } from "lucide-react";
import { VerificationReport, FindingFlag } from "@/lib/reports";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";

type Props = {
  report: VerificationReport;
  onClose: () => void;
};

function ConfidenceRing({ score }: { score: number }) {
  const color = score >= 75 ? "#22c55e" : score >= 45 ? "#f59e0b" : "#ef4444";
  const label = score >= 75 ? "High Confidence" : score >= 45 ? "Medium Confidence" : "Low Confidence";
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
          <circle
            cx="50" cy="50" r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
            style={{ transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color, fontFamily: "'Space Grotesk', sans-serif" }}>
            {score}
          </span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      <span className="text-sm font-semibold" style={{ color }}>{label}</span>
    </div>
  );
}

const flagConfig: Record<FindingFlag, { icon: typeof CheckCircle2; cls: string }> = {
  ok: { icon: CheckCircle2, cls: "text-emerald-500" },
  warning: { icon: AlertTriangle, cls: "text-amber-500" },
  critical: { icon: XCircle, cls: "text-red-500" },
};

function FindingRow({ f }: { f: import("@/lib/reports").VerificationFinding }) {
  const { icon: Icon, cls } = flagConfig[f.flag] ?? flagConfig.ok;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", cls)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{f.label}</p>
        {f.detail && <p className="text-xs text-muted-foreground mt-0.5">{f.detail}</p>}
      </div>
      <span className={cn("text-sm font-semibold flex-shrink-0", cls)}>{f.value}</span>
    </div>
  );
}

function ExtractedDataPanel({ report }: { report: VerificationReport }) {
  const docType = report.documentLabel.toLowerCase();
  const data = report.extractedData;

  // Tax Returns or P&L — show revenue/profit chart
  if (docType.includes("tax") || docType.includes("p&l") || docType.includes("balance")) {
    const years = Array.isArray(data.years) ? (data.years as string[]) : [];
    const revenue = Array.isArray(data.revenue) ? (data.revenue as number[]) : [];
    const netProfit = Array.isArray(data.netProfit) ? (data.netProfit as number[]) : [];

    if (years.length > 0 && revenue.length > 0) {
      const chartData = years.map((y, i) => ({
        year: y,
        Revenue: revenue[i] ?? 0,
        "Net Profit": netProfit[i] ?? 0,
      }));
      return (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5" /> Financial Trend
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, ""]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Net Profit" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
  }

  // Bank Statements — monthly flow
  if (docType.includes("bank")) {
    const months = Array.isArray(data.months) ? (data.months as string[]) : [];
    const deposits = Array.isArray(data.deposits) ? (data.deposits as number[]) : [];
    const balance = Array.isArray(data.balance) ? (data.balance as number[]) : [];

    if (months.length > 0 && deposits.length > 0) {
      const chartData = months.map((m, i) => ({
        month: m,
        Deposits: deposits[i] ?? 0,
        Balance: balance[i] ?? 0,
      }));
      return (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Cash Flow Trend
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, ""]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Line type="monotone" dataKey="Deposits" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Balance" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }
  }

  // Lease / Debt — key-value table
  if (docType.includes("lease") || docType.includes("debt")) {
    const entries = Object.entries(data).filter(([, v]) => typeof v === "string" || typeof v === "number");
    if (entries.length > 0) {
      return (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Extracted Terms
          </p>
          <div className="space-y-2">
            {entries.map(([k, v]) => (
              <div key={k} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                <span className="text-sm text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</span>
                <span className="text-sm font-semibold">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
  }

  // Generic fallback — render any key-value extractedData
  const entries = Object.entries(data).filter(([, v]) => typeof v !== "object" || v === null);
  if (entries.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <Info className="w-3.5 h-3.5" /> Extracted Data
      </p>
      <div className="space-y-2">
        {entries.map(([k, v]) => (
          <div key={k} className="flex justify-between items-center py-2 border-b border-border last:border-0">
            <span className="text-sm text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</span>
            <span className="text-sm font-semibold">{String(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VerificationReportModal({ report, onClose }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const hasExtractedData = Object.keys(report.extractedData).length > 0;
  const confidenceColor = report.confidenceScore >= 75 ? "emerald" : report.confidenceScore >= 45 ? "amber" : "red";

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-2xl bg-background shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className={cn(
          "px-6 py-5 border-b border-border flex items-start gap-4",
          confidenceColor === "emerald" ? "bg-emerald-50 dark:bg-emerald-950/20" :
          confidenceColor === "amber" ? "bg-amber-50 dark:bg-amber-950/20" :
          "bg-red-50 dark:bg-red-950/20"
        )}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Bot className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-xs font-medium text-muted-foreground">{report.agentName}</span>
            </div>
            <h2 className="text-base font-bold leading-snug" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {report.documentLabel}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {report.fileName} · Analyzed {new Date(report.analyzedAt).toLocaleString()}
            </p>
          </div>
          <button
            data-testid="button-close-report"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-background/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Confidence Hero */}
          <div className="px-6 py-6 flex items-start gap-8 border-b border-border">
            <ConfidenceRing score={report.confidenceScore} />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Shield className={cn(
                  "w-4 h-4",
                  confidenceColor === "emerald" ? "text-emerald-500" :
                  confidenceColor === "amber" ? "text-amber-500" : "text-red-500"
                )} />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Verification Summary
                </span>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{report.summary}</p>
            </div>
          </div>

          <div className="px-6 py-6 space-y-8">
            {/* Key Findings */}
            {report.findings.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Key Findings
                </p>
                <div className="bg-card border border-card-border rounded-xl px-4 divide-y divide-border">
                  {report.findings.map((f, i) => (
                    <FindingRow key={i} f={f} />
                  ))}
                </div>
              </div>
            )}

            {/* Extracted Data Chart/Table */}
            {hasExtractedData && (
              <div className="bg-card border border-card-border rounded-xl p-5">
                <ExtractedDataPanel report={report} />
              </div>
            )}

            {/* Red Flags */}
            {report.redFlags.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Red Flags
                </p>
                <div className="space-y-2">
                  {report.redFlags.map((flag, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg"
                    >
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-red-700 dark:text-red-400">{flag}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {report.recommendations.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Advisor Recommendations
                </p>
                <div className="space-y-2">
                  {report.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg"
                    >
                      <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <span className="text-sm text-blue-700 dark:text-blue-300">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Advisor Notes */}
            {report.advisorNotes && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Detailed Advisor Notes
                </p>
                <div className="bg-card border border-card-border rounded-xl p-5">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{report.advisorNotes}</p>
                </div>
              </div>
            )}

            {/* Raw Response */}
            {report.rawResponse && (
              <div>
                <button
                  onClick={() => setShowRaw(!showRaw)}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showRaw ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {showRaw ? "Hide" : "Show"} raw N8n response
                </button>
                {showRaw && (
                  <pre className="mt-3 p-4 bg-muted rounded-lg text-xs text-muted-foreground overflow-x-auto leading-relaxed">
                    {report.rawResponse}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
