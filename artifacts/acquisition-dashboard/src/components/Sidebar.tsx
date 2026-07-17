import { Link, useLocation } from "wouter";
import { useClerk, useAuth } from "@clerk/react";
import { apiFetch } from "@/lib/apiFetch";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, FileText, Phone, TrendingUp, Home,
  Shield, AlertTriangle, CheckSquare, Calendar, ChevronRight,
  LogOut, Users, BarChart3, ArrowLeft, Layers, Activity, Settings2,
  Inbox, AlertOctagon, Building2, UserPlus, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboard } from "@/lib/context";
import { isSectionVisible, type DealUser, type SectionKey, type UserRole } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { type Business, STAGE_LABELS, STAGE_COLORS } from "@/lib/storage";
import IntegrationsPanel from "./IntegrationsPanel";

// ─── Business-level nav items ─────────────────────────────────────────────────

type NavItem = {
  segment: string;
  label: string;
  icon: React.ElementType;
  sectionKey: SectionKey;
};

const BUSINESS_NAV: NavItem[] = [
  { segment: "",               label: "Overview",              icon: LayoutDashboard, sectionKey: "overview"   },
  { segment: "documents",      label: "Documents",             icon: FileText,        sectionKey: "documents"  },
  { segment: "contacts",       label: "Call Tracker",          icon: Phone,           sectionKey: "calls"      },
  { segment: "financials",     label: "Financials",            icon: TrendingUp,      sectionKey: "financials" },
  { segment: "finance",        label: "Financial Management",  icon: Activity,        sectionKey: "financials" },
  { segment: "lease",          label: "Lease",                 icon: Home,            sectionKey: "lease"      },
  { segment: "license",        label: "License & Compliance",  icon: Shield,          sectionKey: "license"    },
  { segment: "risks",          label: "Risk Tracker",          icon: AlertTriangle,   sectionKey: "risk"       },
  { segment: "day1",           label: "Day 1 Takeover",        icon: CheckSquare,     sectionKey: "day1"       },
  { segment: "plan",           label: "30-Day Plan",           icon: Calendar,        sectionKey: "plan"       },
  { segment: "reports",        label: "Reports",               icon: BarChart3,       sectionKey: "financials" },
];

const OPERATIONS_NAV: NavItem[] = [
  { segment: "invoice-inbox",  label: "Invoice Inbox",         icon: Inbox,           sectionKey: "inbox"      },
  { segment: "review-queue",   label: "You Need To Check This",icon: AlertOctagon,    sectionKey: "review"     },
];

// ─── Sidebar inner — needs DashboardProvider as ancestor ─────────────────────

function BusinessSidebarInner({
  businessId,
  business,
  dealUser,
}: {
  businessId: string;
  business?: Business;
  dealUser: DealUser | null;
}) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const { state } = useDashboard();
  const { toast } = useToast();
  const bPath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [reviewCount,      setReviewCount]      = useState(0);
  const [showInvite,       setShowInvite]        = useState(false);
  const [inviteName,       setInviteName]        = useState("");
  const [inviteEmail,      setInviteEmail]       = useState("");
  const [inviteRole,       setInviteRole]        = useState<UserRole>("buyer");
  const [invitePending,    setInvitePending]     = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvitePending(true);
    try {
      const resp = await apiFetch(`${bPath}/api/email/send-invite`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          email:     inviteEmail,
          name:      inviteName,
          role:      inviteRole,
          invitedBy: dealUser?.name ?? "Your team",
        }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Request failed (${resp.status})`);
      }
      toast({ title: `Invite sent to ${inviteEmail} — link expires in 1 hour` });
      setShowInvite(false);
      setInviteName(""); setInviteEmail(""); setInviteRole("buyer");
    } catch (err) {
      toast({ title: "Failed to send invite", description: String(err), variant: "destructive" });
    } finally {
      setInvitePending(false);
    }
  };

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const token = await getToken();
        const r = await fetch(
          `${bPath}/api/review-queue/count?businessId=${businessId}`,
          { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        const d = await r.json() as { count: number };
        setReviewCount(d.count ?? 0);
      } catch { /* silent */ }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, [businessId, getToken]);

  const completedProgress = state.progress.filter((p) => p.checked).length;
  const totalProgress     = state.progress.length;
  const overallPct        = Math.round((completedProgress / totalProgress) * 100);

  const entityItems = state.entitySetupItems ?? [];
  const entityDone  = entityItems.filter((i) => i.checked).length;
  const entityTotal = entityItems.length;

  const isBuyer   = dealUser?.role === "buyer" || dealUser?.role === "super_admin";
  const baseHref  = `/b/${businessId}`;

  const stageColors = business ? STAGE_COLORS[business.stage] : null;

  // Gate on resolved auth: until dealUser is loaded, render NO role-gated nav.
  // Defaulting to "show everything" flashed the full sidebar for a moment
  // before permissions kicked in.
  const visibleNav = dealUser
    ? BUSINESS_NAV.filter((item) => isSectionVisible(dealUser, item.sectionKey))
    : [];
  // Operations features are always visible to buyers; for other roles, respect permissions.
  const visibleOpsNav = dealUser
    ? OPERATIONS_NAV.filter((item) => isBuyer || isSectionVisible(dealUser, item.sectionKey))
    : [];

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-sidebar flex flex-col border-r border-sidebar-border z-50">
      {/* Portfolio back link */}
      <Link
        href="/"
        className="flex items-center gap-2 px-4 py-3 border-b border-sidebar-border/50 text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors text-xs font-medium"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <Layers className="w-3 h-3" />
        Portfolio
      </Link>

      {/* Business brand */}
      <div className="px-5 py-4 border-b border-sidebar-border">
        <div className="flex items-start gap-2.5 mb-3">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5",
            stageColors ? `${stageColors.bg} ${stageColors.text}` : "bg-primary/20 text-primary"
          )}>
            {(business?.name ?? "TB").split(" ").slice(0, 2).map((w) => w[0]).join("")}
          </div>
          <div className="flex-1 min-w-0">
            <h1
              className="text-white font-bold text-sm leading-tight truncate"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {business?.name ?? "Business"}
            </h1>
            {business && (
              <span className={cn(
                "inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold mt-1",
                stageColors?.bg, stageColors?.text
              )}>
                {STAGE_LABELS[business.stage]}
              </span>
            )}
          </div>
        </div>

        {/* Progress */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-sidebar-foreground text-[11px] opacity-50">Deal Progress</span>
            <span className="text-white text-[11px] font-semibold">{overallPct}%</span>
          </div>
          <div className="h-1.5 bg-sidebar-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Business nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {visibleNav.map(({ segment, label, icon: Icon }) => {
          const href   = segment ? `${baseHref}/${segment}` : baseHref;
          const active = location === href || (segment === "" && location === baseHref);
          return (
            <Link
              key={segment}
              href={href}
              data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
                active
                  ? "bg-sidebar-accent text-white"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0 opacity-70 group-hover:opacity-100" />
              <span className="flex-1 truncate">{label}</span>
              {active && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
            </Link>
          );
        })}

        {/* Entity Setup — Pre-Close Setup section, always visible */}
        <>
          <div className="my-2 border-t border-sidebar-border opacity-20" />
          <p className="px-3 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40">
            Pre-Close Setup
          </p>
          <Link
            href={`${baseHref}/entity-setup`}
            data-testid="nav-entity-setup"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
              location === `${baseHref}/entity-setup`
                ? "bg-sidebar-accent text-white"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
            )}
          >
            <Building2 className="w-4 h-4 flex-shrink-0 opacity-70 group-hover:opacity-100" />
            <span className="flex-1 truncate text-xs">New Entity Setup</span>
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0",
              entityDone === entityTotal && entityTotal > 0
                ? "bg-emerald-500/90 text-white"
                : "bg-sidebar-border text-sidebar-foreground/60"
            )}>
              {entityDone === entityTotal && entityTotal > 0 ? "✓" : `${entityDone}/${entityTotal}`}
            </span>
          </Link>
        </>

        {/* Operations section */}
        {visibleOpsNav.length > 0 && (
          <>
            <div className="my-2 border-t border-sidebar-border opacity-20" />
            <p className="px-3 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40">
              Operations
            </p>
            {visibleOpsNav.map(({ segment, label, icon: Icon }) => {
              const href      = `${baseHref}/${segment}`;
              const active    = location === href;
              const isReview  = segment === "review-queue";
              return (
                <Link
                  key={segment}
                  href={href}
                  data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
                    active
                      ? "bg-sidebar-accent text-white"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0 opacity-70 group-hover:opacity-100" />
                  <span className="flex-1 truncate text-xs">{label}</span>
                  {isReview && reviewCount > 0 && (
                    <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none flex-shrink-0">
                      {reviewCount > 99 ? "99+" : reviewCount}
                    </span>
                  )}
                  {active && <ChevronRight className="w-3.5 h-3.5 opacity-50 flex-shrink-0" />}
                </Link>
              );
            })}
          </>
        )}

        {/* Admin console — buyer only */}
        {isBuyer && (
          <>
            <div className="my-2 border-t border-sidebar-border opacity-30" />
            <Link
              href="/admin"
              data-testid="nav-admin-console"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
                location === "/admin"
                  ? "bg-sidebar-accent text-white"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
              )}
            >
              <Users className="w-4 h-4 flex-shrink-0 opacity-70 group-hover:opacity-100" />
              <span className="flex-1">Admin Console</span>
              {location === "/admin" && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
            </Link>
          </>
        )}
      </nav>

      {/* Integrations / Settings */}
      <div className="px-3 py-2 border-t border-sidebar-border/40">
        <button
          onClick={() => setShowIntegrations(true)}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/30 transition-colors text-xs"
        >
          <Settings2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Integrations &amp; Webhooks</span>
        </button>
      </div>

      {/* User footer */}
      <div className="px-5 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
            {((dealUser?.name || dealUser?.email) ?? "H").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sidebar-foreground text-xs font-medium truncate">
              {dealUser?.name || dealUser?.email || "Heath Blake"}
            </p>
            <p className="text-sidebar-foreground text-xs opacity-50 capitalize">
              {dealUser?.role ?? "buyer"}
            </p>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            title="Add team member"
            className="text-sidebar-foreground opacity-40 hover:opacity-100 transition-opacity"
          >
            <UserPlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => signOut()}
            title="Sign out"
            className="text-sidebar-foreground opacity-40 hover:opacity-100 transition-opacity"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Add Team Member
              </h3>
              <button
                onClick={() => setShowInvite(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Name</label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  placeholder="Full name"
                  className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as UserRole)}
                  className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary"
                >
                  <option value="buyer">Buyer</option>
                  <option value="agent">Advisor / Agent</option>
                  <option value="seller">Seller</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={invitePending}
                className="w-full bg-primary text-primary-foreground text-sm font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {invitePending ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                Add Team Member
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Integrations overlay */}
      {showIntegrations && (
        <div className="fixed inset-0 z-[80] flex items-center justify-end bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg h-full bg-card border-l border-border shadow-2xl overflow-y-auto p-6">
            <IntegrationsPanel onClose={() => setShowIntegrations(false)} isBuyer={isBuyer} />
          </div>
        </div>
      )}
    </aside>
  );
}

// ─── Public export — must be rendered inside DashboardProvider ───────────────

export function Sidebar({
  businessId,
  business,
  dealUser,
}: {
  businessId: string;
  business?: Business;
  dealUser: DealUser | null;
}) {
  return (
    <BusinessSidebarInner
      businessId={businessId}
      business={business}
      dealUser={dealUser}
    />
  );
}
