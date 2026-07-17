import { apiFetch } from "./apiFetch";

// ─── Integration Config Service ───────────────────────────────────────────────
//
// Central, typed access layer for all n8n webhook URLs and integration points.
// URLs are stored server-side in the `integration_configs` PostgreSQL table,
// admin-only writable, and cached client-side in a module-level Map after load.
//
// Usage:
//   await loadIntegrationConfigs()      ← call once at app start (AuthenticatedApp)
//   getIntegrationUrl(INTEGRATION_KEYS.DOCUMENT_INTAKE)   ← synchronous after load
//   await saveIntegrationUrl(key, value)  ← buyer/admin only
//
// Falls back to legacy localStorage keys during the migration period so that
// existing users don't lose their webhook URLs before they re-save via the panel.

// ─── Typed key constants ──────────────────────────────────────────────────────

export const INTEGRATION_KEYS = {
  DOCUMENT_INTAKE:        "document_intake_webhook",
  DOCUMENT_RETRIEVAL:     "document_retrieval_webhook",
  WORKFLOW_UPDATES:       "workflow_updates_webhook",
  FINANCIAL_INGESTION:    "financial_ingestion_webhook",
  EXPENSE_INGESTION:      "expense_ingestion_webhook",
  RECONCILIATION:         "reconciliation_webhook",
  REPORTING:              "reporting_webhook",
  PORTFOLIO_PROVISIONING: "portfolio_provisioning_webhook",
} as const;

export type IntegrationKey = (typeof INTEGRATION_KEYS)[keyof typeof INTEGRATION_KEYS];

export const ALL_INTEGRATION_KEYS = Object.values(INTEGRATION_KEYS) as IntegrationKey[];

// ─── Legacy localStorage key → new integration key mapping ───────────────────
// Used during migration to read existing user-saved values if the DB has none.

export const LEGACY_KEY_MAP: Record<string, IntegrationKey> = {
  n8n_doc_intake_v2:    INTEGRATION_KEYS.DOCUMENT_INTAKE,
  n8n_doc_retrieval_v1: INTEGRATION_KEYS.DOCUMENT_RETRIEVAL,
  n8n_fin_intake_v1:    INTEGRATION_KEYS.FINANCIAL_INGESTION,
};

// ─── Metadata visible in the UI ──────────────────────────────────────────────

export type IntegrationMeta = {
  key:         IntegrationKey;
  label:       string;
  description: string;
  group:       string;
};

export const INTEGRATION_META: Record<IntegrationKey, IntegrationMeta> = {
  document_intake_webhook: {
    key:         "document_intake_webhook",
    label:       "Document Intake",
    description: "Receives uploaded documents. Routes to Google Drive and returns Drive link + AI analysis.",
    group:       "Documents",
  },
  document_retrieval_webhook: {
    key:         "document_retrieval_webhook",
    label:       "Document Retrieval",
    description: "Fetches original PDFs from Google Drive by documentId. Returns a view/download link.",
    group:       "Documents",
  },
  workflow_updates_webhook: {
    key:         "workflow_updates_webhook",
    label:       "Workflow Updates",
    description: "Receives deal stage changes and triggers downstream automations.",
    group:       "Automation",
  },
  financial_ingestion_webhook: {
    key:         "financial_ingestion_webhook",
    label:       "Financial Ingestion",
    description: "Receives P&L / bank statement data and writes to the Google Sheets financial model.",
    group:       "Financials",
  },
  expense_ingestion_webhook: {
    key:         "expense_ingestion_webhook",
    label:       "Expense Ingestion",
    description: "Receives expense records for reconciliation and writes to the expense sheet.",
    group:       "Financials",
  },
  reconciliation_webhook: {
    key:         "reconciliation_webhook",
    label:       "Reconciliation",
    description: "Triggers bank reconciliation workflow; returns matched/unmatched transaction data.",
    group:       "Financials",
  },
  reporting_webhook: {
    key:         "reporting_webhook",
    label:       "Reporting",
    description: "Triggers report generation (lender, investor, exit) and returns PDF links.",
    group:       "Reporting",
  },
  portfolio_provisioning_webhook: {
    key:         "portfolio_provisioning_webhook",
    label:       "Portfolio Provisioning",
    description: "Called once when a portfolio is created to provision Drive folders and Sheets.",
    group:       "Infrastructure",
  },
};

// ─── Runtime cache ────────────────────────────────────────────────────────────

const _cache = new Map<IntegrationKey, string>();
let _loaded = false;
let _loadPromise: Promise<void> | null = null;

// ─── Load configs from server into module cache ───────────────────────────────

export async function loadIntegrationConfigs(): Promise<void> {
  if (_loaded) return;
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    try {
      const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await apiFetch(`${basePath}/api/integrations`);
      if (res.ok) {
        const data = await res.json();
        for (const cfg of data.configs ?? []) {
          if (cfg.value !== undefined && cfg.value !== "") {
            _cache.set(cfg.key as IntegrationKey, cfg.value);
          }
        }
      }
    } catch {
      // Network error — we'll rely on localStorage fallback below
    }

    // Migration pass: pull legacy localStorage values for any key not yet in DB cache
    for (const [localKey, integrationKey] of Object.entries(LEGACY_KEY_MAP)) {
      if (!_cache.has(integrationKey)) {
        const legacy = localStorage.getItem(localKey);
        if (legacy?.trim()) {
          _cache.set(integrationKey, legacy.trim());
        }
      }
    }

    _loaded = true;
    _loadPromise = null;
  })();

  return _loadPromise;
}

// ─── Synchronous read from cache ──────────────────────────────────────────────
// Returns empty string if not configured. Callers should check and surface an
// "Integration not configured" message rather than silently sending to a blank URL.

export function getIntegrationUrl(key: IntegrationKey): string {
  return _cache.get(key) ?? "";
}

// ─── Check if a key is configured ────────────────────────────────────────────

export function isIntegrationConfigured(key: IntegrationKey): boolean {
  return !!_cache.get(key)?.trim();
}

// ─── Get all configured status (for IntegrationsPanel or readiness checks) ────

export type ConfigStatus = {
  key:          IntegrationKey;
  label:        string;
  group:        string;
  description:  string;
  isConfigured: boolean;
  value:        string;
};

export function getConfigStatuses(): ConfigStatus[] {
  return ALL_INTEGRATION_KEYS.map((key) => ({
    ...INTEGRATION_META[key],
    isConfigured: isIntegrationConfigured(key),
    value:        _cache.get(key) ?? "",
  }));
}

// ─── Save a config value to the server and update cache ──────────────────────

export async function saveIntegrationUrl(
  key: IntegrationKey,
  value: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    const res = await apiFetch(`${basePath}/api/integrations/${key}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ value }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error ?? `HTTP ${res.status}` };
    }
    // Update local cache immediately
    if (value.trim()) _cache.set(key, value.trim());
    else               _cache.delete(key);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ─── Test a webhook URL via the server-side test endpoint ─────────────────────

export async function testIntegrationUrl(
  key: IntegrationKey,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    const res = await apiFetch(`${basePath}/api/integrations/test/${key}`, {
      method: "POST",
    });
    const body = await res.json().catch(() => ({}));
    return { ok: body.ok === true, status: body.status, error: body.error };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ─── Force refresh cache from server ─────────────────────────────────────────

export async function refreshIntegrationConfigs(): Promise<void> {
  _loaded = false;
  _loadPromise = null;
  _cache.clear();
  await loadIntegrationConfigs();
}

// ─── Phase 1 compatibility shim ───────────────────────────────────────────────
// documentPipeline.ts still exports getWebhookUrl(legacyKey). That function now
// calls this shim so all existing call sites work without change.

export function getWebhookUrlByLegacyKey(legacyKey: string): string {
  const integrationKey = LEGACY_KEY_MAP[legacyKey];
  if (integrationKey) return getIntegrationUrl(integrationKey);
  // Unknown key — fall back to localStorage directly
  return localStorage.getItem(legacyKey) ?? "";
}
