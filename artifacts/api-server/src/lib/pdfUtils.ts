import { execFile } from "child_process";
import { promisify } from "util";
import { readdir, readFile, mkdir, rm } from "fs/promises";
import { join, extname } from "path";
import { PDFDocument } from "pdf-lib";

const execFileAsync = promisify(execFile);

// ─── PDF → PNG page images ────────────────────────────────────────────────────

/**
 * Convert all pages of a PDF to PNG files using pdftoppm.
 * Returns sorted array of absolute file paths.
 */
export async function pdfPagesToPngs(
  pdfPath: string,
  outputDir: string,
  dpi: number = 150,
): Promise<string[]> {
  await mkdir(outputDir, { recursive: true });
  const prefix = join(outputDir, "page");

  await execFileAsync("pdftoppm", [
    "-png",
    "-r", String(dpi),
    pdfPath,
    prefix,
  ]);

  const all = await readdir(outputDir);
  return all
    .filter((f) => f.endsWith(".png"))
    .sort()
    .map((f) => join(outputDir, f));
}

/**
 * Get a single thumbnail (first page) of a PDF at low resolution.
 * Returns base64 PNG data URL.
 */
export async function pdfFirstPageThumbnail(
  pdfPath: string,
  outputDir: string,
): Promise<string> {
  await mkdir(outputDir, { recursive: true });
  const prefix = join(outputDir, "thumb");

  await execFileAsync("pdftoppm", [
    "-png",
    "-r", "72",
    "-f", "1",
    "-l", "1",
    pdfPath,
    prefix,
  ]);

  const files = (await readdir(outputDir))
    .filter((f) => f.startsWith("thumb") && f.endsWith(".png"))
    .sort();

  if (!files.length) throw new Error("pdftoppm produced no output");

  const imgPath = join(outputDir, files[0]);
  const data = await readFile(imgPath);
  return `data:image/png;base64,${data.toString("base64")}`;
}

// ─── Image → base64 ───────────────────────────────────────────────────────────

export async function imageToBase64DataUrl(imagePath: string): Promise<string> {
  const ext = extname(imagePath).toLowerCase().slice(1);
  const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
  const data = await readFile(imagePath);
  return `data:${mime};base64,${data.toString("base64")}`;
}

export async function imageToBase64(imagePath: string): Promise<string> {
  const data = await readFile(imagePath);
  return data.toString("base64");
}

// ─── PDF page count ───────────────────────────────────────────────────────────

export async function countPdfPages(pdfPath: string): Promise<number> {
  const bytes = await readFile(pdfPath);
  const doc   = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getPageCount();
}

// ─── PDF splitting ────────────────────────────────────────────────────────────

/**
 * Split a PDF into multiple PDFs by 1-indexed page ranges.
 * Returns Buffer[] with one Buffer per range.
 */
export async function splitPdfByPageRanges(
  pdfPath: string,
  ranges: Array<{ start: number; end: number }>,
): Promise<Buffer[]> {
  const srcBytes = await readFile(pdfPath);
  const srcDoc   = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
  const results: Buffer[] = [];

  for (const { start, end } of ranges) {
    const newDoc = await PDFDocument.create();
    const indices = Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
    const copied  = await newDoc.copyPages(srcDoc, indices);
    for (const page of copied) newDoc.addPage(page);
    const bytes = await newDoc.save();
    results.push(Buffer.from(bytes));
  }

  return results;
}

/**
 * Merge multiple PDF Buffers into a single PDF.
 */
export async function mergePdfs(pdfs: Buffer[]): Promise<Buffer> {
  const merged = await PDFDocument.create();
  for (const buf of pdfs) {
    const src    = await PDFDocument.load(buf, { ignoreEncryption: true });
    const pages  = await merged.copyPages(src, src.getPageIndices());
    for (const p of pages) merged.addPage(p);
  }
  return Buffer.from(await merged.save());
}

// ─── Temp directory management ────────────────────────────────────────────────

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function cleanupDir(dir: string): Promise<void> {
  try { await rm(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}
