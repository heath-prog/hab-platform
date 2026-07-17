import { useState, Fragment } from "react";
import {
  TrendingUp, CheckCircle2, Circle, Lock, Zap, Database,
  AlertCircle, ArrowUpRight, ArrowDownRight, RefreshCw,
  Activity, Wifi, WifiOff, Upload, Info, BarChart3,
  FileText, ExternalLink, Scale, Filter, Plus, Check,
  X, AlertTriangle, ChevronUp, ChevronDown, Loader2,
  Building2, DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type PortfolioState, loadPortfolio, savePortfolio } from "@/lib/storage";
import {
  loadExpenseRecords, saveExpenseRecords, addExpenseRecord, updateExpenseRecord,
  getConnection, upsertConnection, loadFinancialRecords,
  type ExpenseRecord, type ReconciliationStatus, type SourceType, type IntegrationConnection,
} from "@/lib/documentPipeline";

// ─── Activation checklist ─────────────────────────────────────────────────────

type ActivationItem = { id: string; label: string; description: string };

const ACTIVATION_ITEMS: ActivationItem[] = [
  { id: "a1", label: "Acquisition closed",              description: "Purchase agreement signed and funds transferred" },
  { id: "a2", label: "Entity / ownership finalized",    description: "LLC paperwork, EIN, and ownership structure confirmed" },
  { id: "a3", label: "Bank access verified",            description: "Business checking account open and accessible" },
  { id: "a4", label: "QuickBooks access confirmed",     description: "Login credentials and chart of accounts ready" },
  { id: "a5", label: "Tekmetric connected",             description: "Shop management system access transferred" },
  { id: "a6", label: "Payroll data path established",   description: "Payroll processor confirmed and access granted" },
  { id: "a7", label: "Vendor / supplier data ingested", description: "Key vendor accounts and balances documented" },
  { id: "a8", label: "Opening balance sheet captured",  description: "Day-1 asset and liability snapshot recorded" },
  { id: "a9", label: "First post-close P&L baseline",   description: "Month-1 reporting period ready to begin" },
];

function loadActivation(id: string): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(`fin_activation_${id}`) ?? "{}"); } catch { return {}; }
}
function saveActivation(id: string, s: Record<string, boolean>) {
  localStorage.setItem(`fin_activation_${id}`, JSON.stringify(s));
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, target, delta, prefix = "$", suffix = "", hasData }: {
  label: string; value?: number; target: string; delta?: number;
  prefix?: string; suffix?: string; hasData: boolean;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <p className="text-xs text-muted-foreground font-medium mb-2">{label}</p>
      {hasData && value !== undefined ? (
        <>
          <p className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {prefix}{value.toLocaleString()}{suffix}
          </p>
          {delta !== undefined && (
            <div className={cn("flex items-center gap-1 text-xs mt-1", delta >= 0 ? "text-emerald-500" : "text-red-400")}>
              {delta >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {Math.abs(delta)}% vs prior period
            </div>
          )}
        </>
      ) : (
        <p className="text-2xl font-bold text-muted-foreground/30" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>—</p>
      )}
      <p className="text-xs text-muted-foreground/60 mt-2">Target: {target}</p>
    </div>
  );
}

// ─── P&L row ─────────────────────────────────────────────────────────────────

function PLRow({ label, value, indent = 0, bold = false, highlight }: {
  label: string; value?: number; indent?: number; bold?: boolean; highlight?: "green" | "blue" | "amber";
}) {
  const hl = highlight === "green" ? "text-emerald-600" : highlight === "blue" ? "text-primary" : highlight === "amber" ? "text-amber-500" : "";
  return (
    <tr className="border-b border-border/50 hover:bg-muted/20">
      <td className={cn("py-2.5 text-sm", bold && "font-semibold", hl)} style={{ paddingLeft: `${(indent + 1) * 12}px` }}>
        {label}
      </td>
      <td className={cn("py-2.5 text-sm text-right font-mono", bold && "font-semibold", hl)}>
        {value !== undefined ? `$${value.toLocaleString()}` : <span className="text-muted-foreground/30">—</span>}
      </td>
      <td className="py-2.5 text-sm text-right text-muted-foreground/40 font-mono">—</td>
      <td className="py-2.5 text-sm text-right text-muted-foreground/40 font-mono">—</td>
    </tr>
  );
}

// ─── Data source card ─────────────────────────────────────────────────────────

const SOURCE_META: Record<SourceType, { name: string; description: string; connectLabel: string }> = {
  tekmetric:  { name: "Tekmetric",     description: "Shop management · daily ticket data · car count · ARO",            connectLabel: "Enter API Key" },
  quickbooks: { name: "QuickBooks",    description: "Accounting · P&L · balance sheet · expense categories",            connectLabel: "Connect via OAuth" },
  bank:       { name: "Bank Feed",     description: "Cash position · reconciliation · vendor payments",                  connectLabel: "Import Bank CSV" },
  n8n:        { name: "N8n Workflow",  description: "Automated financial data ingestion via your N8n document pipeline", connectLabel: "Configure Webhook" },
  manual:     { name: "Manual Upload", description: "Upload statements, invoices, vendor bills directly",               connectLabel: "Upload Document" },
};

function DataSourceCard({ businessId, sourceType }: { businessId: string; sourceType: SourceType }) {
  const meta     = SOURCE_META[sourceType];
  const [conn,   setConn]    = useState<IntegrationConnection>(() => getConnection(businessId, sourceType));
  const [editing, setEditing] = useState(false);
  const [input,  setInput]   = useState(conn.connectionValue ?? "");

  function save() {
    const next: IntegrationConnection = {
      ...conn,
      connectionStatus: input.trim() ? "connected" : "not_connected",
      connectionValue:  input.trim() || undefined,
      updatedAt:        new Date().toISOString(),
    };
    upsertConnection(businessId, next);
    setConn(next);
    setEditing(false);
  }

  function disconnect() {
    const next: IntegrationConnection = {
      ...conn,
      connectionStatus: sourceType === "manual" ? "manual_only" : sourceType === "n8n" ? "connected" : "not_connected",
      connectionValue:  undefined,
      lastSyncAt:       undefined,
      recordsIngested:  undefined,
      updatedAt:        new Date().toISOString(),
    };
    upsertConnection(businessId, next);
    setConn(next);
    setInput("");
    setEditing(false);
  }

  const isConnected = conn.connectionStatus === "connected" || conn.connectionStatus === "manual_only";

  return (
    <div className="flex flex-col gap-3 px-6 py-4">
      <div className="flex items-start gap-4">
        <div className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
          isConnected ? "bg-emerald-500/10" : "bg-muted"
        )}>
          {conn.connectionStatus === "connected"    && <Wifi   className="w-4 h-4 text-emerald-500" />}
          {conn.connectionStatus === "manual_only"  && <Upload className="w-4 h-4 text-muted-foreground" />}
          {conn.connectionStatus === "not_connected" && <WifiOff className="w-4 h-4 text-muted-foreground/40" />}
          {conn.connectionStatus === "sync_error"   && <AlertCircle className="w-4 h-4 text-red-500" />}
          {conn.connectionStatus === "pending"      && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium">{meta.name}</p>
            <span className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              conn.connectionStatus === "connected"     ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : conn.connectionStatus === "manual_only" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                : conn.connectionStatus === "sync_error"  ? "bg-red-500/10 text-red-600"
                : "bg-muted text-muted-foreground"
            )}>
              {conn.connectionStatus === "connected"     && "Connected"}
              {conn.connectionStatus === "not_connected" && "Not Connected"}
              {conn.connectionStatus === "manual_only"   && "Manual Mode"}
              {conn.connectionStatus === "sync_error"    && "Sync Error"}
              {conn.connectionStatus === "pending"       && "Pending"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
          {conn.lastSyncAt && (
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              Last sync: {new Date(conn.lastSyncAt).toLocaleString()}
              {conn.recordsIngested !== undefined && ` · ${conn.recordsIngested.toLocaleString()} records`}
            </p>
          )}
          {conn.dataCoverage && (
            <p className="text-xs text-muted-foreground/60">Coverage: {conn.dataCoverage}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isConnected && conn.connectionStatus !== "manual_only" && (
            <button onClick={disconnect} className="text-xs text-muted-foreground hover:text-red-500 transition-colors">
              Disconnect
            </button>
          )}
          <button
            onClick={() => setEditing(!editing)}
            className="text-xs text-primary hover:underline"
          >
            {editing ? "Cancel" : isConnected && conn.connectionStatus !== "manual_only" ? "Edit" : meta.connectLabel}
          </button>
        </div>
      </div>

      {editing && (
        <div className="flex gap-2 pl-13">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              sourceType === "tekmetric"  ? "Tekmetric API key…" :
              sourceType === "quickbooks" ? "OAuth token or client ID…" :
              sourceType === "bank"       ? "CSV file path or bank feed URL…" :
              sourceType === "n8n"        ? "N8n financial intake webhook URL…" :
              "File path or notes…"
            }
            className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={save}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Reconciliation center ────────────────────────────────────────────────────

const STATUS_CFG: Record<ReconciliationStatus, { label: string; color: string; icon: typeof Check }> = {
  matched:   { label: "Matched",    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400", icon: Check },
  approved:  { label: "Approved",   color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",             icon: CheckCircle2 },
  unmatched: { label: "Unmatched",  color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",         icon: AlertTriangle },
  review:    { label: "Review",     color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",     icon: AlertCircle },
  escalated: { label: "Escalated",  color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",                icon: AlertCircle },
};

function ReconciliationCenter({ businessId }: { businessId: string }) {
  const [records, setRecords]     = useState<ExpenseRecord[]>(() => loadExpenseRecords(businessId));
  const [filter, setFilter]       = useState<ReconciliationStatus | "all">("all");
  const [showAdd, setShowAdd]     = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Add expense form state
  const [newVendor,   setNewVendor]   = useState("");
  const [newAmount,   setNewAmount]   = useState("");
  const [newDocType,  setNewDocType]  = useState("Invoice");
  const [newCategory, setNewCategory] = useState("");
  const [newDueDate,  setNewDueDate]  = useState("");

  function addRecord() {
    if (!newVendor.trim() || !newAmount.trim()) return;
    const r = addExpenseRecord(businessId, {
      businessId,
      vendorName:            newVendor.trim(),
      documentType:          newDocType,
      amount:                parseFloat(newAmount),
      expenseCategory:       newCategory || undefined,
      dueDate:               newDueDate || undefined,
      reconciliationStatus:  "unmatched",
    });
    setRecords((p) => [r, ...p]);
    setNewVendor(""); setNewAmount(""); setNewCategory(""); setNewDueDate("");
    setShowAdd(false);
  }

  function updateStatus(id: string, status: ReconciliationStatus) {
    updateExpenseRecord(businessId, id, { reconciliationStatus: status });
    setRecords(loadExpenseRecords(businessId));
  }

  const filtered = filter === "all" ? records : records.filter((r) => r.reconciliationStatus === filter);

  const stats = {
    total:     records.length,
    matched:   records.filter((r) => r.reconciliationStatus === "matched").length,
    approved:  records.filter((r) => r.reconciliationStatus === "approved").length,
    unmatched: records.filter((r) => r.reconciliationStatus === "unmatched").length,
    review:    records.filter((r) => r.reconciliationStatus === "review").length,
  };

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Total Expenses", value: stats.total,     color: "text-foreground" },
          { label: "Matched",        value: stats.matched,   color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Approved",       value: stats.approved,  color: "text-blue-600 dark:text-blue-400" },
          { label: "Unmatched",      value: stats.unmatched, color: "text-amber-600 dark:text-amber-400" },
          { label: "Review Needed",  value: stats.review,    color: "text-orange-600 dark:text-orange-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className={cn("text-2xl font-bold", color)} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {(["all", "matched", "unmatched", "review", "approved", "escalated"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all",
                filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f === "all" ? `All (${stats.total})` : f}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Expense
          </button>
        </div>
      </div>

      {/* Add expense form */}
      {showAdd && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold">Add Expense Record</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Vendor Name *</label>
              <input
                value={newVendor}
                onChange={(e) => setNewVendor(e.target.value)}
                placeholder="e.g. AutoZone, Cintas…"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Amount *</label>
              <input
                type="number"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Document Type</label>
              <select
                value={newDocType}
                onChange={(e) => setNewDocType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {["Invoice", "Statement", "Receipt", "Credit Memo", "Purchase Order"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="e.g. Parts, Supplies, Utilities…"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Due Date</label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addRecord}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90">
              Add Record
            </button>
            <button onClick={() => setShowAdd(false)}
              className="px-4 py-2 border border-border text-sm rounded-lg hover:bg-muted">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Expense records table */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
          <Scale className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No expense records</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {filter === "all"
              ? "Add expenses manually or connect N8n to auto-ingest from uploaded invoices."
              : `No records with status "${filter}".`}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Vendor</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Type</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Amount</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Due Date</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Match</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rec) => {
                const cfg     = STATUS_CFG[rec.reconciliationStatus];
                const StatusIcon = cfg.icon;
                const isExpanded = expandedId === rec.id;

                return (
                  <Fragment key={rec.id}>
                    <tr
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">{rec.vendorName}</p>
                        {rec.expenseCategory && <p className="text-xs text-muted-foreground">{rec.expenseCategory}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{rec.documentType}</td>
                      <td className="px-4 py-3 text-sm font-mono text-right font-semibold">
                        ${rec.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {rec.dueDate ? new Date(rec.dueDate + "T00:00:00").toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full w-fit", cfg.color)}>
                          <StatusIcon className="w-3 h-3" /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {rec.matchedReference ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 justify-end">
                          {rec.driveViewLink && (
                            <button
                              onClick={(e) => { e.stopPropagation(); window.open(rec.driveViewLink, "_blank"); }}
                              className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                              title="View original"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded action row */}
                    {isExpanded && (
                      <tr key={`${rec.id}-exp`} className="bg-muted/20 border-b border-border/50">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted-foreground font-medium mr-2">Update status:</span>
                            {(["matched", "approved", "unmatched", "review", "escalated"] as ReconciliationStatus[]).map((s) => {
                              const c = STATUS_CFG[s];
                              return (
                                <button
                                  key={s}
                                  onClick={(e) => { e.stopPropagation(); updateStatus(rec.id, s); }}
                                  className={cn(
                                    "flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-all",
                                    rec.reconciliationStatus === s
                                      ? cn(c.color, "border-current/40")
                                      : "border-border text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  {rec.reconciliationStatus === s && <Check className="w-2.5 h-2.5" />}
                                  {c.label}
                                </button>
                              );
                            })}
                            {rec.notes && (
                              <span className="text-xs text-muted-foreground ml-2 italic">{rec.notes}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Instructions */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>
          Expense records can be added manually above or ingested automatically via the N8n workflow when
          invoices are uploaded through the Document Center. Each record chains back to its source document
          for full audit traceability.
        </span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = "overview" | "pl" | "reconciliation" | "sources";

export default function FinancialManagement({ businessId = "true-blue" }: { businessId?: string }) {
  const [portfolio, setPortfolio] = useState<PortfolioState>(loadPortfolio);
  const business = portfolio.businesses.find((b) => b.id === businessId);
  const isActive = business?.financialManagementActive ?? false;

  const [activation, setActivation] = useState<Record<string, boolean>>(() => loadActivation(businessId));
  const [activating, setActivating] = useState(false);

  const completedCount = ACTIVATION_ITEMS.filter((i) => activation[i.id]).length;
  const completionPct  = Math.round((completedCount / ACTIVATION_ITEMS.length) * 100);
  const allDone        = completedCount === ACTIVATION_ITEMS.length;

  const [activeTab, setActiveTab] = useState<Tab>("overview");

  function toggleItem(id: string) {
    const next = { ...activation, [id]: !activation[id] };
    setActivation(next);
    saveActivation(businessId, next);
  }

  function activate() {
    if (!allDone) return;
    setActivating(true);
    setTimeout(() => {
      const next: PortfolioState = {
        businesses: portfolio.businesses.map((b) =>
          b.id === businessId
            ? { ...b, financialManagementActive: true, stage: "operating", closedDate: new Date().toISOString() }
            : b
        ),
      };
      setPortfolio(next);
      savePortfolio(next);
      setActivating(false);
    }, 1500);
  }

  // ─── Pre-activation (bypassed in demo mode — always show full dashboard) ─────
  if (false && !isActive) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Financial Management</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs font-semibold border border-border">
                <Lock className="w-3 h-3" /> Not Yet Active
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Complete the activation checklist below to unlock post-close financial operations.</p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-primary/5 to-emerald-500/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Activate Financial Management</h2>
                <p className="text-xs text-muted-foreground">Completion launches your post-close operating dashboard</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{completionPct}%</p>
              <p className="text-xs text-muted-foreground">{completedCount}/{ACTIVATION_ITEMS.length} complete</p>
            </div>
          </div>

          <div className="h-1.5 bg-muted">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${completionPct}%` }} />
          </div>

          <div className="divide-y divide-border">
            {ACTIVATION_ITEMS.map((item) => {
              const done = !!activation[item.id];
              return (
                <button key={item.id} onClick={() => toggleItem(item.id)}
                  className="w-full flex items-start gap-4 px-6 py-4 hover:bg-muted/30 transition-colors text-left">
                  <div className="mt-0.5 flex-shrink-0">
                    {done ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5 text-muted-foreground/40" />}
                  </div>
                  <div className="flex-1">
                    <p className={cn("text-sm font-medium", done && "line-through text-muted-foreground")}>{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  </div>
                  {done && <span className="text-xs text-emerald-500 font-medium flex-shrink-0">Done</span>}
                </button>
              );
            })}
          </div>

          <div className="px-6 py-5 border-t border-border bg-muted/20 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {allDone ? "All systems confirmed — ready to activate." : `${ACTIVATION_ITEMS.length - completedCount} items remaining.`}
            </p>
            <button
              onClick={activate}
              disabled={!allDone || activating}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all",
                allDone && !activating
                  ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/25"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {activating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Activating…</> : <><Zap className="w-4 h-4" /> Activate Financial Management</>}
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-card rounded-2xl border border-dashed border-border p-6 opacity-40 select-none">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
            <Lock className="w-3 h-3" /> Preview — Unlocks After Activation
          </p>
          <div className="grid grid-cols-4 gap-3">
            {["Revenue vs Target", "Gross Profit %", "EBITDA", "Net Income"].map((label) => (
              <div key={label} className="bg-muted/40 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-muted-foreground/20">—</p>
                <p className="text-xs text-muted-foreground/50 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Post-activation dashboard ──────────────────────────────────────────────
  const TABS: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
    { id: "overview",       label: "Overview",       icon: BarChart3 },
    { id: "pl",             label: "P&L",            icon: TrendingUp },
    { id: "reconciliation", label: "Reconciliation", icon: Scale },
    { id: "sources",        label: "Data Sources",   icon: Database },
  ];

  const sourceTypes: SourceType[] = ["tekmetric", "quickbooks", "bank", "n8n", "manual"];
  const connectedCount = sourceTypes.filter((s) => {
    const c = getConnection(businessId, s);
    return c.connectionStatus === "connected" || c.connectionStatus === "manual_only";
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Financial Management</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-semibold border border-emerald-500/20">
              <Activity className="w-3 h-3" /> Operating
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{business?.name} · {business?.entityName}</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="h-9 px-3 rounded-lg border border-border bg-card text-sm">
            <option>This Month</option>
            <option>Last Month</option>
            <option>Last 30 Days</option>
            <option>Last 90 Days</option>
            <option>Trailing 12 Months</option>
          </select>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-sm hover:bg-muted transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all",
              activeTab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {id === "sources" && (
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{connectedCount}/{sourceTypes.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Overview tab ─────────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard label="Monthly Revenue"  target="$200,000"  prefix="$" hasData={false} />
            <KPICard label="Gross Profit %"   target="70%"       prefix="" suffix="%" hasData={false} />
            <KPICard label="EBITDA"           target="~$45K/mo"  prefix="$" hasData={false} />
            <KPICard label="Net Income"       target="$34,000"   prefix="$" hasData={false} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <KPICard label="Car Count"     target="200/mo"   prefix="" suffix=" cars" hasData={false} />
            <KPICard label="ARO"           target="$1,000"   prefix="$" hasData={false} />
            <KPICard label="Cash Position" target="Positive" prefix="$" hasData={false} />
          </div>

          {/* AI Commentary */}
          <div className="bg-gradient-to-br from-primary/5 to-emerald-500/5 rounded-2xl border border-primary/10 p-6">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>AI Financial Commentary</h3>
              <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted border border-border">Waiting for data</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Once data sources are connected, AI-powered commentary will appear here — including revenue trend analysis,
              margin performance, anomaly detection, period comparisons, and actionable operational recommendations.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground/60">Connect Tekmetric and QuickBooks to generate your first AI analysis.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── P&L tab ─────────────────────────────────────────────────────────── */}
      {activeTab === "pl" && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Profit & Loss</h2>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Actual</span>
              <span>Target</span>
              <span>Prior Period</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Line Item</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2.5">Actual</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2.5">Target</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2.5">Prior</th>
                </tr>
              </thead>
              <tbody>
                <PLRow label="Revenue"            bold />
                <PLRow label="Labor Revenue"      indent={1} />
                <PLRow label="Parts Revenue"      indent={1} />
                <PLRow label="Other Revenue"      indent={1} />
                <PLRow label="Cost of Goods Sold" bold />
                <PLRow label="Labor COGS"         indent={1} />
                <PLRow label="Parts COGS"         indent={1} />
                <PLRow label="Gross Profit"       bold highlight="green" />
                <PLRow label="Operating Expenses" bold />
                <PLRow label="Payroll"            indent={1} />
                <PLRow label="Rent"               indent={1} />
                <PLRow label="Utilities"          indent={1} />
                <PLRow label="Marketing"          indent={1} />
                <PLRow label="Insurance"          indent={1} />
                <PLRow label="Supplies"           indent={1} />
                <PLRow label="Other Expenses"     indent={1} />
                <PLRow label="EBITDA"             bold highlight="blue" />
                <PLRow label="Depreciation"       indent={1} />
                <PLRow label="Interest"           indent={1} />
                <PLRow label="Taxes"              indent={1} />
                <PLRow label="Net Income"         bold highlight="green" />
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            Connect data sources (Data Sources tab) to populate this table from Tekmetric, QuickBooks, or N8n.
          </div>
        </div>
      )}

      {/* ── Reconciliation tab ───────────────────────────────────────────────── */}
      {activeTab === "reconciliation" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Expense Reconciliation</h2>
            <p className="text-xs text-muted-foreground">Match uploaded expense documents to bank transactions</p>
          </div>
          <ReconciliationCenter businessId={businessId} />
        </div>
      )}

      {/* ── Data Sources tab ─────────────────────────────────────────────────── */}
      {activeTab === "sources" && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Data Source Connections</h2>
            </div>
            <span className="text-xs text-muted-foreground">{connectedCount}/{sourceTypes.length} connected</span>
          </div>
          <div className="divide-y divide-border">
            {sourceTypes.map((s) => (
              <DataSourceCard key={s} businessId={businessId} sourceType={s} />
            ))}
          </div>
          <div className="px-6 py-4 border-t border-border bg-muted/20">
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              Financial data ingested via N8n follows the canonical schema: portfolioId → businessId → dealId → period → records.
              Each record chains to a source document for full audit traceability. Tekmetric and QuickBooks data flows
              through N8n before reaching this dashboard.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
