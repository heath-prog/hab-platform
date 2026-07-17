import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Users, Shield, AlertTriangle, CheckCircle2,
  Loader2, Ban, RotateCcw, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentDealUser } from "@/lib/auth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type BillingStatus = "active" | "past_due" | "suspended";

type AdminUser = {
  clerk_user_id:        string;
  name:                 string | null;
  email:                string;
  role:                 string;
  billing_status:       BillingStatus;
  billing_suspended_at: string | null;
  created_at:           string;
};

type Appeal = {
  id:           number;
  clerk_id:     string;
  user_name:    string | null;
  user_email:   string | null;
  message:      string;
  status:       "pending" | "approved" | "denied";
  reviewed_by:  string | null;
  reviewed_at:  string | null;
  created_at:   string;
};

function billingBadge(status: BillingStatus) {
  if (status === "active")   return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (status === "past_due") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  return "bg-red-500/10 text-red-400 border-red-500/20";
}

function roleBadge(role: string) {
  if (role === "super_admin") return "bg-purple-500/10 text-purple-400 border-purple-500/20";
  if (role === "buyer")       return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  if (role === "agent")       return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
  if (role === "seller")      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  return "bg-muted text-muted-foreground border-border";
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users,   setUsers]   = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/admin/users`, { credentials: "include" });
      if (r.ok) setUsers(await r.json() as AdminUser[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const suspend = async (clerkId: string) => {
    if (!confirm("Suspend this user's access?")) return;
    setActing(clerkId);
    await fetch(`${BASE}/api/admin/users/${clerkId}/suspend`, { method: "POST", credentials: "include" });
    setActing(null);
    void reload();
  };

  const restore = async (clerkId: string) => {
    setActing(clerkId);
    await fetch(`${BASE}/api/admin/users/${clerkId}/restore`, { method: "POST", credentials: "include" });
    setActing(null);
    void reload();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/40 border-b border-border">
            <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Role</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Billing</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Joined</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map((u) => {
            const isBusy = acting === u.clerk_user_id;
            return (
              <tr key={u.clerk_user_id} className="bg-card hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3.5">
                  <p className="font-medium truncate max-w-[180px]">{u.name || "—"}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[180px]">{u.email}</p>
                </td>
                <td className="px-4 py-3.5 hidden md:table-cell">
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border capitalize", roleBadge(u.role))}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border capitalize", billingBadge(u.billing_status))}>
                    {u.billing_status.replace("_", " ")}
                  </span>
                  {u.billing_suspended_at && (
                    <p className="text-xs text-muted-foreground/60 mt-0.5">Since {fmtDate(u.billing_suspended_at)}</p>
                  )}
                </td>
                <td className="px-4 py-3.5 hidden lg:table-cell">
                  <p className="text-xs text-muted-foreground">{fmtDate(u.created_at)}</p>
                </td>
                <td className="px-4 py-3.5 text-right">
                  {u.billing_status === "suspended" ? (
                    <button
                      onClick={() => restore(u.clerk_user_id)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                    >
                      {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                      Restore
                    </button>
                  ) : u.role !== "super_admin" ? (
                    <button
                      onClick={() => suspend(u.clerk_user_id)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                      Suspend
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
          {users.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center py-12 text-muted-foreground text-sm">
                <Users className="w-8 h-8 mx-auto mb-3 opacity-20" />
                No users found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Appeals Tab ──────────────────────────────────────────────────────────────

function AppealsTab() {
  const [appeals,  setAppeals]  = useState<Appeal[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/admin/appeals`, { credentials: "include" });
      if (r.ok) setAppeals(await r.json() as Appeal[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const approve = async (id: number) => {
    setActing(id);
    await fetch(`${BASE}/api/admin/appeals/${id}/approve`, { method: "POST", credentials: "include" });
    setActing(null);
    void reload();
  };

  const pending  = appeals.filter((a) => a.status === "pending");
  const resolved = appeals.filter((a) => a.status !== "pending");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (appeals.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p className="text-sm">No payment appeals yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending */}
      {pending.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" /> Pending Review ({pending.length})
          </h3>
          <div className="space-y-3">
            {pending.map((a) => (
              <div key={a.id} className="bg-card border border-amber-500/20 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-semibold text-sm">{a.user_name || "Unknown User"}</p>
                    <p className="text-xs text-muted-foreground">{a.user_email || a.clerk_id}</p>
                    <p className="text-xs text-muted-foreground mt-2">Submitted {fmtDate(a.created_at)}</p>
                    <blockquote className="mt-3 border-l-2 border-amber-500/40 pl-3 text-sm text-muted-foreground italic leading-relaxed">
                      {a.message}
                    </blockquote>
                  </div>
                  <button
                    onClick={() => approve(a.id)}
                    disabled={acting === a.id}
                    className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-500 text-white hover:bg-emerald-400 transition-colors disabled:opacity-50"
                  >
                    {acting === a.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <CheckCircle2 className="w-4 h-4" />}
                    Approve &amp; Restore Access
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolved */}
      {resolved.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Resolved ({resolved.length})
          </h3>
          <div className="space-y-2">
            {resolved.map((a) => (
              <div key={a.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 opacity-60">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{a.user_name || a.user_email}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(a.created_at)}</p>
                </div>
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full border capitalize",
                  a.status === "approved"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-red-500/10 text-red-400 border-red-500/20"
                )}>
                  {a.status}
                </span>
                {a.reviewed_at && (
                  <p className="text-xs text-muted-foreground hidden md:block">{fmtDate(a.reviewed_at)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = "users" | "appeals";

export default function AdminConsole() {
  const [, navigate]         = useLocation();
  const { data: dealUser }   = useCurrentDealUser();
  const [activeTab, setTab]  = useState<Tab>("users");

  // Guard: only super_admin can view this page
  if (dealUser && dealUser.role !== "super_admin") {
    navigate("/");
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
          <Shield className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Super Admin Console
          </h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            User management, billing enforcement, and payment appeals
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          { id: "users",   label: "Users",           icon: Users },
          { id: "appeals", label: "Payment Appeals",  icon: FileText },
        ] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "users"   && <UsersTab />}
      {activeTab === "appeals" && <AppealsTab />}
    </div>
  );
}
