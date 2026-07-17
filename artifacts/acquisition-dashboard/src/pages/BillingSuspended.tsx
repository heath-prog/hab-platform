import { useState } from "react";
import { useClerk } from "@clerk/react";
import { AlertOctagon, LogOut, Send, CheckCircle2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function BillingSuspended() {
  const { signOut } = useClerk();
  const [message, setMessage]     = useState("");
  const [pending,  setPending]    = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error,    setError]      = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setPending(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/api/billing/appeal`, {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ message: message.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? "Request failed");
      }
      setSubmitted(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl">

        {/* Icon */}
        <div className="flex items-center justify-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-red-500/10 border-2 border-red-500/20 flex items-center justify-center">
            <AlertOctagon className="w-10 h-10 text-red-500" />
          </div>
        </div>

        {/* Copy */}
        <div className="text-center mb-10 space-y-4">
          <h1
            className="text-4xl font-black tracking-tight text-foreground"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Your Bill Needs to Be Paid.
          </h1>
          <p className="text-muted-foreground leading-relaxed text-base max-w-xl mx-auto">
            We don't care how you feel about it — your account has been suspended
            due to a past-due balance. Submit a payment appeal below. It will be
            reviewed by AI — yes, the same AI that has been watching your deals,
            tracking your documents, and making sure nothing slips through the
            cracks of your acquisition. Once payment is verified, your access is
            restored automatically. This tool is literally running your business.
            Let's keep it running.
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-border mb-10" />

        {/* Appeal form or success */}
        {submitted ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-8 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="font-semibold text-emerald-400 text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Appeal Submitted
            </p>
            <p className="text-sm text-muted-foreground">
              Your appeal has been submitted. We'll review it shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="appeal-msg"
                className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2"
              >
                Appeal Message
              </label>
              <textarea
                id="appeal-msg"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Explain your situation, confirm payment has been made, or request a review…"
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary resize-none"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending || !message.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {pending ? (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Submit Payment Appeal
            </button>
          </form>
        )}

        {/* Sign out */}
        <div className="mt-8 text-center">
          <button
            onClick={() => signOut()}
            className="inline-flex items-center gap-2 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground/40 mt-6">
          HAB Enterprises 3 LLC · Acquisition Platform
        </p>
      </div>
    </div>
  );
}
