import { useClerk } from "@clerk/react";
import { CheckCircle2, Circle, Upload, LogOut, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useCallback } from "react";
import type { DealUser } from "@/lib/auth";
import { AIDocumentUpload } from "@/components/AIDocumentUpload";

const REQUIRED_DOCS = [
  { id: "sd1",  label: "Last 3 Years Federal Business Tax Returns", priority: "high" },
  { id: "sd2",  label: "Last 3 Years Profit & Loss Statements", priority: "high" },
  { id: "sd3",  label: "Last 3 Years Balance Sheets", priority: "high" },
  { id: "sd4",  label: "Last 12 Months Bank Statements (all accounts)", priority: "high" },
  { id: "sd5",  label: "Current Lease Agreement", priority: "high" },
  { id: "sd6",  label: "BAR (Bureau of Automotive Repair) License", priority: "high" },
  { id: "sd7",  label: "Smog / STAR Certification (if applicable)", priority: "medium" },
  { id: "sd8",  label: "Current Payroll Reports (last 3 months)", priority: "high" },
  { id: "sd9",  label: "Employee Roster & Job Titles", priority: "medium" },
  { id: "sd10", label: "Debt Schedule (loans, equipment financing)", priority: "high" },
  { id: "sd11", label: "Accounts Payable & Receivable Aging Report", priority: "medium" },
  { id: "sd12", label: "Equipment & Inventory List with Values", priority: "medium" },
  { id: "sd13", label: "Vehicle Title(s) (including Jeep)", priority: "medium" },
  { id: "sd14", label: "Vendor List with Contact Information", priority: "low" },
  { id: "sd15", label: "Tekmetric Export / Shop Management Report", priority: "medium" },
  { id: "sd16", label: "Proof of Google Business & Website Ownership", priority: "low" },
];

const STORAGE_KEY = "trueblue_seller_submissions";

function loadSubmitted(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); } catch { return {}; }
}
function saveSubmitted(r: Record<string, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
}

const priorityLabel = (p: string) =>
  p === "high" ? "Required" : p === "medium" ? "Important" : "Optional";
const priorityClass = (p: string) =>
  p === "high"
    ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30"
    : p === "medium"
    ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30"
    : "text-muted-foreground bg-muted";

export default function SellerPortal({ dealUser }: { dealUser: DealUser }) {
  const { signOut } = useClerk();
  const [submitted, setSubmitted] = useState<Record<string, boolean>>(loadSubmitted);

  const toggle = (id: string) => {
    const next = { ...submitted, [id]: !submitted[id] };
    setSubmitted(next);
    saveSubmitted(next);
  };

  const doneCount = Object.values(submitted).filter(Boolean).length;
  const totalCount = REQUIRED_DOCS.length;
  const pct = Math.round((doneCount / totalCount) * 100);

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="fixed top-0 inset-x-0 z-50 h-16 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-white text-xs font-bold">HA</span>
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              HAB Enterprises — Seller Document Portal
            </p>
            <p className="text-sidebar-foreground text-xs opacity-60">
              Healthy Auto Business Acquisition OS
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sidebar-foreground text-sm opacity-70">
            {dealUser.name || dealUser.email}
          </span>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-1.5 text-xs text-sidebar-foreground opacity-60 hover:opacity-100 transition-opacity"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </header>

      <main className="pt-24 pb-16 px-8 max-w-3xl mx-auto">
        {/* Welcome */}
        <div className="mb-8">
          <h2
            className="text-2xl font-bold mb-1"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Welcome{dealUser.name ? `, ${dealUser.name.split(" ")[0]}` : ""}
          </h2>
          <p className="text-muted-foreground text-sm">
            Please upload the required documents below to move the acquisition forward. Upload each file using the upload tool, then mark it as submitted.
          </p>
        </div>

        {/* Progress bar */}
        <div className="bg-card border border-card-border rounded-xl p-5 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Submission Progress
            </span>
            <span className="text-sm font-bold text-primary">{doneCount} / {totalCount}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {totalCount - doneCount > 0
              ? `${totalCount - doneCount} document${totalCount - doneCount !== 1 ? "s" : ""} still needed`
              : "All documents submitted — thank you!"}
          </p>
        </div>

        {/* Upload area */}
        <div className="mb-6">
          <AIDocumentUpload onReportSaved={() => {}} />
        </div>

        {/* Document checklist */}
        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <Upload className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Required Documents
            </h3>
            <span className="ml-auto text-xs text-muted-foreground">Mark submitted after uploading</span>
          </div>
          <div className="divide-y divide-border">
            {REQUIRED_DOCS.map((doc) => (
              <div key={doc.id} className="px-6 py-3.5 flex items-center gap-3">
                <button
                  onClick={() => toggle(doc.id)}
                  className={cn(
                    "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                    submitted[doc.id]
                      ? "bg-emerald-500 border-emerald-500"
                      : "border-border hover:border-primary"
                  )}
                >
                  {submitted[doc.id] && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                </button>
                <span
                  className={cn(
                    "flex-1 text-sm",
                    submitted[doc.id] ? "line-through text-muted-foreground" : "text-foreground"
                  )}
                >
                  {doc.label}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    priorityClass(doc.priority)
                  )}
                >
                  {priorityLabel(doc.priority)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Contact note */}
        <div className="mt-6 bg-primary/5 border border-primary/20 rounded-xl px-5 py-4 flex items-start gap-3">
          <Clock className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium mb-1">Have questions?</p>
            <p className="text-xs text-muted-foreground">
              Contact Heath Blake at HAB Enterprises 3 LLC. All documents are reviewed confidentially as part of the acquisition due diligence process. Target closing: July 16, 2026.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
