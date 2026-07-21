import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  Building2, TrendingUp, CheckCircle2, Plus, ChevronRight,
  AlertTriangle, Clock, Briefcase, DollarSign, BarChart3,
  X, ArrowRight, Layers, Loader2, Trash2, RotateCcw,
  MoreVertical, Archive, Search, Filter, Users,
} from "lucide-react";
import {
  type Business, type BusinessStage,
  type PipelineStage,
  STAGE_LABELS, STAGE_COLORS, PIPELINE_STAGE_LABELS,
  savePortfolio, loadPortfolioFromDB, saveBusinessToDB,
  type PortfolioState,
  getLifecycleState,
  moveBusinessToPipeline,
  moveBusinessToActive,
  moveBusinessToTrash,
  restoreBusinessFromTrash,
  permanentlyDeleteBusiness,
  purgeExpiredTrash,
  daysUntilPurge,
} from "@/lib/storage";
import { cn } from "@/lib/utils";
import { useClerk } from "@clerk/react";
import { useCurrentDealUser } from "@/lib/auth";
import IntakeWizard, { LaunchSummary } from "@/components/IntakeWizard";

// ─── Utility formatters ────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastData = { id: number; message: string; type: "success" | "error" };

function Toast({ t, onDismiss }: { t: ToastData; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(t.id), 4500);
    return () => clearTimeout(timer);
  }, [t.id, onDismiss]);

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium max-w-sm",
        t.type === "success"
          ? "bg-card border-emerald-500/30 text-emerald-400"
          : "bg-card border-red-500/30 text-red-400",
      )}
    >
      {t.type === "success"
        ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
      <span className="flex-1 text-foreground">{t.message}</span>
      <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 transition-opacity">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Confirm Modal ─────────────────────────────────────────────────────────────

type ModalVariant =
  | "move-to-pipeline"
  | "move-to-active"
  | "trash"
  | "restore"
  | "permanent-delete";

type ConfirmState = { variant: ModalVariant; business: Business };

const MODAL_CONFIG: Record<ModalVariant, {
  title: string;
  body: React.ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  confirmClass: string;
}> = {
  "move-to-pipeline": {
    title: "Move to Pipeline?",
    body: "This business will move out of your active portfolio and into the pipeline. All workspace data, notes, and documents are preserved — only the location in your portfolio changes.",
    cancelLabel: "Cancel",
    confirmLabel: "Move to Pipeline",
    confirmClass: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  "move-to-active": {
    title: "Move to Active Portfolio?",
    body: "This business will move from the pipeline into your active portfolio. All workspace data is preserved.",
    cancelLabel: "Cancel",
    confirmLabel: "Move to Active Portfolio",
    confirmClass: "bg-primary hover:bg-primary/90 text-white",
  },
  "trash": {
    title: "Delete business workspace?",
    body: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          This will remove the business from your portfolio and move it to Trash for{" "}
          <strong className="text-foreground">10 days</strong>.
        </p>
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 leading-relaxed">
          <strong>Important:</strong> This removes the business workspace from this app only.
          Documents associated with this business may still remain in your Drive or connected
          storage and will not be deleted there.
        </div>
        <p className="text-xs text-muted-foreground">
          You can restore this workspace from Trash within 10 days. After that, it is permanently deleted.
        </p>
      </div>
    ),
    cancelLabel: "Cancel",
    confirmLabel: "Move to Trash",
    confirmClass: "bg-amber-600 hover:bg-amber-700 text-white",
  },
  "restore": {
    title: "Restore this workspace?",
    body: "This business will be restored to its previous location in your portfolio. All workspace data is intact.",
    cancelLabel: "Cancel",
    confirmLabel: "Restore",
    confirmClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  "permanent-delete": {
    title: "Permanently delete?",
    body: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          This will <strong className="text-red-400">permanently and irreversibly</strong> delete
          this business workspace from the app.
        </p>
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 leading-relaxed">
          <strong>This cannot be undone.</strong> Documents associated with this business may still
          remain in your Drive or connected storage and will not be deleted there.
        </div>
      </div>
    ),
    cancelLabel: "Cancel",
    confirmLabel: "Delete Permanently",
    confirmClass: "bg-red-600 hover:bg-red-700 text-white",
  },
};

function ConfirmModal({
  state,
  onCancel,
  onConfirm,
  loading,
}: {
  state: ConfirmState;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const cfg = MODAL_CONFIG[state.variant];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-md">
        <h2 className="text-base font-bold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {cfg.title}
        </h2>
        <p className="text-xs text-muted-foreground font-medium mb-4">{state.business.name}</p>
        <div className="mb-6 text-sm text-muted-foreground">
          {typeof cfg.body === "string" ? <p>{cfg.body}</p> : cfg.body}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            {cfg.cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn("flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2", cfg.confirmClass)}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {cfg.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Action Dropdown ───────────────────────────────────────────────────────────

type ActionItem = { label: string; icon: React.ElementType; onClick: () => void; danger?: boolean };

function ActionMenu({ actions }: { actions: ActionItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1"
      >
        Edit <MoreVertical className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-30 bg-popover border border-border rounded-xl shadow-xl w-52 py-1 overflow-hidden">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={(e) => { e.stopPropagation(); setOpen(false); a.onClick(); }}
              className={cn(
                "flex items-center gap-2.5 w-full px-4 py-2.5 text-xs font-medium transition-colors text-left",
                a.danger
                  ? "text-red-400 hover:bg-red-500/10"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <a.icon className="w-3.5 h-3.5 flex-shrink-0" />
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function StageBadge({ stage }: { stage: BusinessStage }) {
  const c = STAGE_COLORS[stage];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border", c.bg, c.text, c.border)}>
      {STAGE_LABELS[stage]}
    </span>
  );
}

function PipelineStageBadge({ stage }: { stage?: PipelineStage }) {
  if (!stage) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-blue-500/10 text-blue-400 border-blue-500/20">
      {PIPELINE_STAGE_LABELS[stage]}
    </span>
  );
}

function TrashCountdown({ purgeAt }: { purgeAt: string }) {
  const days = daysUntilPurge(purgeAt);
  const urgent = days <= 2;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border",
      urgent
        ? "bg-red-500/15 text-red-400 border-red-500/30"
        : "bg-amber-500/10 text-amber-400 border-amber-500/20",
    )}>
      <Clock className="w-2.5 h-2.5" />
      {days <= 0 ? "Purging soon" : `${days} day${days === 1 ? "" : "s"} left`}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: number | string; sub?: string; color: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 flex items-center gap-4">
      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0", color)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{value}</p>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Business Card (Active Portfolio) ─────────────────────────────────────────

function BusinessCard({
  business,
  onMoveToPipeline,
  onTrash,
  onEdit,
}: {
  business: Business;
  onMoveToPipeline: () => void;
  onTrash: () => void;
  onEdit: () => void;
}) {
  const c = STAGE_COLORS[business.stage];
  const docsCount = business.docsReceived
    ? Object.values(business.docsReceived).filter(Boolean).length
    : undefined;

  const actions: ActionItem[] = [
    { label: "Edit business details", icon: Filter, onClick: onEdit },
    { label: "Move to Pipeline", icon: Archive, onClick: onMoveToPipeline },
    { label: "Delete workspace", icon: Trash2, onClick: onTrash, danger: true },
  ];

  return (
    <div className={cn("bg-card rounded-xl border-2 p-5 flex flex-col gap-4 hover:shadow-md transition-shadow", c.border)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold", c.bg, c.text)}>
            {business.name.split(" ").slice(0, 2).map(w => w[0]).join("")}
          </div>
          <div>
            <h3 className="font-bold text-sm leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {business.name}
            </h3>
            <p className="text-xs text-muted-foreground">{business.industry || "Business"}</p>
          </div>
        </div>
        <StageBadge stage={business.stage} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><p className="text-muted-foreground/70">Deal Price</p><p className="font-semibold">{fmtMoney(business.dealPrice)}</p></div>
        <div><p className="text-muted-foreground/70">Seller</p><p className="font-semibold truncate">{business.seller || "—"}</p></div>
        <div><p className="text-muted-foreground/70">Buyer Entity</p><p className="font-semibold truncate">{business.entityName || "—"}</p></div>
        <div>
          <p className="text-muted-foreground/70">
            {business.stage === "operating" || business.stage === "closed" ? "Closed" : "Target Close"}
          </p>
          <p className="font-semibold">
            {business.stage === "operating" || business.stage === "closed"
              ? fmtDate(business.closedDate)
              : fmtDate(business.targetCloseDate)}
          </p>
        </div>
      </div>

      {(business.acquisitionType || business.sbaRequired || (business.financingTypes && business.financingTypes.length > 0)) && (
        <div className="flex flex-wrap gap-1.5">
          {business.acquisitionType && business.acquisitionType !== "undecided" && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20 capitalize">
              {business.acquisitionType} Purchase
            </span>
          )}
          {(business.sbaRequired || business.financingTypes?.includes("sba")) && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-500/10 text-violet-500 border border-violet-500/20">SBA</span>
          )}
          {business.sellerFinancingExpected && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">Seller Note</span>
          )}
          {business.rollupIntent && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">Rollup</span>
          )}
        </div>
      )}

      {docsCount !== undefined && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${Math.round((docsCount / 9) * 100)}%` }} />
          </div>
          <span className="text-xs text-muted-foreground/70 font-medium">{docsCount}/9 docs</span>
        </div>
      )}

      <div className="flex items-center gap-2 mt-auto pt-1">
        <Link href={`/b/${business.id}`} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors">
          Open Workspace <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <Link href={`/b/${business.id}/finance`} className="flex items-center justify-center gap-1 px-3 py-2 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-lg text-xs font-semibold hover:bg-emerald-500/20 transition-colors">
          <BarChart3 className="w-3.5 h-3.5" />
        </Link>
        <ActionMenu actions={actions} />
      </div>
    </div>
  );
}

// ─── Pipeline Card ─────────────────────────────────────────────────────────────

function PipelineCard({
  business,
  onMoveToActive,
  onTrash,
  onEdit,
}: {
  business: Business;
  onMoveToActive: () => void;
  onTrash: () => void;
  onEdit: () => void;
}) {
  const actions: ActionItem[] = [
    { label: "Edit business details", icon: Filter, onClick: onEdit },
    { label: "Move to Active Portfolio", icon: TrendingUp, onClick: onMoveToActive },
    { label: "Delete workspace", icon: Trash2, onClick: onTrash, danger: true },
  ];

  return (
    <div className="bg-card rounded-xl border-2 border-blue-500/20 p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold bg-blue-500/15 text-blue-400">
            {business.name.split(" ").slice(0, 2).map(w => w[0]).join("")}
          </div>
          <div>
            <h3 className="font-bold text-sm leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {business.name}
            </h3>
            <p className="text-xs text-muted-foreground">{business.location || business.industry || "Business"}</p>
          </div>
        </div>
        <PipelineStageBadge stage={business.pipelineStage} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><p className="text-muted-foreground/70">Deal Price</p><p className="font-semibold">{fmtMoney(business.dealPrice)}</p></div>
        <div><p className="text-muted-foreground/70">Seller</p><p className="font-semibold truncate">{business.seller || "—"}</p></div>
        <div><p className="text-muted-foreground/70">Industry</p><p className="font-semibold truncate">{business.industry || "—"}</p></div>
        <div><p className="text-muted-foreground/70">Added</p><p className="font-semibold">{fmtDate(business.createdAt)}</p></div>
      </div>

      {business.description && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{business.description}</p>
      )}

      <div className="flex items-center gap-2 mt-auto pt-1">
        <Link href={`/b/${business.id}`} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors">
          Open Workspace <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <button
          onClick={onMoveToActive}
          className="flex items-center justify-center gap-1 px-3 py-2 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-lg text-xs font-semibold hover:bg-emerald-500/20 transition-colors"
          title="Move to Active Portfolio"
        >
          <TrendingUp className="w-3.5 h-3.5" />
        </button>
        <ActionMenu actions={actions} />
      </div>
    </div>
  );
}

// ─── Trash Card ───────────────────────────────────────────────────────────────

function TrashCard({
  business,
  onRestore,
  onPermanentDelete,
}: {
  business: Business;
  onRestore: () => void;
  onPermanentDelete: () => void;
}) {
  const actions: ActionItem[] = [
    { label: "Restore workspace", icon: RotateCcw, onClick: onRestore },
    { label: "Delete permanently", icon: Trash2, onClick: onPermanentDelete, danger: true },
  ];

  const prevLabel = business.previousLifecycleState === "pipeline" ? "Pipeline" : "Active Portfolio";

  return (
    <div className="bg-card rounded-xl border-2 border-red-500/20 p-5 flex flex-col gap-4 opacity-80 hover:opacity-100 transition-opacity">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold bg-muted text-muted-foreground">
            {business.name.split(" ").slice(0, 2).map(w => w[0]).join("")}
          </div>
          <div>
            <h3 className="font-bold text-sm leading-tight line-through text-muted-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {business.name}
            </h3>
            <p className="text-xs text-muted-foreground/60">Was in {prevLabel}</p>
          </div>
        </div>
        {business.purgeAt && <TrashCountdown purgeAt={business.purgeAt} />}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><p className="text-muted-foreground/70">Deal Price</p><p className="font-medium text-muted-foreground">{fmtMoney(business.dealPrice)}</p></div>
        <div><p className="text-muted-foreground/70">Deleted</p><p className="font-medium text-muted-foreground">{fmtDate(business.deletedAt)}</p></div>
        <div><p className="text-muted-foreground/70">Permanent deletion</p><p className="font-medium text-muted-foreground">{fmtDate(business.purgeAt)}</p></div>
        <div><p className="text-muted-foreground/70">Industry</p><p className="font-medium text-muted-foreground">{business.industry || "—"}</p></div>
      </div>

      <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15 text-xs text-amber-300/80 leading-relaxed">
        Documents may still exist in your Drive or connected storage.
      </div>

      <div className="flex items-center gap-2 mt-auto pt-1">
        <button
          onClick={onRestore}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600/90 text-white rounded-lg text-xs font-semibold hover:bg-emerald-600 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Restore
        </button>
        <ActionMenu actions={actions} />
      </div>
    </div>
  );
}

// ─── Empty States ──────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, body, action }: {
  icon: React.ElementType;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-20 text-muted-foreground">
      <Icon className="w-12 h-12 mx-auto mb-4 opacity-20" />
      <p className="text-sm font-semibold text-foreground/60">{title}</p>
      <p className="text-xs text-muted-foreground/70 mt-1.5 max-w-xs mx-auto leading-relaxed">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

const EMPTY_PORTFOLIO: PortfolioState = { businesses: [] };
type Tab = "active" | "pipeline" | "trash";

export default function PortfolioHome() {
  const { signOut } = useClerk();
  const [, navigate] = useLocation();
  const { data: dealUser } = useCurrentDealUser();

  const [portfolio,      setPortfolio]     = useState<PortfolioState>(EMPTY_PORTFOLIO);
  const [loading,        setLoading]       = useState(true);
  const [activeTab,      setActiveTab]     = useState<Tab>("active");
  const [showWizard,     setShowWizard]    = useState(false);
  const [launchBusiness, setLaunchBusiness] = useState<Business | null>(null);
  const [filterStage,    setFilterStage]   = useState<BusinessStage | "all">("all");
  const [search,         setSearch]        = useState("");
  const [confirmState,   setConfirmState]  = useState<ConfirmState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [toasts,         setToasts]        = useState<ToastData[]>([]);
  const toastCounter = useRef(0);

  // ── Load portfolio ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadPortfolioFromDB().then((data) => {
      if (cancelled) return;
      // Client-side: hide any businesses whose purge date has already passed
      // (server will hard-delete them on the same request, but filter client-side too)
      const { keep } = purgeExpiredTrash(data.businesses);
      setPortfolio({ ...data, businesses: keep });
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // ── Derived lists ───────────────────────────────────────────────────────────
  const allBusinesses  = portfolio.businesses;
  const activeList     = allBusinesses.filter((b) => getLifecycleState(b) === "active_portfolio");
  const pipelineList   = allBusinesses.filter((b) => getLifecycleState(b) === "pipeline");
  const trashList      = allBusinesses.filter((b) => getLifecycleState(b) === "trashed");

  const totalValue = activeList.reduce((s, b) => s + b.dealPrice, 0);

  const filteredActive = activeList
    .filter((b) => filterStage === "all" || b.stage === filterStage)
    .filter((b) => !search || b.name.toLowerCase().includes(search.toLowerCase()));

  const filteredPipeline = pipelineList
    .filter((b) => !search || b.name.toLowerCase().includes(search.toLowerCase()));

  const filteredTrash = trashList
    .filter((b) => !search || b.name.toLowerCase().includes(search.toLowerCase()));

  // ── Toast helpers ───────────────────────────────────────────────────────────
  function addToast(message: string, type: "success" | "error" = "success") {
    const id = ++toastCounter.current;
    setToasts((t) => [...t, { id, message, type }]);
  }
  function dismissToast(id: number) {
    setToasts((t) => t.filter((x) => x.id !== id));
  }

  // ── Business state updater ──────────────────────────────────────────────────
  function applyUpdate(updated: Business) {
    setPortfolio((prev) => ({
      ...prev,
      businesses: prev.businesses.map((b) => (b.id === updated.id ? updated : b)),
    }));
    const next = { ...portfolio, businesses: portfolio.businesses.map((b) => b.id === updated.id ? updated : b) };
    savePortfolio(next);
  }

  function removeFromState(id: string) {
    setPortfolio((prev) => ({
      ...prev,
      businesses: prev.businesses.filter((b) => b.id !== id),
    }));
  }

  // ── Confirm modal handler ────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!confirmState) return;
    setConfirmLoading(true);
    const { variant, business } = confirmState;
    try {
      if (variant === "move-to-pipeline") {
        const updated = await moveBusinessToPipeline(business);
        applyUpdate(updated);
        setActiveTab("pipeline");
        addToast("Business moved to pipeline.");
      } else if (variant === "move-to-active") {
        const updated = await moveBusinessToActive(business);
        applyUpdate(updated);
        setActiveTab("active");
        addToast("Business moved to active portfolio.");
      } else if (variant === "trash") {
        const updated = await moveBusinessToTrash(business);
        applyUpdate(updated);
        addToast(`${business.name} moved to Trash. It will be permanently deleted in 10 days unless restored.`);
      } else if (variant === "restore") {
        const updated = await restoreBusinessFromTrash(business);
        applyUpdate(updated);
        const dest = updated.lifecycleState === "pipeline" ? "pipeline" : "active portfolio";
        setActiveTab(updated.lifecycleState === "pipeline" ? "pipeline" : "active");
        addToast(`${business.name} restored to ${dest}.`);
      } else if (variant === "permanent-delete") {
        await permanentlyDeleteBusiness(business.id);
        removeFromState(business.id);
        addToast(`${business.name} permanently deleted.`);
      }
      setConfirmState(null);
    } catch (err) {
      addToast((err as Error).message, "error");
    } finally {
      setConfirmLoading(false);
    }
  }

  // ── Intake wizard handlers ──────────────────────────────────────────────────
  function handleIntakeSave(newB: Business) {
    const next: PortfolioState = { ...portfolio, businesses: [...portfolio.businesses, newB] };
    setPortfolio(next);
    savePortfolio(next);
    void saveBusinessToDB(newB);
    setShowWizard(false);
    setLaunchBusiness(newB);
  }

  const isBuyer = dealUser?.role === "buyer" || dealUser?.role === "super_admin";

  // ── Tab counts ──────────────────────────────────────────────────────────────
  const tabs: { key: Tab; label: string; count: number; icon: React.ElementType }[] = [
    { key: "active",   label: "Active Portfolio", count: activeList.length,   icon: Briefcase },
    { key: "pipeline", label: "Pipeline",         count: pipelineList.length, icon: TrendingUp },
    { key: "trash",    label: "Trash",            count: trashList.length,    icon: Trash2 },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-sidebar flex flex-col border-r border-sidebar-border z-50">
        <div className="px-6 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sidebar-foreground text-[10px] font-semibold tracking-wider uppercase opacity-50">Portfolio</p>
              <h1 className="text-white font-bold text-sm leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                HAB Enterprises
              </h1>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <NavItem href="/" icon={Layers} label="Portfolio Home" active />
          {isBuyer && <NavItem href="/crm" icon={Briefcase} label="CRM" />}
          {isBuyer && <NavItem href="/admin" icon={Users} label="Admin Console" />}
        </nav>
        <div className="px-5 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
              {((dealUser?.name || dealUser?.email) ?? "H").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sidebar-foreground text-xs font-medium truncate">
                {dealUser?.name || dealUser?.email || "Heath Blake"}
              </p>
              <p className="text-sidebar-foreground text-xs opacity-50 capitalize">{dealUser?.role ?? "buyer"}</p>
            </div>
            <button onClick={() => signOut()} title="Sign out" className="text-sidebar-foreground opacity-40 hover:opacity-100 transition-opacity">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-64 p-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Portfolio Command Center
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              HAB Enterprises 3 LLC · Heath Blake, Managing Member
            </p>
          </div>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Business
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard icon={Briefcase}    label="Active Portfolio"     value={activeList.length}        color="bg-primary"      />
              <StatCard icon={TrendingUp}   label="Pipeline Leads"       value={pipelineList.length}      color="bg-blue-600"     />
              <StatCard icon={CheckCircle2} label="Operating"            value={activeList.filter(b => b.stage === "operating").length} color="bg-emerald-600" />
              <StatCard icon={DollarSign}   label="Portfolio Value"      value={fmtMoney(totalValue)}     color="bg-slate-600"    />
            </div>

            {/* Tab navigation */}
            <div className="flex items-center gap-1 mb-6 border-b border-border">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                    activeTab === tab.key
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                    tab.key === "trash" && trashList.length > 0 && activeTab !== "trash"
                      ? "text-amber-400 hover:text-amber-300"
                      : "",
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-full text-xs font-bold",
                      activeTab === tab.key
                        ? "bg-primary/20 text-primary"
                        : tab.key === "trash"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-muted text-muted-foreground",
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}

              {/* Search */}
              <div className="ml-auto flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary w-40"
                  />
                </div>
              </div>
            </div>

            {/* ── Active Portfolio Tab ────────────────────────────────────────── */}
            {activeTab === "active" && (
              <>
                {/* Stage filter pills */}
                <div className="flex items-center gap-2 mb-6 flex-wrap">
                  {(["all", "lead", "diligence", "loi", "close-ready", "closed", "operating", "archived"] as const).map((s) => {
                    const count = s === "all" ? activeList.length : activeList.filter(b => b.stage === s).length;
                    if (s !== "all" && count === 0) return null;
                    const isActive = filterStage === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setFilterStage(s)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                          isActive
                            ? "bg-primary text-white border-primary"
                            : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/30",
                        )}
                      >
                        {s === "all" ? "All" : STAGE_LABELS[s]} <span className="ml-1 opacity-60">{count}</span>
                      </button>
                    );
                  })}
                </div>

                {filteredActive.length === 0 ? (
                  <EmptyState
                    icon={Building2}
                    title={search ? "No matching businesses" : "No active businesses yet"}
                    body={search ? "Try a different search term." : "Add your first business or move a pipeline lead here."}
                    action={
                      !search && (
                        <button onClick={() => setShowWizard(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
                          <Plus className="w-4 h-4" /> Add Business
                        </button>
                      )
                    }
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredActive.map((b) => (
                      <BusinessCard
                        key={b.id}
                        business={b}
                        onMoveToPipeline={() => setConfirmState({ variant: "move-to-pipeline", business: b })}
                        onTrash={() => setConfirmState({ variant: "trash", business: b })}
                        onEdit={() => setShowWizard(true)}
                      />
                    ))}
                  </div>
                )}

                {activeList.some((b) => b.stage === "close-ready") && (
                  <div className="mt-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-400">Close-Ready Businesses Require Attention</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {activeList.filter(b => b.stage === "close-ready").map(b => b.name).join(", ")} — review final closing steps.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Pipeline Tab ────────────────────────────────────────────────── */}
            {activeTab === "pipeline" && (
              <>
                {filteredPipeline.length === 0 ? (
                  <EmptyState
                    icon={TrendingUp}
                    title={search ? "No matching pipeline businesses" : "No businesses in pipeline yet"}
                    body={
                      search
                        ? "Try a different search term."
                        : "Move a lead here to track opportunities before they become active. Use the Edit menu on any active business card."
                    }
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredPipeline.map((b) => (
                      <PipelineCard
                        key={b.id}
                        business={b}
                        onMoveToActive={() => setConfirmState({ variant: "move-to-active", business: b })}
                        onTrash={() => setConfirmState({ variant: "trash", business: b })}
                        onEdit={() => setShowWizard(true)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Trash Tab ───────────────────────────────────────────────────── */}
            {activeTab === "trash" && (
              <>
                {trashList.length > 0 && (
                  <div className="flex items-center gap-3 p-3 mb-5 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs text-amber-300">
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    Items in Trash are permanently deleted after 10 days. Restore anytime before the countdown expires.
                  </div>
                )}
                {filteredTrash.length === 0 ? (
                  <EmptyState
                    icon={Trash2}
                    title={search ? "No matching trashed businesses" : "Trash is empty"}
                    body={
                      search
                        ? "Try a different search term."
                        : "No deleted businesses. Items moved to trash stay here for 10 days before permanent deletion."
                    }
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredTrash.map((b) => (
                      <TrashCard
                        key={b.id}
                        business={b}
                        onRestore={() => setConfirmState({ variant: "restore", business: b })}
                        onPermanentDelete={() => setConfirmState({ variant: "permanent-delete", business: b })}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Intake Wizard */}
      {showWizard && <IntakeWizard onSave={handleIntakeSave} onClose={() => setShowWizard(false)} />}

      {/* Launch Summary */}
      {launchBusiness && (
        <LaunchSummary
          business={launchBusiness}
          onOpen={() => { navigate(`/b/${launchBusiness.id}`); setLaunchBusiness(null); }}
          onBack={() => setLaunchBusiness(null)}
        />
      )}

      {/* Confirm Modal */}
      {confirmState && (
        <ConfirmModal
          state={confirmState}
          onCancel={() => !confirmLoading && setConfirmState(null)}
          onConfirm={handleConfirm}
          loading={confirmLoading}
        />
      )}

      {/* Toast Stack */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <Toast key={t.id} t={t} onDismiss={dismissToast} />
        ))}
      </div>
    </div>
  );
}

// ─── NavItem ──────────────────────────────────────────────────────────────────

function NavItem({ href, icon: Icon, label, active }: {
  href: string; icon: React.ElementType; label: string; active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
        active
          ? "bg-sidebar-accent text-white"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0 opacity-70 group-hover:opacity-100" />
      <span className="flex-1">{label}</span>
      {active && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
    </Link>
  );
}
