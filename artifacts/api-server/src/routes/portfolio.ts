import { Router } from "express";
import { getAuth } from "@clerk/express";
import type { QueryResult, QueryResultRow } from "pg";
import { pool } from "../lib/db";
import { logger } from "../lib/logger";

const router = Router();

const SEED_BUSINESSES = [
  {
    id: "true-blue",
    name: "True Blue Auto Care",
    entityName: "True Blue Auto Care Inc.",
    seller: "Saj Zoghet",
    buyer: "Heath Blake",
    buyerEntity: "HAB Enterprises 3 LLC",
    dealPrice: 300000,
    stage: "diligence",
    acquisitionType: "asset",
    industry: "Automotive Repair",
    targetCloseDate: "2026-07-16",
    escrowDate: "2026-05-16",
    financialManagementActive: true,
    description: "Asset purchase of True Blue Auto Care Inc. $300K purchase price. Rent: $8K/mo. Seller note: $2,250/mo.",
    createdAt: "2026-04-08T00:00:00Z",
  },
  {
    id: "prestige-auto-works",
    name: "Prestige Auto Works",
    entityName: "Prestige Auto Works",
    seller: "Andre Kamel",
    buyer: "Heath Blake",
    buyerEntity: "HAB Enterprises 5 LLC",
    dealPrice: 1800000,
    stage: "lead",
    acquisitionType: "asset",
    financingTypes: ["sba"],
    industry: "Automotive Repair",
    targetCloseDate: "2026-09-15",
    financialManagementActive: true,
    description: "European auto repair shop in Elk Grove. SBA needed to purchase business.",
    tags: ["Asset Purchase", "SBA", "Rollup"],
    createdAt: "2026-04-08T00:00:00Z",
  },
];

// GET /api/portfolio — load (or create + seed) the user's portfolio
router.get("/", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    let portfolio = await pool
      .query("SELECT id, name FROM portfolios WHERE owner_clerk_id = $1", [userId])
      .then((r: QueryResult) => r.rows[0] as { id: number; name: string } | undefined);

    if (!portfolio) {
      const ins = await pool.query(
        "INSERT INTO portfolios (owner_clerk_id, name) VALUES ($1, $2) RETURNING id, name",
        [userId, "My Portfolio"],
      );
      portfolio = ins.rows[0] as { id: number; name: string };

      for (const b of SEED_BUSINESSES) {
        await pool.query(
          `INSERT INTO businesses (id, portfolio_id, owner_clerk_id, data)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO NOTHING`,
          [b.id, portfolio.id, userId, JSON.stringify(b)],
        );
      }

      logger.info({ userId }, "Created new portfolio with seed businesses");
    }

    const bizRows = await pool.query(
      "SELECT data FROM businesses WHERE portfolio_id = $1 ORDER BY created_at ASC",
      [portfolio.id],
    );

    // ── Lazy purge: hard-delete any trashed businesses past their purge date ──
    // This runs on every portfolio load as the fallback cleanup mechanism.
    // External Drive files and document references are NOT removed here —
    // only the app-owned workspace record (JSONB data) is hard-deleted.
    const now = new Date();
    const expired = bizRows.rows.filter((r: QueryResultRow) => {
      const biz = (r as { data: Record<string, unknown> }).data;
      return biz.lifecycleState === "trashed"
        && typeof biz.purgeAt === "string"
        && new Date(biz.purgeAt) <= now;
    });
    for (const row of expired) {
      const id = ((row as { data: Record<string, unknown> }).data.id) as string;
      await pool.query("DELETE FROM businesses WHERE id = $1 AND owner_clerk_id = $2", [id, userId]);
      logger.info({ businessId: id }, "Auto-purged expired trashed business");
    }

    const expiredIds = new Set(expired.map((r: QueryResultRow) =>
      ((r as { data: Record<string, unknown> }).data.id) as string
    ));
    const liveBusinesses = bizRows.rows
      .filter((r: QueryResultRow) => !expiredIds.has(((r as { data: Record<string, unknown> }).data.id) as string))
      .map((r: QueryResultRow) => (r as { data: unknown }).data);

    return res.json({
      id:         portfolio.id,
      name:       portfolio.name,
      businesses: liveBusinesses,
    });
  } catch (err) {
    logger.error(err, "GET /api/portfolio failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/portfolio — rename portfolio
router.put("/", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { name } = req.body as { name?: string };
    if (!name?.trim()) return res.status(400).json({ error: "name required" });

    await pool.query(
      "UPDATE portfolios SET name = $1, updated_at = NOW() WHERE owner_clerk_id = $2",
      [name.trim(), userId],
    );
    return res.json({ ok: true });
  } catch (err) {
    logger.error(err, "PUT /api/portfolio failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/portfolio/businesses — upsert a business
router.post("/businesses", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const biz = req.body as { id?: string };
    if (!biz?.id) return res.status(400).json({ error: "business id required" });

    const portfolio = await pool
      .query("SELECT id FROM portfolios WHERE owner_clerk_id = $1", [userId])
      .then((r: QueryResult) => r.rows[0] as { id: number } | undefined);

    if (!portfolio) return res.status(404).json({ error: "Portfolio not found" });

    // Preserve the server-side `workspace` payload (dashboard state) — the
    // client sends only the Business fields, so a plain overwrite would wipe it.
    await pool.query(
      `INSERT INTO businesses (id, portfolio_id, owner_clerk_id, data)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
         SET data = EXCLUDED.data || (
               CASE WHEN businesses.data ? 'workspace'
                    THEN jsonb_build_object('workspace', businesses.data->'workspace')
                    ELSE '{}'::jsonb END
             ),
             updated_at = NOW()`,
      [biz.id, portfolio.id, userId, JSON.stringify(biz)],
    );
    return res.json({ ok: true });
  } catch (err) {
    logger.error(err, "POST /api/portfolio/businesses failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Workspace state (per-business dashboard data, stored in the JSONB payload) ─

// GET /api/portfolio/businesses/:id/workspace — load workspace state
router.get("/businesses/:id/workspace", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const r = await pool.query(
      "SELECT data->'workspace' AS workspace FROM businesses WHERE id = $1 AND owner_clerk_id = $2",
      [req.params.id, userId],
    );
    if (!r.rows.length) return res.status(404).json({ error: "Business not found" });

    return res.json({ workspace: (r.rows[0] as { workspace: unknown }).workspace ?? null });
  } catch (err) {
    logger.error(err, "GET /api/portfolio/businesses/:id/workspace failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/portfolio/businesses/:id/workspace — persist workspace state
router.put("/businesses/:id/workspace", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const workspace = req.body as Record<string, unknown> | undefined;
    if (!workspace || typeof workspace !== "object") {
      return res.status(400).json({ error: "workspace payload required" });
    }

    const r = await pool.query(
      `UPDATE businesses
       SET data = jsonb_set(data, '{workspace}', $3::jsonb, true), updated_at = NOW()
       WHERE id = $1 AND owner_clerk_id = $2
       RETURNING id`,
      [req.params.id, userId, JSON.stringify(workspace)],
    );
    if (!r.rows.length) return res.status(404).json({ error: "Business not found" });

    return res.json({ ok: true });
  } catch (err) {
    logger.error(err, "PUT /api/portfolio/businesses/:id/workspace failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/portfolio/businesses/:id — remove a business
router.delete("/businesses/:id", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await pool.query(
      "DELETE FROM businesses WHERE id = $1 AND owner_clerk_id = $2",
      [req.params.id, userId],
    );
    return res.json({ ok: true });
  } catch (err) {
    logger.error(err, "DELETE /api/portfolio/businesses failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
