import { Router } from "express";
import { randomUUID } from "node:crypto";
import { getAuth } from "@clerk/express";
import { pool } from "../lib/db";

// CRM module (WP1) — tenants / clients pipeline / contacts / advisors /
// KPI snapshots / compliance / onboarding checklists, plus the HAB_CRM_v1.html
// JSON importer. Contract: outputs/CRM_DATA_MODEL.md (schemaVersion 1).

const router = Router();

// ─── Auth guard (same pattern as routes/users.ts) ────────────────────────────
// super_admin passes all role guards — it sits above buyer in the hierarchy.
const BUYER_OR_ABOVE = new Set(["buyer", "super_admin"]);

async function requireBuyer(req: any, res: any): Promise<string | null> {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  const me = await pool.query("SELECT role FROM deal_users WHERE clerk_user_id = $1", [auth.userId]);
  if (!me.rows.length || !BUYER_OR_ABOVE.has(me.rows[0].role)) { res.status(403).json({ error: "Forbidden" }); return null; }
  return auth.userId;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Queryable = { query: (text: string, params?: any[]) => Promise<any> };

function uid(): string {
  return randomUUID();
}

/** Curriculum week derivation — CRM_DATA_MODEL.md §5.1. weekOverride wins;
 *  otherwise floor((today - startDate) / 7d) + 1, clamped >= 1.
 *  Weeks 1–13 = Advisor Cycle, 14–26 = Coach Cycle, > 26 = graduated. */
function deriveWeek(
  startDate: unknown,
  weekOverride: unknown,
): { week: number | null; cycle: "advisor" | "coach" | "graduated" | null } {
  let week: number | null = null;
  if (typeof weekOverride === "number" && weekOverride >= 1) {
    week = weekOverride;
  } else if (startDate) {
    const start = new Date(startDate as string).getTime();
    if (!Number.isNaN(start)) {
      week = Math.max(1, Math.floor((Date.now() - start) / (7 * 86400000)) + 1);
    }
  }
  if (week == null) return { week: null, cycle: null };
  return { week, cycle: week <= 13 ? "advisor" : week <= 26 ? "coach" : "graduated" };
}

function toTenant(row: Record<string, any>) {
  return {
    id: row.id,
    name: row.name,
    entityLabel: row.entity_label,
    features: row.features ?? {},
    ...(row.config ?? {}), // stages, kpiDefs, onboardingTemplate, weekThemes, ...
  };
}

function toClient(row: Record<string, any>) {
  const { week, cycle } = deriveWeek(row.start_date, row.week_override);
  const flags: string[] = Array.isArray(row.flags) ? row.flags : [];
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    stageId: row.stage_id,
    isSeed: row.is_seed,
    seedNote: row.seed_note,
    emails: row.emails ?? [],
    phone: row.phone,
    address: row.address,
    notes: row.notes,
    flags,
    acquisitionFlag: flags.includes("acquisition"),
    calendarColorId: row.calendar_color_id,
    slots: row.slots ?? [],
    startDate: row.start_date,
    weekOverride: row.week_override,
    curriculumWeek: week,
    curriculumCycle: cycle,
    docsDelivered: row.docs_delivered ?? {},
    onboardingGeneratedAt: row.onboarding_generated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toContact(row: Record<string, any>) {
  return { id: row.id, clientId: row.client_id, name: row.name, role: row.role, email: row.email, phone: row.phone };
}

function toAdvisor(row: Record<string, any>) {
  return { id: row.id, clientId: row.client_id, name: row.name, level: row.level, progress: row.progress ?? {}, notes: row.notes };
}

function toSnapshot(row: Record<string, any>) {
  return { id: row.id, clientId: row.client_id, date: row.snapshot_date, values: row.kpi_values ?? {} };
}

function toTask(row: Record<string, any>) {
  return { id: row.id, clientId: row.client_id, position: row.position, label: row.label, done: row.done, doneDate: row.done_date };
}

async function logActivity(q: Queryable, clientId: string, text: string): Promise<void> {
  await q.query("INSERT INTO crm_activity (client_id, text) VALUES ($1, $2)", [clientId, text]);
}

/** Rule §5.2 — instantiate the tenant's onboardingTemplate as unchecked tasks.
 *  Idempotent: no-op when the client already has any tasks. */
async function generateOnboardingTasks(q: Queryable, clientId: string, template: string[]): Promise<number> {
  const existing = await q.query("SELECT COUNT(*)::int AS n FROM crm_onboarding_tasks WHERE client_id = $1", [clientId]);
  if (existing.rows[0].n > 0) return 0;
  for (let i = 0; i < template.length; i++) {
    await q.query(
      "INSERT INTO crm_onboarding_tasks (id, client_id, position, label) VALUES ($1, $2, $3, $4)",
      [uid(), clientId, i, template[i]],
    );
  }
  await q.query("UPDATE crm_clients SET onboarding_generated_at = NOW(), updated_at = NOW() WHERE id = $1", [clientId]);
  await logActivity(q, clientId, `Onboarding checklist generated (${template.length} tasks)`);
  return template.length;
}

// ─── Tenants ─────────────────────────────────────────────────────────────────

// GET /api/crm/tenants
router.get("/tenants", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    const result = await pool.query("SELECT * FROM tenants ORDER BY id ASC");
    return res.json(result.rows.map(toTenant));
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/crm/tenants/:tid — full tenant config (stages, kpiDefs, ...)
router.get("/tenants/:tid", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    const result = await pool.query("SELECT * FROM tenants WHERE id = $1", [req.params.tid]);
    if (!result.rows.length) return res.status(404).json({ error: "Not found" });
    return res.json(toTenant(result.rows[0]));
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/crm/tenants/:tid — upsert tenant config (body in export shape:
// { name, entityLabel, features, stages, kpiDefs, onboardingTemplate, ... })
router.put("/tenants/:tid", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    const { name, entityLabel, features, ...config } = req.body ?? {};
    if (!name) return res.status(400).json({ error: "name required" });
    delete (config as Record<string, unknown>).id;
    const result = await pool.query(
      `INSERT INTO tenants (id, name, entity_label, features, config)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, entity_label = EXCLUDED.entity_label,
         features = EXCLUDED.features, config = EXCLUDED.config, updated_at = NOW()
       RETURNING *`,
      [req.params.tid, name, entityLabel ?? "Account", JSON.stringify(features ?? {}), JSON.stringify(config)],
    );
    return res.json(toTenant(result.rows[0]));
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── Clients (shops) ─────────────────────────────────────────────────────────

// GET /api/crm/tenants/:tid/clients?stage=&flag=&q=
router.get("/tenants/:tid/clients", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    const params: any[] = [req.params.tid];
    let sql = "SELECT * FROM crm_clients WHERE tenant_id = $1";
    const { stage, flag, q } = req.query as Record<string, string | undefined>;
    if (stage) { params.push(stage); sql += ` AND stage_id = $${params.length}`; }
    if (flag)  { params.push(flag);  sql += ` AND $${params.length} = ANY(flags)`; }
    if (q)     { params.push(`%${q}%`); sql += ` AND name ILIKE $${params.length}`; }
    sql += " ORDER BY name ASC";
    const result = await pool.query(sql, params);
    return res.json(result.rows.map(toClient));
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/crm/tenants/:tid/clients
router.post("/tenants/:tid/clients", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    const tenant = await pool.query("SELECT id FROM tenants WHERE id = $1", [req.params.tid]);
    if (!tenant.rows.length) return res.status(404).json({ error: "Unknown tenant" });
    const b = req.body ?? {};
    if (!b.name) return res.status(400).json({ error: "name required" });
    const id = typeof b.id === "string" && b.id ? b.id : uid();
    const result = await pool.query(
      `INSERT INTO crm_clients
         (id, tenant_id, name, stage_id, is_seed, seed_note, emails, phone, address, notes,
          flags, calendar_color_id, slots, start_date, week_override, docs_delivered)
       VALUES ($1, $2, $3, COALESCE($4, 'prospect'), COALESCE($5, FALSE), $6,
               COALESCE($7, '{}'), $8, $9, $10, COALESCE($11, '{}'), $12,
               COALESCE($13, '[]'::jsonb), $14, $15, COALESCE($16, '{}'::jsonb))
       RETURNING *`,
      [
        id, req.params.tid, b.name, b.stageId ?? null, b.isSeed ?? null, b.seedNote ?? null,
        b.emails ?? null, b.phone ?? null, b.address ?? null, b.notes ?? null,
        b.flags ?? null, b.calendarColorId ?? null,
        b.slots != null ? JSON.stringify(b.slots) : null,
        b.startDate ?? null, b.weekOverride ?? null,
        b.docsDelivered != null ? JSON.stringify(b.docsDelivered) : null,
      ],
    );
    await logActivity(pool, id, "Client created");
    return res.status(201).json(toClient(result.rows[0]));
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/crm/clients/:id — client + contacts + advisors + KPI snapshots +
// compliance + onboarding tasks + recent activity + derived curriculum week
router.get("/clients/:id", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    const found = await pool.query("SELECT * FROM crm_clients WHERE id = $1", [req.params.id]);
    if (!found.rows.length) return res.status(404).json({ error: "Not found" });
    const id = req.params.id;
    const [contacts, advisors, snapshots, compliance, tasks, activity] = await Promise.all([
      pool.query("SELECT * FROM crm_contacts WHERE client_id = $1 ORDER BY created_at ASC", [id]),
      pool.query("SELECT * FROM crm_advisors WHERE client_id = $1 ORDER BY created_at ASC", [id]),
      pool.query("SELECT * FROM crm_kpi_snapshots WHERE client_id = $1 ORDER BY snapshot_date DESC, created_at DESC", [id]),
      pool.query("SELECT * FROM crm_compliance WHERE client_id = $1", [id]),
      pool.query("SELECT * FROM crm_onboarding_tasks WHERE client_id = $1 ORDER BY position ASC", [id]),
      pool.query("SELECT * FROM crm_activity WHERE client_id = $1 ORDER BY ts DESC LIMIT 100", [id]),
    ]);
    return res.json({
      ...toClient(found.rows[0]),
      contacts: contacts.rows.map(toContact),
      advisors: advisors.rows.map(toAdvisor),
      kpiSnapshots: snapshots.rows.map(toSnapshot),
      compliance: compliance.rows.length ? compliance.rows[0].fields : {},
      onboardingTasks: tasks.rows.map(toTask),
      activity: activity.rows.map((r: Record<string, any>) => ({ ts: r.ts, text: r.text })),
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/crm/clients/:id — partial update. Stage moves go through
// POST /clients/:id/stage so the onboarding auto-generation rule applies.
router.patch("/clients/:id", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    const b = req.body ?? {};
    const sets: string[] = [];
    const params: any[] = [];
    const set = (col: string, val: any) => { params.push(val); sets.push(`${col} = $${params.length}`); };
    if (b.name !== undefined) set("name", b.name);
    if (b.isSeed !== undefined) set("is_seed", b.isSeed);
    if (b.seedNote !== undefined) set("seed_note", b.seedNote);
    if (b.emails !== undefined) set("emails", b.emails ?? []);
    if (b.phone !== undefined) set("phone", b.phone);
    if (b.address !== undefined) set("address", b.address);
    if (b.notes !== undefined) set("notes", b.notes);
    if (b.flags !== undefined) set("flags", b.flags ?? []);
    if (b.calendarColorId !== undefined) set("calendar_color_id", b.calendarColorId);
    if (b.slots !== undefined) set("slots", JSON.stringify(b.slots ?? []));
    if (b.startDate !== undefined) set("start_date", b.startDate);
    if (b.weekOverride !== undefined) set("week_override", b.weekOverride);
    if (b.docsDelivered !== undefined) set("docs_delivered", JSON.stringify(b.docsDelivered ?? {}));
    if (!sets.length && b.compliance === undefined) return res.status(400).json({ error: "No updatable fields in body" });
    let row: Record<string, any> | null = null;
    if (sets.length) {
      params.push(req.params.id);
      const result = await pool.query(
        `UPDATE crm_clients SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
        params,
      );
      if (!result.rows.length) return res.status(404).json({ error: "Not found" });
      row = result.rows[0];
    } else {
      const result = await pool.query("SELECT * FROM crm_clients WHERE id = $1", [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: "Not found" });
      row = result.rows[0];
    }
    if (b.compliance !== undefined) {
      await pool.query(
        `INSERT INTO crm_compliance (client_id, fields, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (client_id) DO UPDATE SET fields = crm_compliance.fields || EXCLUDED.fields, updated_at = NOW()`,
        [req.params.id, JSON.stringify(b.compliance ?? {})],
      );
    }
    return res.json(toClient(row as Record<string, any>));
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/crm/clients/:id/stage {stageId} — moves stage, logs activity, and
// applies rule §5.2: entering the tenant's onboardingTriggerStage (HAB:
// "contract" / Contract Signed) auto-generates the onboarding checklist.
router.post("/clients/:id/stage", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    const { stageId } = req.body ?? {};
    if (!stageId || typeof stageId !== "string") return res.status(400).json({ error: "stageId required" });
    const found = await pool.query(
      "SELECT c.*, t.config AS tenant_config FROM crm_clients c JOIN tenants t ON t.id = c.tenant_id WHERE c.id = $1",
      [req.params.id],
    );
    if (!found.rows.length) return res.status(404).json({ error: "Not found" });
    const prev = found.rows[0];
    const config = prev.tenant_config ?? {};
    const stages: Array<{ id: string; label: string }> = Array.isArray(config.stages) ? config.stages : [];
    if (stages.length && !stages.some((s) => s.id === stageId)) {
      return res.status(400).json({ error: `Unknown stageId "${stageId}" for tenant ${prev.tenant_id}` });
    }
    const label = stages.find((s) => s.id === stageId)?.label ?? stageId;
    const updated = await pool.query(
      "UPDATE crm_clients SET stage_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [stageId, req.params.id],
    );
    if (prev.stage_id !== stageId) await logActivity(pool, req.params.id, `Stage → ${label}`);
    let tasksGenerated = 0;
    if (stageId === config.onboardingTriggerStage) {
      const template: string[] = Array.isArray(config.onboardingTemplate) ? config.onboardingTemplate : [];
      if (template.length) tasksGenerated = await generateOnboardingTasks(pool, req.params.id, template);
    }
    return res.json({ ...toClient(updated.rows[0]), tasksGenerated });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/crm/clients/:id — child rows cascade
router.delete("/clients/:id", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    await pool.query("DELETE FROM crm_clients WHERE id = $1", [req.params.id]);
    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── Contacts ────────────────────────────────────────────────────────────────

// POST /api/crm/clients/:id/contacts
router.post("/clients/:id/contacts", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    const { name, role, email, phone } = req.body ?? {};
    if (!name) return res.status(400).json({ error: "name required" });
    const client = await pool.query("SELECT id FROM crm_clients WHERE id = $1", [req.params.id]);
    if (!client.rows.length) return res.status(404).json({ error: "Client not found" });
    const result = await pool.query(
      "INSERT INTO crm_contacts (id, client_id, name, role, email, phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [uid(), req.params.id, name, role ?? null, email ?? null, phone ?? null],
    );
    return res.status(201).json(toContact(result.rows[0]));
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/crm/contacts/:cid
router.delete("/contacts/:cid", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    await pool.query("DELETE FROM crm_contacts WHERE id = $1", [req.params.cid]);
    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── Advisors ────────────────────────────────────────────────────────────────

// POST /api/crm/clients/:id/advisors
router.post("/clients/:id/advisors", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    const { name, level, progress, notes } = req.body ?? {};
    if (!name) return res.status(400).json({ error: "name required" });
    const client = await pool.query("SELECT id FROM crm_clients WHERE id = $1", [req.params.id]);
    if (!client.rows.length) return res.status(404).json({ error: "Client not found" });
    const result = await pool.query(
      `INSERT INTO crm_advisors (id, client_id, name, level, progress, notes)
       VALUES ($1, $2, $3, COALESCE($4, 1), COALESCE($5, '{}'::jsonb), $6) RETURNING *`,
      [uid(), req.params.id, name, level ?? null, progress != null ? JSON.stringify(progress) : null, notes ?? null],
    );
    await logActivity(pool, req.params.id, `Advisor added: ${name}`);
    return res.status(201).json(toAdvisor(result.rows[0]));
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/crm/advisors/:aid — body: {name?, level?, notes?, progress?}
// progress merges per module key ({"M3":"done"} touches only M3).
router.patch("/advisors/:aid", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    const { name, level, progress, notes } = req.body ?? {};
    const result = await pool.query(
      `UPDATE crm_advisors SET
         name = COALESCE($1, name),
         level = COALESCE($2, level),
         notes = COALESCE($3, notes),
         progress = CASE WHEN $4::jsonb IS NULL THEN progress ELSE progress || $4::jsonb END
       WHERE id = $5 RETURNING *`,
      [name ?? null, level ?? null, notes ?? null, progress != null ? JSON.stringify(progress) : null, req.params.aid],
    );
    if (!result.rows.length) return res.status(404).json({ error: "Not found" });
    const row = result.rows[0];
    if (level != null) await logActivity(pool, row.client_id, `Advisor ${row.name} → level ${row.level}`);
    return res.json(toAdvisor(row));
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/crm/advisors/:aid
router.delete("/advisors/:aid", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    await pool.query("DELETE FROM crm_advisors WHERE id = $1", [req.params.aid]);
    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── KPI snapshots ───────────────────────────────────────────────────────────

// GET /api/crm/clients/:id/kpi-snapshots (newest first)
router.get("/clients/:id/kpi-snapshots", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    const result = await pool.query(
      "SELECT * FROM crm_kpi_snapshots WHERE client_id = $1 ORDER BY snapshot_date DESC, created_at DESC",
      [req.params.id],
    );
    return res.json(result.rows.map(toSnapshot));
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/crm/clients/:id/kpi-snapshots {date, values} — append-only
router.post("/clients/:id/kpi-snapshots", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    const { date, values } = req.body ?? {};
    if (!date) return res.status(400).json({ error: "date required (ISO date)" });
    if (values == null || typeof values !== "object" || Array.isArray(values)) {
      return res.status(400).json({ error: "values must be an object keyed by KPI id" });
    }
    const client = await pool.query("SELECT id FROM crm_clients WHERE id = $1", [req.params.id]);
    if (!client.rows.length) return res.status(404).json({ error: "Client not found" });
    const result = await pool.query(
      "INSERT INTO crm_kpi_snapshots (id, client_id, snapshot_date, kpi_values) VALUES ($1, $2, $3, $4) RETURNING *",
      [uid(), req.params.id, date, JSON.stringify(values)],
    );
    await logActivity(pool, req.params.id, `KPI snapshot recorded (${date})`);
    return res.status(201).json(toSnapshot(result.rows[0]));
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/crm/kpi-snapshots/:sid
router.delete("/kpi-snapshots/:sid", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    await pool.query("DELETE FROM crm_kpi_snapshots WHERE id = $1", [req.params.sid]);
    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── Compliance ──────────────────────────────────────────────────────────────

// GET /api/crm/clients/:id/compliance
router.get("/clients/:id/compliance", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    const client = await pool.query("SELECT id FROM crm_clients WHERE id = $1", [req.params.id]);
    if (!client.rows.length) return res.status(404).json({ error: "Client not found" });
    const result = await pool.query("SELECT * FROM crm_compliance WHERE client_id = $1", [req.params.id]);
    return res.json({
      clientId: req.params.id,
      fields: result.rows.length ? result.rows[0].fields : {},
      updatedAt: result.rows.length ? result.rows[0].updated_at : null,
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/crm/clients/:id/compliance — merge {fields: {bar_exp: "..."}}
// (or the field map directly as the body); keys follow tenant complianceFields.
router.patch("/clients/:id/compliance", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    const body = req.body ?? {};
    const fields = body.fields !== undefined ? body.fields : body;
    if (fields == null || typeof fields !== "object" || Array.isArray(fields)) {
      return res.status(400).json({ error: "fields must be an object keyed by compliance field id" });
    }
    const client = await pool.query("SELECT id FROM crm_clients WHERE id = $1", [req.params.id]);
    if (!client.rows.length) return res.status(404).json({ error: "Client not found" });
    const result = await pool.query(
      `INSERT INTO crm_compliance (client_id, fields, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (client_id) DO UPDATE SET fields = crm_compliance.fields || EXCLUDED.fields, updated_at = NOW()
       RETURNING *`,
      [req.params.id, JSON.stringify(fields)],
    );
    return res.json({ clientId: req.params.id, fields: result.rows[0].fields, updatedAt: result.rows[0].updated_at });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── Onboarding checklist ────────────────────────────────────────────────────

// POST /api/crm/clients/:id/onboarding/generate — manual trigger (idempotent)
router.post("/clients/:id/onboarding/generate", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    const found = await pool.query(
      "SELECT c.id, t.config AS tenant_config FROM crm_clients c JOIN tenants t ON t.id = c.tenant_id WHERE c.id = $1",
      [req.params.id],
    );
    if (!found.rows.length) return res.status(404).json({ error: "Not found" });
    const config = found.rows[0].tenant_config ?? {};
    const template: string[] = Array.isArray(config.onboardingTemplate) ? config.onboardingTemplate : [];
    const tasksGenerated = template.length
      ? await generateOnboardingTasks(pool, req.params.id, template)
      : 0;
    const tasks = await pool.query("SELECT * FROM crm_onboarding_tasks WHERE client_id = $1 ORDER BY position ASC", [req.params.id]);
    return res.json({ tasksGenerated, tasks: tasks.rows.map(toTask) });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/crm/clients/:id/onboarding/tasks {label} — append ad-hoc task
router.post("/clients/:id/onboarding/tasks", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    const { label } = req.body ?? {};
    if (!label) return res.status(400).json({ error: "label required" });
    const client = await pool.query("SELECT id FROM crm_clients WHERE id = $1", [req.params.id]);
    if (!client.rows.length) return res.status(404).json({ error: "Client not found" });
    const result = await pool.query(
      `INSERT INTO crm_onboarding_tasks (id, client_id, position, label)
       VALUES ($1, $2, (SELECT COALESCE(MAX(position), -1) + 1 FROM crm_onboarding_tasks WHERE client_id = $2), $3)
       RETURNING *`,
      [uid(), req.params.id, label],
    );
    return res.status(201).json(toTask(result.rows[0]));
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/crm/onboarding-tasks/:tid {done, doneDate?} — toggle a task
router.patch("/onboarding-tasks/:tid", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    const { done, doneDate, label } = req.body ?? {};
    if (done === undefined && label === undefined) return res.status(400).json({ error: "done or label required" });
    const result = await pool.query(
      `UPDATE crm_onboarding_tasks SET
         label = COALESCE($1, label),
         done = COALESCE($2, done),
         done_date = CASE
           WHEN $2::boolean IS TRUE THEN COALESCE($3::date, CURRENT_DATE)
           WHEN $2::boolean IS FALSE THEN NULL
           ELSE done_date
         END
       WHERE id = $4 RETURNING *`,
      [label ?? null, done ?? null, doneDate ?? null, req.params.tid],
    );
    if (!result.rows.length) return res.status(404).json({ error: "Not found" });
    return res.json(toTask(result.rows[0]));
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── Activity log ────────────────────────────────────────────────────────────

// GET /api/crm/clients/:id/activity (newest first)
router.get("/clients/:id/activity", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    const result = await pool.query(
      "SELECT ts, text FROM crm_activity WHERE client_id = $1 ORDER BY ts DESC LIMIT 200",
      [req.params.id],
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/crm/clients/:id/activity {text}
router.post("/clients/:id/activity", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    const { text } = req.body ?? {};
    if (!text) return res.status(400).json({ error: "text required" });
    const client = await pool.query("SELECT id FROM crm_clients WHERE id = $1", [req.params.id]);
    if (!client.rows.length) return res.status(404).json({ error: "Client not found" });
    await logActivity(pool, req.params.id, String(text));
    return res.status(201).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── Import — HAB_CRM_v1.html localStorage export ────────────────────────────

// POST /api/crm/import — accepts the Export JSON payload verbatim:
// { schemaVersion: 1, savedAt, activeTenantId, tenants: [...], accounts: [...] }.
// Tenants are upserted by id; accounts are replaced by id (delete + reinsert,
// child rows cascade) so re-importing the same export is idempotent and never
// touches records that are absent from the payload.
router.post("/import", async (req, res) => {
  try {
    if (!(await requireBuyer(req, res))) return;
    const body = req.body ?? {};
    if (body.schemaVersion !== 1 || !Array.isArray(body.tenants) || !Array.isArray(body.accounts)) {
      return res.status(400).json({
        error: "Not a valid HAB CRM v1 export (expected schemaVersion 1 with tenants[] and accounts[])",
      });
    }
    const counts = { tenants: 0, clients: 0, contacts: 0, advisors: 0, kpiSnapshots: 0, onboardingTasks: 0, activityEntries: 0, compliance: 0, skipped: 0 };
    const db = await pool.connect();
    try {
      await db.query("BEGIN");

      for (const t of body.tenants) {
        if (!t || typeof t.id !== "string" || !t.id || !t.name) { counts.skipped++; continue; }
        const { id, name, entityLabel, features, ...config } = t;
        await db.query(
          `INSERT INTO tenants (id, name, entity_label, features, config)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name, entity_label = EXCLUDED.entity_label,
             features = EXCLUDED.features, config = EXCLUDED.config, updated_at = NOW()`,
          [id, name, entityLabel ?? "Account", JSON.stringify(features ?? {}), JSON.stringify(config)],
        );
        counts.tenants++;
      }

      for (const a of body.accounts) {
        if (!a || typeof a.id !== "string" || !a.id || !a.tenantId || !a.name) { counts.skipped++; continue; }
        await db.query("DELETE FROM crm_clients WHERE id = $1", [a.id]);
        await db.query(
          `INSERT INTO crm_clients
             (id, tenant_id, name, stage_id, is_seed, seed_note, emails, phone, address, notes,
              flags, calendar_color_id, slots, start_date, week_override, docs_delivered,
              onboarding_generated_at, created_at)
           VALUES ($1, $2, $3, COALESCE($4, 'prospect'), COALESCE($5, FALSE), $6,
                   COALESCE($7, '{}'), $8, $9, $10, COALESCE($11, '{}'), $12,
                   COALESCE($13, '[]'::jsonb), $14, $15, COALESCE($16, '{}'::jsonb),
                   $17, COALESCE($18::timestamptz, NOW()))`,
          [
            a.id, a.tenantId, a.name, a.stageId ?? null, a.isSeed ?? null, a.seedNote ?? null,
            Array.isArray(a.emails) ? a.emails : null, a.phone ?? null, a.address ?? null, a.notes ?? null,
            Array.isArray(a.flags) ? a.flags : null, a.calendarColorId ?? null,
            a.slots != null ? JSON.stringify(a.slots) : null,
            a.startDate ?? null, a.weekOverride ?? null,
            a.docsDelivered != null ? JSON.stringify(a.docsDelivered) : null,
            a.onboarding?.generatedAt ?? null, a.createdAt ?? null,
          ],
        );
        counts.clients++;

        for (const c of Array.isArray(a.contacts) ? a.contacts : []) {
          if (!c?.name) continue;
          await db.query(
            "INSERT INTO crm_contacts (id, client_id, name, role, email, phone) VALUES ($1, $2, $3, $4, $5, $6)",
            [typeof c.id === "string" && c.id ? c.id : uid(), a.id, c.name, c.role ?? null, c.email ?? null, c.phone ?? null],
          );
          counts.contacts++;
        }

        for (const adv of Array.isArray(a.advisors) ? a.advisors : []) {
          if (!adv?.name) continue;
          await db.query(
            `INSERT INTO crm_advisors (id, client_id, name, level, progress, notes)
             VALUES ($1, $2, $3, COALESCE($4, 1), COALESCE($5, '{}'::jsonb), $6)`,
            [
              typeof adv.id === "string" && adv.id ? adv.id : uid(), a.id, adv.name,
              adv.level ?? null, adv.progress != null ? JSON.stringify(adv.progress) : null, adv.notes ?? null,
            ],
          );
          counts.advisors++;
        }

        for (const s of Array.isArray(a.kpiSnapshots) ? a.kpiSnapshots : []) {
          if (!s?.date) continue;
          await db.query(
            "INSERT INTO crm_kpi_snapshots (id, client_id, snapshot_date, kpi_values) VALUES ($1, $2, $3, $4)",
            [typeof s.id === "string" && s.id ? s.id : uid(), a.id, s.date, JSON.stringify(s.values ?? {})],
          );
          counts.kpiSnapshots++;
        }

        if (a.compliance != null && typeof a.compliance === "object" && Object.keys(a.compliance).length) {
          await db.query(
            "INSERT INTO crm_compliance (client_id, fields) VALUES ($1, $2)",
            [a.id, JSON.stringify(a.compliance)],
          );
          counts.compliance++;
        }

        const obTasks = Array.isArray(a.onboarding?.tasks) ? a.onboarding.tasks : [];
        for (let i = 0; i < obTasks.length; i++) {
          const task = obTasks[i];
          if (!task?.label) continue;
          await db.query(
            `INSERT INTO crm_onboarding_tasks (id, client_id, position, label, done, done_date)
             VALUES ($1, $2, $3, $4, COALESCE($5, FALSE), $6)`,
            [typeof task.id === "string" && task.id ? task.id : uid(), a.id, i, task.label, task.done ?? null, task.doneDate ?? null],
          );
          counts.onboardingTasks++;
        }

        for (const entry of Array.isArray(a.activity) ? a.activity : []) {
          if (!entry?.text) continue;
          await db.query(
            "INSERT INTO crm_activity (client_id, ts, text) VALUES ($1, COALESCE($2::timestamptz, NOW()), $3)",
            [a.id, entry.ts ?? null, entry.text],
          );
          counts.activityEntries++;
        }
      }

      await db.query("COMMIT");
    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    } finally {
      db.release();
    }
    return res.json({ ok: true, savedAt: body.savedAt ?? null, imported: counts });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
