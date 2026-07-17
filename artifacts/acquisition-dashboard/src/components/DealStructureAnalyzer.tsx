import { useState } from "react";
import {
  Building2, DollarSign, TrendingUp, AlertTriangle, CheckCircle2,
  Sparkles, Copy, Check, Loader2, ChevronDown, ChevronUp,
  ShieldCheck, Zap, BarChart3, AlertCircle, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiFetch";
import type { Business } from "@/lib/storage";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

type Metrics = {
  purchasePrice:         number;
  buyerCash:             number;
  sellerNote:            number;
  sellerNoteStandby:     boolean;
  sellerNoteEquityCredit: number;
  totalEquityInjection:  number;
  requiredEquity:        number;
  equityGap:             number;
  equityPct:             number;
  sbaLoanAmount:         number;
  annualDebtService:     number;
  sde:                   number;
  dscr:                  number;
  meetsEquityRequirement: boolean;
  meetsDscr:             boolean;
  isApprovable:          boolean;
  sbaRate:               number;
  sbaTerm:               number;
};

type Concern = { concern: string; response: string };

type Analysis = {
  verdict:                    "APPROVABLE" | "NEEDS_RESTRUCTURING" | "STRONG_DEAL";
  verdictRationale:           string;
  bankReadyStatement:         string | null;
  structureStrengths:         string[];
  potentialConcerns:          Concern[];
  peStructuredSummary:        string | null;
  restructuringRecommendation: string | null;
  proMove:                    string | null;
};

type AnalysisResult = { metrics: Metrics; analysis: Analysis; aiError?: boolean };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function parseDollar(raw: string): number {
  return parseFloat(raw.replace(/[^0-9.]/g, "")) || 0;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ─── DSCR Gauge ───────────────────────────────────────────────────────────────

function DscrGauge({ dscr }: { dscr: number }) {
  const pct   = Math.min((dscr / 3) * 100, 100);
  const color = dscr >= 1.5 ? "bg-emerald-500" : dscr >= 1.25 ? "bg-amber-500" : "bg-red-500";
  const label = dscr >= 1.5 ? "Strong" : dscr >= 1.25 ? "Acceptable" : "Below Threshold";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">DSCR</span>
        <span className={cn("font-bold tabular-nums", dscr >= 1.25 ? "text-emerald-400" : "text-red-400")}>
          {dscr.toFixed(2)}x · {label}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground/50">
        <span>0x</span><span className="text-amber-400/80">1.25x min</span><span>3x+</span>
      </div>
    </div>
  );
}

// ─── Verdict Badge ────────────────────────────────────────────────────────────

function VerdictBadge({ verdict }: { verdict: Analysis["verdict"] }) {
  const cfg = {
    STRONG_DEAL:         { icon: ShieldCheck, label: "Strong Deal",         cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    APPROVABLE:          { icon: CheckCircle2, label: "Bankable",            cls: "bg-blue-500/15   text-blue-400   border-blue-500/30"    },
    NEEDS_RESTRUCTURING: { icon: AlertTriangle, label: "Needs Restructuring", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30"  },
  }[verdict];

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border", cfg.cls)}>
      <cfg.icon className="w-3.5 h-3.5" /> {cfg.label}
    </span>
  );
}

// ─── Results Panel ────────────────────────────────────────────────────────────

function ResultsPanel({ result }: { result: AnalysisResult }) {
  const { metrics: m, analysis: a } = result;
  const [showConcerns, setShowConcerns] = useState(false);

  return (
    <div className="space-y-5 mt-6">
      {/* Verdict header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <VerdictBadge verdict={a.verdict} />
            {result.aiError && (
              <span className="text-xs text-amber-400/70 italic">AI narrative unavailable — calculations shown</span>
            )}
          </div>
          {a.verdictRationale && (
            <p className="text-xs text-muted-foreground mt-1">{a.verdictRationale}</p>
          )}
        </div>
      </div>

      {/* Deal metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: "Purchase Price",   value: fmt(m.purchasePrice),      ok: true },
          { label: "Buyer Cash",       value: fmt(m.buyerCash),          ok: true },
          { label: "Seller Note",      value: fmt(m.sellerNote),         ok: true },
          { label: "SBA Loan",         value: fmt(m.sbaLoanAmount),      ok: true },
          { label: "SDE",              value: fmt(m.sde),                ok: true },
          { label: "Equity Injection", value: `${fmt(m.totalEquityInjection)} (${m.equityPct}%)`, ok: m.meetsEquityRequirement },
          { label: "Annual Debt Svc",  value: fmt(m.annualDebtService),  ok: true },
          { label: "SBA Rate / Term",  value: `${m.sbaRate}% / ${m.sbaTerm}yr`, ok: true },
          { label: "Equity Gap",       value: m.equityGap > 0 ? fmt(m.equityGap) + " short" : "Requirement met", ok: m.meetsEquityRequirement },
        ].map(({ label, value, ok }) => (
          <div key={label} className={cn("rounded-xl border p-3", ok ? "bg-card border-border" : "bg-red-500/5 border-red-500/20")}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
            <p className={cn("text-sm font-bold mt-0.5 tabular-nums", ok ? "text-foreground" : "text-red-400")}>{value}</p>
          </div>
        ))}
      </div>

      {/* DSCR gauge */}
      <div className="bg-card border border-border rounded-xl p-4">
        <DscrGauge dscr={m.dscr} />
        <p className="text-xs text-muted-foreground mt-2">
          SDE <strong className="text-foreground">{fmt(m.sde)}</strong> ÷ Annual Debt Service <strong className="text-foreground">{fmt(m.annualDebtService)}</strong>
          {m.sellerNoteStandby && m.sellerNote > 0 && (
            <span className="text-muted-foreground/60"> · Seller note excluded (full standby)</span>
          )}
        </p>
      </div>

      {/* PE-structured summary */}
      {a.peStructuredSummary && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="w-4 h-4 text-primary" /> PE-Structured Deal Summary
            </div>
            <CopyButton text={a.peStructuredSummary} />
          </div>
          <p className="px-4 py-3 text-sm text-muted-foreground leading-relaxed">{a.peStructuredSummary}</p>
        </div>
      )}

      {/* Bank-ready statement */}
      {a.bankReadyStatement && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-primary/20">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <ShieldCheck className="w-4 h-4" /> Bank-Ready Language
            </div>
            <CopyButton text={a.bankReadyStatement} />
          </div>
          <p className="px-4 py-3 text-sm text-foreground/80 leading-relaxed italic">
            "{a.bankReadyStatement}"
          </p>
        </div>
      )}

      {/* Restructuring recommendation */}
      {a.restructuringRecommendation && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-400 mb-2">
            <RefreshCw className="w-4 h-4" /> Restructuring Recommendation
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{a.restructuringRecommendation}</p>
        </div>
      )}

      {/* Strengths */}
      {a.structureStrengths?.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Structure Strengths
          </div>
          <ul className="px-4 py-3 space-y-2">
            {a.structureStrengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pro move */}
      {a.proMove && (
        <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-400 mb-2">
            <Zap className="w-4 h-4" /> Pro Move
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{a.proMove}</p>
        </div>
      )}

      {/* Lender concerns accordion */}
      {a.potentialConcerns?.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowConcerns((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/30 transition-colors"
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              Potential Lender Concerns &amp; Responses
            </span>
            {showConcerns ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showConcerns && (
            <div className="border-t border-border divide-y divide-border">
              {a.potentialConcerns.map((c, i) => (
                <div key={i} className="px-4 py-3 space-y-1.5">
                  <p className="text-xs font-semibold text-amber-400">{c.concern}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{c.response}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Input Form ───────────────────────────────────────────────────────────────

function dollarInput(
  label: string,
  value: string,
  onChange: (v: string) => void,
  hint?: string,
) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="w-full pl-7 pr-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      {hint && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{hint}</p>}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function DealStructureAnalyzer({ business }: { business?: Business }) {
  const [purchasePrice, setPurchasePrice] = useState(
    business?.dealPrice ? String(business.dealPrice) : ""
  );
  const [buyerCash,         setBuyerCash]         = useState("");
  const [sellerNote,        setSellerNote]        = useState("");
  const [sellerNoteStandby, setSellerNoteStandby] = useState(true);
  const [sde,               setSde]               = useState("");
  const [sbaRate,           setSbaRate]           = useState("11.5");
  const [sbaTerm,           setSbaTerm]           = useState("10");
  const [showAdvanced,      setShowAdvanced]      = useState(false);
  const [loading,           setLoading]           = useState(false);
  const [error,             setError]             = useState("");
  const [result,            setResult]            = useState<AnalysisResult | null>(null);

  // Live preview calc (no AI)
  const pp  = parseDollar(purchasePrice);
  const bc  = parseDollar(buyerCash);
  const sn  = parseDollar(sellerNote);
  const sdeN = parseDollar(sde);
  const snEquity = sellerNoteStandby ? sn : 0;
  const totalEquity = bc + snEquity;
  const reqEquity   = pp * 0.10;
  const sbaLoan     = pp - bc - sn;
  const r = parseFloat(sbaRate) / 100 / 12;
  const n = parseFloat(sbaTerm) * 12;
  const monthlyPmt  = sbaLoan > 0 && r > 0 ? sbaLoan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : 0;
  const annualDs    = monthlyPmt * 12;
  const dscrLive    = annualDs > 0 ? sdeN / annualDs : 0;
  const equityPct   = pp > 0 ? (totalEquity / pp) * 100 : 0;

  async function handleAnalyze() {
    if (!pp || !bc || !sdeN) {
      setError("Please fill in Purchase Price, Buyer Cash, and SDE.");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const resp = await apiFetch(`${BASE}/api/deal-structure/analyze`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          businessName:     business?.name ?? "Business Acquisition",
          purchasePrice:    pp,
          buyerCash:        bc,
          sellerNote:       sn,
          sellerNoteStandby,
          sde:              sdeN,
          sbaRate:          parseFloat(sbaRate) / 100,
          sbaTerm:          parseFloat(sbaTerm),
        }),
      });
      if (!resp.ok) throw new Error(`API error ${resp.status}`);
      const data = await resp.json() as AnalysisResult;
      setResult(data);
    } catch (e) {
      setError((e as Error).message ?? "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Deal Structure Analyzer
            </h3>
            <p className="text-xs text-muted-foreground">Bank-ready · PE-structured · SBA compliance</p>
          </div>
        </div>
        {result && (
          <button
            onClick={() => setResult(null)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> New Analysis
          </button>
        )}
      </div>

      <div className="p-6">
        {!result ? (
          <div className="space-y-5">
            {/* Deal inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dollarInput("Purchase Price", purchasePrice, setPurchasePrice, "Full acquisition price")}
              {dollarInput("Buyer Cash Injection", buyerCash, setBuyerCash, "Your actual cash at close")}
              {dollarInput("Seller Note (if any)", sellerNote, setSellerNote, "Amount seller is carrying back")}
              {dollarInput("SDE — Seller's Discretionary Earnings", sde, setSde, "Annual adj. EBITDA from financial statements")}
            </div>

            {/* Seller note standby toggle */}
            {parseDollar(sellerNote) > 0 && (
              <label className="flex items-center gap-3 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={sellerNoteStandby}
                  onChange={(e) => setSellerNoteStandby(e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <div>
                  <p className="text-xs font-semibold text-blue-400">Seller note on full standby (≥24 months)</p>
                  <p className="text-[10px] text-muted-foreground/70">
                    When on full standby, SBA counts the seller note as equity injection — closing your equity gap.
                  </p>
                </div>
              </label>
            )}

            {/* Advanced */}
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Advanced (SBA rate &amp; term)
            </button>
            {showAdvanced && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">SBA Rate (%)</label>
                  <input
                    type="text"
                    value={sbaRate}
                    onChange={(e) => setSbaRate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Loan Term (years)</label>
                  <input
                    type="text"
                    value={sbaTerm}
                    onChange={(e) => setSbaTerm(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            )}

            {/* Live preview metrics */}
            {pp > 0 && bc > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-muted/30 border border-border rounded-xl">
                {[
                  {
                    icon: Building2,
                    label: "SBA Loan",
                    value: sbaLoan > 0 ? fmt(sbaLoan) : "—",
                    ok: sbaLoan > 0,
                  },
                  {
                    icon: DollarSign,
                    label: "Equity Injection",
                    value: `${fmt(totalEquity)} (${equityPct.toFixed(1)}%)`,
                    ok: totalEquity >= reqEquity,
                  },
                  {
                    icon: TrendingUp,
                    label: "Annual Debt Svc",
                    value: annualDs > 0 ? fmt(annualDs) : "—",
                    ok: true,
                  },
                  {
                    icon: BarChart3,
                    label: "DSCR (est.)",
                    value: dscrLive > 0 ? `${dscrLive.toFixed(2)}x` : sdeN > 0 ? "—" : "Enter SDE",
                    ok: dscrLive >= 1.25 || dscrLive === 0,
                  },
                ].map(({ icon: Icon, label, value, ok }) => (
                  <div key={label} className="text-center">
                    <Icon className={cn("w-4 h-4 mx-auto mb-1", ok ? "text-muted-foreground" : "text-red-400")} />
                    <p className={cn("text-sm font-bold tabular-nums", ok ? "text-foreground" : "text-red-400")}>{value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Equity gap warning */}
            {pp > 0 && bc > 0 && totalEquity < reqEquity && (
              <div className="flex items-start gap-3 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-amber-300/90">
                  <strong>Equity gap: {fmt(reqEquity - totalEquity)}</strong> — SBA requires 10% ({fmt(reqEquity)}).{" "}
                  {sn === 0
                    ? "Consider adding a seller note on full standby to close this gap."
                    : !sellerNoteStandby
                      ? "Enable 'full standby' above to count the seller note as equity."
                      : ""}
                </p>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> {error}
              </p>
            )}

            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing deal structure…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Analyze &amp; Generate Bank-Ready Package</>
              )}
            </button>
          </div>
        ) : (
          <ResultsPanel result={result} />
        )}
      </div>
    </div>
  );
}
