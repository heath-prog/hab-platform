import { Router }           from "express";
import multer               from "multer";
import { mkdir }            from "fs/promises";
import { getAuth }          from "@clerk/express";
import { pool }             from "../lib/db";
import { processDocumentUpload } from "../lib/documentProcessor";

const router = Router();

const UPLOAD_DIR = "/tmp/hab-uploads";

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireAuth(req: any, res: any): Promise<string | null> {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return auth.userId;
}

// ─── Multer config ────────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    await mkdir(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ext    = file.originalname.split(".").pop() ?? "bin";
    cb(null, `${unique}.${ext}`);
  },
});

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
]);

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    // Allow by mime type OR by extension for browsers that misreport zip mime
    const ext = file.originalname.split(".").pop()?.toLowerCase() ?? "";
    const extOk = ["pdf", "jpg", "jpeg", "png", "zip"].includes(ext);
    if (ALLOWED_MIME.has(file.mimetype) || extOk) cb(null, true);
    else cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
});

// ─── Helper: normalize mime type ─────────────────────────────────────────────

function normalizeMime(mime: string, filename: string): string {
  if (mime === "application/octet-stream") {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "pdf") return "application/pdf";
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "png") return "image/png";
    if (ext === "zip") return "application/zip";
  }
  return mime;
}

// ─── POST /api/documents/upload ───────────────────────────────────────────────

router.post(
  "/upload",
  upload.single("file"),
  async (req, res) => {
    try {
      const uid = await requireAuth(req, res);
      if (!uid) return;

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const businessId = (req.body.businessId as string) || "unknown";
      const mime       = normalizeMime(file.mimetype, file.originalname);

      // 1. Create the upload record immediately
      const insertResult = await pool.query(
        `INSERT INTO document_uploads
         (business_id, original_filename, file_type, file_size, status)
         VALUES ($1, $2, $3, $4, 'processing')
         RETURNING id`,
        [businessId, file.originalname, mime, file.size],
      );
      const uploadId: number = insertResult.rows[0].id;

      // 2. Process (runs AI, splits PDFs, queues low-confidence items)
      const result = await processDocumentUpload(uploadId, file.path, mime, businessId);

      res.json(result);
    } catch (err: unknown) {
      console.error("Upload processing error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  },
);

// ─── GET /api/documents/uploads?businessId= ──────────────────────────────────

router.get("/uploads", async (req, res) => {
  try {
    const uid = await requireAuth(req, res);
    if (!uid) return;

    const { businessId, limit = "20", offset = "0" } = req.query as Record<string, string>;
    const result = await pool.query(
      `SELECT * FROM document_uploads
       WHERE ($1::text IS NULL OR business_id = $1)
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [businessId || null, Number(limit), Number(offset)],
    );
    res.json({ uploads: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /api/documents/uploads/:id ──────────────────────────────────────────

router.get("/uploads/:id", async (req, res) => {
  try {
    const uid = await requireAuth(req, res);
    if (!uid) return;

    const upload = await pool.query(
      "SELECT * FROM document_uploads WHERE id = $1",
      [req.params.id],
    );
    if (!upload.rows.length) { res.status(404).json({ error: "Not found" }); return; }

    const docs = await pool.query(
      "SELECT * FROM extracted_documents WHERE upload_id = $1 ORDER BY doc_index ASC",
      [req.params.id],
    );
    const queued = await pool.query(
      "SELECT id, doc_index, status, confidence, ai_note, created_at FROM review_queue_items WHERE upload_id = $1",
      [req.params.id],
    );

    res.json({
      upload:     upload.rows[0],
      documents:  docs.rows,
      queueItems: queued.rows,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
