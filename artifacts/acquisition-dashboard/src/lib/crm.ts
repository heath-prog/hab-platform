// ─── CRM data layer (WP-CRM-UI) ───────────────────────────────────────────────
// Types + TanStack Query hooks over the WP1 CRM API
// (artifacts/api-server/src/routes/crm.ts, mounted at /api/crm).
// Contract: outputs/CRM_DATA_MODEL.md (schemaVersion 1).

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Types (mirror the API's toTenant/toClient/... serializers) ──────────────

export type CrmStage = { id: string; label: string };
export type CrmKpiDef = { id: string; label: string; target: number | null; cmp?: string; unit?: string };
export type CrmComplianceFieldDef = { id: string; label: string; type?: string; alert?: boolean };
export type CrmDocDef = { id: string; label: string };

export type CrmTenantFeatures = Partial<
  Record<"curriculum" | "kpis" | "compliance" | "onboarding" | "advisors" | "calendar", boolean>
>;

export type CrmTenant = {
  id: string;
  name: string;
  entityLabel: string;
  features: CrmTenantFeatures;
  // config spread by the API (all optional — defensive against partial configs)
  stages?: CrmStage[];
  onboardingTriggerStage?: string;
  onboardingTemplate?: string[];
  masteryLevels?: string[];
  modules?: string[];
  kpiDefs?: CrmKpiDef[];
  docs?: CrmDocDef[];
  complianceFields?: CrmComplianceFieldDef[];
  weekThemes?: string[];
};

export type CrmSessionSlot = { label?: string; day?: string; time?: string };
export type CrmCycle = "advisor" | "coach" | "graduated" | null;

export type CrmClient = {
  id: string;
  tenantId: string;
  name: string;
  stageId: string;
  isSeed: boolean;
  seedNote: string | null;
  emails: string[];
  phone: string | null;
  address: string | null;
  notes: string | null;
  flags: string[];
  acquisitionFlag: boolean;
  calendarColorId: number | null;
  slots: CrmSessionSlot[];
  startDate: string | null;
  weekOverride: number | null;
  curriculumWeek: number | null;
  curriculumCycle: CrmCycle;
  docsDelivered: Record<string, string | null>;
  onboardingGeneratedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CrmContact = {
  id: string; clientId: string; name: string;
  role: string | null; email: string | null; phone: string | null;
};

export type CrmModuleState = "" | "ip" | "done";

export type CrmAdvisor = {
  id: string; clientId: string; name: string;
  level: number;
  progress: Record<string, CrmModuleState>;
  notes: string | null;
};

export type CrmKpiSnapshot = { id: string; clientId: string; date: string; values: Record<string, number> };
export type CrmOnboardingTask = {
  id: string; clientId: string; position: number;
  label: string; done: boolean; doneDate: string | null;
};
export type CrmActivityEntry = { ts: string; text: string };

export type CrmClientDetail = CrmClient & {
  contacts: CrmContact[];
  advisors: CrmAdvisor[];
  kpiSnapshots: CrmKpiSnapshot[];
  compliance: Record<string, string>;
  onboardingTasks: CrmOnboardingTask[];
  activity: CrmActivityEntry[];
};

export type CrmStageMoveResult = CrmClient & { tasksGenerated: number };

export type CrmImportResult = {
  ok: boolean;
  savedAt: string | null;
  imported: {
    tenants: number; clients: number; contacts: number; advisors: number;
    kpiSnapshots: number; onboardingTasks: number; activityEntries: number;
    compliance: number; skipped: number;
  };
};

// ─── Google Calendar palette (CRM_DATA_MODEL.md §5.3) ────────────────────────

export const CALENDAR_COLORS: Record<number, { name: string; hex: string }> = {
  1:  { name: "Lavender",  hex: "#7986cb" },
  2:  { name: "Sage",      hex: "#33b679" },
  3:  { name: "Grape",     hex: "#8e24aa" },
  4:  { name: "Flamingo",  hex: "#e67c73" },
  5:  { name: "Banana",    hex: "#f6c026" },
  6:  { name: "Tangerine", hex: "#f5511d" },
  7:  { name: "Peacock",   hex: "#039be5" },
  8:  { name: "Graphite",  hex: "#616161" },
  9:  { name: "Blueberry", hex: "#3f51b5" },
  10: { name: "Basil",     hex: "#0b8043" },
  11: { name: "Tomato",    hex: "#d60000" },
};

/** 9 Blueberry = Heath's weekly 1:1s, 7 Peacock = legacy group cohort. */
export const RESERVED_CALENDAR_COLOR_IDS = new Set([9, 7]);

// ─── Derived helpers (client-side mirrors of CRM_DATA_MODEL.md §5) ───────────

export function stageLabel(tenant: CrmTenant | undefined, stageId: string): string {
  return tenant?.stages?.find((s) => s.id === stageId)?.label ?? stageId;
}

export function weekTheme(tenant: CrmTenant | undefined, week: number | null): string | null {
  if (!tenant?.weekThemes || week == null || week < 1 || week > tenant.weekThemes.length) return null;
  return tenant.weekThemes[week - 1];
}

export function cycleLabel(cycle: CrmCycle): string {
  if (cycle === "advisor") return "Advisor Cycle";
  if (cycle === "coach") return "Coach Cycle";
  if (cycle === "graduated") return "Graduated";
  return "—";
}

/** First token of "M1 Rapport" → "M1" (module progress key). */
export function moduleKey(module: string): string {
  return module.split(" ")[0];
}

/** §5.4 — green when value >= target; target null (ARO) never colored. */
export function kpiStatus(def: CrmKpiDef, value: number | undefined): "good" | "bad" | "neutral" {
  if (value === undefined || def.target == null) return "neutral";
  return value >= def.target ? "good" : "bad";
}

/** §5.5 — date+alert compliance fields: past due / due within 60 days. */
export function complianceStatus(
  def: CrmComplianceFieldDef,
  value: string | undefined,
): "past_due" | "due_soon" | "ok" | "none" {
  if (def.type !== "date" || !def.alert || !value) return "none";
  const d = new Date(value).getTime();
  if (Number.isNaN(d)) return "none";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((d - today.getTime()) / 86400000);
  if (diffDays < 0) return "past_due";
  if (diffDays <= 60) return "due_soon";
  return "ok";
}

// ─── Fetch wrapper (Clerk bearer token via apiFetch) ─────────────────────────

export class CrmApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function crmFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const resp = await apiFetch(`${BASE}/api/crm${path}`, {
    ...options,
    headers: {
      ...(options.body != null ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!resp.ok) {
    const body = (await resp.json().catch(() => ({}))) as { error?: string };
    throw new CrmApiError(resp.status, body.error ?? `Request failed (${resp.status})`);
  }
  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useCrmTenants() {
  return useQuery<CrmTenant[]>({
    queryKey: ["crm", "tenants"],
    queryFn: () => crmFetch<CrmTenant[]>("/tenants"),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useCrmTenant(tid: string | undefined) {
  return useQuery<CrmTenant>({
    queryKey: ["crm", "tenant", tid],
    queryFn: () => crmFetch<CrmTenant>(`/tenants/${tid}`),
    enabled: !!tid,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useCrmClients(tid: string | undefined) {
  return useQuery<CrmClient[]>({
    queryKey: ["crm", "clients", tid],
    queryFn: () => crmFetch<CrmClient[]>(`/tenants/${tid}/clients`),
    enabled: !!tid,
    retry: 1,
  });
}

export function useCrmClient(id: string | undefined) {
  return useQuery<CrmClientDetail>({
    queryKey: ["crm", "client", id],
    queryFn: () => crmFetch<CrmClientDetail>(`/clients/${id}`),
    enabled: !!id,
    retry: 1,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────
// Low-traffic internal tool: invalidate the whole "crm" cache after writes so
// board, detail and tenant views never go stale.

function useCrmMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation<TResult, Error, TVars>({
    mutationFn: fn,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["crm"] }); },
  });
}

export function useMoveClientStage() {
  return useCrmMutation<{ clientId: string; stageId: string }, CrmStageMoveResult>(
    ({ clientId, stageId }) =>
      crmFetch(`/clients/${clientId}/stage`, { method: "POST", body: JSON.stringify({ stageId }) }),
  );
}

export type CrmClientPatch = Partial<{
  name: string; isSeed: boolean; seedNote: string | null;
  emails: string[]; phone: string; address: string; notes: string;
  flags: string[]; calendarColorId: number | null;
  slots: CrmSessionSlot[]; startDate: string | null; weekOverride: number | null;
  docsDelivered: Record<string, string | null>;
  compliance: Record<string, string>;
}>;

export function useUpdateClient() {
  return useCrmMutation<{ clientId: string; patch: CrmClientPatch }, CrmClient>(
    ({ clientId, patch }) =>
      crmFetch(`/clients/${clientId}`, { method: "PATCH", body: JSON.stringify(patch) }),
  );
}

export function useCreateClient() {
  return useCrmMutation<{ tenantId: string; name: string; stageId?: string }, CrmClient>(
    ({ tenantId, ...body }) =>
      crmFetch(`/tenants/${tenantId}/clients`, { method: "POST", body: JSON.stringify(body) }),
  );
}

export function useAddContact() {
  return useCrmMutation<{ clientId: string; name: string; role?: string; email?: string; phone?: string }, CrmContact>(
    ({ clientId, ...body }) =>
      crmFetch(`/clients/${clientId}/contacts`, { method: "POST", body: JSON.stringify(body) }),
  );
}

export function useDeleteContact() {
  return useCrmMutation<{ contactId: string }, void>(
    ({ contactId }) => crmFetch(`/contacts/${contactId}`, { method: "DELETE" }),
  );
}

export function useAddAdvisor() {
  return useCrmMutation<{ clientId: string; name: string }, CrmAdvisor>(
    ({ clientId, ...body }) =>
      crmFetch(`/clients/${clientId}/advisors`, { method: "POST", body: JSON.stringify(body) }),
  );
}

export function useUpdateAdvisor() {
  return useCrmMutation<
    { advisorId: string; level?: number; notes?: string; progress?: Record<string, CrmModuleState> },
    CrmAdvisor
  >(({ advisorId, ...body }) =>
    crmFetch(`/advisors/${advisorId}`, { method: "PATCH", body: JSON.stringify(body) }),
  );
}

export function useDeleteAdvisor() {
  return useCrmMutation<{ advisorId: string }, void>(
    ({ advisorId }) => crmFetch(`/advisors/${advisorId}`, { method: "DELETE" }),
  );
}

export function useAddKpiSnapshot() {
  return useCrmMutation<{ clientId: string; date: string; values: Record<string, number> }, CrmKpiSnapshot>(
    ({ clientId, ...body }) =>
      crmFetch(`/clients/${clientId}/kpi-snapshots`, { method: "POST", body: JSON.stringify(body) }),
  );
}

export function useDeleteKpiSnapshot() {
  return useCrmMutation<{ snapshotId: string }, void>(
    ({ snapshotId }) => crmFetch(`/kpi-snapshots/${snapshotId}`, { method: "DELETE" }),
  );
}

export function useGenerateOnboarding() {
  return useCrmMutation<{ clientId: string }, { tasksGenerated: number; tasks: CrmOnboardingTask[] }>(
    ({ clientId }) => crmFetch(`/clients/${clientId}/onboarding/generate`, { method: "POST", body: "{}" }),
  );
}

export function useAddOnboardingTask() {
  return useCrmMutation<{ clientId: string; label: string }, CrmOnboardingTask>(
    ({ clientId, label }) =>
      crmFetch(`/clients/${clientId}/onboarding/tasks`, { method: "POST", body: JSON.stringify({ label }) }),
  );
}

export function useToggleOnboardingTask() {
  return useCrmMutation<{ taskId: string; done: boolean }, CrmOnboardingTask>(
    ({ taskId, done }) =>
      crmFetch(`/onboarding-tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ done }) }),
  );
}

export function useAddActivity() {
  return useCrmMutation<{ clientId: string; text: string }, { ok: boolean }>(
    ({ clientId, text }) =>
      crmFetch(`/clients/${clientId}/activity`, { method: "POST", body: JSON.stringify({ text }) }),
  );
}

export function useCrmImport() {
  return useCrmMutation<unknown, CrmImportResult>(
    (payload) => crmFetch(`/import`, { method: "POST", body: JSON.stringify(payload) }),
  );
}
