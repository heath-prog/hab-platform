import {
  Document, Page, View, Text, Line, Svg, StyleSheet, Font,
} from "@react-pdf/renderer";

// ─── Color palette ─────────────────────────────────────────────────────────────
const C = {
  navy:   "#0f2a5e",
  blue:   "#1d4ed8",
  teal:   "#0e7490",
  gray:   "#374151",
  mid:    "#6b7280",
  light:  "#f3f4f6",
  border: "#d1d5db",
  white:  "#ffffff",
  black:  "#111827",
};

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.black,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 48,
    backgroundColor: C.white,
  },

  // ── Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  companyName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: C.navy,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  tagline: {
    fontSize: 6.5,
    color: C.teal,
    letterSpacing: 1.2,
    marginTop: 1,
  },
  contactBlock: {
    alignItems: "flex-end",
  },
  contactLine: {
    fontSize: 8,
    color: C.gray,
    marginBottom: 1.5,
  },
  contactName: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: C.gray,
    marginBottom: 1.5,
  },

  // ── Divider
  divider: { marginTop: 8, marginBottom: 14 },

  // ── Title block
  titleBlock: { alignItems: "center", marginBottom: 18 },
  docTitle: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: C.navy,
    letterSpacing: 1,
    marginBottom: 4,
  },
  docSubtitle: {
    fontSize: 9.5,
    color: C.gray,
    fontFamily: "Helvetica-Oblique",
  },

  // ── Sections
  section: { marginBottom: 11 },
  sectionHeader: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.navy,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  body: { fontSize: 8.5, color: C.gray, lineHeight: 1.5 },
  bodyBold: { fontSize: 8.5, color: C.black, fontFamily: "Helvetica-Bold", lineHeight: 1.5 },

  // ── Data table
  table: { marginBottom: 2 },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
    paddingVertical: 4,
  },
  tableRowShaded: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
    paddingVertical: 4,
    backgroundColor: C.light,
  },
  tableLabel: { width: "38%", fontSize: 8.5, color: C.gray, fontFamily: "Helvetica-Bold" },
  tableValue: { width: "62%", fontSize: 8.5, color: C.black, lineHeight: 1.45 },

  // ── Bullet list
  bulletRow: { flexDirection: "row", marginBottom: 2 },
  bullet: { width: 10, fontSize: 8.5, color: C.mid },
  bulletText: { flex: 1, fontSize: 8.5, color: C.gray, lineHeight: 1.45 },

  // ── Signature block
  sigSection: { marginTop: 18 },
  sigRow: { flexDirection: "row", gap: 40 },
  sigCol: { flex: 1 },
  sigParty: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.navy, marginBottom: 6 },
  sigLine: { borderBottomWidth: 1, borderBottomColor: C.black, marginBottom: 3, height: 18 },
  sigLabel: { fontSize: 7.5, color: C.mid },

  // ── Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 48,
    right: 48,
    alignItems: "center",
  },
  footerText: {
    fontSize: 7,
    color: C.mid,
    letterSpacing: 0.3,
  },
  footerNote: {
    fontSize: 7,
    color: C.mid,
    textAlign: "center",
    marginTop: 4,
    fontFamily: "Helvetica-Oblique",
  },
  confidential: {
    fontSize: 7.5,
    color: C.teal,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
    marginTop: 3,
  },
});

// ─── Types ─────────────────────────────────────────────────────────────────────

export type LoiData = {
  // Parties
  buyerEntity:            string;
  buyerName:              string;
  buyerTitle:             string;
  buyerEmail:             string;
  sellerName:             string;
  sellerEntity:           string;
  sellerTitle:            string;
  sellerEmail:            string;

  // Deal
  transactionType:        string;
  purchasePrice:          number;
  initialDeposit:         number;
  depositDeadline:        string;
  escrowPeriodDays:       number;
  targetCloseDate:        string;
  acceptanceDeadline:     string;

  // Seller financing
  sellerNoteBalance:      number;
  sellerNoteTerm:         string;
  monthlyPayment:         number;
  graceDay:               number;
  lateFeePercent:         number;

  // Transition comp
  consultingMonthly:      number;

  // Exclusivity
  exclusivityDays:        number;

  // Optional extra notes
  customNotes?:           string;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  return `$${n.toLocaleString("en-US")} USD`;
}
function fmtPct(n: number) {
  return `${n}%`;
}

// ─── Table helper ──────────────────────────────────────────────────────────────

function TRow({ label, value, shade }: { label: string; value: string; shade?: boolean }) {
  return (
    <View style={shade ? s.tableRowShaded : s.tableRow}>
      <Text style={s.tableLabel}>{label}</Text>
      <Text style={s.tableValue}>{value}</Text>
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={s.bulletRow}>
      <Text style={s.bullet}>•</Text>
      <Text style={s.bulletText}>{text}</Text>
    </View>
  );
}

// ─── LOI PDF Document ──────────────────────────────────────────────────────────

export function LoiDocument({ data }: { data: LoiData }) {
  const downPmtTotal  = data.initialDeposit * 2;
  const downPmtPct    = Math.round((downPmtTotal / data.purchasePrice) * 100);
  const depositPct    = Math.round((data.initialDeposit / data.purchasePrice) * 100);

  return (
    <Document title="Letter of Intent" author={data.buyerEntity} creator="HAB Enterprises Acquisition Platform">
      <Page size="LETTER" style={s.page}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.companyName}>{data.buyerEntity.toUpperCase()}</Text>
            <Text style={s.tagline}>AUTOMOTIVE ACQUISITIONS  |  BUSINESS GROWTH  |  STRATEGIC INVESTMENT</Text>
          </View>
          <View style={s.contactBlock}>
            <Text style={s.contactName}>{data.buyerName}, {data.buyerTitle}</Text>
            <Text style={s.contactLine}>{data.buyerEmail}</Text>
            <Text style={s.contactLine}>United States</Text>
          </View>
        </View>

        {/* ── Blue rule ──────────────────────────────────────────────────────── */}
        <View style={s.divider}>
          <Svg height="2" width="519">
            <Line x1="0" y1="1" x2="519" y2="1" strokeWidth={1.5} stroke={C.navy} />
          </Svg>
        </View>

        {/* ── Title ──────────────────────────────────────────────────────────── */}
        <View style={s.titleBlock}>
          <Text style={s.docTitle}>LETTER OF INTENT</Text>
          <Text style={s.docSubtitle}>Proposed Acquisition of {data.sellerEntity}</Text>
        </View>

        {/* ── 1. Purpose ────────────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionHeader}>1. Purpose</Text>
          <Text style={s.body}>
            This Letter of Intent ("LOI") sets forth the preliminary terms under which {data.buyerEntity} ("Buyer") intends to acquire 100% ownership interest of {data.sellerEntity} ("Company"). This LOI outlines key terms prior to execution of a definitive Purchase Agreement.
          </Text>
        </View>

        {/* ── 2. Transaction Structure ──────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionHeader}>2. Transaction Structure</Text>
          <Text style={s.body}>
            The transaction is currently contemplated as a {data.transactionType} of 100% of the issued and outstanding shares of the Company for a total purchase price of {fmt$(data.purchasePrice)}. Final structure (Stock vs. Asset Purchase) shall be determined at Buyer's sole discretion during due diligence.
          </Text>
        </View>

        {/* ── 3. Purchase Price ─────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionHeader}>3. Purchase Price &amp; Payment Terms</Text>
          <View style={s.table}>
            <TRow label="Total Purchase Price"      value={fmt$(data.purchasePrice)} />
            <TRow label="Initial Deposit (Earnest Money)" value={`${fmt$(data.initialDeposit)} (${depositPct}%) deposited into escrow on or before ${data.depositDeadline}`} shade />
            <TRow label="Escrow Period"             value={`${data.escrowPeriodDays} days`} />
            <TRow label="Target Closing Date"       value={`${data.targetCloseDate} (may close earlier upon mutual written agreement)`} shade />
            <TRow label="Remaining Down Payment"    value={`Additional ${fmt$(data.initialDeposit)} due at closing — Total down payment: ${fmt$(downPmtTotal)} (${downPmtPct}%); funds released upon successful closing`} />
          </View>
        </View>

        {/* ── 4. Seller Financing ──────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionHeader}>4. Seller Financing (Seller Note)</Text>
          <Text style={[s.body, { marginBottom: 4 }]}>
            Remaining balance of {fmt$(data.sellerNoteBalance)} to be carried by Seller under the following terms:
          </Text>
          <View style={s.table}>
            <TRow label="Term"          value={data.sellerNoteTerm} />
            <TRow label="Monthly Payment" value={`$${data.monthlyPayment.toLocaleString()} — Due on the 5th of each month`} shade />
            <TRow label="Grace Period"  value={`Until the ${data.graceDay}th of each month`} />
            <TRow label="Late Fee"      value={`${fmtPct(data.lateFeePercent)} ($${Math.round(data.monthlyPayment * data.lateFeePercent / 100).toLocaleString()}) after the ${data.graceDay}th`} shade />
            <TRow label="Prepayment"    value="Allowed at any time with no penalty" />
            <TRow label="Security"      value="Seller Note secured by business assets (UCC or equivalent); final default terms and cure periods to be defined in Purchase Agreement" shade />
          </View>
        </View>

        {/* ── 5. Seller Participation ──────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionHeader}>5. Seller Participation Option</Text>
          <Text style={s.body}>
            Seller shall have the option (not obligation) to convert any remaining Seller Note balance (up to 100%) into an investment in future acquisitions by {data.buyerEntity}. Subject to separate written agreement. Valuation and ownership terms to be defined at time of investment. No automatic equity conversion.
          </Text>
        </View>

        {/* ── 6. Assets Included ────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionHeader}>6. Assets Included</Text>
          <Text style={[s.body, { marginBottom: 3 }]}>Transaction includes all business assets, including but not limited to:</Text>
          <Bullet text="Equipment (lifts, compressors, tools, etc.) and Inventory" />
          <Bullet text="Business name, brand, phone numbers, website(s) and domain(s)" />
          <Bullet text="Google reviews and online presence" />
          <Bullet text="Customer database and vendor accounts" />
          <Bullet text="Shop management system(s) and data" />
          <Bullet text="Company-owned vehicles (including wrapped 'True Blue' Jeep, if owned by Company)" />
        </View>

        {/* ── 7. Lease Contingency ─────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionHeader}>7. Lease Contingency</Text>
          <Text style={s.body}>
            This transaction is contingent upon Buyer securing acceptable lease terms. Buyer intends to establish a long-term lease (target: 20 years with renewal options and right of first refusal if available). Lease terms are subject to landlord approval and must be transferable and acceptable to Buyer. Failure to secure acceptable lease terms allows Buyer to terminate without penalty.
          </Text>
        </View>

        {/* ── 8. Due Diligence ─────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionHeader}>8. Due Diligence Period</Text>
          <Text style={[s.body, { marginBottom: 3 }]}>
            The escrow period shall serve as the due diligence period (minimum 30 days, up to {data.escrowPeriodDays} days). Buyer shall receive full access to:
          </Text>
          <Bullet text="Financials (P&L, tax returns, balance sheets)" />
          <Bullet text="QuickBooks and accounting systems" />
          <Bullet text="Shop management system (Tekmetric or equivalent)" />
          <Bullet text="Payroll records" />
          <Bullet text="Vendor and parts purchase history" />
          <Bullet text="Operational data and customer records" />
        </View>

        {/* ── 9. Transition & Compensation ──────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionHeader}>9. Transition &amp; Compensation During Escrow</Text>
          <View style={s.table}>
            <TRow label="Buyer Role"        value={`${data.buyerName} will be engaged in a consulting and transition capacity during the due diligence period`} />
            <TRow label="System Access"     value="Buyer granted access to systems, staff, and operations for evaluation and transition planning" shade />
            <TRow label="Compensation"      value={`${data.buyerEntity} will be compensated $${data.consultingMonthly.toLocaleString()}/month as a 1099 independent contractor, paid by ${data.sellerEntity}`} />
            <TRow label="Operational Control" value="Remains with Seller until closing, unless otherwise agreed in writing" shade />
          </View>
        </View>

        {/* ── 10. Representations & Warranties ─────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionHeader}>10. Representations &amp; Warranties</Text>
          <Text style={[s.body, { marginBottom: 3 }]}>Seller shall represent and warrant in the definitive agreement:</Text>
          <Bullet text="Financials are accurate and complete" />
          <Bullet text="No undisclosed liabilities exist" />
          <Bullet text="All taxes are current" />
          <Bullet text="No pending or threatened litigation" />
          <Bullet text="Assets are free and clear of liens (unless disclosed)" />
        </View>

        {/* ── 11. Exclusivity ──────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionHeader}>11. Exclusivity</Text>
          <Text style={s.body}>
            Seller agrees to {data.exclusivityDays} days exclusivity from the date of this LOI and will not negotiate with any other party during this period.
          </Text>
        </View>

        {/* ── 12. Closing ──────────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionHeader}>12. Closing</Text>
          <Text style={[s.body, { marginBottom: 3 }]}>
            Target Closing Date: {data.targetCloseDate}, subject to:
          </Text>
          <Bullet text="Completion of due diligence" />
          <Bullet text="Lease approval" />
          <Bullet text="Execution of definitive agreements" />
          <Bullet text="Satisfaction of all conditions" />
        </View>

        {/* ── 13. Non-Binding Nature ────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionHeader}>13. Non-Binding Nature</Text>
          <Text style={s.body}>
            This LOI is non-binding except for: Exclusivity, Confidentiality (if applicable), and the obligation of Good Faith Negotiations.
          </Text>
        </View>

        {/* ── 14. Acceptance ───────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionHeader}>14. Acceptance</Text>
          <Text style={s.body}>
            If acceptable, please sign and return no later than: <Text style={s.bodyBold}>{data.acceptanceDeadline}</Text>
          </Text>
        </View>

        {/* ── Signature Block ───────────────────────────────────────────────── */}
        <View style={s.sigSection}>
          <View style={s.sigRow}>
            {/* Buyer */}
            <View style={s.sigCol}>
              <Text style={s.sigParty}>BUYER</Text>
              <Text style={[s.body, { marginBottom: 10 }]}>{data.buyerEntity}</Text>
              <View style={s.sigLine} />
              <Text style={s.sigLabel}>By (Signature)</Text>
              <Text style={[s.body, { marginTop: 6, marginBottom: 2 }]}>Name: {data.buyerName}</Text>
              <Text style={[s.body, { marginBottom: 2 }]}>Title: {data.buyerTitle}</Text>
              <View style={{ borderBottomWidth: 0.5, borderBottomColor: C.border, marginTop: 10, marginBottom: 2 }} />
              <Text style={s.sigLabel}>Date</Text>
            </View>

            {/* Seller */}
            <View style={s.sigCol}>
              <Text style={s.sigParty}>SELLER</Text>
              <Text style={[s.body, { marginBottom: 10 }]}>{data.sellerEntity}</Text>
              <View style={s.sigLine} />
              <Text style={s.sigLabel}>By (Signature)</Text>
              <Text style={[s.body, { marginTop: 6, marginBottom: 2 }]}>Name: {data.sellerName}</Text>
              <View style={{ borderBottomWidth: 0.5, borderBottomColor: C.border, marginBottom: 2 }} />
              <Text style={s.sigLabel}>Title</Text>
              <View style={{ borderBottomWidth: 0.5, borderBottomColor: C.border, marginTop: 10, marginBottom: 2 }} />
              <Text style={s.sigLabel}>Date</Text>
            </View>
          </View>
        </View>

        {/* ── Confidentiality note ─────────────────────────────────────────── */}
        <View style={{ marginTop: 20 }}>
          <Svg height="1" width="519">
            <Line x1="0" y1="0.5" x2="519" y2="0.5" strokeWidth={0.5} stroke={C.border} />
          </Svg>
          <Text style={[s.footerNote, { marginTop: 6 }]}>
            This Letter of Intent is confidential and intended solely for the named parties. It does not constitute a binding agreement except as noted in Section 13.
          </Text>
        </View>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{data.buyerEntity}  |  Confidential  |  Letter of Intent</Text>
        </View>

      </Page>
    </Document>
  );
}

// ─── Default data (True Blue deal) ────────────────────────────────────────────

export const DEFAULT_LOI_DATA: LoiData = {
  buyerEntity:        "HAB Enterprises 3 LLC",
  buyerName:          "Heath Blake",
  buyerTitle:         "CEO / President",
  buyerEmail:         "heath.blake3@gmail.com",
  sellerName:         "Saj Zoghet",
  sellerEntity:       "True Blue Auto Care Inc",
  sellerTitle:        "",
  sellerEmail:        "",
  transactionType:    "Stock Purchase",
  purchasePrice:      300000,
  initialDeposit:     15000,
  depositDeadline:    "May 16, 2026",
  escrowPeriodDays:   60,
  targetCloseDate:    "July 16, 2026",
  acceptanceDeadline: "April 15, 2026",
  sellerNoteBalance:  270000,
  sellerNoteTerm:     "Up to 10 years (120 months)",
  monthlyPayment:     2250,
  graceDay:           15,
  lateFeePercent:     10,
  consultingMonthly:  2000,
  exclusivityDays:    60,
};
