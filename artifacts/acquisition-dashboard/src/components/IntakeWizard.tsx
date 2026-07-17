import { useState, useMemo } from "react";
import {
  X, ChevronRight, ChevronLeft, Building2, FileText,
  Users, Banknote, Cpu, Sparkles, Check, AlertTriangle,
  TrendingUp, Target, ArrowRight, BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  Business, BusinessStage, AcquisitionType, FinancingType, DocStatusSnapshot,
} from "@/lib/storage";
import { STAGE_LABELS, EMPTY_DOCS } from "@/lib/storage";
import { inferWorkflow } from "@/lib/inferWorkflow";

// ─── Form state ────────────────────────────────────────────────────────────────

type WizardForm = {
  // Step 1
  name: string;
  industry: string;
  businessType: string;
  dbaName: string;
  legalEntityName: string;
  website: string;
  location: string;
  numberOfLocations: string;
  yearsInBusiness: string;
  description: string;
  // Step 2
  stage: BusinessStage;
  acquisitionType: AcquisitionType;
  dealPrice: string;
  estimatedDownPayment: string;
  targetCloseDate: string;
  sbaRequired: boolean;
  sellerFinancingExpected: boolean;
  leaseAssignmentExpected: boolean;
  landlordApprovalRequired: boolean;
  brokeredDeal: boolean;
  exclusivityInPlace: boolean;
  currentStepNote: string;
  // Step 3
  seller: string;
  sellerEntity: string;
  buyer: string;
  entityName: string;
  brokerName: string;
  attorneyName: string;
  cpaName: string;
  landlordContact: string;
  lenderContact: string;
  // Step 4
  docsReceived: DocStatusSnapshot;
  // Step 5
  financingTypes: FinancingType[];
  workingCapitalNeeded: boolean;
  postCloseCapitalEstimate: string;
  buyerOperateDirectly: boolean;
  managerInPlace: boolean;
  dayOneOperatorKnown: boolean;
  currentStaffRemaining: boolean;
  postCloseFinancialSystemRequired: boolean;
  rollupIntent: boolean;
};

const EMPTY_FORM: WizardForm = {
  name: "", industry: "Automotive Repair", businessType: "", dbaName: "",
  legalEntityName: "", website: "", location: "", numberOfLocations: "1",
  yearsInBusiness: "", description: "",
  stage: "lead", acquisitionType: "undecided", dealPrice: "",
  estimatedDownPayment: "", targetCloseDate: "", sbaRequired: false,
  sellerFinancingExpected: false, leaseAssignmentExpected: false,
  landlordApprovalRequired: false, brokeredDeal: false, exclusivityInPlace: false,
  currentStepNote: "",
  seller: "", sellerEntity: "", buyer: "Heath Blake", entityName: "HAB Enterprises 3 LLC",
  brokerName: "", attorneyName: "", cpaName: "", landlordContact: "", lenderContact: "",
  docsReceived: { ...EMPTY_DOCS },
  financingTypes: [], workingCapitalNeeded: false, postCloseCapitalEstimate: "",
  buyerOperateDirectly: true, managerInPlace: false, dayOneOperatorKnown: false,
  currentStaffRemaining: true, postCloseFinancialSystemRequired: true, rollupIntent: false,
};

// ─── Step definitions ──────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Business Basics",    icon: Building2  },
  { id: 2, label: "Deal Structure",     icon: FileText   },
  { id: 3, label: "People & Contacts",  icon: Users      },
  { id: 4, label: "Documents",          icon: BookOpen   },
  { id: 5, label: "Financing & Ops",    icon: Banknote   },
  { id: 6, label: "AI Summary",         icon: Sparkles   },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, type = "text", helper }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; helper?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-foreground/70 mb-1.5">{label}</label>
      <input
        type={type}
        className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {helper && <p className="text-xs text-muted-foreground/60 mt-1">{helper}</p>}
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder, helper }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; helper?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-foreground/70 mb-1.5">{label}</label>
      <textarea
        className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {helper && <p className="text-xs text-muted-foreground/60 mt-1">{helper}</p>}
    </div>
  );
}

function Toggle({ label, value, onChange, helper }: {
  label: string; value: boolean; onChange: (v: boolean) => void; helper?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground/90">{label}</p>
        {helper && <p className="text-xs text-muted-foreground/60 mt-0.5">{helper}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={cn(
          "w-10 h-5.5 rounded-full relative transition-colors flex-shrink-0 mt-0.5 flex items-center",
          value ? "bg-primary" : "bg-muted border border-border"
        )}
        style={{ minWidth: "2.5rem", height: "1.375rem" }}
      >
        <span
          className={cn(
            "absolute w-4 h-4 rounded-full bg-white shadow transition-transform",
            value ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}

function SelectField({ label, value, onChange, options, helper }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; helper?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-foreground/70 mb-1.5">{label}</label>
      <select
        className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {helper && <p className="text-xs text-muted-foreground/60 mt-1">{helper}</p>}
    </div>
  );
}

function RadioGroup({ label, value, onChange, options, helper }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string; desc?: string }[]; helper?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-foreground/70 mb-2">{label}</label>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all",
              value === o.value
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            <span>{o.label}</span>
            {o.desc && <span className={cn("text-xs font-normal", value === o.value ? "text-white/70" : "text-muted-foreground/60")}>{o.desc}</span>}
          </button>
        ))}
      </div>
      {helper && <p className="text-xs text-muted-foreground/60 mt-1.5">{helper}</p>}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-1 mt-4 first:mt-0">
      <div className="h-px flex-1 bg-border/60" />
      <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider shrink-0">{children}</p>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}

function DocRow({ label, field, docs, onChange }: {
  label: string;
  field: keyof DocStatusSnapshot;
  docs: DocStatusSnapshot;
  onChange: (k: keyof DocStatusSnapshot, v: boolean) => void;
}) {
  const received = docs[field];
  return (
    <button
      type="button"
      onClick={() => onChange(field, !received)}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left",
        received
          ? "bg-emerald-500/8 border-emerald-500/25 text-foreground"
          : "bg-card border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
      )}
    >
      <div className={cn(
        "w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border transition-colors",
        received ? "bg-emerald-500 border-emerald-500" : "border-border bg-background"
      )}>
        {received && <Check className="w-3 h-3 text-white" />}
      </div>
      <span className="text-sm font-medium">{label}</span>
      <span className={cn("ml-auto text-xs font-semibold px-2 py-0.5 rounded-full", received ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground")}>
        {received ? "Received" : "Not yet"}
      </span>
    </button>
  );
}

function FinancingChip({ label, value, checked, onChange }: {
  label: string; value: FinancingType; checked: boolean; onChange: (v: FinancingType, on: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(value, !checked)}
      className={cn(
        "px-3.5 py-2 rounded-xl border text-sm font-semibold transition-all",
        checked
          ? "bg-primary text-white border-primary shadow-sm"
          : "bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function ReadinessBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-foreground/80">{label}</p>
        <p className={cn("text-xs font-bold", color)}>{value}%</p>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", value < 30 ? "bg-red-500" : value < 60 ? "bg-amber-500" : "bg-emerald-500")}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

// ─── Step content components ───────────────────────────────────────────────────

function Step1({ form, set }: { form: WizardForm; set: (k: keyof WizardForm, v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Business Name *" value={form.name} onChange={(v) => set("name", v)} placeholder="Prestige Auto Works" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Industry" value={form.industry} onChange={(v) => set("industry", v)} placeholder="Automotive Repair" />
        <Field label="Business Type" value={form.businessType} onChange={(v) => set("businessType", v)} placeholder="Auto Repair Shop" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="DBA / Brand Name" value={form.dbaName} onChange={(v) => set("dbaName", v)} placeholder="Trading name (if different)" />
        <Field label="Legal Entity Name" value={form.legalEntityName} onChange={(v) => set("legalEntityName", v)} placeholder="XYZ Inc." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City, State" value={form.location} onChange={(v) => set("location", v)} placeholder="Elk Grove, CA" />
        <Field label="Website" value={form.website} onChange={(v) => set("website", v)} placeholder="https://..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Years in Business" value={form.yearsInBusiness} onChange={(v) => set("yearsInBusiness", v)} placeholder="12" helper="Used for SBA eligibility and seller credibility scoring" />
        <Field label="Number of Locations" value={form.numberOfLocations} onChange={(v) => set("numberOfLocations", v)} type="number" placeholder="1" />
      </div>
      <TextArea label="Description" value={form.description} onChange={(v) => set("description", v)}
        placeholder="Brief deal summary — include context, seller motivation, and any known highlights..." helper="The AI assistant uses this to personalize your deal analysis." />
    </div>
  );
}

function Step2({ form, set }: { form: WizardForm; set: (k: keyof WizardForm, v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Current Stage"
          value={form.stage}
          onChange={(v) => set("stage", v as BusinessStage)}
          options={(Object.keys(STAGE_LABELS) as BusinessStage[]).map((s) => ({ value: s, label: STAGE_LABELS[s] }))}
        />
        <Field label="Deal Price" value={form.dealPrice} onChange={(v) => set("dealPrice", v)} type="number" placeholder="1800000" helper="Full purchase price" />
      </div>

      <RadioGroup
        label="Acquisition Type"
        value={form.acquisitionType}
        onChange={(v) => set("acquisitionType", v as AcquisitionType)}
        options={[
          { value: "asset",     label: "Asset Purchase",  desc: "Buys assets only"   },
          { value: "stock",     label: "Stock Purchase",  desc: "Buys entity shares"  },
          { value: "undecided", label: "Undecided",       desc: "To be determined"    },
        ]}
        helper="Asset purchase is most common for SMB acquisitions. Stock purchase requires full entity review."
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Estimated Down Payment" value={form.estimatedDownPayment} onChange={(v) => set("estimatedDownPayment", v)} type="number" placeholder="200000" />
        <Field label="Target Close Date" value={form.targetCloseDate} onChange={(v) => set("targetCloseDate", v)} type="date" />
      </div>

      <SectionLabel>Deal Conditions</SectionLabel>
      <div className="space-y-1 bg-muted/30 rounded-xl px-3 py-1 border border-border/60">
        <Toggle label="SBA financing is likely" value={form.sbaRequired} onChange={(v) => set("sbaRequired", v)} helper="Triggers SBA lender workflow and document checklist" />
        <Toggle label="Seller financing expected" value={form.sellerFinancingExpected} onChange={(v) => set("sellerFinancingExpected", v)} helper="Seller will carry a note as part of the deal" />
        <Toggle label="Lease assignment expected" value={form.leaseAssignmentExpected} onChange={(v) => set("leaseAssignmentExpected", v)} />
        <Toggle label="Landlord approval required" value={form.landlordApprovalRequired} onChange={(v) => set("landlordApprovalRequired", v)} helper="Triggers landlord contact task" />
        <Toggle label="Brokered deal" value={form.brokeredDeal} onChange={(v) => set("brokeredDeal", v)} />
        <Toggle label="Exclusivity in place" value={form.exclusivityInPlace} onChange={(v) => set("exclusivityInPlace", v)} />
      </div>

      <TextArea label="Current Step / Notes" value={form.currentStepNote} onChange={(v) => set("currentStepNote", v)} placeholder="Where are things right now? What's the most recent development or blocker?" helper="The AI uses this to refine recommended next steps." />
    </div>
  );
}

function Step3({ form, set }: { form: WizardForm; set: (k: keyof WizardForm, v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <SectionLabel>Seller</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Seller Name" value={form.seller} onChange={(v) => set("seller", v)} placeholder="Andre Kamel" />
        <Field label="Seller Entity" value={form.sellerEntity} onChange={(v) => set("sellerEntity", v)} placeholder="Kamel LLC" />
      </div>

      <SectionLabel>Buyer</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Buyer / Operator" value={form.buyer} onChange={(v) => set("buyer", v)} placeholder="Heath Blake" />
        <Field label="Buyer Entity" value={form.entityName} onChange={(v) => set("entityName", v)} placeholder="HAB Enterprises 3 LLC" />
      </div>

      <SectionLabel>Advisors & Contacts</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Broker Name" value={form.brokerName} onChange={(v) => set("brokerName", v)} placeholder="Business broker" />
        <Field label="Attorney" value={form.attorneyName} onChange={(v) => set("attorneyName", v)} placeholder="Deal attorney" />
        <Field label="CPA" value={form.cpaName} onChange={(v) => set("cpaName", v)} placeholder="Accountant / CPA" />
        <Field label="Landlord Contact" value={form.landlordContact} onChange={(v) => set("landlordContact", v)} placeholder="Landlord / PM" />
        <Field label="Lender / SBA Contact" value={form.lenderContact} onChange={(v) => set("lenderContact", v)} placeholder="Bank or SBA rep" helper="Required if SBA financing is selected" />
      </div>
    </div>
  );
}

function Step4({ form, set }: { form: WizardForm; set: (k: keyof WizardForm, v: unknown) => void }) {
  const setDoc = (k: keyof DocStatusSnapshot, v: boolean) => {
    set("docsReceived", { ...form.docsReceived, [k]: v });
  };
  const count = Object.values(form.docsReceived).filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-muted-foreground">Mark every document category the seller has <em>already provided</em>.</p>
        <span className="text-sm font-bold text-primary">{count} / 9 received</span>
      </div>
      <DocRow label="Financials (general)" field="financials" docs={form.docsReceived} onChange={setDoc} />
      <DocRow label="Tax Returns (3 years)" field="taxReturns" docs={form.docsReceived} onChange={setDoc} />
      <DocRow label="P&L Statements" field="pnls" docs={form.docsReceived} onChange={setDoc} />
      <DocRow label="Bank Statements (12 months)" field="bankStatements" docs={form.docsReceived} onChange={setDoc} />
      <DocRow label="Lease Agreement" field="lease" docs={form.docsReceived} onChange={setDoc} />
      <DocRow label="Payroll Reports" field="payroll" docs={form.docsReceived} onChange={setDoc} />
      <DocRow label="Debt Schedule" field="debtSchedule" docs={form.docsReceived} onChange={setDoc} />
      <DocRow label="Equipment List" field="equipmentList" docs={form.docsReceived} onChange={setDoc} />
      <DocRow label="Licenses & Permits" field="licensesPermits" docs={form.docsReceived} onChange={setDoc} />
    </div>
  );
}

function Step5({ form, set }: { form: WizardForm; set: (k: keyof WizardForm, v: unknown) => void }) {
  const toggleFinancing = (type: FinancingType, on: boolean) => {
    const current = form.financingTypes;
    if (on) {
      set("financingTypes", [...current.filter((t) => t !== "undecided"), type]);
    } else {
      const next = current.filter((t) => t !== type);
      set("financingTypes", next.length === 0 ? ["undecided"] : next);
    }
  };
  const checked = (t: FinancingType) => form.financingTypes.includes(t);

  return (
    <div className="space-y-4">
      <SectionLabel>Capital & Financing Structure</SectionLabel>
      <div>
        <label className="block text-xs font-semibold text-foreground/70 mb-2">Financing Types <span className="font-normal text-muted-foreground">(select all that apply)</span></label>
        <div className="flex flex-wrap gap-2">
          <FinancingChip label="Cash" value="cash" checked={checked("cash")} onChange={toggleFinancing} />
          <FinancingChip label="SBA 7(a)" value="sba" checked={checked("sba")} onChange={toggleFinancing} />
          <FinancingChip label="Seller Note" value="seller-note" checked={checked("seller-note")} onChange={toggleFinancing} />
          <FinancingChip label="Conventional Loan" value="conventional" checked={checked("conventional")} onChange={toggleFinancing} />
          <FinancingChip label="Investor Equity" value="investor-equity" checked={checked("investor-equity")} onChange={toggleFinancing} />
          <FinancingChip label="Undecided" value="undecided" checked={checked("undecided")} onChange={toggleFinancing} />
        </div>
        <p className="text-xs text-muted-foreground/60 mt-1.5">Selecting SBA will activate the SBA lender readiness workflow automatically.</p>
      </div>

      <div className="space-y-1 bg-muted/30 rounded-xl px-3 py-1 border border-border/60">
        <Toggle label="Working capital funding needed post-close" value={form.workingCapitalNeeded} onChange={(v) => set("workingCapitalNeeded", v)} />
      </div>
      {form.workingCapitalNeeded && (
        <Field label="Estimated Post-Close Capital Need" value={form.postCloseCapitalEstimate} onChange={(v) => set("postCloseCapitalEstimate", v)} type="number" placeholder="50000" helper="Amount of cash needed for operations after close" />
      )}

      <SectionLabel>Operating Plan</SectionLabel>
      <div className="space-y-1 bg-muted/30 rounded-xl px-3 py-1 border border-border/60">
        <Toggle label="Buyer will operate directly (owner-operator)" value={form.buyerOperateDirectly} onChange={(v) => set("buyerOperateDirectly", v)} />
        <Toggle label="Experienced manager already in place" value={form.managerInPlace} onChange={(v) => set("managerInPlace", v)} />
        <Toggle label="Day 1 operator is identified and confirmed" value={form.dayOneOperatorKnown} onChange={(v) => set("dayOneOperatorKnown", v)} helper="Critical for close-readiness" />
        <Toggle label="Current staff expected to remain post-close" value={form.currentStaffRemaining} onChange={(v) => set("currentStaffRemaining", v)} />
        <Toggle label="Post-close financial system required on Day 1" value={form.postCloseFinancialSystemRequired} onChange={(v) => set("postCloseFinancialSystemRequired", v)} helper="Activates Financial Management dashboard at close" />
        <Toggle label="This is part of a multi-shop rollup strategy" value={form.rollupIntent} onChange={(v) => set("rollupIntent", v)} helper="Enables portfolio rollup tracking and consolidated reporting" />
      </div>
    </div>
  );
}

function Step6Summary({ form }: { form: WizardForm }) {
  const preview = useMemo(() => {
    const ft = form.financingTypes;
    const b: Business = {
      id: "preview",
      name: form.name || "New Business",
      entityName: form.entityName,
      seller: form.seller,
      buyer: form.buyer,
      dealPrice: parseFloat(form.dealPrice) || 0,
      stage: form.stage,
      targetCloseDate: form.targetCloseDate || undefined,
      industry: form.industry,
      financialManagementActive: false,
      description: form.description,
      createdAt: new Date().toISOString(),
      acquisitionType: form.acquisitionType,
      sbaRequired: form.sbaRequired,
      sellerFinancingExpected: form.sellerFinancingExpected,
      landlordApprovalRequired: form.landlordApprovalRequired,
      exclusivityInPlace: form.exclusivityInPlace,
      currentStepNote: form.currentStepNote,
      lenderContact: form.lenderContact,
      landlordContact: form.landlordContact,
      financingTypes: ft.length > 0 ? ft : undefined,
      dayOneOperatorKnown: form.dayOneOperatorKnown,
      rollupIntent: form.rollupIntent,
      docsReceived: form.docsReceived,
      leaseAssignmentExpected: form.leaseAssignmentExpected,
    };
    return inferWorkflow(b);
  }, [form]);

  const { readiness } = preview;

  return (
    <div className="space-y-5">
      {/* Deal Summary */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <p className="text-sm font-bold text-primary">AI Deal Summary</p>
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed">{preview.dealSummary}</p>
      </div>

      {/* Readiness scores */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Readiness Scores</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <ReadinessBar label="Document Readiness"  value={readiness.document}  color={readiness.document  < 30 ? "text-red-500" : readiness.document  < 60 ? "text-amber-500" : "text-emerald-500"} />
          <ReadinessBar label="Financing Readiness" value={readiness.financing} color={readiness.financing < 30 ? "text-red-500" : readiness.financing < 60 ? "text-amber-500" : "text-emerald-500"} />
          <ReadinessBar label="Diligence Readiness" value={readiness.diligence} color={readiness.diligence < 30 ? "text-red-500" : readiness.diligence < 60 ? "text-amber-500" : "text-emerald-500"} />
          <ReadinessBar label="Close Readiness"     value={readiness.close}     color={readiness.close     < 30 ? "text-red-500" : readiness.close     < 60 ? "text-amber-500" : "text-emerald-500"} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Buyer Actions */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2.5">Buyer Actions</p>
          <ul className="space-y-1.5">
            {preview.buyerActions.slice(0, 4).map((a, i) => (
              <li key={i} className="flex items-start gap-2">
                <Target className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-xs text-foreground/80">{a}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Missing items */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2.5">Missing Items</p>
          {preview.missingItems.length === 0 ? (
            <p className="text-xs text-emerald-500 font-medium">No critical gaps identified</p>
          ) : (
            <ul className="space-y-1.5">
              {preview.missingItems.slice(0, 5).map((m, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-foreground/80">{m}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Workflow track + risk flags */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Workflow Track</p>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" />
            <p className="text-sm font-semibold text-foreground">{preview.workflowTrack}</p>
          </div>
          <div className="mt-2.5 flex items-start gap-2 bg-primary/5 rounded-lg px-3 py-2">
            <ArrowRight className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-primary font-medium leading-relaxed">{preview.nextStep}</p>
          </div>
        </div>

        {preview.riskFlags.length > 0 && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
            <p className="text-xs font-bold text-red-500/80 uppercase tracking-wider mb-2.5">Risk Flags</p>
            <ul className="space-y-1.5">
              {preview.riskFlags.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-red-600/80 dark:text-red-400/80">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Launch summary (post-submit screen) ──────────────────────────────────────

export function LaunchSummary({ business, onOpen, onBack }: {
  business: Business;
  onOpen: () => void;
  onBack: () => void;
}) {
  const inference = useMemo(() => inferWorkflow(business), [business]);
  const { readiness } = inference;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-primary px-8 py-6">
          <div className="flex items-center gap-2 mb-1">
            <Check className="w-5 h-5 text-white" />
            <p className="text-white/80 text-sm font-semibold">Workspace Created</p>
          </div>
          <h2 className="text-white text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {business.name}
          </h2>
          <p className="text-white/70 text-sm mt-1">{inference.workflowTrack} · {inference.financingPath}</p>
        </div>

        <div className="px-8 py-6 max-h-[60vh] overflow-y-auto space-y-5">
          {/* Deal summary */}
          <div className="bg-muted/40 rounded-xl px-4 py-3 border border-border">
            <p className="text-sm text-foreground/80 leading-relaxed">{inference.dealSummary}</p>
          </div>

          {/* Next step highlight */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-start gap-3">
            <ArrowRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">Recommended Next Step</p>
              <p className="text-sm font-semibold text-foreground">{inference.nextStep}</p>
            </div>
          </div>

          {/* Readiness + actions grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Readiness</p>
              <div className="space-y-3">
                <ReadinessBar label="Documents"  value={readiness.document}  color={readiness.document  < 30 ? "text-red-500" : readiness.document  < 60 ? "text-amber-500" : "text-emerald-500"} />
                <ReadinessBar label="Financing"  value={readiness.financing} color={readiness.financing < 30 ? "text-red-500" : readiness.financing < 60 ? "text-amber-500" : "text-emerald-500"} />
                <ReadinessBar label="Diligence"  value={readiness.diligence} color={readiness.diligence < 30 ? "text-red-500" : readiness.diligence < 60 ? "text-amber-500" : "text-emerald-500"} />
                <ReadinessBar label="Close"      value={readiness.close}     color={readiness.close     < 30 ? "text-red-500" : readiness.close     < 60 ? "text-amber-500" : "text-emerald-500"} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Top Actions</p>
                <ul className="space-y-1.5">
                  {inference.buyerActions.slice(0, 3).map((a, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Target className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-foreground/80">{a}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {inference.riskFlags.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1.5">Watch</p>
                  <p className="text-xs text-amber-600/80 dark:text-amber-400/80 leading-relaxed">{inference.riskFlags[0]}</p>
                </div>
              )}
            </div>
          </div>

          {inference.missingItems.length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Still Missing</p>
              <div className="flex flex-wrap gap-1.5">
                {inference.missingItems.slice(0, 6).map((m, i) => (
                  <span key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted border border-border text-xs text-muted-foreground">
                    <AlertTriangle className="w-3 h-3 text-amber-400" /> {m}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-8 py-4 border-t border-border flex items-center justify-between">
          <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Portfolio
          </button>
          <button
            onClick={onOpen}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm"
          >
            Open Workspace <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main wizard component ─────────────────────────────────────────────────────

export default function IntakeWizard({
  onSave,
  onClose,
}: {
  onSave: (b: Business) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardForm>({ ...EMPTY_FORM });
  const [touched, setTouched] = useState(false);

  const set = (k: keyof WizardForm, v: unknown) => {
    setForm((p) => ({ ...p, [k]: v }));
  };

  const canAdvance = step === 1 ? form.name.trim().length > 0 : true;

  function buildBusiness(): Business {
    const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const ft = form.financingTypes.filter((t) => t !== "undecided");
    return {
      id: `${slug}-${Date.now()}`,
      name: form.name.trim(),
      entityName: form.entityName || "HAB Enterprises 3 LLC",
      seller: form.seller,
      buyer: form.buyer,
      dealPrice: parseFloat(form.dealPrice) || 0,
      stage: form.stage,
      targetCloseDate: form.targetCloseDate || undefined,
      industry: form.industry,
      financialManagementActive: form.stage === "operating",
      description: form.description,
      createdAt: new Date().toISOString(),

      legalEntityName: form.legalEntityName || undefined,
      dbaName: form.dbaName || undefined,
      website: form.website || undefined,
      location: form.location || undefined,
      numberOfLocations: parseInt(form.numberOfLocations) || 1,
      yearsInBusiness: form.yearsInBusiness || undefined,
      businessType: form.businessType || undefined,

      acquisitionType: form.acquisitionType,
      estimatedDownPayment: parseFloat(form.estimatedDownPayment) || undefined,
      sellerFinancingExpected: form.sellerFinancingExpected,
      sbaRequired: form.sbaRequired,
      leaseAssignmentExpected: form.leaseAssignmentExpected,
      landlordApprovalRequired: form.landlordApprovalRequired,
      brokeredDeal: form.brokeredDeal,
      exclusivityInPlace: form.exclusivityInPlace,
      currentStepNote: form.currentStepNote || undefined,

      sellerEntity: form.sellerEntity || undefined,
      brokerName: form.brokerName || undefined,
      attorneyName: form.attorneyName || undefined,
      cpaName: form.cpaName || undefined,
      landlordContact: form.landlordContact || undefined,
      lenderContact: form.lenderContact || undefined,

      financingTypes: ft.length > 0 ? ft : undefined,
      workingCapitalNeeded: form.workingCapitalNeeded,
      postCloseCapitalEstimate: parseFloat(form.postCloseCapitalEstimate) || undefined,
      buyerOperateDirectly: form.buyerOperateDirectly,
      managerInPlace: form.managerInPlace,
      dayOneOperatorKnown: form.dayOneOperatorKnown,
      currentStaffRemaining: form.currentStaffRemaining,
      postCloseFinancialSystemRequired: form.postCloseFinancialSystemRequired,
      rollupIntent: form.rollupIntent,
      docsReceived: form.docsReceived,
    };
  }

  function handleSubmit() {
    if (!form.name.trim()) { setTouched(true); return; }
    onSave(buildBusiness());
  }

  const stepLabels: Record<number, string> = {
    1: "Tell us about the business",
    2: "Structure the deal",
    3: "Who's involved?",
    4: "What documents have been received?",
    5: "How will this deal be financed and operated?",
    6: "Your AI deal analysis is ready",
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm">
      {/* Left sidebar */}
      <div className="w-56 bg-sidebar flex flex-col border-r border-sidebar-border flex-shrink-0">
        <div className="px-6 py-5 border-b border-sidebar-border">
          <p className="text-sidebar-foreground/50 text-[10px] font-semibold tracking-wider uppercase mb-1">New Acquisition</p>
          <h2 className="text-white font-bold text-sm leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {form.name || "Untitled Business"}
          </h2>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {STEPS.map((s) => {
            const done  = s.id < step;
            const active = s.id === step;
            return (
              <button
                key={s.id}
                onClick={() => s.id < step && setStep(s.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left",
                  active ? "bg-sidebar-accent text-white" :
                  done   ? "text-white/60 hover:text-white hover:bg-sidebar-accent/40 cursor-pointer" :
                           "text-sidebar-foreground/30 cursor-default"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs border",
                  active ? "bg-white text-primary border-white font-bold" :
                  done   ? "bg-white/20 border-white/30 text-white/60" :
                           "border-white/15 text-white/20"
                )}>
                  {done ? <Check className="w-3 h-3" /> : s.id}
                </div>
                <span className="text-xs">{s.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-sidebar-border">
          <button onClick={onClose} className="flex items-center gap-2 text-sidebar-foreground/40 hover:text-sidebar-foreground/80 transition-colors text-xs">
            <X className="w-3.5 h-3.5" /> Cancel intake
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col bg-background overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-border bg-card/50 flex-shrink-0">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Step {step} of {STEPS.length}</p>
            <h3 className="text-base font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {stepLabels[step]}
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "rounded-full transition-all",
                  s.id < step  ? "w-2.5 h-2.5 bg-primary" :
                  s.id === step ? "w-6 h-2.5 bg-primary" :
                                  "w-2.5 h-2.5 bg-muted"
                )}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {touched && step === 1 && !form.name.trim() && (
            <div className="mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-sm text-red-500 font-medium">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Business name is required to continue.
            </div>
          )}
          {step === 1 && <Step1 form={form} set={set} />}
          {step === 2 && <Step2 form={form} set={set} />}
          {step === 3 && <Step3 form={form} set={set} />}
          {step === 4 && <Step4 form={form} set={set} />}
          {step === 5 && <Step5 form={form} set={set} />}
          {step === 6 && <Step6Summary form={form} />}
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between px-8 py-4 border-t border-border bg-card/50 flex-shrink-0">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 1 ? "Cancel" : "Back"}
          </button>

          <div className="flex items-center gap-3">
            {step < 5 && (
              <button
                onClick={() => setStep(6)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip to summary →
              </button>
            )}
            {step < 6 ? (
              <button
                onClick={() => {
                  if (step === 1 && !form.name.trim()) { setTouched(true); return; }
                  setStep(step + 1);
                }}
                disabled={!canAdvance && step === 1}
                className={cn(
                  "flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm",
                  canAdvance || step > 1
                    ? "bg-primary text-white hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-6 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 transition-colors shadow-sm"
              >
                <Check className="w-4 h-4" /> Create Business Workspace
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
