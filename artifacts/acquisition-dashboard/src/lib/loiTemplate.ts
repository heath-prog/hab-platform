// ─── LOI Template ─────────────────────────────────────────────────────────────
// STATUS: Placeholder — replace body text below with the actual Heath Blake template
// when provided. The structure, variables, and viewer component are all complete.
// ─────────────────────────────────────────────────────────────────────────────

export type LoiVariable = {
  key: string;
  label: string;
  defaultValue: string;
};

export const LOI_VARIABLES: LoiVariable[] = [
  { key: "BUSINESS_NAME",    label: "Business Name",          defaultValue: "True Blue Auto Care Inc." },
  { key: "SELLER_NAME",      label: "Seller / Seller Entity", defaultValue: "Saj Zoghet"               },
  { key: "BUYER_NAME",       label: "Buyer Name",             defaultValue: "Heath Blake"               },
  { key: "BUYER_ENTITY",     label: "Buyer Entity",           defaultValue: "HAB Enterprises 3 LLC"    },
  { key: "DEAL_PRICE",       label: "Purchase Price",         defaultValue: "$300,000"                  },
  { key: "CLOSE_DATE",       label: "Target Close Date",      defaultValue: "July 16, 2026"             },
  { key: "LOCATION",         label: "Business Location",      defaultValue: "California"                },
  { key: "DILIGENCE_PERIOD", label: "Diligence Period",       defaultValue: "30 days"                  },
  { key: "EXCLUSIVITY_DAYS", label: "Exclusivity Period",     defaultValue: "45 days"                  },
];

// ── When the user provides the actual template, replace this string.
// Use {{VARIABLE_KEY}} notation for substitution (e.g. {{BUSINESS_NAME}}).
// The viewer will highlight substitution tokens in blue.

export const LOI_TEMPLATE_TEXT = `LETTER OF INTENT TO PURCHASE BUSINESS
AND NON-DISCLOSURE AGREEMENT

Date: {{TODAY}}

From: {{BUYER_NAME}}
      {{BUYER_ENTITY}}

To:   {{SELLER_NAME}}

Re:   Letter of Intent — Acquisition of {{BUSINESS_NAME}}

Dear {{SELLER_NAME}},

This Letter of Intent ("LOI") sets forth the general terms and conditions under which {{BUYER_ENTITY}} ("Buyer") proposes to acquire substantially all of the assets (or equity, if mutually agreed) of {{BUSINESS_NAME}} ("Business") from {{SELLER_NAME}} ("Seller").

─────────────────────────────────────────────────────────────
ARTICLE 1 — NON-DISCLOSURE AGREEMENT
─────────────────────────────────────────────────────────────

1.1  Confidentiality. In connection with the Buyer's evaluation of a potential acquisition of the Business, Seller may disclose to Buyer, and Buyer may receive, certain confidential and proprietary information including, without limitation, financial statements, customer data, employee information, trade secrets, and business plans (collectively, "Confidential Information").

1.2  Obligations. Buyer agrees to: (a) keep all Confidential Information strictly confidential; (b) not disclose Confidential Information to any third party without Seller's prior written consent, except to Buyer's advisors, lenders, and legal counsel on a need-to-know basis under obligations of confidentiality no less restrictive than those set forth herein; (c) use Confidential Information solely for purposes of evaluating the proposed acquisition; and (d) promptly return or destroy all Confidential Information upon Seller's written request or upon termination of discussions.

1.3  Exclusions. The confidentiality obligations shall not apply to information that: (a) is or becomes publicly known through no breach of this Agreement; (b) was lawfully in Buyer's possession prior to disclosure; or (c) is required to be disclosed by law or court order, provided Buyer provides Seller with prompt written notice.

1.4  Term. The confidentiality obligations in this Article 1 shall survive the termination of this LOI and shall remain in effect for a period of three (3) years from the date hereof.

─────────────────────────────────────────────────────────────
ARTICLE 2 — PROPOSED TERMS OF ACQUISITION
─────────────────────────────────────────────────────────────

2.1  Purchase Price. The proposed aggregate purchase price for the Business is {{DEAL_PRICE}} (the "Purchase Price"), subject to adjustment based on due diligence findings, asset verification, and the condition of the Business at closing.

2.2  Structure. The proposed acquisition is structured as an Asset Purchase, whereby Buyer will acquire the business assets, goodwill, customer lists, equipment, and intellectual property of the Business. The structure is subject to mutual agreement and attorney review.

2.3  Financing. Buyer intends to finance the transaction through a combination of: (a) Buyer's available capital; (b) SBA 7(a) financing (if applicable); and/or (c) Seller financing (if mutually agreed). Final financing structure is subject to lender approval.

2.4  Earnest Money / Deposit. Upon execution of a definitive Purchase Agreement, Buyer will deposit an earnest money amount to be mutually agreed upon, to be held in escrow by a mutually selected escrow agent.

─────────────────────────────────────────────────────────────
ARTICLE 3 — DUE DILIGENCE
─────────────────────────────────────────────────────────────

3.1  Due Diligence Period. Following execution of this LOI, Buyer shall have {{DILIGENCE_PERIOD}} to conduct a thorough review of the Business (the "Due Diligence Period"). Seller agrees to provide Buyer with access to all books, records, financial statements, contracts, leases, licenses, and other documents reasonably requested by Buyer.

3.2  Cooperation. Seller agrees to cooperate fully with Buyer's due diligence process and to make available Seller's employees, advisors, and records as reasonably needed.

─────────────────────────────────────────────────────────────
ARTICLE 4 — EXCLUSIVITY
─────────────────────────────────────────────────────────────

4.1  Exclusivity Period. For a period of {{EXCLUSIVITY_DAYS}} from the date this LOI is signed by both parties ("Exclusivity Period"), Seller agrees not to solicit, negotiate, or accept any offer from any other party for the purchase of the Business or its assets.

4.2  Good Faith Negotiation. Both parties agree to negotiate in good faith toward the execution of a definitive Purchase and Sale Agreement during the Exclusivity Period.

─────────────────────────────────────────────────────────────
ARTICLE 5 — GENERAL PROVISIONS
─────────────────────────────────────────────────────────────

5.1  Non-Binding. Except for Article 1 (Non-Disclosure Agreement) and Article 4 (Exclusivity), this LOI is non-binding and does not constitute a legally enforceable agreement. The acquisition is subject to, among other things: (a) completion of satisfactory due diligence; (b) execution of a definitive Purchase and Sale Agreement; (c) financing approval; and (d) any required third-party consents.

5.2  Target Close Date. The parties intend to target a closing date of on or before {{CLOSE_DATE}}, subject to the satisfaction of all conditions.

5.3  Governing Law. This LOI shall be governed by the laws of the State of California.

5.4  Counterparts. This LOI may be executed in one or more counterparts, including electronic signatures, each of which shall be deemed an original.

─────────────────────────────────────────────────────────────

AGREED AND ACCEPTED:

BUYER:

Signature: _______________________________
Name:      {{BUYER_NAME}}
Title:     Managing Member
Entity:    {{BUYER_ENTITY}}
Date:      _______________


SELLER:

Signature: _______________________________
Name:      {{SELLER_NAME}}
Date:      _______________

─────────────────────────────────────────────────────────────
[END OF LETTER OF INTENT AND NON-DISCLOSURE AGREEMENT]
This document was generated by the HAB Enterprises Acquisition Platform.
Template version 1.0 — replace with executed attorney-reviewed version at close.`;

export function fillTemplate(
  template: string,
  overrides: Partial<Record<string, string>> = {},
  businessName?: string,
  sellerName?: string,
  dealPrice?: number,
  targetCloseDate?: string,
  buyerName?: string,
  buyerEntity?: string,
): string {
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const closeDate = targetCloseDate
    ? new Date(targetCloseDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "TBD";
  const price = dealPrice ? `$${dealPrice.toLocaleString()}` : "TBD";

  const vars: Record<string, string> = {
    TODAY:         today,
    BUSINESS_NAME: businessName  || "{{BUSINESS_NAME}}",
    SELLER_NAME:   sellerName    || "{{SELLER_NAME}}",
    BUYER_NAME:    buyerName     || "Heath Blake",
    BUYER_ENTITY:  buyerEntity   || "HAB Enterprises 3 LLC",
    DEAL_PRICE:    price,
    CLOSE_DATE:    closeDate,
    LOCATION:      "California",
    DILIGENCE_PERIOD: "30 days",
    EXCLUSIVITY_DAYS: "45 days",
    ...overrides,
  };

  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template,
  );
}
