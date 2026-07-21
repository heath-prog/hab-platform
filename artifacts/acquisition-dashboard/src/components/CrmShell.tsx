import { Link, useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { Layers, Users, Briefcase, LogOut, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentDealUser } from "@/lib/auth";

// ─── CRM layout shell (WP-CRM-UI) ────────────────────────────────────────────
// Portfolio-level sidebar (mirrors PortfolioHome's) around the /crm pages.
// Gating is fail-closed, same as Sidebar.tsx: until the deal user has resolved
// we render a loading screen (never ungated content); non-buyer roles are
// redirected home.

function NavItem({ href, icon: Icon, label, active }: {
  href: string; icon: React.ElementType; label: string; active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
        active
          ? "bg-sidebar-accent text-white"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0 opacity-70 group-hover:opacity-100" />
      <span className="flex-1">{label}</span>
      {active && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
    </Link>
  );
}

export default function CrmShell({ children }: { children: React.ReactNode }) {
  const { data: dealUser, isLoading } = useCurrentDealUser();
  const { signOut } = useClerk();
  const [, navigate] = useLocation();

  const isBuyer = dealUser?.role === "buyer" || dealUser?.role === "super_admin";

  // Fail closed: no CRM content until the role is known.
  if (isLoading || !dealUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white text-sm font-bold">HA</span>
          </div>
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isBuyer) {
    navigate("/");
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-sidebar flex flex-col border-r border-sidebar-border z-50">
        <div className="px-6 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sidebar-foreground text-[10px] font-semibold tracking-wider uppercase opacity-50">
                Portfolio
              </p>
              <h1
                className="text-white font-bold text-sm leading-tight"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                HAB Enterprises
              </h1>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <NavItem href="/" icon={Layers} label="Portfolio Home" />
          <NavItem href="/crm" icon={Briefcase} label="CRM" active />
          <NavItem href="/admin" icon={Users} label="Admin Console" />
        </nav>

        <div className="px-5 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
              {((dealUser.name || dealUser.email) ?? "H").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sidebar-foreground text-xs font-medium truncate">
                {dealUser.name || dealUser.email || "Heath Blake"}
              </p>
              <p className="text-sidebar-foreground text-xs opacity-50 capitalize">{dealUser.role}</p>
            </div>
            <button
              onClick={() => signOut()}
              title="Sign out"
              className="text-sidebar-foreground opacity-40 hover:opacity-100 transition-opacity"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-64 p-8 max-w-6xl">{children}</main>
    </div>
  );
}
