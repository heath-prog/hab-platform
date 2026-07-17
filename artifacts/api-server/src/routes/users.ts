import { Router } from "express";
import { getAuth } from "@clerk/express";
import { pool } from "../lib/db";
import { promoteSuperAdminIfEligible } from "../lib/superAdmin";

const router = Router();

function toResponse(row: Record<string, unknown>) {
  return {
    id: row.id,
    clerkUserId: row.clerk_user_id,
    email: row.email,
    name: row.name,
    role: row.role,
    permissions: row.permissions,
    notes: row.notes,
    invitedBy: row.invited_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// super_admin passes all role guards — it sits above buyer in the hierarchy.
const BUYER_OR_ABOVE = new Set(["buyer", "super_admin"]);

async function requireBuyer(req: any, res: any): Promise<string | null> {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  const me = await pool.query("SELECT role FROM deal_users WHERE clerk_user_id = $1", [auth.userId]);
  if (!me.rows.length || !BUYER_OR_ABOVE.has(me.rows[0].role)) { res.status(403).json({ error: "Forbidden" }); return null; }
  return auth.userId;
}

// GET /api/users/me — auto-create or link on first login
router.get("/me", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });

    const { userId, sessionClaims } = auth;
    const email = (sessionClaims?.email as string) || "";
    const name = (sessionClaims?.name as string) || null;

    let result = await pool.query("SELECT * FROM deal_users WHERE clerk_user_id = $1", [userId]);

    if (!result.rows.length) {
      // Try to match pre-created record by email
      const byEmail = await pool.query("SELECT * FROM deal_users WHERE email = $1 AND clerk_user_id LIKE 'pending-%'", [email]);
      if (byEmail.rows.length) {
        await pool.query(
          "UPDATE deal_users SET clerk_user_id = $1, name = COALESCE(name, $2), updated_at = NOW() WHERE id = $3",
          [userId, name, byEmail.rows[0].id]
        );
        result = await pool.query("SELECT * FROM deal_users WHERE clerk_user_id = $1", [userId]);
      } else {
        // First user ever → buyer; otherwise pending
        const countResult = await pool.query("SELECT COUNT(*) FROM deal_users");
        const isFirst = parseInt(countResult.rows[0].count as string) === 0;
        const role = isFirst ? "buyer" : "pending";
        result = await pool.query(
          "INSERT INTO deal_users (clerk_user_id, email, name, role) VALUES ($1, $2, $3, $4) RETURNING *",
          [userId, email, name, role]
        );
      }
    }

    // Super-admin promotion runs at every session load — not just at server
    // startup — so a fresh sign-in immediately gets the right role.
    let row = result.rows[0];
    const promoted = await promoteSuperAdminIfEligible(row.id);
    if (promoted) row = promoted;

    return res.json(toResponse(row));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/users — list all (buyer only)
router.get("/", async (req, res) => {
  try {
    const uid = await requireBuyer(req, res);
    if (!uid) return;
    const result = await pool.query("SELECT * FROM deal_users ORDER BY created_at ASC");
    res.json(result.rows.map(toResponse));
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/users — pre-create a user (buyer only)
router.post("/", async (req, res) => {
  try {
    const uid = await requireBuyer(req, res);
    if (!uid) return;
    const { email, name, role, notes } = req.body;
    if (!email) return res.status(400).json({ error: "email required" });
    const existing = await pool.query("SELECT id FROM deal_users WHERE email = $1", [email]);
    if (existing.rows.length) return res.status(409).json({ error: "User with this email already exists" });
    const placeholder = `pending-${Math.random().toString(36).slice(2)}`;
    const result = await pool.query(
      "INSERT INTO deal_users (clerk_user_id, email, name, role, notes, invited_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [placeholder, email, name || null, role || "seller", notes || "", uid]
    );
    return res.status(201).json(toResponse(result.rows[0]));
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/users/:id — update role / name / notes (buyer only)
router.patch("/:id", async (req, res) => {
  try {
    const uid = await requireBuyer(req, res);
    if (!uid) return;
    const { role, name, notes } = req.body;
    const result = await pool.query(
      "UPDATE deal_users SET role = COALESCE($1, role), name = COALESCE($2, name), notes = COALESCE($3, notes), updated_at = NOW() WHERE id = $4 RETURNING *",
      [role ?? null, name ?? null, notes ?? null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Not found" });
    return res.json(toResponse(result.rows[0]));
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/users/:id/permissions (buyer only)
router.patch("/:id/permissions", async (req, res) => {
  try {
    const uid = await requireBuyer(req, res);
    if (!uid) return;
    const { permissions } = req.body;
    const result = await pool.query(
      "UPDATE deal_users SET permissions = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [JSON.stringify(permissions), req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Not found" });
    return res.json(toResponse(result.rows[0]));
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/users/:id (buyer only)
router.delete("/:id", async (req, res) => {
  try {
    const uid = await requireBuyer(req, res);
    if (!uid) return;
    await pool.query("DELETE FROM deal_users WHERE id = $1", [req.params.id]);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
