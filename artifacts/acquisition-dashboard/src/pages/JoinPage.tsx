import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth, SignIn } from "@clerk/react";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ValidateResult =
  | { state: "loading" }
  | { state: "invalid"; reason: "not_found" | "expired" | "error" }
  | { state: "valid"; email: string; name: string; role: string };

const ROLE_LABELS: Record<string, string> = {
  buyer:   "Buyer",
  agent:   "Advisor / Agent",
  seller:  "Seller",
  pending: "Pending",
};

export default function JoinPage() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const { isSignedIn, isLoaded } = useAuth();
  const [, navigate] = useLocation();
  const [result,   setResult]   = useState<ValidateResult>({ state: "loading" });
  const [consumed, setConsumed] = useState(false);
  const [consumeErr, setConsumeErr] = useState("");

  // Step 1: validate token
  useEffect(() => {
    if (!token) {
      setResult({ state: "invalid", reason: "not_found" });
      return;
    }
    fetch(`${BASE}/api/email/validate-invite?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (r.status === 404) { setResult({ state: "invalid", reason: "not_found" }); return; }
        if (r.status === 410) { setResult({ state: "invalid", reason: "expired" });   return; }
        if (!r.ok)            { setResult({ state: "invalid", reason: "error" });      return; }
        const data = await r.json() as { email: string; name: string; role: string };
        setResult({ state: "valid", ...data });
      })
      .catch(() => setResult({ state: "invalid", reason: "error" }));
  }, [token]);

  // Step 2: once signed in + token valid, consume it
  useEffect(() => {
    if (!isLoaded || !isSignedIn || result.state !== "valid" || consumed) return;
    fetch(`${BASE}/api/email/consume-invite`, {
      method:      "POST",
      credentials: "include",
      headers:     { "Content-Type": "application/json" },
      body:        JSON.stringify({ token }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({})) as { error?: string };
          setConsumeErr(body.error === "expired" ? "expired" : "error");
          return;
        }
        setConsumed(true);
        setTimeout(() => navigate("/"), 1500);
      })
      .catch(() => setConsumeErr("error"));
  }, [isLoaded, isSignedIn, result, consumed, token, navigate]);

  // ── Loading token validation ──────────────────────────────────────────────
  if (result.state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Invalid / expired ─────────────────────────────────────────────────────
  if (result.state === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="bg-card border border-border rounded-2xl shadow-lg max-w-sm w-full p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {result.reason === "expired" ? "Invite Link Expired" : "Invalid Invite Link"}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This invite link has expired or is invalid. Ask the person who invited you to send a new one.
          </p>
          <p className="text-xs text-muted-foreground/60 pt-2">HAB Enterprises 3 LLC · Acquisition Platform</p>
        </div>
      </div>
    );
  }

  // ── Token valid — but auth not yet loaded ─────────────────────────────────
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Token valid + signed in — consuming ───────────────────────────────────
  if (isSignedIn) {
    if (consumeErr === "expired") {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="bg-card border border-border rounded-2xl shadow-lg max-w-sm w-full p-8 text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
            <h2 className="text-xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Invite Already Used
            </h2>
            <p className="text-sm text-muted-foreground">
              This invite was already accepted or has expired. Ask for a new link.
            </p>
          </div>
        </div>
      );
    }
    if (consumeErr) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="bg-card border border-border rounded-2xl shadow-lg max-w-sm w-full p-8 text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Something went wrong</h2>
            <p className="text-sm text-muted-foreground">Could not activate your account. Please contact your admin.</p>
          </div>
        </div>
      );
    }
    if (consumed) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="bg-card border border-border rounded-2xl shadow-lg max-w-sm w-full p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Welcome to HAB Dashboard!
            </h2>
            <p className="text-sm text-muted-foreground">
              You've joined as <strong>{ROLE_LABELS[result.role] ?? result.role}</strong>. Redirecting…
            </p>
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
          </div>
        </div>
      );
    }
    // Still consuming
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="bg-card border border-border rounded-2xl shadow-lg max-w-sm w-full p-8 text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-sm font-medium">Activating your account…</p>
        </div>
      </div>
    );
  }

  // ── Token valid + NOT signed in — show sign-in prompt ─────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <span className="text-2xl font-bold text-primary">TB</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            You've been invited to HAB Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in or create an account to join as{" "}
            <strong>{ROLE_LABELS[result.role] ?? result.role}</strong>
          </p>
          <p className="text-xs text-muted-foreground/60">
            Invitation for: {result.name} ({result.email})
          </p>
        </div>
        <SignIn
          routing="hash"
          signUpUrl={`${BASE}/sign-up`}
          forceRedirectUrl={`${BASE}/join?token=${encodeURIComponent(token)}`}
        />
      </div>
    </div>
  );
}
