import { Router } from "express";
import { getAuth } from "@clerk/express";
import { pool } from "../lib/db";
import { logger } from "../lib/logger";

const router = Router();

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function requireSuperAdmin(
  userId: string,
): Promise<boolean> {
  const r = await pool.query(
    "SELECT role FROM deal_users WHERE clerk_user_id = $1",
    [userId],
  );
  return (r.rows[0] as { role: string } | undefined)?.role === "super_admin";
}

// ── Admin: list users ──────────────────────────────────────────────────────

router.get("/users", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await requireSuperAdmin(userId)))
      return res.status(403).json({ error: "Forbidden" });

    const rows = await pool.query(`
      SELECT clerk_user_id, name, email, role,
             billing_status, billing_suspended_at, created_at
      FROM deal_users
      ORDER BY created_at ASC
    `);
    return res.json(rows.rows);
  } catch (err) {
    logger.error(err, "GET /api/admin/users");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: suspend user ────────────────────────────────────────────────────

router.post("/users/:clerkId/suspend", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await requireSuperAdmin(userId)))
      return res.status(403).json({ error: "Forbidden" });

    await pool.query(
      `UPDATE deal_users
       SET billing_status = 'suspended', billing_suspended_at = NOW()
       WHERE clerk_user_id = $1`,
      [req.params.clerkId],
    );
    logger.info({ target: req.params.clerkId, by: userId }, "User suspended");
    return res.json({ ok: true });
  } catch (err) {
    logger.error(err, "POST /api/admin/users/:clerkId/suspend");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: restore user ────────────────────────────────────────────────────

router.post("/users/:clerkId/restore", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await requireSuperAdmin(userId)))
      return res.status(403).json({ error: "Forbidden" });

    await pool.query(
      `UPDATE deal_users
       SET billing_status = 'active', billing_suspended_at = NULL
       WHERE clerk_user_id = $1`,
      [req.params.clerkId],
    );
    logger.info({ target: req.params.clerkId, by: userId }, "User restored");
    return res.json({ ok: true });
  } catch (err) {
    logger.error(err, "POST /api/admin/users/:clerkId/restore");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Billing: status for current user ──────────────────────────────────────

router.get("/billing/status", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const r = await pool.query(
      "SELECT billing_status FROM deal_users WHERE clerk_user_id = $1",
      [userId],
    );
    const row = r.rows[0] as { billing_status: string } | undefined;
    return res.json({ billingStatus: row?.billing_status ?? "active" });
  } catch (err) {
    logger.error(err, "GET /api/billing/status");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Billing: submit payment appeal ────────────────────────────────────────

router.post("/billing/appeal", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { message } = req.body as { message?: string };
    if (!message?.trim()) return res.status(400).json({ error: "message required" });

    const user = await pool.query(
      "SELECT name, email FROM deal_users WHERE clerk_user_id = $1",
      [userId],
    );
    const u = user.rows[0] as { name: string; email: string } | undefined;

    await pool.query(
      `INSERT INTO payment_appeals (clerk_id, user_name, user_email, message)
       VALUES ($1, $2, $3, $4)`,
      [userId, u?.name ?? null, u?.email ?? null, message.trim()],
    );
    logger.info({ userId }, "Payment appeal submitted");
    return res.json({ ok: true });
  } catch (err) {
    logger.error(err, "POST /api/billing/appeal");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: list appeals ────────────────────────────────────────────────────

router.get("/admin/appeals", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await requireSuperAdmin(userId)))
      return res.status(403).json({ error: "Forbidden" });

    const rows = await pool.query(`
      SELECT id, clerk_id, user_name, user_email, message, status,
             reviewed_by, reviewed_at, created_at
      FROM payment_appeals
      ORDER BY created_at DESC
    `);
    return res.json(rows.rows);
  } catch (err) {
    logger.error(err, "GET /api/admin/appeals");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: approve appeal ─────────────────────────────────────────────────

router.post("/admin/appeals/:id/approve", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await requireSuperAdmin(userId)))
      return res.status(403).json({ error: "Forbidden" });

    const appeal = await pool.query(
      "SELECT clerk_id FROM payment_appeals WHERE id = $1",
      [req.params.id],
    );
    const a = appeal.rows[0] as { clerk_id: string } | undefined;
    if (!a) return res.status(404).json({ error: "Appeal not found" });

    await pool.query(
      `UPDATE payment_appeals
       SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
       WHERE id = $2`,
      [userId, req.params.id],
    );
    await pool.query(
      `UPDATE deal_users
       SET billing_status = 'active', billing_suspended_at = NULL
       WHERE clerk_user_id = $1`,
      [a.clerk_id],
    );
    logger.info({ appealId: req.params.id, by: userId }, "Appeal approved");
    return res.json({ ok: true });
  } catch (err) {
    logger.error(err, "POST /api/admin/appeals/:id/approve");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
