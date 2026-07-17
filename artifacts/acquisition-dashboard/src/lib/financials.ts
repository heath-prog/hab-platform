const FINANCIALS_KEY = "trueblue_financials_v1";
const FINANCIAL_WEBHOOK_KEY = "trueblue_financial_webhook";

// ── Post-acquisition performance targets (set by Heath Blake) ──────────────
export const TARGETS = {
  monthlyRevenue: 200_000,     // $200K / mo
  carCount: 200,               // 200 cars / mo
  aro: 1_000,                  // $1,000 ARO
  grossMarginPct: 0.70,        // 70% gross profit margin
  netMarginPct: 0.17,          // 17% net profit of revenue
  monthlyNetProfit: 34_000,    // $200K × 17% = $34K / mo
  monthlyRent: 8_000,          // $8K / mo rent
  sellerNote: 2_250,           // $2,250 / mo seller note payment
} as const;

export type FinancialPeriod = {
  id: string;
  period: string;  // "2024-01" | "2024-Q1" | "2024"
  label: string;   // "Jan 2024" | "Q1 2024" | "FY 2024"
  ingestedAt: string;
  revenue: number;
  laborRevenue: number;
  partsRevenue: number;
  otherRevenue: number;
  cogs: number;
  laborCogs: number;
  partsCogs: number;
  grossProfit: number;
  grossMargin: number;
  payroll: number;
  rent: number;
  utilities: number;
  marketing: number;
  insurance: number;
  supplies: number;
  otherExpenses: number;
  totalOpex: number;
  ebitda: number;
  ebitdaMargin: number;
  depreciation: number;
  interest: number;
  taxes: number;
  netIncome: number;
  netMargin: number;
  carCount: number;
  aro: number;
};

export function parsePeriodLabel(period: string): string {
  if (/^\d{4}$/.test(period)) return `FY ${period}`;
  if (/^\d{4}-Q\d$/.test(period)) {
    const [year, q] = period.split("-");
    return `${q} ${year}`;
  }
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [year, month] = period.split("-");
    const d = new Date(parseInt(year), parseInt(month) - 1, 1);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  return period;
}

export function computeDerived(p: Partial<FinancialPeriod>): FinancialPeriod {
  const revenue = p.revenue ?? 0;
  const laborCogs = p.laborCogs ?? 0;
  const partsCogs = p.partsCogs ?? 0;
  const cogs = p.cogs ?? laborCogs + partsCogs;
  const grossProfit = p.grossProfit ?? revenue - cogs;
  const grossMargin = revenue > 0 ? grossProfit / revenue : 0;
  const payroll = p.payroll ?? 0;
  const rent = p.rent ?? 0;
  const utilities = p.utilities ?? 0;
  const marketing = p.marketing ?? 0;
  const insurance = p.insurance ?? 0;
  const supplies = p.supplies ?? 0;
  const otherExpenses = p.otherExpenses ?? 0;
  const totalOpex = p.totalOpex ?? payroll + rent + utilities + marketing + insurance + supplies + otherExpenses;
  const ebitda = p.ebitda ?? grossProfit - totalOpex;
  const ebitdaMargin = revenue > 0 ? ebitda / revenue : 0;
  const depreciation = p.depreciation ?? 0;
  const interest = p.interest ?? 0;
  const taxes = p.taxes ?? 0;
  const netIncome = p.netIncome ?? ebitda - depreciation - interest - taxes;
  const netMargin = revenue > 0 ? netIncome / revenue : 0;
  const carCount = p.carCount ?? 0;
  const aro = carCount > 0 ? revenue / carCount : (p.aro ?? 0);
  const period = p.period ?? "";
  return {
    id: p.id ?? `fp-${period}-${Date.now()}`,
    period,
    label: p.label ?? parsePeriodLabel(period),
    ingestedAt: p.ingestedAt ?? new Date().toISOString(),
    revenue,
    laborRevenue: p.laborRevenue ?? 0,
    partsRevenue: p.partsRevenue ?? 0,
    otherRevenue: p.otherRevenue ?? 0,
    cogs,
    laborCogs,
    partsCogs,
    grossProfit,
    grossMargin,
    payroll,
    rent,
    utilities,
    marketing,
    insurance,
    supplies,
    otherExpenses,
    totalOpex,
    ebitda,
    ebitdaMargin,
    depreciation,
    interest,
    taxes,
    netIncome,
    netMargin,
    carCount,
    aro,
  };
}

export function loadFinancials(): FinancialPeriod[] {
  try {
    const raw = localStorage.getItem(FINANCIALS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FinancialPeriod[];
  } catch {
    return [];
  }
}

export function saveFinancials(records: FinancialPeriod[]): void {
  localStorage.setItem(FINANCIALS_KEY, JSON.stringify(records));
}

export function upsertFinancialRecords(incoming: FinancialPeriod[]): void {
  const all = loadFinancials();
  for (const rec of incoming) {
    const idx = all.findIndex((r) => r.period === rec.period);
    if (idx >= 0) all[idx] = rec;
    else all.push(rec);
  }
  all.sort((a, b) => a.period.localeCompare(b.period));
  saveFinancials(all);
}

export function parseN8nFinancials(raw: unknown): FinancialPeriod[] {
  const data = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const records: unknown[] = Array.isArray(data.records)
    ? data.records
    : Array.isArray(raw)
    ? (raw as unknown[])
    : [data];
  return records
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => {
      const period = typeof r.period === "string" ? r.period : "";
      if (!period) return null;
      return computeDerived({
        ...(r as Partial<FinancialPeriod>),
        period,
        label: typeof r.label === "string" ? r.label : parsePeriodLabel(period),
        id: `fp-${period}-${Date.now()}`,
        ingestedAt: new Date().toISOString(),
      });
    })
    .filter((r): r is FinancialPeriod => r !== null && r.period !== "");
}

export function aggregatePeriods(periods: FinancialPeriod[]): FinancialPeriod | null {
  if (periods.length === 0) return null;
  if (periods.length === 1) return periods[0];
  const s = (k: keyof FinancialPeriod) =>
    periods.reduce((acc, p) => acc + (typeof p[k] === "number" ? (p[k] as number) : 0), 0);
  const revenue = s("revenue");
  const grossProfit = s("grossProfit");
  const ebitda = s("ebitda");
  const totalOpex = s("totalOpex");
  const cogs = s("cogs");
  const netIncome = s("netIncome");
  const carCount = s("carCount");
  return computeDerived({
    id: "aggregate",
    period: `${periods[0].period}:${periods[periods.length - 1].period}`,
    label: `${periods[0].label} – ${periods[periods.length - 1].label}`,
    ingestedAt: new Date().toISOString(),
    revenue, grossProfit, grossMargin: revenue > 0 ? grossProfit / revenue : 0,
    laborRevenue: s("laborRevenue"), partsRevenue: s("partsRevenue"), otherRevenue: s("otherRevenue"),
    cogs, laborCogs: s("laborCogs"), partsCogs: s("partsCogs"),
    payroll: s("payroll"), rent: s("rent"), utilities: s("utilities"),
    marketing: s("marketing"), insurance: s("insurance"), supplies: s("supplies"),
    otherExpenses: s("otherExpenses"), totalOpex,
    ebitda, ebitdaMargin: revenue > 0 ? ebitda / revenue : 0,
    depreciation: s("depreciation"), interest: s("interest"), taxes: s("taxes"),
    netIncome, netMargin: revenue > 0 ? netIncome / revenue : 0,
    carCount, aro: carCount > 0 ? revenue / carCount : 0,
  });
}

export function getFinancialWebhook(): string {
  return localStorage.getItem(FINANCIAL_WEBHOOK_KEY) ?? "";
}
export function setFinancialWebhook(url: string): void {
  localStorage.setItem(FINANCIAL_WEBHOOK_KEY, url);
}

// Formatting helpers
export const fmtCurrency = (n: number, compact = false) => {
  if (compact) {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${Math.round(n).toLocaleString()}`;
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
};
export const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;
export const fmtNum = (n: number) => Math.round(n).toLocaleString();
export const deltaClass = (n: number) =>
  n > 0 ? "text-emerald-600 dark:text-emerald-400" : n < 0 ? "text-red-500" : "text-muted-foreground";
export const deltaLabel = (curr: number, prior: number) => {
  if (prior === 0) return null;
  const d = ((curr - prior) / Math.abs(prior)) * 100;
  return { d, label: `${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(1)}%` };
};
