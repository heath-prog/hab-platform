import { pool } from "./db";
import { promoteEligibleSuperAdmins } from "./superAdmin";

// ─── Mock SVG thumbnails for seeding demo review items ────────────────────────

function makeSvgThumb(content: string): string {
  const svg = `<svg width="480" height="640" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const THUMB_NAPA = makeSvgThumb(`
  <rect width="480" height="640" fill="#fff"/>
  <rect x="0" y="0" width="480" height="72" fill="#1e3a8a"/>
  <text x="16" y="30" font-size="20" fill="white" font-weight="bold" font-family="Arial">NAPA AUTO PARTS</text>
  <text x="16" y="50" font-size="10" fill="#93c5fd" font-family="Arial">1847 W Commerce Dr, Phoenix AZ 85001 | (602) 555-0182</text>
  <text x="16" y="65" font-size="10" fill="#93c5fd" font-family="Arial">Invoice #INV-2026-04447 | April 7, 2026</text>
  <text x="16" y="98" font-size="11" fill="#374151" font-family="Arial" font-weight="bold">BILL TO: True Blue Auto Care, 4820 N 19th Ave, Phoenix AZ</text>
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
  <text x="20" y="202" font-size="10" fill="#111827" font-family="Arial">Wiper Blade Set 22+18</text>
  <text x="315" y="202" font-size="10" fill="#111827" font-family="Arial">3</text>
  <text x="355" y="202" font-size="10" fill="#111827" font-family="Arial">$18.50</text>
  <text x="415" y="202" font-size="10" fill="#111827" font-family="Arial">$55.50</text>
  <line x1="16" y1="214" x2="464" y2="214" stroke="#e5e7eb" stroke-width="1"/>
  <text x="355" y="232" font-size="10" fill="#374151" font-family="Arial">Subtotal:</text>
  <text x="420" y="232" font-size="10" fill="#374151" font-family="Arial">$212.84</text>
  <text x="355" y="250" font-size="10" fill="#374151" font-family="Arial">Tax 8.6%:</text>
  <text x="420" y="250" font-size="10" fill="#374151" font-family="Arial">$18.30</text>
  <rect x="300" y="256" width="164" height="22" fill="#fffbeb"/>
  <text x="355" y="271" font-size="11" fill="#111827" font-family="Arial" font-weight="bold">TOTAL:</text>
  <rect x="390" y="258" width="72" height="18" fill="#fde68a" rx="2"/>
  <text x="394" y="271" font-size="11" fill="#92400e" font-family="Arial" font-weight="bold">$2??.??</text>
  <text x="16" y="310" font-size="9" fill="#ef4444" font-family="Arial">[ Total obscured by paper fold — see lower right corner ]</text>
  <rect x="390" y="280" width="74" height="40" fill="#fef9c3" rx="3"/>
  <text x="394" y="296" font-size="7" fill="#a16207" font-family="Arial">paper</text>
  <text x="394" y="308" font-size="7" fill="#a16207" font-family="Arial">fold</text>
  <text x="16" y="360" font-size="9" fill="#9ca3af" font-family="Arial">DUE: April 21, 2026 | Acct: TBA-0847 | Thank you for your business</text>
`);

const THUMB_TWOPAGE = makeSvgThumb(`
  <rect width="480" height="640" fill="#fafafa"/>
  <rect x="0" y="0" width="480" height="300" fill="#fff" stroke="#d1fae5" stroke-width="2"/>
  <rect x="0" y="0" width="480" height="52" fill="#c00"/>
  <text x="14" y="24" font-size="16" fill="white" font-weight="bold" font-family="Arial">O'REILLY AUTO PARTS</text>
  <text x="14" y="40" font-size="9" fill="#fecaca" font-family="Arial">Invoice #ORY-88419 | April 7, 2026 | Store #1847</text>
  <text x="14" y="72" font-size="10" fill="#374151" font-family="Arial">Brake Pad Set D1465 ...... 2 x $34.99 = $69.98</text>
  <text x="14" y="88" font-size="10" fill="#374151" font-family="Arial">Rotors 31431 .......... 2 x $52.99 = $105.98</text>
  <text x="14" y="104" font-size="10" fill="#374151" font-family="Arial">Brake Cleaner ........... 3 x $6.49 = $19.47</text>
  <text x="14" y="130" font-size="11" fill="#111827" font-family="Arial" font-weight="bold">TOTAL: $210.40</text>
  <line x1="0" y1="300" x2="480" y2="300" stroke="#dc2626" stroke-width="3" stroke-dasharray="8 4"/>
  <text x="170" y="295" font-size="8" fill="#dc2626" font-family="Arial">CUT HERE — TWO DOCUMENTS</text>
  <rect x="0" y="300" width="480" height="340" fill="#fff"/>
  <rect x="0" y="300" width="480" height="52" fill="#16a34a"/>
  <text x="14" y="324" font-size="16" fill="white" font-weight="bold" font-family="Arial">PR??AIR / A?RG?S</text>
  <text x="14" y="340" font-size="9" fill="#bbf7d0" font-family="Arial">Invoice #??? | April 7, 2026 | [header partially cut off]</text>
  <text x="14" y="372" font-size="10" fill="#374151" font-family="Arial">Compressed Air Cylinder Rental ................. $45.00</text>
  <text x="14" y="388" font-size="10" fill="#374151" font-family="Arial">O2 Tank Refill 244 cu ft .................... $128.00</text>
  <text x="14" y="404" font-size="10" fill="#374151" font-family="Arial">Acetylene Refill ............................ $94.00</text>
  <text x="14" y="430" font-size="11" fill="#111827" font-family="Arial" font-weight="bold">TOTAL: $267.00</text>
  <text x="14" y="470" font-size="9" fill="#9ca3af" font-family="Arial">Note: supplier name cut off in scan, bottom of page 1</text>
`);

const THUMB_DAMAGED = makeSvgThumb(`
  <rect width="480" height="640" fill="#f5f5f4"/>
  <rect x="0" y="0" width="480" height="640" fill="url(#noise)" opacity="0.4"/>
  <rect x="20" y="20" width="200" height="24" fill="#d6d3d1" rx="2" opacity="0.7"/>
  <rect x="20" y="52" width="130" height="10" fill="#a8a29e" rx="2" opacity="0.5"/>
  <rect x="20" y="70" width="280" height="8" fill="#d6d3d1" rx="2" opacity="0.6"/>
  <rect x="20" y="90" width="260" height="8" fill="#d6d3d1" rx="2" opacity="0.4"/>
  <rect x="20" y="110" width="240" height="8" fill="#d6d3d1" rx="2" opacity="0.5"/>
  <rect x="0" y="130" width="480" height="80" fill="#a8a29e" opacity="0.3"/>
  <rect x="20" y="140" width="300" height="8" fill="#78716c" rx="2" opacity="0.6"/>
  <rect x="20" y="158" width="280" height="8" fill="#78716c" rx="2" opacity="0.4"/>
  <rect x="20" y="176" width="320" height="8" fill="#78716c" rx="2" opacity="0.5"/>
  <rect x="0" y="220" width="480" height="200" fill="#e7e5e4" opacity="0.8"/>
  <rect x="20" y="240" width="200" height="8" fill="#a8a29e" rx="2" opacity="0.4"/>
  <rect x="20" y="258" width="180" height="8" fill="#a8a29e" rx="2" opacity="0.3"/>
  <rect x="20" y="276" width="220" height="8" fill="#a8a29e" rx="2" opacity="0.4"/>
  <rect x="20" y="294" width="160" height="8" fill="#a8a29e" rx="2" opacity="0.2"/>
  <text x="100" y="390" font-size="48" fill="#ef4444" opacity="0.12" font-weight="bold" font-family="Arial" transform="rotate(-20,100,390)">WATER</text>
  <text x="80" y="450" font-size="48" fill="#ef4444" opacity="0.12" font-weight="bold" font-family="Arial" transform="rotate(-20,80,450)">DAMAGED</text>
  <rect x="20" y="430" width="120" height="8" fill="#a8a29e" rx="2" opacity="0.3"/>
  <rect x="20" y="448" width="100" height="8" fill="#a8a29e" rx="2" opacity="0.2"/>
  <text x="290" y="420" font-size="11" fill="#78716c" font-family="Arial">Apr ??</text>
  <text x="290" y="438" font-size="11" fill="#78716c" font-family="Arial">$???</text>
`);

async function seedMockReviewItems(): Promise<void> {
  const existing = await pool.query(
    "SELECT COUNT(*) FROM document_uploads WHERE business_id = 'demo'",
  );
  if (parseInt((existing.rows[0] as { count: string }).count) > 0) return;

  const upload = await pool.query(
    `INSERT INTO document_uploads
     (business_id, original_filename, file_type, file_size, status, docs_found, docs_filed, docs_queued)
     VALUES ('demo', 'end-of-day-scan-apr-07.pdf', 'application/pdf', 3247891, 'complete', 5, 2, 3)
     RETURNING id`,
  );
  const uploadId = (upload.rows[0] as { id: number }).id;

  await pool.query(
    `INSERT INTO review_queue_items
     (upload_id, business_id, doc_index, page_start, page_end, thumbnail_b64, ai_note, partial_data, confidence, status)
     VALUES ($1,'demo',0,1,1,$2,$3,$4,72,'pending')`,
    [
      uploadId, THUMB_NAPA,
      "I can read the vendor name (NAPA Auto Parts) and most line items clearly, but the invoice total in the lower-right corner is obscured by a paper fold. I can make out the first digit is 2 but cannot confirm the exact amount. All other fields extracted successfully.",
      JSON.stringify({ vendor: "NAPA Auto Parts", invoiceNumber: "INV-2026-04447", date: "2026-04-07", totalAmount: null, lineItems: [{ description: "Oil Filter PH3980", quantity: 4, unitPrice: 8.97, total: 35.88 }] }),
    ],
  );
  await pool.query(
    `INSERT INTO review_queue_items
     (upload_id, business_id, doc_index, page_start, page_end, thumbnail_b64, ai_note, partial_data, confidence, status)
     VALUES ($1,'demo',1,2,2,$2,$3,$4,48,'pending')`,
    [
      uploadId, THUMB_TWOPAGE,
      "This scan appears to contain two separate documents — an O'Reilly Auto Parts invoice in the top half ($210.40 total), and a second invoice in the bottom half from a gas/welding supplier (Praxair or Airgas — the header was cut off). I cannot determine the exact page boundary. Use Split & File to separate them.",
      JSON.stringify({ vendor: null, invoiceNumber: null, date: "2026-04-07", totalAmount: null }),
    ],
  );
  await pool.query(
    `INSERT INTO review_queue_items
     (upload_id, business_id, doc_index, page_start, page_end, thumbnail_b64, ai_note, partial_data, confidence, status)
     VALUES ($1,'demo',2,3,3,$2,$3,$4,31,'pending')`,
    [
      uploadId, THUMB_DAMAGED,
      "This page appears severely water-damaged or was scanned through a wet or smeared surface. The supplier name is completely illegible. I can make out what might be a date in the upper right (April, year unclear) and some dollar amounts in the body text, but I cannot reliably extract any data. Consider re-scanning if the original is available.",
      JSON.stringify({ vendor: null, invoiceNumber: null, date: null, totalAmount: null }),
    ],
  );
}

export async function runMigrations(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS integration_configs (
      id          SERIAL PRIMARY KEY,
      key         VARCHAR(100) UNIQUE NOT NULL,
      value       TEXT        NOT NULL DEFAULT '',
      is_active   BOOLEAN     NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS document_uploads (
      id                SERIAL PRIMARY KEY,
      business_id       VARCHAR(100)  NOT NULL,
      original_filename VARCHAR(255)  NOT NULL,
      file_type         VARCHAR(20)   NOT NULL,
      file_size         INTEGER,
      page_count        INTEGER,
      status            VARCHAR(30)   NOT NULL DEFAULT 'processing',
      docs_found        INTEGER,
      docs_filed        INTEGER       DEFAULT 0,
      docs_queued       INTEGER       DEFAULT 0,
      error_msg         TEXT,
      processed_at      TIMESTAMPTZ,
      created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS extracted_documents (
      id               SERIAL PRIMARY KEY,
      upload_id        INTEGER       NOT NULL REFERENCES document_uploads(id) ON DELETE CASCADE,
      business_id      VARCHAR(100)  NOT NULL,
      doc_index        INTEGER       NOT NULL,
      page_start       INTEGER       NOT NULL,
      page_end         INTEGER       NOT NULL,
      vendor_name      TEXT,
      invoice_number   TEXT,
      invoice_date     TEXT,
      total_amount     NUMERIC(12,2),
      line_items       JSONB,
      confidence       INTEGER,
      ai_note          TEXT,
      drive_file_id    TEXT,
      drive_view_link  TEXT,
      sheets_row_id    TEXT,
      status           VARCHAR(30)   NOT NULL DEFAULT 'filed',
      created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS review_queue_items (
      id               SERIAL PRIMARY KEY,
      upload_id        INTEGER       NOT NULL REFERENCES document_uploads(id) ON DELETE CASCADE,
      business_id      VARCHAR(100)  NOT NULL,
      doc_index        INTEGER,
      page_start       INTEGER,
      page_end         INTEGER,
      thumbnail_b64    TEXT,
      ai_note          TEXT          NOT NULL,
      partial_data     JSONB,
      confidence       INTEGER,
      status           VARCHAR(30)   NOT NULL DEFAULT 'pending',
      reviewer_notes   TEXT,
      resolved_action  VARCHAR(30),
      reviewed_at      TIMESTAMPTZ,
      created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS invite_tokens (
      id          SERIAL PRIMARY KEY,
      token       TEXT          NOT NULL UNIQUE,
      email       TEXT          NOT NULL,
      name        TEXT          NOT NULL,
      role        TEXT          NOT NULL,
      invited_by  TEXT,
      expires_at  TIMESTAMPTZ   NOT NULL,
      used_at     TIMESTAMPTZ,
      created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS portfolios (
      id              SERIAL PRIMARY KEY,
      owner_clerk_id  TEXT NOT NULL UNIQUE,
      name            TEXT NOT NULL DEFAULT 'My Portfolio',
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS businesses (
      id              TEXT PRIMARY KEY,
      portfolio_id    INTEGER REFERENCES portfolios(id) ON DELETE CASCADE,
      owner_clerk_id  TEXT NOT NULL,
      data            JSONB NOT NULL,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // ── Billing columns ───────────────────────────────────────────────────────
  await pool.query(`
    ALTER TABLE deal_users
      ADD COLUMN IF NOT EXISTS billing_status        TEXT NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS billing_suspended_at  TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS billing_notes         TEXT;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_appeals (
      id           SERIAL PRIMARY KEY,
      clerk_id     TEXT NOT NULL,
      user_name    TEXT,
      user_email   TEXT,
      message      TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending',
      reviewed_by  TEXT,
      reviewed_at  TIMESTAMPTZ,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Set Heath Blake as super_admin (idempotent). The same rule also runs at
  // every session load in GET /api/users/me — see lib/superAdmin.ts — so a
  // fresh sign-in does not have to wait for a server restart.
  await promoteEligibleSuperAdmins();

  await seedMockReviewItems();
}
