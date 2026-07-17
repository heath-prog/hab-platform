import { readFile, mkdir, writeFile } from "fs/promises";
import { join, extname, basename } from "path";
import { randomUUID } from "crypto";
import AdmZip from "adm-zip";
import OpenAI from "openai";
import { pool } from "./db";
import {
  pdfPagesToPngs,
  pdfFirstPageThumbnail,
  imageToBase64DataUrl,
  countPdfPages,
  splitPdfByPageRanges,
  ensureDir,
  cleanupDir,
} from "./pdfUtils";
import { INTEGRATION_KEYS } from "./integrationKeys";

const CONFIDENCE_THRESHOLD = 80;
const UPLOAD_BASE = "/tmp/hab-uploads";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LineItem = {
  description: string;
  quantity:    number | null;
  unitPrice:   number | null;
  total:       number | null;
};

export type AiDocument = {
  documentIndex: number;
  pages:         number[];
  documentType:  string;
  vendor:        string | null;
  invoiceNumber: string | null;
  date:          string | null;
  totalAmount:   number | null;
  lineItems:     LineItem[];
  confidence:    number;
  aiNote:        string;
};

type AiResponse = {
  totalDocuments: number;
  documents:      AiDocument[];
};

export type ProcessingResult = {
  uploadId:   number;
  totalPages: number;
  filed:      number;
  queued:     number;
  failed:     number;
  documents:  Array<{
    status:    "filed" | "queued" | "error";
    vendor:    string | null;
    amount:    number | null;
    date:      string | null;
    confidence: number;
    aiNote:    string;
    driveLink?: string;
  }>;
};

// ─── Shared OpenAI client (lazy init) ────────────────────────────────────────

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ─── Integration config shim ──────────────────────────────────────────────────
// The integration config service lives in the frontend; on the server side
// we read directly from the integration_configs DB table.

async function getWebhookUrl(key: string): Promise<string> {
  try {
    const r = await pool.query(
      "SELECT value FROM integration_configs WHERE key = $1",
      [key]
    );
    return (r.rows[0]?.value as string) ?? "";
  } catch {
    return "";
  }
}

// ─── OpenAI Vision call ───────────────────────────────────────────────────────

const VISION_PROMPT = `You are an expert at analyzing scanned business documents (invoices, receipts, statements).

You will see images of pages from a document batch uploaded by a shop manager.

Your job:
1. Determine how many SEPARATE documents are in this batch
2. Identify page boundaries (where each new document starts/ends)
3. For each document, extract all available information
4. Rate your confidence (0-100) per document

A new document typically starts when: header/letterhead changes, new invoice number appears, date changes significantly, or the visual layout changes completely.

Confidence scoring:
- 90-100: All key fields clearly visible and readable
- 80-89: Most fields readable, minor uncertainties
- 60-79: Several fields unclear or uncertain
- Below 60: Significant portions unreadable or ambiguous

Return ONLY valid JSON with this exact structure:
{
  "totalDocuments": <number>,
  "documents": [
    {
      "documentIndex": <0-based number>,
      "pages": [<1-indexed page numbers>],
      "documentType": "invoice" | "receipt" | "statement" | "unknown",
      "vendor": "<vendor/company name or null>",
      "invoiceNumber": "<invoice number or null>",
      "date": "<YYYY-MM-DD or null>",
      "totalAmount": <number or null>,
      "lineItems": [
        { "description": "<text>", "quantity": <number or null>, "unitPrice": <number or null>, "total": <number or null> }
      ],
      "confidence": <0-100>,
      "aiNote": "<explanation of what you could/couldn't determine>"
    }
  ]
}`;

async function analyzePages(pageDataUrls: string[]): Promise<AiResponse> {
  const openai = getOpenAI();

  const imageContent = pageDataUrls.map((url) => ({
    type: "image_url" as const,
    image_url: { url, detail: "high" as const },
  }));

  const response = await openai.chat.completions.create({
    model:    "gpt-4o",
    messages: [
      {
        role:    "user",
        content: [
          { type: "text", text: VISION_PROMPT },
          ...imageContent,
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_tokens:      4096,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as AiResponse;
}

// ─── Send to n8n document intake webhook ─────────────────────────────────────

async function fileToN8n(
  pdfBuffer: Buffer,
  doc: AiDocument,
  businessId: string,
  uploadId: number,
): Promise<{ driveFileId?: string; driveViewLink?: string; sheetsRowId?: string }> {
  const webhookUrl = await getWebhookUrl(INTEGRATION_KEYS.DOCUMENT_INTAKE);
  if (!webhookUrl?.startsWith("http")) return {};

  const date  = new Date().toISOString().split("T")[0];
  const safe  = (s: string) => s.replace(/[^a-zA-Z0-9 ]/g, "").trim();
  const fname = `${safe(doc.vendor ?? "Unknown")} - ${safe(doc.invoiceNumber ?? "INV")} - ${date}.pdf`;

  try {
    const resp = await fetch(webhookUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        file:         pdfBuffer.toString("base64"),
        filename:     fname,
        mimeType:     "application/pdf",
        businessId,
        uploadId,
        documentType: doc.documentType,
        vendor:       doc.vendor,
        invoiceNumber: doc.invoiceNumber,
        date:         doc.date,
        totalAmount:  doc.totalAmount,
        lineItems:    doc.lineItems,
        confidence:   doc.confidence,
      }),
    });

    if (resp.ok) {
      const body = await resp.json().catch(() => ({})) as Record<string, unknown>;
      return {
        driveFileId:   body.driveFileId as string | undefined,
        driveViewLink: body.driveViewLink as string | undefined,
        sheetsRowId:   body.sheetsRowId as string | undefined,
      };
    }
  } catch { /* webhook failure — treat as pending_sync */ }

  return {};
}

// ─── Process a single PDF file ────────────────────────────────────────────────

async function processPdf(
  pdfPath:    string,
  uploadId:   number,
  businessId: string,
  workDir:    string,
): Promise<Array<{ doc: AiDocument; status: "filed" | "queued" | "error"; driveLink?: string }>> {
  const pageDir = join(workDir, "pages");
  const thumbDir = join(workDir, "thumb");

  // Convert pages to images
  const pageFiles = await pdfPagesToPngs(pdfPath, pageDir, 150);
  if (!pageFiles.length) return [];

  // Read all pages as base64 data URLs for Vision API
  // Batch in groups of 20 to stay within limits
  const BATCH = 20;
  const allDocs: AiDocument[] = [];

  for (let i = 0; i < pageFiles.length; i += BATCH) {
    const batchFiles = pageFiles.slice(i, i + BATCH);
    const dataUrls   = await Promise.all(batchFiles.map(imageToBase64DataUrl));
    const result     = await analyzePages(dataUrls);

    // Adjust page numbers for multi-batch
    const offset = i;
    for (const d of result.documents) {
      allDocs.push({ ...d, pages: d.pages.map((p) => p + offset) });
    }
  }

  const output: Array<{ doc: AiDocument; status: "filed" | "queued" | "error"; driveLink?: string }> = [];

  for (const doc of allDocs) {
    const pageStart = Math.min(...doc.pages);
    const pageEnd   = Math.max(...doc.pages);

    if (doc.confidence >= CONFIDENCE_THRESHOLD) {
      // Split this document out of the original PDF
      const [splitBuf] = await splitPdfByPageRanges(pdfPath, [{ start: pageStart, end: pageEnd }]);
      const n8nResult  = await fileToN8n(splitBuf, doc, businessId, uploadId);

      const status = Object.keys(n8nResult).length > 0 ? "filed" : "filed";
      await pool.query(
        `INSERT INTO extracted_documents
         (upload_id, business_id, doc_index, page_start, page_end, vendor_name, invoice_number,
          invoice_date, total_amount, line_items, confidence, ai_note, drive_file_id, drive_view_link, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          uploadId, businessId, doc.documentIndex, pageStart, pageEnd,
          doc.vendor, doc.invoiceNumber, doc.date, doc.totalAmount,
          JSON.stringify(doc.lineItems), doc.confidence, doc.aiNote,
          n8nResult.driveFileId ?? null,
          n8nResult.driveViewLink ?? null,
          n8nResult.driveFileId ? "filed" : "pending_sync",
        ],
      );
      output.push({ doc, status: "filed", driveLink: n8nResult.driveViewLink });
    } else {
      // Low confidence → review queue. Split the PDF now so reviewer can re-file it.
      const [splitBuf] = await splitPdfByPageRanges(pdfPath, [{ start: pageStart, end: pageEnd }]).catch(() => [Buffer.alloc(0)]);
      const thumbB64   = await pdfFirstPageThumbnail(pdfPath, join(thumbDir, `doc_${doc.documentIndex}`)).catch(() => "");
      await pool.query(
        `INSERT INTO review_queue_items
         (upload_id, business_id, doc_index, page_start, page_end, thumbnail_b64, ai_note, partial_data, confidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          uploadId, businessId, doc.documentIndex, pageStart, pageEnd,
          thumbB64, doc.aiNote,
          JSON.stringify({
            vendor:        doc.vendor,
            invoiceNumber: doc.invoiceNumber,
            date:          doc.date,
            totalAmount:   doc.totalAmount,
            lineItems:     doc.lineItems,
            pdfB64:        splitBuf.length ? splitBuf.toString("base64") : null,
          }),
          doc.confidence,
        ],
      );
      output.push({ doc, status: "queued" });
    }
  }

  return output;
}

// ─── Process an image file (JPG/PNG treated as single-page document) ──────────

async function processImage(
  imagePath:  string,
  uploadId:   number,
  businessId: string,
): Promise<Array<{ doc: AiDocument; status: "filed" | "queued" | "error"; driveLink?: string }>> {
  const dataUrl = await imageToBase64DataUrl(imagePath);
  const result  = await analyzePages([dataUrl]);

  const output: Array<{ doc: AiDocument; status: "filed" | "queued" | "error"; driveLink?: string }> = [];

  for (const doc of result.documents) {
    if (doc.confidence >= CONFIDENCE_THRESHOLD) {
      const imageData = await readFile(imagePath);
      const n8nResult = await fileToN8n(imageData, doc, businessId, uploadId);

      await pool.query(
        `INSERT INTO extracted_documents
         (upload_id, business_id, doc_index, page_start, page_end, vendor_name, invoice_number,
          invoice_date, total_amount, line_items, confidence, ai_note, drive_file_id, drive_view_link, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          uploadId, businessId, doc.documentIndex, 1, 1,
          doc.vendor, doc.invoiceNumber, doc.date, doc.totalAmount,
          JSON.stringify(doc.lineItems), doc.confidence, doc.aiNote,
          n8nResult.driveFileId ?? null, n8nResult.driveViewLink ?? null,
          n8nResult.driveFileId ? "filed" : "pending_sync",
        ],
      );
      output.push({ doc, status: "filed", driveLink: n8nResult.driveViewLink });
    } else {
      const imgB64 = await imageToBase64DataUrl(imagePath);
      await pool.query(
        `INSERT INTO review_queue_items
         (upload_id, business_id, doc_index, page_start, page_end, thumbnail_b64, ai_note, partial_data, confidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          uploadId, businessId, doc.documentIndex, 1, 1,
          imgB64, doc.aiNote,
          JSON.stringify({ vendor: doc.vendor, invoiceNumber: doc.invoiceNumber, date: doc.date, totalAmount: doc.totalAmount }),
          doc.confidence,
        ],
      );
      output.push({ doc, status: "queued" });
    }
  }

  return output;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function processDocumentUpload(
  uploadId:   number,
  filePath:   string,
  mimeType:   string,
  businessId: string,
): Promise<ProcessingResult> {
  const workDir = join(UPLOAD_BASE, `work_${uploadId}_${randomUUID().slice(0, 8)}`);
  await ensureDir(workDir);

  const allResults: Array<{ doc: AiDocument; status: "filed" | "queued" | "error"; driveLink?: string }> = [];

  try {
    const isPdf = mimeType === "application/pdf";
    const isImg = ["image/jpeg", "image/png"].includes(mimeType);
    const isZip = mimeType === "application/zip" || mimeType === "application/x-zip-compressed";

    if (isPdf) {
      const results = await processPdf(filePath, uploadId, businessId, workDir);
      allResults.push(...results);
    } else if (isImg) {
      const results = await processImage(filePath, uploadId, businessId);
      allResults.push(...results);
    } else if (isZip) {
      // Extract ZIP and process each file inside
      const extractDir = join(workDir, "extracted");
      await ensureDir(extractDir);
      const zip = new AdmZip(filePath);
      zip.extractAllTo(extractDir, true);

      const { readdir: rd } = await import("fs/promises");
      const entries = await rd(extractDir, { recursive: true }).catch(() => [] as string[]);

      for (const entry of entries) {
        const entryPath = join(extractDir, entry as string);
        const ext = extname(entry as string).toLowerCase();
        let entryMime = "";
        if (ext === ".pdf")             entryMime = "application/pdf";
        else if (ext === ".jpg" || ext === ".jpeg") entryMime = "image/jpeg";
        else if (ext === ".png")        entryMime = "image/png";
        if (!entryMime) continue;

        const subDir = join(workDir, `sub_${basename(entry as string).replace(/\./g, "_")}`);
        if (entryMime === "application/pdf") {
          const r = await processPdf(entryPath, uploadId, businessId, subDir);
          allResults.push(...r);
        } else {
          const r = await processImage(entryPath, uploadId, businessId);
          allResults.push(...r);
        }
      }
    }

    const filed  = allResults.filter((r) => r.status === "filed").length;
    const queued = allResults.filter((r) => r.status === "queued").length;
    const failed = allResults.filter((r) => r.status === "error").length;

    await pool.query(
      `UPDATE document_uploads
       SET status = $1, docs_found = $2, docs_filed = $3, docs_queued = $4, processed_at = NOW()
       WHERE id = $5`,
      [failed > 0 && filed === 0 && queued === 0 ? "failed" : "complete", allResults.length, filed, queued, uploadId],
    );

    return {
      uploadId,
      totalPages:  allResults.length,
      filed,
      queued,
      failed,
      documents: allResults.map(({ doc, status, driveLink }) => ({
        status,
        vendor:        doc.vendor,
        invoiceNumber: doc.invoiceNumber,
        amount:        doc.totalAmount,
        date:          doc.date,
        confidence:    doc.confidence,
        aiNote:        doc.aiNote,
        driveLink,
      })),
    };
  } catch (err) {
    await pool.query(
      "UPDATE document_uploads SET status = 'failed', error_msg = $1 WHERE id = $2",
      [String(err), uploadId],
    );
    throw err;
  } finally {
    await cleanupDir(workDir);
  }
}
