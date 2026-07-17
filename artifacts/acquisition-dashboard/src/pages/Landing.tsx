import { useLocation } from "wouter";
import { Shield, FileText, TrendingUp, Users, ArrowRight, Lock, Building2, BarChart3, Zap } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "AI Document Processing",
    desc: "OpenAI Vision extracts, classifies, and confidence-scores every document — invoices, financials, and legal docs processed automatically.",
  },
  {
    icon: TrendingUp,
    title: "Financial Dashboard",
    desc: "CFO-grade P&L, EBITDA, and cash flow reporting with trend analysis and target benchmarking across your entire portfolio.",
  },
  {
    icon: Shield,
    title: "Due Diligence Tracking",
    desc: "End-to-end checklists covering licenses, lease review, entity setup, compliance, and risk assessment — per deal.",
  },
  {
    icon: Building2,
    title: "Portfolio Management",
    desc: "Track multiple acquisitions simultaneously from lead through close and into operations — one OS for every deal.",
  },
  {
    icon: BarChart3,
    title: "Review Queue",
    desc: "Low-confidence documents flagged for human review with a split-panel viewer, annotation tools, and one-click filing.",
  },
  {
    icon: Users,
    title: "Multi-Party Access",
    desc: "Role-based access for buyers, sellers, attorneys, agents, and CPAs with granular per-section permission controls.",
  },
];

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-8 py-5 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-white text-sm font-bold">HA</span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground tracking-wider uppercase font-medium">Portfolio OS</p>
            <h1 className="text-sm font-bold leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              HAB Enterprises
            </h1>
          </div>
        </div>
        <button
          onClick={() => setLocation("/sign-in")}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Sign In
          <ArrowRight className="w-4 h-4" />
        </button>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
          <Lock className="w-3 h-3" />
          Private — Authorized access only
        </div>

        <h2
          className="text-5xl font-bold tracking-tight mb-4 max-w-3xl leading-tight"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Healthy Auto Business
          <span className="block text-primary">Acquisition OS</span>
        </h2>

        <p className="text-muted-foreground text-lg max-w-xl mb-3">
          A private operating system for managing automotive business acquisitions — from first lead through close and into day-to-day operations.
        </p>
        <p className="text-muted-foreground text-sm mb-10">
          Operated by <span className="font-medium text-foreground">Heath Blake / HAB Enterprises</span>
          &nbsp;·&nbsp;
          AI-powered due diligence, document processing, and deal tracking
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/sign-in")}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity text-sm"
          >
            Sign in with Google or Apple
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLocation("/sign-up")}
            className="px-6 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Create account
          </button>
        </div>
      </section>

      {/* Features */}
      <section className="px-8 pb-16 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="bg-card border border-card-border rounded-xl p-5 shadow-sm"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Icon className="w-4.5 h-4.5 text-primary" />
              </div>
              <h3 className="font-semibold text-sm mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-8 py-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          HAB Enterprises · Confidential
        </p>
        <p className="text-xs text-muted-foreground">
          Healthy Auto Business Portfolio OS
        </p>
      </footer>
    </div>
  );
}
