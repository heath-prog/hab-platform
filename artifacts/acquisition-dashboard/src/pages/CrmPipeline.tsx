import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  Briefcase, Loader2, AlertTriangle, Plus, Search, Upload,
  MoveRight, GraduationCap, ClipboardCheck, RefreshCw, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import CrmShell from "@/components/CrmShell";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type CrmClient, type CrmTenant,
  CALENDAR_COLORS, cycleLabel, stageLabel,
  useCrmTenants, useCrmClients, useCreateClient, useMoveClientStage, useCrmImport,
} from "@/lib/crm";

// ─── Pipeline board (WP-CRM-UI) ──────────────────────────────────────────────
// Columns from tenant stage config (GET /api/crm/tenants), cards from
// GET /api/crm/tenants/:tid/clients, stage moves via POST /api/crm/clients/:id/stage
// (Contract-Signed onboarding auto-generation surfaced via toast + card badge).

// HAB brand accents (navy/gold) — touches only, app theme stays untouched
const HAB_GOLD = "#C8A75C";

function ClientCard({
  client, tenant, onMove, moving,
}: {
  client: CrmClient;
  tenant: CrmTenant;
  onMove: (client: CrmClient, stageId: string) => void;
  moving: boolean;
}) {
  const color = client.calendarColorId != null ? CALENDAR_COLORS[client.calendarColorId] : null;
  const stages = tenant.stages ?? [];
  return (
    <div className="bg-card border border-border rounded-xl p-3 hover:border-primary/40 transition-colors group">
      <div className="flex items-start gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
          title={color ? `Calendar: ${color.name}` : "Calendar color unassigned"}
          style={{ backgroundColor: color?.hex ?? "transparent", border: color ? "none" : "1px dashed var(--border, #666)" }}
        />
        <Link
          href={`/crm/clients/${client.id}`}
          className="flex-1 min-w-0 text-sm font-semibold leading-snug hover:text-primary transition-colors"
        >
          {client.name}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              title="Move stage"
              className="opacity-40 hover:opacity-100 transition-opacity flex-shrink-0"
              disabled={moving}
            >
              {moving
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <MoveRight className="w-3.5 h-3.5" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs">Move to stage</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {stages.map((s) => (
              <DropdownMenuItem
                key={s.id}
                disabled={s.id === client.stageId}
                onClick={() => onMove(client, s.id)}
                className="text-xs"
              >
                {s.label}
                {s.id === tenant.onboardingTriggerStage && (
                  <ClipboardCheck className="w-3 h-3 ml-auto opacity-50" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {tenant.features?.curriculum && client.curriculumWeek != null && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary"
            title={cycleLabel(client.curriculumCycle)}
          >
            <GraduationCap className="w-3 h-3" />
            Wk {client.curriculumWeek}
          </span>
        )}
        {client.acquisitionFlag && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Acquisition
          </span>
        )}
        {client.flags.filter((f) => f !== "acquisition").map((f) => (
          <span key={f} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
            {f}
          </span>
        ))}
        {client.isSeed && (
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border"
            style={{ color: HAB_GOLD, borderColor: `${HAB_GOLD}55`, backgroundColor: `${HAB_GOLD}14` }}
            title={client.seedNote ?? "Seeded from HAB records — pending verification"}
          >
            Seed
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Import card — HAB_CRM_v1 JSON export → POST /api/crm/import ─────────────

function ImportCard() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const importMutation = useCrmImport();
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setLastResult(null);
    let payload: unknown;
    try {
      payload = JSON.parse(await file.text());
    } catch {
      toast({ title: "Import failed", description: "That file is not valid JSON.", variant: "destructive" });
      return;
    }
    const p = payload as { schemaVersion?: unknown; tenants?: unknown; accounts?: unknown };
    if (p?.schemaVersion !== 1 || !Array.isArray(p.tenants) || !Array.isArray(p.accounts)) {
      toast({
        title: "Not a HAB CRM v1 export",
        description: "Expected schemaVersion 1 with tenants[] and accounts[] (use the app's Export JSON button).",
        variant: "destructive",
      });
      return;
    }
    try {
      const result = await importMutation.mutateAsync(payload);
      const c = result.imported;
      const summary =
        `${c.tenants} tenants · ${c.clients} clients · ${c.contacts} contacts · ${c.advisors} advisors · ` +
        `${c.kpiSnapshots} KPI snapshots · ${c.onboardingTasks} tasks · ${c.activityEntries} activity entries` +
        (c.skipped ? ` · ${c.skipped} skipped` : "");
      setLastResult(summary);
      toast({ title: "CRM import complete", description: summary });
    } catch (err) {
      toast({ title: "Import failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <div
      className="rounded-xl border border-dashed p-4 bg-card/50"
      style={{ borderColor: `${HAB_GOLD}66` }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${HAB_GOLD}1f` }}
        >
          <Upload className="w-4 h-4" style={{ color: HAB_GOLD }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Import HAB CRM v1 export</p>
          <p className="text-xs text-muted-foreground">
            JSON from the HAB_CRM_v1 app's Export button (schemaVersion 1). Re-importing the same file is safe.
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importMutation.isPending}
          className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex-shrink-0"
        >
          {importMutation.isPending
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Upload className="w-3.5 h-3.5" />}
          Choose file…
        </button>
      </div>
      {lastResult && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-400 mt-3">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> Imported: {lastResult}
        </p>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

function PipelineContent() {
  const { toast } = useToast();
  const tenantsQuery = useCrmTenants();
  const tenants = tenantsQuery.data ?? [];

  const [tenantId, setTenantId] = useState<string | null>(null);
  useEffect(() => {
    if (tenantId == null && tenants.length) {
      setTenantId(tenants.some((t) => t.id === "hab") ? "hab" : tenants[0].id);
    }
  }, [tenants, tenantId]);

  const tenant = tenants.find((t) => t.id === tenantId);
  const clientsQuery = useCrmClients(tenant?.id);
  const moveStage = useMoveClientStage();
  const createClient = useCreateClient();

  const [q, setQ] = useState("");
  const [newName, setNewName] = useState("");
  const [movingId, setMovingId] = useState<string | null>(null);

  const clients = useMemo(() => {
    const list = clientsQuery.data ?? [];
    const needle = q.trim().toLowerCase();
    return needle ? list.filter((c) => c.name.toLowerCase().includes(needle)) : list;
  }, [clientsQuery.data, q]);

  const handleMove = async (client: CrmClient, stageId: string) => {
    if (!tenant) return;
    setMovingId(client.id);
    try {
      const result = await moveStage.mutateAsync({ clientId: client.id, stageId });
      const label = stageLabel(tenant, stageId);
      if (result.tasksGenerated > 0) {
        toast({
          title: `${client.name} → ${label}`,
          description: `Onboarding checklist auto-generated (${result.tasksGenerated} tasks).`,
        });
      } else {
        toast({ title: `${client.name} → ${label}` });
      }
    } catch (err) {
      toast({ title: "Stage move failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setMovingId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !newName.trim()) return;
    try {
      await createClient.mutateAsync({ tenantId: tenant.id, name: newName.trim() });
      toast({ title: `${newName.trim()} added to pipeline` });
      setNewName("");
    } catch (err) {
      toast({ title: "Could not add", description: (err as Error).message, variant: "destructive" });
    }
  };

  // ── Loading / error / empty states (no live DB in dev — stay defensive) ────
  if (tenantsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (tenantsQuery.isError) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
        <p className="text-sm font-medium mb-1">Couldn't load CRM tenants</p>
        <p className="text-xs text-muted-foreground mb-4">{(tenantsQuery.error as Error)?.message}</p>
        <button
          onClick={() => void tenantsQuery.refetch()}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  const stages = tenant?.stages ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary"
            style={{ boxShadow: `inset 0 -2px 0 ${HAB_GOLD}` }}
          >
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Client CRM
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {tenant ? tenant.name : "HAB — Healthy Auto Business · Operate"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {tenants.length > 1 && (
            <select
              value={tenantId ?? ""}
              onChange={(e) => setTenantId(e.target.value)}
              className="text-sm bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-primary"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${tenant?.entityLabel?.toLowerCase() ?? "client"}s…`}
              className="text-sm bg-background border border-border rounded-xl pl-8 pr-3 py-2 w-48 focus:outline-none focus:border-primary"
            />
          </div>
          {tenant && (
            <form onSubmit={handleCreate} className="flex items-center gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`New ${tenant.entityLabel?.toLowerCase() ?? "client"} name`}
                className="text-sm bg-background border border-border rounded-xl px-3 py-2 w-44 focus:outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={createClient.isPending || !newName.trim()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {createClient.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Plus className="w-3.5 h-3.5" />}
                Add
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Import card */}
      <ImportCard />

      {/* Board */}
      {!tenant ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-sm font-medium mb-1">No CRM tenants yet</p>
          <p className="text-xs text-muted-foreground">
            Import your HAB_CRM_v1 JSON export above to load the HAB pipeline, stages and seeded shops.
          </p>
        </div>
      ) : clientsQuery.isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : clientsQuery.isError ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <AlertTriangle className="w-5 h-5 text-red-400 mx-auto mb-2" />
          <p className="text-sm font-medium mb-1">Couldn't load {tenant.entityLabel?.toLowerCase()}s</p>
          <p className="text-xs text-muted-foreground mb-4">{(clientsQuery.error as Error)?.message}</p>
          <button
            onClick={() => void clientsQuery.refetch()}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 items-start">
          {stages.map((stage) => {
            const inStage = clients.filter((c) => c.stageId === stage.id);
            const isTrigger = stage.id === tenant.onboardingTriggerStage;
            return (
              <div key={stage.id} className="w-64 flex-shrink-0">
                <div className="flex items-center gap-2 px-1 mb-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex-1 truncate">
                    {stage.label}
                  </p>
                  {isTrigger && (
                    <span title="Entering this stage auto-generates the onboarding checklist">
                      <ClipboardCheck className="w-3.5 h-3.5" style={{ color: HAB_GOLD }} />
                    </span>
                  )}
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {inStage.length}
                  </span>
                </div>
                <div
                  className={cn(
                    "space-y-2 rounded-xl p-2 min-h-[80px] bg-muted/20 border border-transparent",
                    isTrigger && "border-dashed",
                  )}
                  style={isTrigger ? { borderColor: `${HAB_GOLD}44` } : undefined}
                >
                  {inStage.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground/60 text-center py-4">Empty</p>
                  ) : (
                    inStage.map((c) => (
                      <ClientCard
                        key={c.id}
                        client={c}
                        tenant={tenant}
                        onMove={handleMove}
                        moving={movingId === c.id}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
          {stages.length === 0 && (
            <p className="text-sm text-muted-foreground py-10">
              This tenant has no stages configured — import a CRM export or set stages via the API.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function CrmPipeline() {
  return (
    <CrmShell>
      <PipelineContent />
    </CrmShell>
  );
}
