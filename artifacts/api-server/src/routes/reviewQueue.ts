import { Router }  from "express";
import { getAuth } from "@clerk/express";
import { pool }    from "../lib/db";
import { writeFile, mkdir } from "fs/promises";
import { join }    from "path";
import { randomUUID } from "crypto";
import {
  pdfPagesToPngs,
  imageToBase64DataUrl,
  splitPdfByPageRanges,
  cleanupDir,
  ensureDir,
} from "../lib/pdfUtils";

const router = Router();

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireAuth(req: any, res: any): Promise<string | null> {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return auth.userId;
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function mapItem(row: Record<string, unknown>, includeThumbnail = false) {
  return {
    id:             row.id,
    uploadId:       row.upload_id,
    businessId:     row.business_id,
    docIndex:       row.doc_index,
    pageStart:      row.page_start,
    pageEnd:        row.page_end,
    thumbnail:      includeThumbnail ? row.thumbnail_b64 : undefined,
    aiNote:         row.ai_note,
    partialData:    row.partial_data,
    confidence:     row.confidence,
    status:         row.status,
    reviewerNotes:  row.reviewer_notes,
    resolvedAction: row.resolved_action,
    reviewedAt:     row.reviewed_at,
    createdAt:      row.created_at,
  };
}

// ─── File a document to n8n ───────────────────────────────────────────────────

async function fileDocToN8n(
  pdfB64:     string,
  metadata:   Record<string, unknown>,
  businessId: string,
): Promise<{ ok: boolean; driveLink?: string }> {
  const row = await pool.query(
    "SELECT value FROM integration_configs WHERE key = 'document_intake_webhook'",
  );
  const webhookUrl = (row.rows[0]?.value as string) ?? "";
  if (!webhookUrl?.startsWith("http")) return { ok: false };

  try {
    const resp = await fetch(webhookUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ file: pdfB64, mimeType: "application/pdf", businessId, ...metadata }),
    });
    if (resp.ok) {
      const body = await resp.json().catch(() => ({})) as Record<string, unknown>;
      return { ok: true, driveLink: body.driveViewLink as string | undefined };
    }
  } catch { /* webhook unavailable */ }
  return { ok: false };
}

// ─── GET /api/review-queue?businessId=&status= ───────────────────────────────

router.get("/", async (req, res) => {
  try {
    const uid = await requireAuth(req, res);
    if (!uid) return;

    const { businessId, status } = req.query as Record<string, string>;
    const result = await pool.query(
      `SELECT id, upload_id, business_id, doc_index, page_start, page_end,
              thumbnail_b64, ai_note, confidence, status, reviewer_notes,
              resolved_action, reviewed_at, created_at,
              partial_data - 'pdfB64' AS partial_data
       FROM review_queue_items
       WHERE ($1::text IS NULL OR business_id = $1)
         AND ($2::text IS NULL OR status = $2)
       ORDER BY created_at DESC`,
      [businessId || null, status || null],
    );

    // Badge count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM review_queue_items
       WHERE ($1::text IS NULL OR business_id = $1) AND status = 'pending'`,
      [businessId || null],
    );

    res.json({
      items:        result.rows.map((r: Record<string, unknown>) => mapItem(r, true)),
      pendingCount: parseInt(countResult.rows[0].count as string),
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /api/review-queue/count?businessId= ─────────────────────────────────

router.get("/count", async (req, res) => {
  try {
    const uid = await requireAuth(req, res);
    if (!uid) return;
    const { businessId } = req.query as Record<string, string>;
    const r = await pool.query(
      `SELECT COUNT(*) FROM review_queue_items
       WHERE ($1::text IS NULL OR business_id = $1) AND status = 'pending'`,
      [businessId || null],
    );
    res.json({ count: parseInt(r.rows[0].count as string) });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /api/review-queue/:id ────────────────────────────────────────────────

router.get("/:id", async (req, res) => {
  try {
    const uid = await requireAuth(req, res);
    if (!uid) return;
    const r = await pool.query(
      "SELECT * FROM review_queue_items WHERE id = $1",
      [req.params.id],
    );
    if (!r.rows.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(mapItem(r.rows[0], true));
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── PATCH /api/review-queue/:id — update reviewer notes / status ─────────────

router.patch("/:id", async (req, res) => {
  try {
    const uid = await requireAuth(req, res);
    if (!uid) return;
    const { reviewerNotes, status } = req.body as { reviewerNotes?: string; status?: string };
    const r = await pool.query(
      `UPDATE review_queue_items
       SET reviewer_notes = COALESCE($1, reviewer_notes),
           status         = COALESCE($2, status)
       WHERE id = $3 RETURNING *`,
      [reviewerNotes ?? null, status ?? null, req.params.id],
    );
    if (!r.rows.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(mapItem(r.rows[0], false));
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /api/review-queue/:id/action ───────────────────────────────────────
// actions: "approve" | "split" | "file_manually" | "resubmit"

router.post("/:id/action", async (req, res) => {
  try {
    const uid = await requireAuth(req, res);
    if (!uid) return;

    const { action, reviewerNotes, splitRanges } = req.body as {
      action:        string;
      reviewerNotes?: string;
      splitRanges?:  Array<{ start: number; end: number }>;
    };

    const itemResult = await pool.query(
      "SELECT * FROM review_queue_items WHERE id = $1",
      [req.params.id],
    );
    if (!itemResult.rows.length) { res.status(404).json({ error: "Not found" }); return; }
    const item = itemResult.rows[0] as Record<string, unknown>;
    const partial = (item.partial_data ?? {}) as Record<string, unknown>;
    const pdfB64  = partial.pdfB64 as string | undefined;

    let message = "";
    let resolvedAction = action;

    if (action === "file_manually") {
      // Mark resolved without sending to Drive
      message = "Marked as filed manually. No Drive upload was performed.";
    } else if (action === "approve") {
      if (!pdfB64) {
        res.json({ ok: false, message: "No PDF data stored for this item — please file manually." });
        return;
      }
      const meta = {
        vendor:        partial.vendor,
        invoiceNumber: partial.invoiceNumber,
        date:          partial.date,
        totalAmount:   partial.totalAmount,
        lineItems:     partial.lineItems,
        reviewerNotes,
      };
      const result = await fileDocToN8n(pdfB64, meta, item.business_id as string);
      message = result.ok
        ? `Filed successfully!${result.driveLink ? ` Drive: ${result.driveLink}` : ""}`
        : "Filed locally — Drive webhook not yet configured. Document data saved.";
    } else if (action === "split") {
      if (!pdfB64 || !splitRanges?.length) {
        res.json({ ok: false, message: "PDF data or split ranges missing." });
        return;
      }
      // Write PDF to temp, split, file each part
      const tmpDir  = `/tmp/hab-review-split/${randomUUID().slice(0, 8)}`;
      const tmpFile = `${tmpDir}/input.pdf`;
      await ensureDir(tmpDir);
      await writeFile(tmpFile, Buffer.from(pdfB64, "base64"));

      const splits  = await splitPdfByPageRanges(tmpFile, splitRanges);
      let filesOk   = 0;
      for (let i = 0; i < splits.length; i++) {
        const r = await fileDocToN8n(splits[i].toString("base64"), {
          vendor:  partial.vendor ?? `Split-${i + 1}`,
          reviewerNotes,
        }, item.business_id as string);
        if (r.ok) filesOk++;
      }
      await cleanupDir(tmpDir);
      message = `Split into ${splits.length} documents. ${filesOk} filed to Drive.`;
      resolvedAction = "split";
    } else if (action === "resubmit") {
      if (!pdfB64) {
        res.json({ ok: false, message: "No PDF data stored for this item." });
        return;
      }
      // Write to temp and re-run AI
      const tmpDir  = `/tmp/hab-resubmit/${randomUUID().slice(0, 8)}`;
      const tmpFile = `${tmpDir}/input.pdf`;
      await ensureDir(tmpDir);
      await writeFile(tmpFile, Buffer.from(pdfB64, "base64"));

      // Re-analyze the PDF pages
      const pageFiles = await pdfPagesToPngs(tmpFile, `${tmpDir}/pages`, 150);
      if (!pageFiles.length) {
        await cleanupDir(tmpDir);
        res.json({ ok: false, message: "Could not extract pages from PDF for reanalysis." });
        return;
      }

      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

      const dataUrls = await Promise.all(pageFiles.map(imageToBase64DataUrl));
      const aiResp   = await openai.chat.completions.create({
        model:    "gpt-4o",
        messages: [{
          role:    "user",
          content: [
            { type: "text", text: `You are re-analyzing a flagged document. Previous issue: "${item.ai_note}"\nReviewer notes: "${reviewerNotes ?? "none"}"\n\nPlease try again and return JSON with the same structure as before (totalDocuments, documents[]).` },
            ...dataUrls.map((url) => ({ type: "image_url" as const, image_url: { url, detail: "high" as const } })),
          ],
        }],
        response_format: { type: "json_object" },
        max_tokens:      2048,
      });

      const raw    = aiResp.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as { documents: Array<{ confidence: number; aiNote: string; vendor: string }> };
      const topDoc = parsed.documents?.[0];
      await cleanupDir(tmpDir);

      if (topDoc && topDoc.confidence >= 80) {
        // File it now
        const n8n = await fileDocToN8n(pdfB64, {
          vendor:  topDoc.vendor,
          reviewerNotes,
        }, item.business_id as string);
        message = `AI now confident (${topDoc.confidence}%). ${n8n.ok ? "Filed to Drive!" : "Saved locally — Drive webhook not configured."}`;
      } else {
        // Update note and set back to pending
        const newNote = topDoc?.aiNote ?? "AI still cannot determine document details.";
        await pool.query(
          "UPDATE review_queue_items SET ai_note = $1, confidence = $2, status = 'pending' WHERE id = $3",
          [newNote, topDoc?.confidence ?? item.confidence, req.params.id],
        );
        res.json({ ok: true, action: "resubmit", message: `AI re-analyzed. Confidence still low (${topDoc?.confidence ?? "?"}%). Item remains in queue with updated notes.` });
        return;
      }
    } else {
      res.status(400).json({ error: `Unknown action: ${action}` });
      return;
    }

    // Mark as resolved
    await pool.query(
      `UPDATE review_queue_items
       SET status = 'resolved', resolved_action = $1, reviewer_notes = COALESCE($2, reviewer_notes), reviewed_at = NOW()
       WHERE id = $3`,
      [resolvedAction, reviewerNotes ?? null, req.params.id],
    );

    res.json({ ok: true, action: resolvedAction, message });
  } catch (err: unknown) {
    console.error("Review queue action error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
