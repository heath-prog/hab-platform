import { Router } from "express";
import { getAuth } from "@clerk/express";
import type { QueryResultRow } from "pg";
import { pool } from "../lib/db";

const router = Router();

// ─── Required config keys (all 8 platform integration points) ─────────────────

export const REQUIRED_KEYS = [
  "document_intake_webhook",
  "document_retrieval_webhook",
  "workflow_updates_webhook",
  "financial_ingestion_webhook",
  "expense_ingestion_webhook",
  "reconciliation_webhook",
  "reporting_webhook",
  "portfolio_provisioning_webhook",
] as const;

export type IntegrationKey = (typeof REQUIRED_KEYS)[number];

export const KEY_META: Record<IntegrationKey, { label: string; description: string; group: string }> = {
  document_intake_webhook: {
    label:       "Document Intake",
    description: "Receives uploaded documents. Routes to Google Drive and returns Drive link + AI analysis.",
    group:       "Documents",
  },
  document_retrieval_webhook: {
    label:       "Document Retrieval",
    description: "Fetches original PDFs from Google Drive by documentId. Returns a view/download link.",
    group:       "Documents",
  },
  workflow_updates_webhook: {
    label:       "Workflow Updates",
    description: "Receives deal stage changes and triggers downstream n8n automations.",
    group:       "Automation",
  },
  financial_ingestion_webhook: {
    label:       "Financial Ingestion",
    description: "Receives P&L / bank statement data and writes to Google Sheets financial model.",
    group:       "Financials",
  },
  expense_ingestion_webhook: {
    label:       "Expense Ingestion",
    description: "Receives expense records for reconciliation and writes to expense sheet.",
    group:       "Financials",
  },
  reconciliation_webhook: {
    label:       "Reconciliation",
    description: "Triggers bank reconciliation workflow; returns matched/unmatched transaction data.",
    group:       "Financials",
  },
  reporting_webhook: {
    label:       "Reporting",
    description: "Triggers report generation workflows (lender, investor, exit) and returns PDF links.",
    group:       "Reporting",
  },
  portfolio_provisioning_webhook: {
    label:       "Portfolio Provisioning",
    description: "Called once when a portfolio is created to provision Google Drive folders and Sheets.",
    group:       "Infrastructure",
  },
};

// ─── Auth helpers ─────────────────────────────────────────────────────────────

// super_admin passes all role guards — it sits above buyer in the hierarchy.
const BUYER_OR_ABOVE = new Set(["buyer", "super_admin"]);

async function requireBuyer(req: any, res: any): Promise<string | null> {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  const result = await pool.query(
    "SELECT role FROM deal_users WHERE clerk_user_id = $1",
    [auth.userId]
  );
  if (!result.rows.length || !BUYER_OR_ABOVE.has(result.rows[0].role)) {
    res.status(403).json({ error: "Forbidden — buyer role required" });
    return null;
  }
  return auth.userId;
}

async function requireAuth(req: any, res: any): Promise<string | null> {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return auth.userId;
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function toResponse(row: Record<string, unknown>, isBuyer: boolean) {
  const key = row.key as IntegrationKey;
  const meta = KEY_META[key] ?? { label: key, description: "", group: "Other" };
  return {
    key:         row.key,
    label:       meta.label,
    description: meta.description,
    group:       meta.group,
    isConfigured: !!(row.value as string)?.trim(),
    // Only return the raw value to buyers (admins)
    value:       isBuyer ? (row.value ?? "") : undefined,
    isActive:    row.is_active,
    updatedAt:   row.updated_at,
  };
}

// ─── GET /api/integrations — list all configs ─────────────────────────────────
// Buyers: see all keys + values; Authenticated non-buyers: see keys + isConfigured only

router.get("/", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const roleResult = await pool.query(
      "SELECT role FROM deal_users WHERE clerk_user_id = $1",
      [auth.userId]
    );
    const isBuyer = BUYER_OR_ABOVE.has(roleResult.rows[0]?.role);

    // Get all stored configs
    const result = await pool.query(
      "SELECT * FROM integration_configs ORDER BY key ASC"
    );
    const storedMap = new Map(result.rows.map((r: QueryResultRow) => [r.key as string, r]));

    // Always return all required keys, filling in defaults for unconfigured ones
    const configs = REQUIRED_KEYS.map((key) => {
      const row = storedMap.get(key) ?? { key, value: "", is_active: true, updated_at: null };
      return toResponse(row, isBuyer);
    });

    res.json({ configs, isBuyer });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── PUT /api/integrations/:key — upsert a single config ─────────────────────
// Buyer only

router.put("/:key", async (req, res) => {
  try {
    const uid = await requireBuyer(req, res);
    if (!uid) return;

    const { key } = req.params;
    const { value } = req.body as { value: string };

    if (!REQUIRED_KEYS.includes(key as IntegrationKey)) {
      res.status(400).json({ error: `Unknown integration key: ${key}` });
      return;
    }

    await pool.query(
      `INSERT INTO integration_configs (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value ?? ""]
    );

    const row = await pool.query("SELECT * FROM integration_configs WHERE key = $1", [key]);
    res.json(toResponse(row.rows[0], true));
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /api/integrations/status — which required keys are configured ────────
// Available to all authenticated users (needed for upload readiness checks)

router.get("/status", async (req, res) => {
  try {
    const uid = await requireAuth(req, res);
    if (!uid) return;

    const result = await pool.query(
      "SELECT key, value FROM integration_configs WHERE key = ANY($1)",
      [REQUIRED_KEYS]
    );
    const configured = new Set(
      result.rows.filter((r: QueryResultRow) => (r.value as string)?.trim()).map((r: QueryResultRow) => r.key as string)
    );

    const status = Object.fromEntries(
      REQUIRED_KEYS.map((k) => [k, configured.has(k)])
    );
    res.json({ status, allRequired: REQUIRED_KEYS.every((k) => configured.has(k)) });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /api/integrations/url/:key — fetch a single webhook URL ──────────────
// Authenticated users only (needed at upload time without buyer restriction)

router.get("/url/:key", async (req, res) => {
  try {
    const uid = await requireAuth(req, res);
    if (!uid) return;

    const { key } = req.params;
    const result = await pool.query(
      "SELECT value FROM integration_configs WHERE key = $1",
      [key]
    );
    res.json({ key, url: result.rows[0]?.value ?? "" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /api/integrations/test/:key — ping a webhook with test payload ─────
// Buyer only

router.post("/test/:key", async (req, res) => {
  try {
    const uid = await requireBuyer(req, res);
    if (!uid) return;

    const { key } = req.params;
    const urlRow = await pool.query(
      "SELECT value FROM integration_configs WHERE key = $1",
      [key]
    );
    const url = urlRow.rows[0]?.value ?? "";
    if (!url?.startsWith("http")) {
      res.status(400).json({ ok: false, error: "No URL configured for this key" });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const resp = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ test: true, source: "hab-platform", key, timestamp: new Date().toISOString() }),
        signal:  controller.signal,
      });
      clearTimeout(timeout);
      res.json({ ok: resp.ok, status: resp.status, statusText: resp.statusText });
    } catch (fetchErr: unknown) {
      clearTimeout(timeout);
      const isAbort = fetchErr instanceof Error && fetchErr.name === "AbortError";
      res.status(502).json({ ok: false, error: isAbort ? "Timeout (8s)" : String(fetchErr) });
    }
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
