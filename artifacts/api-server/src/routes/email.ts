import { Router }     from "express";
import nodemailer      from "nodemailer";
import { randomBytes } from "crypto";
import { getAuth }     from "@clerk/express";
import { pool }        from "../lib/db";
import { logger }      from "../lib/logger";

const router = Router();

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireAuth(req: any, res: any): Promise<string | null> {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return auth.userId;
}

// ─── Mailer helper ────────────────────────────────────────────────────────────

function getTransporter() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailPass },
  });
}

// ─── POST /api/email/send-loi ─────────────────────────────────────────────────

router.post("/send-loi", async (req, res) => {
  const { to, subject, body, pdfBase64, filename } = req.body as {
    to: string;
    subject: string;
    body: string;
    pdfBase64: string;
    filename: string;
  };

  if (!to || !pdfBase64) {
    res.status(400).json({ error: "Missing required fields: to, pdfBase64" });
    return;
  }

  const gmailUser = process.env.GMAIL_USER;
  const transporter = getTransporter();

  if (!transporter || !gmailUser) {
    res.status(503).json({
      error: "Email not configured",
      hint: "Set GMAIL_USER and GMAIL_APP_PASSWORD environment secrets to enable email sending.",
      fallback: "mailto",
    });
    return;
  }

  try {
    const pdfBuffer = Buffer.from(pdfBase64, "base64");

    await transporter.sendMail({
      from: `"${process.env.SENDER_NAME ?? "HAB Enterprises 3 LLC"}" <${gmailUser}>`,
      to,
      subject: subject ?? "Letter of Intent — HAB Enterprises 3 LLC",
      text: body ?? "Please find the attached Letter of Intent for your review and signature.",
      html: body
        ? `<p>${body.replace(/\n/g, "<br/>")}</p>`
        : `<p>Please find the attached Letter of Intent for your review and signature.</p><p>Please sign and return at your earliest convenience.</p>`,
      attachments: [
        {
          filename: filename ?? "LOI_HABEnterprises.pdf",
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    logger.info({ to, filename }, "LOI email sent");
    res.json({ success: true, to, filename });
  } catch (err) {
    logger.error({ err }, "Failed to send LOI email");
    res.status(500).json({ error: "Failed to send email", detail: String(err) });
  }
});

// ─── POST /api/email/send-invite (no auth required) ──────────────────────────

router.post("/send-invite", async (req, res) => {
  const { email, name, role, invitedBy } = req.body as {
    email:      string;
    name:       string;
    role:       string;
    invitedBy?: string;
  };

  if (!email || !name || !role) {
    res.status(400).json({ error: "Missing required fields: email, name, role" });
    return;
  }

  try {
    const token     = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      `INSERT INTO invite_tokens (token, email, name, role, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [token, email, name, role, invitedBy ?? null, expiresAt],
    );

    const appUrl    = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
    const inviteUrl = `${appUrl}/join?token=${token}`;

    const transporter = getTransporter();
    const gmailUser   = process.env.GMAIL_USER;

    if (transporter && gmailUser) {
      const roleLabel: Record<string, string> = {
        buyer:   "Buyer",
        agent:   "Advisor / Agent",
        seller:  "Seller",
        pending: "Pending",
      };
      await transporter.sendMail({
        from:    `"${process.env.SENDER_NAME ?? "HAB Enterprises 3 LLC"}" <${gmailUser}>`,
        to:      email,
        subject: "You're invited to HAB Dashboard",
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px">
            <h2 style="margin:0 0 8px;font-size:22px">You're invited to HAB Dashboard</h2>
            <p style="color:#555;margin:0 0 24px">
              ${invitedBy ?? "Your team"} has invited you to join as <strong>${roleLabel[role] ?? role}</strong>.
            </p>
            <a href="${inviteUrl}"
               style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
              Accept Invitation →
            </a>
            <p style="color:#888;font-size:12px;margin-top:24px">
              This link expires in 1 hour. If you didn't expect this email, you can ignore it.
            </p>
          </div>
        `,
        text: `You've been invited to HAB Dashboard as ${roleLabel[role] ?? role}.\n\nAccept here: ${inviteUrl}\n\nThis link expires in 1 hour.`,
      });
      logger.info({ to: email }, "Invite email sent");
    } else {
      logger.info({ email, inviteUrl }, "Invite created (email not configured — log URL)");
    }

    res.json({ success: true, inviteUrl });
  } catch (err) {
    logger.error({ err }, "Failed to create invite");
    res.status(500).json({ error: "Failed to create invite", detail: String(err) });
  }
});

// ─── GET /api/email/validate-invite?token= (no auth) ─────────────────────────

router.get("/validate-invite", async (req, res) => {
  const { token } = req.query as { token?: string };
  if (!token) {
    res.status(400).json({ error: "Missing token" });
    return;
  }

  try {
    const r = await pool.query(
      "SELECT * FROM invite_tokens WHERE token = $1",
      [token],
    );

    if (!r.rows.length) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const row = r.rows[0] as {
      email: string; name: string; role: string;
      used_at: Date | null; expires_at: Date;
    };

    if (row.used_at || new Date(row.expires_at) < new Date()) {
      res.status(410).json({ error: "expired" });
      return;
    }

    res.json({ valid: true, email: row.email, name: row.name, role: row.role });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /api/email/consume-invite (requires Clerk auth) ────────────────────

router.post("/consume-invite", async (req, res) => {
  const uid = await requireAuth(req, res);
  if (!uid) return;

  const { token } = req.body as { token: string };
  if (!token) {
    res.status(400).json({ error: "Missing token" });
    return;
  }

  try {
    const r = await pool.query(
      "SELECT * FROM invite_tokens WHERE token = $1",
      [token],
    );

    if (!r.rows.length) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const row = r.rows[0] as {
      id: number; email: string; name: string; role: string;
      used_at: Date | null; expires_at: Date;
    };

    if (row.used_at || new Date(row.expires_at) < new Date()) {
      res.status(410).json({ error: "expired" });
      return;
    }

    // Mark token as used
    await pool.query(
      "UPDATE invite_tokens SET used_at = NOW() WHERE id = $1",
      [row.id],
    );

    // Upsert deal_users record
    await pool.query(
      `INSERT INTO deal_users (clerk_user_id, email, name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (clerk_user_id)
       DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, role = EXCLUDED.role, updated_at = NOW()`,
      [uid, row.email, row.name, row.role],
    );

    logger.info({ uid, email: row.email, role: row.role }, "Invite consumed");
    res.json({ success: true, role: row.role });
  } catch (err) {
    logger.error({ err }, "Failed to consume invite");
    res.status(500).json({ error: "Server error", detail: String(err) });
  }
});

export default router;
