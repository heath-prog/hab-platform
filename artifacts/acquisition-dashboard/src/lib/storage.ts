import { apiFetch } from "./apiFetch";

// ─── Business / Portfolio types ───────────────────────────────────────────────

export type AcquisitionType = "undecided" | "asset" | "stock";
export type FinancingType   = "cash" | "sba" | "seller-note" | "conventional" | "investor-equity" | "undecided";

export type DocStatusSnapshot = {
  // Legal / deal docs (tracked separately as priority items)
  nda:             boolean;
  loi:             boolean;
  loiWithNda:      boolean;  // true when single doc satisfies both NDA + LOI
  // Seller financials / diligence
  financials:      boolean;
  taxReturns:      boolean;
  pnls:            boolean;
  bankStatements:  boolean;
  lease:           boolean;
  payroll:         boolean;
  debtSchedule:    boolean;
  equipmentList:   boolean;
  licensesPermits: boolean;
};

export const EMPTY_DOCS: DocStatusSnapshot = {
  nda: false, loi: false, loiWithNda: false,
  financials: false, taxReturns: false, pnls: false,
  bankStatements: false, lease: false, payroll: false,
  debtSchedule: false, equipmentList: false, licensesPermits: false,
};

export type BusinessStage =
  | "lead"
  | "diligence"
  | "loi"
  | "close-ready"
  | "closed"
  | "operating"
  | "archived";

// ─── Portfolio Lifecycle State ─────────────────────────────────────────────────
// Distinct from BusinessStage (deal progress). LifecycleState controls where
// the workspace lives in the portfolio structure.
export type LifecycleState = "active_portfolio" | "pipeline" | "trashed";

export const TRASH_RETENTION_DAYS = 10;

export const PIPELINE_STAGES = [
  "new_lead", "contacted", "nda_signed", "negotiating",
  "loi_submitted", "due_diligence", "under_contract", "on_hold", "lost_opportunity",
] as const;
export type PipelineStage = typeof PIPELINE_STAGES[number];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  new_lead:         "New Lead",
  contacted:        "Contacted",
  nda_signed:       "NDA Signed",
  negotiating:      "Negotiating",
  loi_submitted:    "LOI Submitted",
  due_diligence:    "Due Diligence",
  under_contract:   "Under Contract",
  on_hold:          "On Hold",
  lost_opportunity: "Lost Opportunity",
};

export const STAGE_LABELS: Record<BusinessStage, string> = {
  lead: "Lead",
  diligence: "Due Diligence",
  loi: "LOI Signed",
  "close-ready": "Close Ready",
  closed: "Closed",
  operating: "Operating",
  archived: "Archived",
};

export const STAGE_COLORS: Record<BusinessStage, { bg: string; text: string; border: string }> = {
  lead:          { bg: "bg-slate-500/15",   text: "text-slate-400",   border: "border-slate-500/30" },
  diligence:     { bg: "bg-amber-500/15",   text: "text-amber-400",   border: "border-amber-500/30" },
  loi:           { bg: "bg-blue-500/15",    text: "text-blue-400",    border: "border-blue-500/30"  },
  "close-ready": { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30" },
  closed:        { bg: "bg-green-500/15",   text: "text-green-400",   border: "border-green-500/30"  },
  operating:     { bg: "bg-primary/15",     text: "text-primary",     border: "border-primary/30"    },
  archived:      { bg: "bg-muted/20",       text: "text-muted-foreground", border: "border-muted/30" },
};

export type Business = {
  // Core identity
  id: string;
  name: string;
  entityName: string;
  seller: string;
  buyer: string;
  dealPrice: number;
  stage: BusinessStage;
  targetCloseDate?: string;
  escrowDate?: string;
  closedDate?: string;
  address?: string;
  industry?: string;
  financialManagementActive: boolean;
  description?: string;
  createdAt: string;

  // Business profile (expanded)
  legalEntityName?: string;
  dbaName?: string;
  website?: string;
  location?: string;
  numberOfLocations?: number;
  yearsInBusiness?: string;
  businessType?: string;

  // Deal structure
  acquisitionType?: AcquisitionType;
  estimatedDownPayment?: number;
  sellerFinancingExpected?: boolean;
  sbaRequired?: boolean;
  leaseAssignmentExpected?: boolean;
  landlordApprovalRequired?: boolean;
  brokeredDeal?: boolean;
  exclusivityInPlace?: boolean;
  currentStepNote?: string;

  // People
  sellerEntity?: string;
  brokerName?: string;
  attorneyName?: string;
  cpaName?: string;
  landlordContact?: string;
  lenderContact?: string;

  // Financing & operating
  financingTypes?: FinancingType[];
  workingCapitalNeeded?: boolean;
  postCloseCapitalEstimate?: number;
  buyerOperateDirectly?: boolean;
  managerInPlace?: boolean;
  dayOneOperatorKnown?: boolean;
  currentStaffRemaining?: boolean;
  postCloseFinancialSystemRequired?: boolean;
  rollupIntent?: boolean;

  // Document status snapshot
  docsReceived?: DocStatusSnapshot;

  // ── Lifecycle management ──────────────────────────────────────────────────
  // lifecycleState controls where in the portfolio this workspace lives.
  // Legacy records without this field are treated as 'active_portfolio'.
  lifecycleState?: LifecycleState;
  // pipelineStage tracks which stage the lead is in when lifecycleState = 'pipeline'.
  pipelineStage?: PipelineStage;
  // previousLifecycleState records where the business came from before trash.
  previousLifecycleState?: "active_portfolio" | "pipeline";
  // Set when moved to trash; purgeAt = deletedAt + TRASH_RETENTION_DAYS.
  deletedAt?: string;
  purgeAt?:   string;
};

export type PortfolioState = {
  businesses: Business[];
  name?: string;
};

const PORTFOLIO_KEY = "portfolio_v1";

export const defaultBusiness: Business = {
  id: "true-blue",
  name: "True Blue Auto Care",
  entityName: "HAB Enterprises 3 LLC",
  seller: "Saj Zoghet",
  buyer: "Heath Blake",
  dealPrice: 300000,
  stage: "diligence",
  targetCloseDate: "2026-07-16",
  address: "TBD, California",
  industry: "Automotive Repair",
  financialManagementActive: false,
  acquisitionType: "asset",
  description: "Asset purchase of True Blue Auto Care Inc. $300K purchase price. Rent: $8K/mo. Seller note: $2,250/mo.",
  createdAt: "2026-04-08T00:00:00Z",
};

export const defaultPortfolio: PortfolioState = {
  businesses: [defaultBusiness],
};

export function loadPortfolio(): PortfolioState {
  try {
    const raw = localStorage.getItem(PORTFOLIO_KEY);
    if (!raw) return defaultPortfolio;
    const stored = JSON.parse(raw) as PortfolioState;
    const hasTrueBlue = stored.businesses.some((b) => b.id === "true-blue");
    if (!hasTrueBlue) {
      stored.businesses = [defaultBusiness, ...stored.businesses];
    } else {
      // Patch missing fields onto existing true-blue entry
      stored.businesses = stored.businesses.map((b) =>
        b.id === "true-blue"
          ? {
              acquisitionType: "asset" as AcquisitionType,
              ...b,
              // Ensure description is always up to date
              description: b.description || defaultBusiness.description,
            }
          : b
      );
    }
    return stored;
  } catch {
    return defaultPortfolio;
  }
}

export function savePortfolio(state: PortfolioState): void {
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(state));
}

export function getBusiness(portfolio: PortfolioState, id: string): Business | undefined {
  return portfolio.businesses.find((b) => b.id === id);
}

// ─── Dashboard (per-business workspace) types ──────────────────────────────────

export type CheckItem = {
  id: string;
  label: string;
  checked: boolean;
  notes?: string;
};

export type DocumentItem = {
  id: string;
  label: string;
  received: boolean;
  verified: boolean;
  notes?: string;
  driveFileId?: string;
  driveFileName?: string;
  driveViewLink?: string;
  extractedDataSnapshot?: string;
  confidenceScore?: number;
};

export type ContactItem = {
  id: string;
  contact: string;
  purpose: string;
  phone: string;
  called: boolean;
  notes?: string;
};

export type KPIItem = {
  id: string;
  metric: string;
  value: string;
  target: string;
  status: boolean;
};

export type RiskItem = {
  id: string;
  risk: string;
  severity: "High" | "Medium" | "Low";
  action: string;
};

export type LeaseItem = {
  id: string;
  item: string;
  status: boolean;
  notes?: string;
};

export type LicenseItem = {
  id: string;
  item: string;
  status: boolean;
  notes?: string;
};

export type WeekTask = {
  id: string;
  task: string;
  done: boolean;
};

export type DashboardState = {
  progress: CheckItem[];
  documents: DocumentItem[];
  contacts: ContactItem[];
  kpis: KPIItem[];
  leaseItems: LeaseItem[];
  licenseItems: LicenseItem[];
  day1Items: CheckItem[];
  entitySetupItems: CheckItem[];
  week1: WeekTask[];
  week2: WeekTask[];
  week3: WeekTask[];
  week4: WeekTask[];
  lastUpdated: string;
};

// Milestone IDs that are blocked by entity setup for asset purchases
export const ENTITY_SETUP_BLOCKED_IDS = ["p5", "p6", "p7", "p8"] as const;

// ─── Default workspace state (True Blue / generic) ────────────────────────────

const LEGACY_KEY = "trueblue_dashboard_v1";

function storageKey(businessId: string) {
  return `portfolio_${businessId}_v1`;
}

export const defaultState: DashboardState = {
  progress: [
    { id: "p-nda", label: "NDA Executed",       checked: false, notes: "" },
    { id: "p1",    label: "LOI Signed",          checked: false, notes: "" },
    { id: "p2",    label: "Due Diligence",       checked: false, notes: "" },
    { id: "p3", label: "Lease Secured",     checked: false, notes: "" },
    { id: "p4", label: "Financing Finalized", checked: false, notes: "" },
    { id: "p5", label: "Legal Docs",        checked: false, notes: "" },
    { id: "p6", label: "Licenses (BAR etc.)", checked: false, notes: "" },
    { id: "p7", label: "Insurance",         checked: false, notes: "" },
    { id: "p8", label: "Closing Ready",     checked: false, notes: "" },
  ],
  documents: [
    { id: "d-nda", label: "NDA (Non-Disclosure Agreement)",  received: false, verified: false, notes: "" },
    { id: "d-loi", label: "LOI (Letter of Intent)",          received: false, verified: false, notes: "" },
    { id: "d1",    label: "3 Years Tax Returns",             received: false, verified: false, notes: "" },
    { id: "d2",  label: "P&L Statements",              received: false, verified: false, notes: "" },
    { id: "d3",  label: "Balance Sheets",              received: false, verified: false, notes: "" },
    { id: "d4",  label: "Bank Statements (12 mo)",     received: false, verified: false, notes: "" },
    { id: "d5",  label: "Debt Schedule",               received: false, verified: false, notes: "" },
    { id: "d6",  label: "Lease Agreement",             received: false, verified: false, notes: "" },
    { id: "d7",  label: "BAR License",                 received: false, verified: false, notes: "" },
    { id: "d8",  label: "Smog License (if applicable)",received: false, verified: false, notes: "" },
    { id: "d9",  label: "Payroll Reports",             received: false, verified: false, notes: "" },
    { id: "d10", label: "Employee List",               received: false, verified: false, notes: "" },
    { id: "d11", label: "Vendor List",                 received: false, verified: false, notes: "" },
    { id: "d12", label: "Inventory List",              received: false, verified: false, notes: "" },
    { id: "d13", label: "Equipment List",              received: false, verified: false, notes: "" },
    { id: "d14", label: "Vehicle Title (Jeep)",        received: false, verified: false, notes: "" },
    { id: "d15", label: "Tekmetric Export",            received: false, verified: false, notes: "" },
    { id: "d16", label: "Google / Website Access",     received: false, verified: false, notes: "" },
  ],
  contacts: [
    { id: "c1", contact: "BAR",              purpose: "License transfer",    phone: "855-735-0465", called: false, notes: "" },
    { id: "c2", contact: "CDTFA",            purpose: "Tax clearance",       phone: "800-400-7115", called: false, notes: "" },
    { id: "c3", contact: "EDD",              purpose: "Payroll transfer",    phone: "888-745-3886", called: false, notes: "" },
    { id: "c4", contact: "Insurance Broker", purpose: "Bind coverage",       phone: "TBD",          called: false, notes: "" },
    { id: "c5", contact: "Landlord",         purpose: "Lease negotiation",   phone: "TBD",          called: false, notes: "" },
    { id: "c6", contact: "CPA",              purpose: "Financial validation", phone: "TBD",         called: false, notes: "" },
    { id: "c7", contact: "Attorney",         purpose: "Deal structure",      phone: "TBD",          called: false, notes: "" },
  ],
  kpis: [
    { id: "k1", metric: "Monthly Revenue",        value: "", target: "$200,000",      status: false },
    { id: "k2", metric: "Car Count",              value: "", target: "200 cars/mo",   status: false },
    { id: "k3", metric: "ARO (Avg Repair Order)", value: "", target: "$1,000",        status: false },
    { id: "k4", metric: "Gross Profit %",         value: "", target: "70%",           status: false },
    { id: "k5", metric: "Net Profit %",           value: "", target: "17% of Revenue",status: false },
    { id: "k6", metric: "Monthly Net Profit $",   value: "", target: "$34,000",       status: false },
  ],
  leaseItems: [
    { id: "l1", item: "Lease Received",              status: false, notes: "" },
    { id: "l2", item: "Landlord Contacted",          status: false, notes: "" },
    { id: "l3", item: "Term Length",                 status: false, notes: "" },
    { id: "l4", item: "Assignment Allowed",          status: false, notes: "" },
    { id: "l5", item: "Rent Confirmed",              status: false, notes: "" },
    { id: "l6", item: "CAM/NNN",                    status: false, notes: "" },
    { id: "l7", item: "Repair Responsibilities",     status: false, notes: "" },
    { id: "l8", item: "ROFR (Right of First Refusal)", status: false, notes: "" },
  ],
  licenseItems: [
    { id: "li1", item: "BAR Transfer Plan",         status: false, notes: "" },
    { id: "li2", item: "Smog License",              status: false, notes: "" },
    { id: "li3", item: "Seller Compliance Verified", status: false, notes: "" },
    { id: "li4", item: "No Open Violations",        status: false, notes: "" },
  ],
  day1Items: [
    { id: "day1", label: "Bank Access",           checked: false, notes: "" },
    { id: "day2", label: "Payroll Access",        checked: false, notes: "" },
    { id: "day3", label: "Tekmetric Admin",       checked: false, notes: "" },
    { id: "day4", label: "Google Profile",        checked: false, notes: "" },
    { id: "day5", label: "Website Access",        checked: false, notes: "" },
    { id: "day6", label: "Phone Number Ownership",checked: false, notes: "" },
    { id: "day7", label: "Vendor Accounts",       checked: false, notes: "" },
    { id: "day8", label: "Keys / Alarm Codes",    checked: false, notes: "" },
  ],
  entitySetupItems: [
    { id: "es1", label: "New legal entity (LLC or Corp) formed with the state", checked: false, notes: "" },
    { id: "es2", label: "EIN (Employer ID Number) obtained from IRS",           checked: false, notes: "" },
    { id: "es3", label: "Business bank account opened in new entity name",      checked: false, notes: "" },
    { id: "es4", label: "State/county tax registration completed (seller's permit, BOE, etc.)", checked: false, notes: "" },
    { id: "es5", label: "Required licenses applied for under new entity (BAR license, Smog Station, etc.)", checked: false, notes: "" },
    { id: "es6", label: "Business insurance bound under new entity name",       checked: false, notes: "" },
  ],
  week1: [
    { id: "w1t1", task: "Meet team",        done: false },
    { id: "w1t2", task: "Review operations",done: false },
    { id: "w1t3", task: "Secure systems",   done: false },
  ],
  week2: [
    { id: "w2t1", task: "Pull KPIs",       done: false },
    { id: "w2t2", task: "Identify leaks",  done: false },
    { id: "w2t3", task: "Evaluate staff",  done: false },
  ],
  week3: [
    { id: "w3t1", task: "Fix pricing",          done: false },
    { id: "w3t2", task: "Improve inspections",  done: false },
    { id: "w3t3", task: "Implement follow-ups", done: false },
  ],
  week4: [
    { id: "w4t1", task: "Reactivate customers", done: false },
    { id: "w4t2", task: "Push maintenance",     done: false },
    { id: "w4t3", task: "Increase ARO",         done: false },
  ],
  lastUpdated: new Date().toISOString(),
};

/** Normalizes a stored workspace snapshot (from localStorage OR the DB) onto
 *  the current DashboardState shape — fills missing fields, migrates old IDs. */
export function normalizeState(stored: Partial<DashboardState>): DashboardState {
  // Migrate KPIs
  const migratedKpis = defaultState.kpis.map((def) => {
    const existing = stored.kpis?.find((k) => k.id === def.id);
    return existing ? { ...def, value: existing.value, status: existing.status } : def;
  });

  // Migrate progress — ensure p-nda exists
  let migratedProgress = stored.progress ?? defaultState.progress;
  if (!migratedProgress.find((p) => p.id === "p-nda")) {
    migratedProgress = [
      { id: "p-nda", label: "NDA Executed", checked: false, notes: "" },
      ...migratedProgress,
    ];
  }

  // Migrate documents — ensure d-nda and d-loi exist at the front
  let migratedDocs = stored.documents ?? defaultState.documents;
  if (!migratedDocs.find((d) => d.id === "d-nda")) {
    migratedDocs = [
      { id: "d-nda", label: "NDA (Non-Disclosure Agreement)", received: false, verified: false, notes: "" },
      { id: "d-loi", label: "LOI (Letter of Intent)",         received: false, verified: false, notes: "" },
      ...migratedDocs.filter((d) => d.id !== "d-loi"),
    ];
  } else if (!migratedDocs.find((d) => d.id === "d-loi")) {
    migratedDocs = [
      ...migratedDocs.filter((d) => d.id === "d-nda"),
      { id: "d-loi", label: "LOI (Letter of Intent)", received: false, verified: false, notes: "" },
      ...migratedDocs.filter((d) => d.id !== "d-nda"),
    ];
  }

  // Migrate entitySetupItems — add if missing from old saves
  const entitySetupItems = stored.entitySetupItems && stored.entitySetupItems.length > 0
    ? stored.entitySetupItems
    : defaultState.entitySetupItems;

  // Spread defaultState first so any field missing from an old save
  // falls back to the default value — prevents ".map is not a function" crashes
  // on contacts, leaseItems, licenseItems, day1Items, week1-4, etc.
  return {
    ...defaultState,
    ...stored,
    kpis:             migratedKpis,
    progress:         migratedProgress,
    documents:        migratedDocs,
    entitySetupItems,
  };
}

/** Reads workspace state from the localStorage cache (fast, offline-safe).
 *  The DB is authoritative — see loadWorkspaceFromDB(). */
export function loadState(businessId = "true-blue"): DashboardState {
  try {
    const key = storageKey(businessId);
    let raw = localStorage.getItem(key);
    if (!raw && businessId === "true-blue") {
      raw = localStorage.getItem(LEGACY_KEY);
    }
    if (!raw) return defaultState;
    return normalizeState(JSON.parse(raw) as Partial<DashboardState>);
  } catch {
    return defaultState;
  }
}

/** True when a workspace snapshot exists in localStorage for this business —
 *  used to decide whether a one-time localStorage → DB migration is needed. */
export function hasLocalState(businessId = "true-blue"): boolean {
  return localStorage.getItem(storageKey(businessId)) !== null
    || (businessId === "true-blue" && localStorage.getItem(LEGACY_KEY) !== null);
}

export function saveState(state: DashboardState, businessId = "true-blue"): void {
  localStorage.setItem(storageKey(businessId), JSON.stringify({ ...state, lastUpdated: new Date().toISOString() }));
}

export function resetState(businessId = "true-blue"): void {
  localStorage.removeItem(storageKey(businessId));
}

// ─── DB-backed portfolio helpers ──────────────────────────────────────────────

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

export async function loadPortfolioFromDB(): Promise<PortfolioState> {
  try {
    const res = await apiFetch(`${API}/api/portfolio`);
    if (!res.ok) return loadPortfolio();
    const data = await res.json() as { businesses?: Business[]; name?: string };
    return { businesses: data.businesses ?? [], name: data.name };
  } catch {
    return loadPortfolio();
  }
}

export async function saveBusinessToDB(business: Business): Promise<void> {
  try {
    await apiFetch(`${API}/api/portfolio/businesses`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(business),
    });
  } catch (e) {
    console.error("Failed to save business to DB:", e);
  }
}

export async function deleteBusinessFromDB(id: string): Promise<void> {
  try {
    await apiFetch(`${API}/api/portfolio/businesses/${id}`, { method: "DELETE" });
  } catch (e) {
    console.error("Failed to delete business from DB:", e);
  }
}

// ─── DB-backed workspace state (authoritative) ────────────────────────────────
// Workspace (dashboard) state lives in businesses.data->'workspace' (JSONB).
// localStorage is only an instant-render cache + one-time migration source.

export async function loadWorkspaceFromDB(
  businessId: string,
): Promise<{ ok: boolean; workspace: DashboardState | null }> {
  try {
    const res = await apiFetch(`${API}/api/portfolio/businesses/${businessId}/workspace`);
    if (!res.ok) return { ok: false, workspace: null };
    const data = await res.json() as { workspace?: Partial<DashboardState> | null };
    return { ok: true, workspace: data.workspace ? normalizeState(data.workspace) : null };
  } catch {
    return { ok: false, workspace: null };
  }
}

export async function saveWorkspaceToDB(businessId: string, state: DashboardState): Promise<void> {
  try {
    await apiFetch(`${API}/api/portfolio/businesses/${businessId}/workspace`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ...state, lastUpdated: new Date().toISOString() }),
    });
  } catch (e) {
    console.error("Failed to save workspace to DB:", e);
  }
}

// Debounced variant — checkbox-heavy pages fire many rapid updates; coalesce
// them into one PUT per business.
const workspaceSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function saveWorkspaceToDBDebounced(
  businessId: string,
  state: DashboardState,
  delayMs = 800,
): void {
  const pending = workspaceSaveTimers.get(businessId);
  if (pending) clearTimeout(pending);
  workspaceSaveTimers.set(businessId, setTimeout(() => {
    workspaceSaveTimers.delete(businessId);
    void saveWorkspaceToDB(businessId, state);
  }, delayMs));
}

// ─── Lifecycle Helper Functions ────────────────────────────────────────────────

/** Returns the effective lifecycle state.
 *  Legacy records without lifecycleState default to 'active_portfolio'. */
export function getLifecycleState(b: Business): LifecycleState {
  return b.lifecycleState ?? "active_portfolio";
}

/** Moves a business from active_portfolio to pipeline.
 *  No-ops if already in pipeline. Throws if trashed. */
export async function moveBusinessToPipeline(b: Business): Promise<Business> {
  const current = getLifecycleState(b);
  if (current === "trashed")    throw new Error("Restore the business from trash before moving it to pipeline.");
  if (current === "pipeline")   return b;
  const updated: Business = { ...b, lifecycleState: "pipeline" };
  await saveBusinessToDB(updated);
  return updated;
}

/** Moves a business from pipeline back to active_portfolio.
 *  No-ops if already active. Throws if trashed. */
export async function moveBusinessToActive(b: Business): Promise<Business> {
  const current = getLifecycleState(b);
  if (current === "trashed")          throw new Error("Restore the business from trash before moving it to active portfolio.");
  if (current === "active_portfolio") return b;
  const updated: Business = { ...b, lifecycleState: "active_portfolio" };
  await saveBusinessToDB(updated);
  return updated;
}

/** Soft-deletes a business by moving it to Trash.
 *  Records the previous lifecycle state so it can be restored correctly.
 *  Sets deletedAt now; purgeAt = deletedAt + TRASH_RETENTION_DAYS.
 *  IMPORTANT: This does NOT delete any external Drive or document storage
 *  references — only the app-owned workspace record changes state. */
export async function moveBusinessToTrash(b: Business): Promise<Business> {
  if (getLifecycleState(b) === "trashed") throw new Error("Business is already in Trash.");
  const now = new Date();
  const purgeAt = new Date(now.getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const updated: Business = {
    ...b,
    lifecycleState:         "trashed",
    previousLifecycleState: (b.lifecycleState ?? "active_portfolio") as "active_portfolio" | "pipeline",
    deletedAt:              now.toISOString(),
    purgeAt:                purgeAt.toISOString(),
  };
  await saveBusinessToDB(updated);
  return updated;
}

/** Restores a trashed business to its previous lifecycle state.
 *  Clears trash metadata. Throws if purge date has already passed. */
export async function restoreBusinessFromTrash(b: Business): Promise<Business> {
  if (getLifecycleState(b) !== "trashed") throw new Error("Business is not in Trash.");
  if (b.purgeAt && new Date() > new Date(b.purgeAt)) {
    throw new Error("This business has already passed its purge date and cannot be restored.");
  }
  const restoredState: LifecycleState = b.previousLifecycleState ?? "active_portfolio";
  const updated: Business = {
    ...b,
    lifecycleState:         restoredState,
    previousLifecycleState: undefined,
    deletedAt:              undefined,
    purgeAt:                undefined,
  };
  await saveBusinessToDB(updated);
  return updated;
}

/** Permanently deletes a business record from the database.
 *  This is irreversible. External documents (Drive files, etc.) are NOT deleted —
 *  only the app-owned workspace record and its JSONB data are removed.
 *  Document upload records in document_uploads / review_queue_items remain
 *  as detached records rather than being cascade-deleted. */
export async function permanentlyDeleteBusiness(id: string): Promise<void> {
  await deleteBusinessFromDB(id);
}

/** Client-side: identifies businesses whose purge date has passed.
 *  Returns { keep } (everything else) and { purgedIds } (already expired).
 *  The backend performs the actual hard delete on the next GET /api/portfolio call. */
export function purgeExpiredTrash(businesses: Business[]): { keep: Business[]; purgedIds: string[] } {
  const now = new Date();
  const keep: Business[]  = [];
  const purgedIds: string[] = [];
  for (const b of businesses) {
    if (getLifecycleState(b) === "trashed" && b.purgeAt && new Date(b.purgeAt) <= now) {
      purgedIds.push(b.id);
    } else {
      keep.push(b);
    }
  }
  return { keep, purgedIds };
}

/** Returns the number of whole days remaining before purge (0 = today, negative = overdue). */
export function daysUntilPurge(purgeAt: string): number {
  const diff = new Date(purgeAt).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
