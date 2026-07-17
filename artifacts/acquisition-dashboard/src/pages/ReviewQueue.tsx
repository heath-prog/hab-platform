import { useState, useEffect, useRef, useCallback } from "react";
import {
  AlertTriangle, CheckCircle2, Loader2, RefreshCw,
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  Highlighter, StickyNote, Scissors, RotateCcw, X,
  FileCheck2, Scissors as ScissorsIcon, FolderOpen, RotateCw, AlertOctagon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboard } from "@/lib/context";
import { apiFetch } from "@/lib/apiFetch";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Mock SVG thumbnails ──────────────────────────────────────────────────────

function svgUrl(content: string): string {
  const svg = `<svg width="480" height="640" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const THUMB_NAPA = svgUrl(`
  <rect width="480" height="640" fill="#fff"/>
  <rect x="0" y="0" width="480" height="72" fill="#1e3a8a"/>
  <text x="16" y="30" font-size="20" fill="white" font-weight="bold" font-family="Arial">NAPA AUTO PARTS</text>
  <text x="16" y="50" font-size="10" fill="#93c5fd" font-family="Arial">1847 W Commerce Dr, Phoenix AZ 85001 | (602) 555-0182</text>
  <text x="16" y="65" font-size="10" fill="#93c5fd" font-family="Arial">Invoice #INV-2026-04447  |  April 7, 2026</text>
  <text x="16" y="98" font-size="11" fill="#374151" font-family="Arial" font-weight="bold">BILL TO: True Blue Auto Care — 4820 N 19th Ave, Phoenix AZ</text>
  <line x1="16" y1="110" x2="464" y2="110" stroke="#e5e7eb" stroke-width="1"/>
  <rect x="16" y="114" width="448" height="18" fill="#f9fafb"/>
  <text x="20" y="127" font-size="9" fill="#6b7280" font-family="Arial" font-weight="bold">DESCRIPTION</text>
  <text x="310" y="127" font-size="9" fill="#6b7280" font-family="Arial" font-weight="bold">QTY</text>
  <text x="360" y="127" font-size="9" fill="#6b7280" font-family="Arial" font-weight="bold">PRICE</text>
  <text x="420" y="127" font-size="9" fill="#6b7280" font-family="Arial" font-weight="bold">TOTAL</text>
  <text x="20" y="148" font-size="10" fill="#111827" font-family="Arial">Premium Oil Filter PH3980</text>
  <text x="315" y="148" font-size="10" fill="#111827" font-family="Arial">4</text>
  <text x="355" y="148" font-size="10" fill="#111827" font-family="Arial">$8.97</text>
  <text x="415" y="148" font-size="10" fill="#111827" font-family="Arial">$35.88</text>
  <text x="20" y="166" font-size="10" fill="#111827" font-family="Arial">Motorcraft 5W-30 Oil (qt)</text>
  <text x="315" y="166" font-size="10" fill="#111827" font-family="Arial">12</text>
  <text x="355" y="166" font-size="10" fill="#111827" font-family="Arial">$6.29</text>
  <text x="415" y="166" font-size="10" fill="#111827" font-family="Arial">$75.48</text>
  <text x="20" y="184" font-size="10" fill="#111827" font-family="Arial">Air Filter CA10166</text>
  <text x="315" y="184" font-size="10" fill="#111827" font-family="Arial">2</text>
  <text x="355" y="184" font-size="10" fill="#111827" font-family="Arial">$22.99</text>
  <text x="415" y="184" font-size="10" fill="#111827" font-family="Arial">$45.98</text>
  <text x="20" y="202" font-size="10" fill="#111827" font-family="Arial">Wiper Blade Set 22 + 18</text>
  <text x="315" y="202" font-size="10" fill="#111827" font-family="Arial">3</text>
  <text x="355" y="202" font-size="10" fill="#111827" font-family="Arial">$18.50</text>
  <text x="415" y="202" font-size="10" fill="#111827" font-family="Arial">$55.50</text>
  <line x1="16" y1="214" x2="464" y2="214" stroke="#e5e7eb" stroke-width="1"/>
  <text x="355" y="234" font-size="10" fill="#374151" font-family="Arial">Subtotal:</text>
  <text x="415" y="234" font-size="10" fill="#374151" font-family="Arial">$212.84</text>
  <text x="355" y="252" font-size="10" fill="#374151" font-family="Arial">Tax (8.6%):</text>
  <text x="415" y="252" font-size="10" fill="#374151" font-family="Arial">$18.30</text>
  <rect x="300" y="258" width="164" height="26" fill="#fffbeb" rx="4"/>
  <text x="350" y="276" font-size="13" fill="#1e3a8a" font-family="Arial" font-weight="bold">TOTAL:</text>
  <rect x="390" y="260" width="70" height="22" fill="#fde68a" rx="3"/>
  <text x="394" y="276" font-size="13" fill="#92400e" font-family="Arial" font-weight="bold">$2??.??</text>
  <rect x="388" y="285" width="74" height="50" fill="#fef9c3" rx="4"/>
  <text x="392" y="300" font-size="8" fill="#a16207" font-family="Arial">paper</text>
  <text x="392" y="313" font-size="8" fill="#a16207" font-family="Arial">fold —</text>
  <text x="392" y="326" font-size="8" fill="#a16207" font-family="Arial">obscured</text>
  <text x="16" y="380" font-size="9" fill="#ef4444" font-family="Arial">! Total amount obscured by fold in paper (lower right)</text>
  <text x="16" y="420" font-size="9" fill="#9ca3af" font-family="Arial">DUE: April 21, 2026 | Account: TBA-0847 | Call 602-555-0198</text>
`);

const THUMB_TWO = svgUrl(`
  <rect width="480" height="640" fill="#fafafa"/>
  <rect x="0" y="0" width="480" height="295" fill="#fff"/>
  <rect x="0" y="0" width="480" height="52" fill="#b91c1c"/>
  <text x="14" y="24" font-size="17" fill="white" font-weight="bold" font-family="Arial">O'REILLY AUTO PARTS</text>
  <text x="14" y="42" font-size="9" fill="#fecaca" font-family="Arial">Invoice #ORY-88419 | April 7, 2026 | Store #1847-PHX</text>
  <text x="14" y="70" font-size="10" fill="#374151" font-family="Arial">Brake Pad Set D1465 .................. 2 x $34.99 = $69.98</text>
  <text x="14" y="87" font-size="10" fill="#374151" font-family="Arial">Rotors 31431 ......................... 2 x $52.99 = $105.98</text>
  <text x="14" y="104" font-size="10" fill="#374151" font-family="Arial">Brake Cleaner 14oz ................... 3 x  $6.49 = $19.47</text>
  <text x="14" y="121" font-size="10" fill="#374151" font-family="Arial">Caliper Slide Pin Kit ................ 1 x $14.97 = $14.97</text>
  <text x="310" y="145" font-size="12" fill="#111827" font-family="Arial" font-weight="bold">TOTAL: $210.40</text>
  <text x="14" y="165" font-size="9" fill="#9ca3af" font-family="Arial">DUE: April 21, 2026 | Acct: TBA-PHX-0199</text>
  <line x1="0" y1="295" x2="480" y2="295" stroke="#dc2626" stroke-width="4" stroke-dasharray="10 5"/>
  <text x="152" y="291" font-size="8" fill="#dc2626" font-family="Arial" font-weight="bold">— TWO SEPARATE DOCUMENTS — CUT HERE —</text>
  <rect x="0" y="295" width="480" height="345" fill="#f0fdf4"/>
  <rect x="0" y="295" width="480" height="52" fill="#15803d"/>
  <text x="14" y="319" font-size="17" fill="white" font-weight="bold" font-family="Arial">PR??AIR / A?RG?S ← [cut off]</text>
  <text x="14" y="337" font-size="9" fill="#bbf7d0" font-family="Arial">Invoice #??? | April 7, 2026 | [supplier header partially cut off in scan]</text>
  <text x="14" y="366" font-size="10" fill="#374151" font-family="Arial">Compressed Air Cylinder Rental ................. $45.00</text>
  <text x="14" y="383" font-size="10" fill="#374151" font-family="Arial">Oxygen Tank Refill — 244 cu ft ............... $128.00</text>
  <text x="14" y="400" font-size="10" fill="#374151" font-family="Arial">Acetylene Refill — 80 cu ft ..................... $94.00</text>
  <text x="310" y="424" font-size="12" fill="#111827" font-family="Arial" font-weight="bold">TOTAL: $267.00</text>
  <text x="14" y="465" font-size="9" fill="#9ca3af" font-family="Arial">Supplier name cut off — likely Praxair or Airgas</text>
`);

const THUMB_DAMAGED = svgUrl(`
  <rect width="480" height="640" fill="#f5f0eb"/>
  <rect x="0" y="0" width="480" height="60" fill="#d6d0c8"/>
  <rect x="20" y="12" width="180" height="20" fill="#b5b0a8" rx="2" opacity="0.8"/>
  <rect x="20" y="40" width="120" height="10" fill="#c5c0b8" rx="2" opacity="0.6"/>
  <rect x="0" y="75" width="480" height="4" fill="#c5b8a0" opacity="0.5"/>
  <rect x="20" y="88" width="300" height="9" fill="#c8c3bb" rx="2" opacity="0.6"/>
  <rect x="20" y="105" width="260" height="9" fill="#c8c3bb" rx="2" opacity="0.5"/>
  <rect x="20" y="122" width="280" height="9" fill="#c8c3bb" rx="2" opacity="0.7"/>
  <rect x="20" y="139" width="240" height="9" fill="#c8c3bb" rx="2" opacity="0.4"/>
  <rect x="0" y="155" width="480" height="100" fill="#b8a898" opacity="0.25"/>
  <rect x="20" y="165" width="320" height="9" fill="#9c9088" rx="2" opacity="0.5"/>
  <rect x="20" y="182" width="290" height="9" fill="#9c9088" rx="2" opacity="0.4"/>
  <rect x="20" y="199" width="310" height="9" fill="#9c9088" rx="2" opacity="0.6"/>
  <rect x="20" y="216" width="270" height="9" fill="#9c9088" rx="2" opacity="0.3"/>
  <rect x="0" y="265" width="480" height="220" fill="#c8b8a0" opacity="0.3"/>
  <rect x="20" y="280" width="200" height="9" fill="#a8a098" rx="2" opacity="0.4"/>
  <rect x="20" y="298" width="180" height="9" fill="#a8a098" rx="2" opacity="0.3"/>
  <rect x="20" y="316" width="220" height="9" fill="#a8a098" rx="2" opacity="0.4"/>
  <rect x="20" y="334" width="160" height="9" fill="#a8a098" rx="2" opacity="0.3"/>
  <text x="110" y="420" font-size="56" fill="#b45309" opacity="0.08" font-weight="bold" font-family="Arial" transform="rotate(-22,110,420)">WATER</text>
  <text x="60" y="490" font-size="56" fill="#b45309" opacity="0.08" font-weight="bold" font-family="Arial" transform="rotate(-22,60,490)">DAMAGE</text>
  <text x="310" y="300" font-size="11" fill="#78716c" font-family="Arial" opacity="0.8">Apr ??</text>
  <text x="310" y="320" font-size="11" fill="#78716c" font-family="Arial" opacity="0.6">$???</text>
  <text x="20" y="580" font-size="9" fill="#a8a098" font-family="Arial" opacity="0.7">Page 1 of 1 — scan quality severely degraded</text>
`);

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = "pending" | "in_progress" | "resolved";

type Classification = "one_document" | "multiple_documents" | "split_here" | "cannot_identify" | "";

type QueueItem = {
  id:             number;
  uploadId:       number;
  businessId:     string;
  docIndex:       number;
  pageStart:      number;
  pageEnd:        number;
  pageCount:      number;
  thumbnails:     string[];
  aiNote:         string;
  partialData:    {
    vendor?:        string | null;
    invoiceNumber?: string | null;
    date?:          string | null;
    totalAmount?:   number | null;
    lineItems?:     unknown[];
  };
  confidence:     number;
  status:         Status;
  reviewerNotes:  string | null;
  resolvedAction: string | null;
  reviewedAt:     string | null;
  createdAt:      string;
  isMock?:        boolean;
};

type Annotation = {
  id:      string;
  type:    "highlight" | "note";
  x:       number;
  y:       number;
  w:       number;
  h:       number;
  text?:   string;
  editing: boolean;
};

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_ITEMS: QueueItem[] = [
  {
    id: 1001, uploadId: 1, businessId: "demo", docIndex: 0,
    pageStart: 1, pageEnd: 1, pageCount: 1,
    thumbnails: [THUMB_NAPA],
    aiNote: "I can read the vendor name (NAPA Auto Parts) and most line items clearly, but the invoice total in the lower-right corner is obscured by a paper fold. I can make out the first digit is 2 but cannot confirm the exact amount. All other fields extracted successfully.",
    partialData: { vendor: "NAPA Auto Parts", invoiceNumber: "INV-2026-04447", date: "2026-04-07", totalAmount: null },
    confidence: 72, status: "pending", reviewerNotes: null, resolvedAction: null, reviewedAt: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 47).toISOString(), isMock: true,
  },
  {
    id: 1002, uploadId: 1, businessId: "demo", docIndex: 1,
    pageStart: 2, pageEnd: 3, pageCount: 2,
    thumbnails: [THUMB_TWO, THUMB_TWO],
    aiNote: "This scan appears to contain TWO separate documents — an O'Reilly Auto Parts invoice (top, $210.40 total) and a second invoice in the bottom half from a welding/gas supplier (Praxair or Airgas — header was cut off, $267.00 total). I cannot determine the exact page boundary. Use Split & File with page ranges to separate them.",
    partialData: { vendor: null, invoiceNumber: null, date: "2026-04-07", totalAmount: null },
    confidence: 48, status: "pending", reviewerNotes: null, resolvedAction: null, reviewedAt: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 47).toISOString(), isMock: true,
  },
  {
    id: 1003, uploadId: 1, businessId: "demo", docIndex: 2,
    pageStart: 4, pageEnd: 4, pageCount: 1,
    thumbnails: [THUMB_DAMAGED],
    aiNote: "This page appears severely water-damaged or was scanned through a wet or smeared surface. The supplier name is completely illegible. I can make out what might be a date in the upper right (April, year unclear) and some dollar amounts in the body text, but I cannot reliably extract any data. Consider re-scanning if the physical document is available.",
    partialData: { vendor: null, invoiceNumber: null, date: null, totalAmount: null },
    confidence: 31, status: "pending", reviewerNotes: null, resolvedAction: null, reviewedAt: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 47).toISOString(), isMock: true,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fromApiItem(row: Record<string, unknown>): QueueItem {
  const pd = (row.partialData ?? {}) as QueueItem["partialData"];
  const thumb = (row.thumbnail as string | undefined) ?? "";
  return {
    id:             row.id as number,
    uploadId:       row.uploadId as number,
    businessId:     row.businessId as string,
    docIndex:       row.docIndex as number,
    pageStart:      row.pageStart as number,
    pageEnd:        row.pageEnd as number,
    pageCount:      1,
    thumbnails:     thumb ? [thumb] : [],
    aiNote:         row.aiNote as string,
    partialData:    pd,
    confidence:     row.confidence as number,
    status:         row.status as Status,
    reviewerNotes:  row.reviewerNotes as string | null,
    resolvedAction: row.resolvedAction as string | null,
    reviewedAt:     row.reviewedAt as string | null,
    createdAt:      row.createdAt as string,
    isMock:         false,
  };
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// ─── Confidence pill ──────────────────────────────────────────────────────────

function ConfPill({ v }: { v: number }) {
  return (
    <span className={cn(
      "text-sm font-bold px-3 py-1 rounded-full",
      v >= 70 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700"
    )}>
      {v}% confidence
    </span>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ s }: { s: Status }) {
  return (
    <span className={cn(
      "text-sm font-bold px-3 py-1 rounded-full",
      s === "pending"     ? "bg-amber-100 text-amber-800" :
      s === "in_progress" ? "bg-blue-100 text-blue-800"   :
                            "bg-green-100 text-green-800"
    )}>
      {s === "pending" ? "Needs Review" : s === "in_progress" ? "In Progress" : "✓ Resolved"}
    </span>
  );
}

// ─── Document Image Viewer ────────────────────────────────────────────────────

type AnnotTool = "none" | "highlight" | "note" | "crop";

function DocumentViewer({ thumbnails }: { thumbnails: string[] }) {
  const [page,        setPage]        = useState(0);
  const [zoom,        setZoom]        = useState(100);
  const [tool,        setTool]        = useState<AnnotTool>("none");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [drawing,     setDrawing]     = useState(false);
  const [drawStart,   setDrawStart]   = useState({ x: 0, y: 0 });
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const total  = Math.max(thumbnails.length, 1);
  const src    = thumbnails[page] ?? "";

  const getRelPos = (e: React.MouseEvent) => {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    const s = zoom / 100;
    return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s };
  };

  const onDown = (e: React.MouseEvent) => {
    if (tool === "none") return;
    const p = getRelPos(e);
    setDrawing(true); setDrawStart(p);
    setCurrentRect({ x: p.x, y: p.y, w: 0, h: 0 });
  };
  const onMove = (e: React.MouseEvent) => {
    if (!drawing) return;
    const p = getRelPos(e);
    setCurrentRect({ x: Math.min(drawStart.x, p.x), y: Math.min(drawStart.y, p.y), w: Math.abs(p.x - drawStart.x), h: Math.abs(p.y - drawStart.y) });
  };
  const onUp = () => {
    if (!drawing || !currentRect || currentRect.w < 5) { setDrawing(false); setCurrentRect(null); return; }
    setAnnotations(prev => [...prev, { id: crypto.randomUUID(), type: tool === "note" ? "note" : "highlight", ...currentRect, text: "", editing: tool === "note" }]);
    setDrawing(false); setCurrentRect(null);
  };

  const toolDefs: { id: AnnotTool; icon: typeof Highlighter; label: string }[] = [
    { id: "highlight", icon: Highlighter, label: "Highlight" },
    { id: "note",      icon: StickyNote,  label: "Text Note" },
    { id: "crop",      icon: Scissors,    label: "Mark Region" },
  ];

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Toolbar row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Zoom */}
        <div className="flex items-center gap-1 rounded-xl border border-border px-2 py-1 bg-card">
          <button onClick={() => setZoom(z => Math.max(50, z - 25))} className="p-1 rounded hover:bg-muted"><ZoomOut className="w-4 h-4" /></button>
          <span className="text-sm font-semibold w-12 text-center">{zoom}%</span>
          <button onClick={() => setZoom(z => Math.min(300, z + 25))} className="p-1 rounded hover:bg-muted"><ZoomIn className="w-4 h-4" /></button>
        </div>

        {/* Annotation tools */}
        <div className="flex items-center gap-1 rounded-xl border border-border px-2 py-1 bg-card">
          {toolDefs.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTool(t => t === id ? "none" : id)}
              title={label}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                tool === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {annotations.length > 0 && (
          <button onClick={() => setAnnotations([])} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 border border-border rounded-xl px-2.5 py-1.5">
            <RotateCcw className="w-3.5 h-3.5" /> Clear
          </button>
        )}

        {tool !== "none" && (
          <span className="text-xs text-primary font-medium">
            {tool === "highlight" ? "Drag to highlight" : tool === "note" ? "Drag, then type" : "Drag to mark region"}
          </span>
        )}
      </div>

      {/* Image area */}
      <div className="flex-1 overflow-auto rounded-2xl border-2 border-border bg-muted/20 min-h-0">
        <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left", display: "inline-block", minWidth: "100%" }}>
          <div
            ref={containerRef}
            className="relative select-none"
            style={{ cursor: tool !== "none" ? "crosshair" : "default" }}
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}
            onMouseLeave={() => { setDrawing(false); setCurrentRect(null); }}
          >
            {src ? (
              <img src={src} alt={`Page ${page + 1}`} draggable={false} className="max-w-full block" style={{ userSelect: "none" }} />
            ) : (
              <div className="w-full h-96 flex items-center justify-center text-muted-foreground">
                <p className="text-sm">No preview available</p>
              </div>
            )}

            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: "visible" }}>
              {drawing && currentRect && (
                <rect x={currentRect.x} y={currentRect.y} width={currentRect.w} height={currentRect.h}
                  fill={tool === "crop" ? "rgba(59,130,246,0.12)" : "rgba(234,179,8,0.28)"}
                  stroke={tool === "crop" ? "#3b82f6" : "#eab308"} strokeWidth="2" strokeDasharray="5 3" />
              )}
              {annotations.map(a => (
                <rect key={a.id} x={a.x} y={a.y} width={a.w} height={a.h}
                  fill={a.type === "highlight" ? "rgba(234,179,8,0.28)" : "rgba(59,130,246,0.12)"}
                  stroke={a.type === "highlight" ? "#eab308" : "#3b82f6"} strokeWidth="2" />
              ))}
            </svg>

            {annotations.filter(a => a.type === "note").map(a => (
              <div key={a.id} className="absolute pointer-events-auto" style={{ left: a.x, top: a.y + a.h + 4 }}>
                <div className="relative bg-yellow-50 border border-yellow-400 rounded-lg px-2 py-1 text-xs shadow max-w-[180px]">
                  {a.editing
                    ? <input autoFocus defaultValue={a.text} onBlur={e => setAnnotations(p => p.map(i => i.id === a.id ? { ...i, text: e.target.value, editing: false } : i))} className="bg-transparent outline-none text-xs w-36" placeholder="Type note…" />
                    : <span>{a.text || "(empty note)"}</span>}
                  <button onClick={() => setAnnotations(p => p.filter(i => i.id !== a.id))} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center">×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Page navigation */}
      {total > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm font-bold disabled:opacity-30 hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <span className="text-base font-bold">Page {page + 1} of {total}</span>
          <button
            onClick={() => setPage(p => Math.min(total - 1, p + 1))}
            disabled={page === total - 1}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm font-bold disabled:opacity-30 hover:bg-muted transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Right-side review panel ──────────────────────────────────────────────────

const CLASSIFICATION_OPTIONS: { value: Classification; label: string; hint: string }[] = [
  { value: "",                label: "— Select classification —",      hint: "" },
  { value: "one_document",    label: "✅  One Document",               hint: "This is a single, complete document. Use Approve & File." },
  { value: "multiple_documents", label: "📄📄  Multiple Documents",  hint: "There are 2 or more separate documents here. Use Split & File." },
  { value: "split_here",      label: "✂️  Split Here",               hint: "AI merged two documents. Enter page ranges below, then Split & File." },
  { value: "cannot_identify", label: "❓  Cannot Identify",          hint: "Document is unreadable or too damaged. Use File Manually." },
];

const ACTIONS = [
  {
    id:     "approve",
    emoji:  "✅",
    label:  "Approve & File",
    sub:    "Send to Google Drive as-is",
    cls:    "bg-emerald-600 hover:bg-emerald-700 text-white",
    best:   ["one_document"] as Classification[],
  },
  {
    id:     "split",
    emoji:  "✂️",
    label:  "Split & File",
    sub:    "Split by pages, file each part",
    cls:    "bg-blue-600 hover:bg-blue-700 text-white",
    best:   ["multiple_documents", "split_here"] as Classification[],
  },
  {
    id:     "file_manually",
    emoji:  "📁",
    label:  "File Manually",
    sub:    "Mark resolved — no Drive upload",
    cls:    "bg-muted hover:bg-muted/70 text-foreground border border-border",
    best:   ["cannot_identify"] as Classification[],
  },
  {
    id:     "resubmit",
    emoji:  "🔄",
    label:  "Resubmit to AI",
    sub:    "AI tries again with your notes",
    cls:    "bg-amber-500 hover:bg-amber-600 text-white",
    best:   [] as Classification[],
  },
] as const;

function ReviewPanel({ item, onResolved, isMockMode }: {
  item:       QueueItem;
  onResolved: () => void;
  isMockMode: boolean;
}) {
  const [classification, setClassification] = useState<Classification>("");
  const [reviewerNotes,  setReviewerNotes]  = useState(item.reviewerNotes ?? "");
  const [splitRanges,    setSplitRanges]    = useState([{ start: "1", end: "1" }]);
  const [submitting,     setSubmitting]     = useState(false);
  const [success,        setSuccess]        = useState<{ msg: string } | null>(null);
  const [error,          setError]          = useState("");

  const hint = CLASSIFICATION_OPTIONS.find(o => o.value === classification)?.hint ?? "";
  const needsSplit = classification === "multiple_documents" || classification === "split_here";

  const handleAction = async (actionId: string) => {
    if (isMockMode) {
      setSubmitting(true);
      await new Promise(r => setTimeout(r, 1200));
      setSubmitting(false);
      const msgs: Record<string, string> = {
        approve:      "Filed to Google Drive! Invoice logged and saved.",
        split:        `Split into ${splitRanges.length} documents and filed to Drive.`,
        file_manually:"Marked as filed manually. Document resolved.",
        resubmit:     "Sent back to AI for re-analysis. Check back shortly.",
      };
      if (actionId === "resubmit") {
        setSuccess({ msg: msgs[actionId] });
        return;
      }
      setSuccess({ msg: msgs[actionId] ?? "Action completed." });
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const body: Record<string, unknown> = { action: actionId, reviewerNotes: reviewerNotes || undefined };
      if (actionId === "split") body.splitRanges = splitRanges.map(r => ({ start: Number(r.start), end: Number(r.end) }));
      const resp = await apiFetch(`${BASE}/api/review-queue/${item.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json() as { ok: boolean; message: string };
      if (data.ok) {
        setSuccess({ msg: data.message });
        if (actionId !== "resubmit") setTimeout(onResolved, 2500);
      } else {
        setError(data.message ?? "Action failed.");
      }
    } catch (e) {
      setError(String(e));
    }
    setSubmitting(false);
  };

  return (
    <div className="relative h-full overflow-y-auto">
      {/* ── Success overlay ── */}
      {success && (
        <div className="absolute inset-0 bg-emerald-900/95 flex flex-col items-center justify-center z-50 rounded-2xl p-8">
          <div className="text-7xl mb-4">✅</div>
          <h2 className="text-3xl font-bold text-white text-center" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Done!
          </h2>
          <p className="text-xl text-emerald-200 mt-3 text-center leading-relaxed max-w-xs">
            {success.msg}
          </p>
          <button
            onClick={() => { setSuccess(null); onResolved(); }}
            className="mt-8 px-8 py-4 bg-white text-emerald-900 rounded-2xl text-xl font-bold hover:bg-emerald-50 transition-colors"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Next Document →
          </button>
        </div>
      )}

      <div className="space-y-5 p-2">
        {/* Meta row */}
        <div className="flex items-center gap-3 flex-wrap">
          <StatusPill s={item.status} />
          <ConfPill v={item.confidence} />
          <span className="text-sm text-muted-foreground">{fmtTime(item.createdAt)}</span>
          {item.isMock && (
            <span className="text-xs bg-violet-100 text-violet-700 font-bold px-2 py-0.5 rounded-full">
              Demo Data
            </span>
          )}
        </div>

        {/* Partial data extracted */}
        {(item.partialData.vendor || item.partialData.invoiceNumber || item.partialData.totalAmount || item.partialData.date) && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <p className="text-sm font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>What the AI could extract:</p>
            <div className="flex gap-4 flex-wrap text-sm">
              {item.partialData.vendor        && <span><strong>Vendor:</strong> {item.partialData.vendor}</span>}
              {item.partialData.invoiceNumber && <span><strong>Invoice:</strong> #{item.partialData.invoiceNumber}</span>}
              {item.partialData.date          && <span><strong>Date:</strong> {item.partialData.date}</span>}
              {item.partialData.totalAmount   && <span><strong>Total:</strong> ${item.partialData.totalAmount}</span>}
            </div>
          </div>
        )}

        {/* AI Note — large, prominent */}
        <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-900" />
            </div>
            <p className="text-base font-bold text-amber-900" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Why the AI flagged this:
            </p>
          </div>
          <p className="text-base text-amber-900 leading-relaxed">{item.aiNote}</p>
        </div>

        {/* Classification dropdown */}
        <div className="space-y-2">
          <label className="text-base font-bold block" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            What is this document?
          </label>
          <select
            value={classification}
            onChange={e => setClassification(e.target.value as Classification)}
            className="w-full text-base font-medium bg-background border-2 border-border rounded-2xl px-4 py-3.5 focus:outline-none focus:border-primary cursor-pointer"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {CLASSIFICATION_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {hint && (
            <p className="text-sm text-muted-foreground pl-1">{hint}</p>
          )}
        </div>

        {/* Page ranges — shown for split */}
        {needsSplit && (
          <div className="rounded-2xl border-2 border-blue-300 bg-blue-50 p-4 space-y-3">
            <p className="text-base font-bold text-blue-800" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              ✂️ Set Page Ranges for Each Document
            </p>
            <p className="text-sm text-blue-700">
              Pages {item.pageStart}–{item.pageEnd} in the original scan.
              Define which pages belong to each separate document.
            </p>
            <div className="space-y-2">
              {splitRanges.map((r, i) => (
                <div key={i} className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-bold text-blue-800 w-20">Document {i + 1}</span>
                  <span className="text-sm text-blue-700">Pages</span>
                  <input type="number" min={item.pageStart} max={item.pageEnd} value={r.start}
                    onChange={e => setSplitRanges(p => p.map((x, j) => j === i ? { ...x, start: e.target.value } : x))}
                    className="w-16 text-base border-2 border-blue-300 rounded-xl px-2 py-1.5 text-center bg-white focus:outline-none focus:border-blue-500" />
                  <span className="text-sm text-blue-700">to</span>
                  <input type="number" min={item.pageStart} max={item.pageEnd} value={r.end}
                    onChange={e => setSplitRanges(p => p.map((x, j) => j === i ? { ...x, end: e.target.value } : x))}
                    className="w-16 text-base border-2 border-blue-300 rounded-xl px-2 py-1.5 text-center bg-white focus:outline-none focus:border-blue-500" />
                  {splitRanges.length > 1 && (
                    <button onClick={() => setSplitRanges(p => p.filter((_, j) => j !== i))} className="text-blue-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setSplitRanges(p => [...p, { start: "1", end: "1" }])}
              className="text-sm text-blue-600 font-semibold hover:underline"
            >
              + Add another document
            </button>
          </div>
        )}

        {/* Reviewer notes */}
        <div className="space-y-2">
          <label className="text-base font-bold block" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Your Notes
            <span className="text-sm text-muted-foreground font-normal ml-2">(optional — helps AI on resubmit)</span>
          </label>
          <textarea
            value={reviewerNotes}
            onChange={e => setReviewerNotes(e.target.value)}
            placeholder={"e.g. \"Page 1 is NAPA, pages 2-3 are O'Reilly — split at line 3\""}
            rows={3}
            className="w-full text-base bg-background border-2 border-border rounded-2xl px-4 py-3 resize-none focus:outline-none focus:border-primary"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-base text-red-700 font-medium">
            ❌ {error}
          </div>
        )}

        {/* ── 4 Large Action Buttons ── */}
        <div className="space-y-3">
          <p className="text-base font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            What do you want to do?
          </p>
          <div className="grid grid-cols-2 gap-3">
            {ACTIONS.map(({ id, emoji, label, sub, cls, best }) => {
              const isRecommended = classification !== "" && (best as string[]).includes(classification);
              return (
                <button
                  key={id}
                  disabled={submitting}
                  onClick={() => handleAction(id)}
                  className={cn(
                    "relative flex flex-col items-center gap-1.5 rounded-2xl px-3 py-5 transition-all disabled:opacity-50",
                    cls,
                    isRecommended ? "ring-4 ring-offset-2 ring-primary/40 scale-[1.02]" : ""
                  )}
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {isRecommended && (
                    <span className="absolute top-2 right-2 text-[10px] font-bold bg-white/20 px-1.5 py-0.5 rounded-full">
                      Suggested
                    </span>
                  )}
                  <span className="text-3xl leading-none">{emoji}</span>
                  <span className="text-lg font-bold text-center leading-tight">{label}</span>
                  <span className="text-xs opacity-80 text-center leading-tight">{sub}</span>
                </button>
              );
            })}
          </div>
        </div>

        {submitting && (
          <div className="flex items-center justify-center gap-3 py-4">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-base font-medium">Processing… please wait</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReviewQueue() {
  const { businessId }                    = useDashboard();
  const [items,        setItems]          = useState<QueueItem[]>([]);
  const [loading,      setLoading]        = useState(true);
  const [selectedId,   setSelectedId]     = useState<number | null>(null);
  const [statusFilter, setStatusFilter]   = useState<"" | Status>("");
  const [pendingCount, setPendingCount]   = useState(0);
  const [refreshing,   setRefreshing]     = useState(false);
  const [isMockMode,   setIsMockMode]     = useState(false);

  const loadItems = useCallback(async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams({ businessId });
      if (statusFilter) params.set("status", statusFilter);
      const resp = await apiFetch(`${BASE}/api/review-queue?${params}`);

      if (resp.status === 401) {
        setItems(MOCK_ITEMS);
        setPendingCount(MOCK_ITEMS.filter(i => i.status === "pending").length);
        setIsMockMode(true);
        if (!selectedId) setSelectedId(MOCK_ITEMS[0].id);
        setLoading(false); setRefreshing(false); return;
      }

      const data  = await resp.json() as { items: Record<string, unknown>[]; pendingCount: number };
      const fetched = (data.items ?? []).map(fromApiItem);

      setItems(fetched);
      setPendingCount(data.pendingCount ?? fetched.filter(i => i.status === "pending").length);
      setIsMockMode(false);
      if (fetched.length > 0 && !selectedId) setSelectedId(fetched[0].id);
    } catch {
      setItems(MOCK_ITEMS);
      setPendingCount(MOCK_ITEMS.filter(i => i.status === "pending").length);
      setIsMockMode(true);
      if (!selectedId) setSelectedId(MOCK_ITEMS[0].id);
    }
    setLoading(false); setRefreshing(false);
  }, [businessId, statusFilter]);

  useEffect(() => { loadItems(); }, [businessId, statusFilter]);

  const visibleItems = statusFilter
    ? items.filter(i => i.status === statusFilter)
    : items;
  const selected = items.find(i => i.id === selectedId) ?? null;

  const handleResolved = () => {
    if (isMockMode) {
      setItems(prev => prev.map(i => i.id === selectedId ? { ...i, status: "resolved" } : i));
      const next = items.find(i => i.id !== selectedId && i.status === "pending");
      setSelectedId(next ? next.id : null);
      return;
    }
    loadItems();
    const next = items.find(i => i.id !== selectedId && i.status === "pending");
    setSelectedId(next?.id ?? null);
  };

  return (
    <div
      className="flex bg-background"
      style={{ height: "calc(100vh - 4rem)", marginLeft: "-2rem", marginRight: "-2rem", marginTop: "-2rem" }}
    >
      {/* ── Column 1: Item list ─────────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 border-r border-border flex flex-col bg-card">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-amber-500" />
                <h2 className="font-bold text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  You Need To Check This
                </h2>
              </div>
              {pendingCount > 0 && (
                <p className="text-sm text-amber-600 font-medium mt-0.5 pl-7">
                  {pendingCount} item{pendingCount !== 1 ? "s" : ""} need your attention
                </p>
              )}
            </div>
            <button onClick={loadItems} disabled={refreshing} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50">
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            </button>
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as "" | Status)}
            className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 focus:outline-none"
          >
            <option value="">All items</option>
            <option value="pending">Needs Review</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-3">
              <FolderOpen className="w-10 h-10 text-muted-foreground/40" />
              <p className="font-bold text-sm">No documents yet</p>
              <p className="text-xs text-muted-foreground leading-relaxed">No documents in the review queue yet. Upload documents from the Documents page to get started.</p>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              <p className="font-bold text-sm">All clear!</p>
              <p className="text-xs text-muted-foreground">No items match this filter.</p>
            </div>
          ) : (
            visibleItems.map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={cn(
                  "w-full text-left p-4 flex gap-3 transition-colors hover:bg-muted/40",
                  selectedId === item.id ? "bg-primary/8 border-l-4 border-l-primary pl-3" : ""
                )}
              >
                {/* Thumbnail */}
                <div className="w-16 h-20 flex-shrink-0 rounded-xl overflow-hidden border border-border bg-muted">
                  {item.thumbnails[0] ? (
                    <img src={item.thumbnails[0]} alt="doc" className="w-full h-full object-cover object-top" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="font-bold text-sm truncate">
                    {item.partialData?.vendor ?? `Document ${item.docIndex + 1}`}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{item.aiNote}</p>
                  <div className="flex gap-2 flex-wrap mt-1">
                    <StatusPill s={item.status} />
                    <ConfPill v={item.confidence} />
                  </div>
                  <p className="text-[11px] text-muted-foreground/50">{fmtTime(item.createdAt)}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {selected ? (
        <>
          {/* ── Column 2: Document viewer ─────────────────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col border-r border-border p-4 overflow-hidden">
            <div className="mb-3 flex items-center gap-3">
              <h3 className="font-bold text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {selected.partialData?.vendor ?? `Document ${selected.docIndex + 1}`}
              </h3>
              {selected.partialData?.invoiceNumber && (
                <span className="text-sm text-muted-foreground">#{selected.partialData.invoiceNumber}</span>
              )}
            </div>
            <div className="flex-1 min-h-0">
              <DocumentViewer key={selected.id} thumbnails={selected.thumbnails} />
            </div>
          </div>

          {/* ── Column 3: Review controls ─────────────────────────────────── */}
          <div className="w-96 flex-shrink-0 overflow-hidden">
            <div className="h-full overflow-y-auto p-4">
              <ReviewPanel key={selected.id} item={selected} onResolved={handleResolved} isMockMode={isMockMode && !!selected.isMock} />
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-3xl bg-amber-100 flex items-center justify-center mx-auto">
              <AlertOctagon className="w-10 h-10 text-amber-500" />
            </div>
            <div>
              <p className="text-xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Select a document to review
              </p>
              <p className="text-base text-muted-foreground mt-2">
                Click any item in the list on the left.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
