import { Router } from "express";
import { getAuth } from "@clerk/express";
import OpenAI from "openai";
import { logger } from "../lib/logger";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Monthly SBA 7(a) loan payment using standard amortization formula. */
function monthlyPayment(principal: number, annualRate: number, termYears: number): number {
  if (principal <= 0) return 0;
  const r = annualRate / 12;
  const n = termYears * 12;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

// ─── POST /api/deal-structure/analyze ─────────────────────────────────────────

router.post("/analyze", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const {
    businessName  = "the target business",
    purchasePrice,
    buyerCash,
    sellerNote        = 0,
    sellerNoteStandby = true,   // full standby = counts as SBA equity
    sde,                         // seller's discretionary earnings
    sbaRate           = 0.115,   // current SBA 7(a) rate (11.5% default)
    sbaTerm           = 10,      // years
  } = req.body as {
    businessName?:      string;
    purchasePrice:      number;
    buyerCash:          number;
    sellerNote?:        number;
    sellerNoteStandby?: boolean;
    sde:                number;
    sbaRate?:           number;
    sbaTerm?:           number;
  };

  if (!purchasePrice || !buyerCash || !sde) {
    return res.status(400).json({ error: "purchasePrice, buyerCash, and sde are required" });
  }

  // ── Core calculations ──────────────────────────────────────────────────────

  // Equity injection: SBA counts seller note on full standby as equity equivalent
  const sellerNoteEquityCredit = sellerNoteStandby ? sellerNote : 0;
  const totalEquityInjection   = buyerCash + sellerNoteEquityCredit;
  const requiredEquity         = purchasePrice * 0.10;
  const equityGap              = Math.max(0, requiredEquity - totalEquityInjection);
  const equityPct              = (totalEquityInjection / purchasePrice) * 100;

  const sbaLoanAmount          = purchasePrice - buyerCash - sellerNote;
  const annualDebtService      = monthlyPayment(sbaLoanAmount, sbaRate, sbaTerm) * 12;
  // SBA DSCR excludes seller note payments when note is on full standby
  const dscr                   = sde / annualDebtService;

  const meetsEquityRequirement = totalEquityInjection >= requiredEquity;
  const meetsDscr              = dscr >= 1.25;
  const isApprovable           = meetsEquityRequirement && meetsDscr;

  const metrics = {
    purchasePrice,
    buyerCash,
    sellerNote,
    sellerNoteStandby,
    sellerNoteEquityCredit,
    totalEquityInjection,
    requiredEquity,
    equityGap,
    equityPct: parseFloat(equityPct.toFixed(1)),
    sbaLoanAmount,
    annualDebtService: parseFloat(annualDebtService.toFixed(0)),
    sde,
    dscr: parseFloat(dscr.toFixed(2)),
    meetsEquityRequirement,
    meetsDscr,
    isApprovable,
    sbaRate: parseFloat((sbaRate * 100).toFixed(2)),
    sbaTerm,
  };

  // ── OpenAI analysis ────────────────────────────────────────────────────────

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `
You are a senior SBA lender advisor and PE deal analyst specializing in small business acquisitions (auto repair, service businesses).

Analyze this deal structure and respond with a JSON object only — no markdown, no commentary outside JSON.

DEAL PARAMETERS:
- Business: ${businessName}
- Purchase Price: $${purchasePrice.toLocaleString()}
- Buyer Cash Injection: $${buyerCash.toLocaleString()} (${equityPct.toFixed(1)}% of price)
- Seller Note: $${sellerNote.toLocaleString()}${sellerNoteStandby ? " (FULL STANDBY — counts as SBA equity)" : " (not on standby)"}
- SBA 7(a) Loan: $${sbaLoanAmount.toLocaleString()} @ ${(sbaRate * 100).toFixed(1)}%, ${sbaTerm} years
- SDE (Seller's Discretionary Earnings): $${sde.toLocaleString()}
- Annual Debt Service: $${annualDebtService.toLocaleString()}
- DSCR: ${dscr.toFixed(2)}x
- Total Equity Injection: $${totalEquityInjection.toLocaleString()} (${equityPct.toFixed(1)}%)
- SBA Equity Requirement Met: ${meetsEquityRequirement ? "YES" : "NO — gap of $" + equityGap.toLocaleString()}
- DSCR Requirement Met (≥1.25x): ${meetsDscr ? "YES" : "NO"}
- Overall Bankable: ${isApprovable ? "YES" : "NO"}

Respond ONLY with this JSON shape:
{
  "verdict": "APPROVABLE" | "NEEDS_RESTRUCTURING" | "STRONG_DEAL",
  "verdictRationale": "One sentence why",
  "bankReadyStatement": "2-3 sentences the buyer presents to the lender — polished, professional, SBA-compliant language. Reference seller participation and DSCR strength.",
  "structureStrengths": ["strength 1", "strength 2", "strength 3"],
  "potentialConcerns": [{"concern": "text", "response": "rebuttal text"}],
  "peStructuredSummary": "3-4 sentence PE-quality summary of the deal — enterprise value, structure rationale, risk profile, and return thesis.",
  "restructuringRecommendation": "Only populate if verdict is NEEDS_RESTRUCTURING — specific actionable fix. Otherwise null.",
  "proMove": "One advanced structuring tip (earnout, working capital reserve, equity kicker, etc.) that strengthens approval odds."
}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const analysis = JSON.parse(raw) as Record<string, unknown>;

    logger.info({ userId, businessName, dscr, isApprovable }, "Deal structure analysis complete");
    return res.json({ metrics, analysis });
  } catch (err) {
    logger.error(err, "OpenAI deal structure analysis failed");
    // Return metrics even if AI fails — calculations are always useful
    return res.json({
      metrics,
      analysis: {
        verdict: isApprovable ? "APPROVABLE" : "NEEDS_RESTRUCTURING",
        verdictRationale: isApprovable
          ? `DSCR of ${dscr.toFixed(2)}x exceeds 1.25x requirement and equity injection of ${equityPct.toFixed(1)}% meets SBA threshold.`
          : `${!meetsEquityRequirement ? "Equity injection does not meet 10% SBA requirement." : ""} ${!meetsDscr ? "DSCR below 1.25x threshold." : ""}`.trim(),
        bankReadyStatement: null,
        structureStrengths: [],
        potentialConcerns: [],
        peStructuredSummary: null,
        restructuringRecommendation: null,
        proMove: null,
      },
      aiError: true,
    });
  }
});

export default router;
