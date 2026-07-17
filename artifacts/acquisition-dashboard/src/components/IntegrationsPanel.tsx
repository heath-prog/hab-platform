import { useState, useEffect, useCallback } from "react";
import {
  Settings2, Wifi, WifiOff, CheckCircle2, AlertTriangle,
  ExternalLink, RefreshCw, X, ChevronRight, Info, Mail,
  Eye, EyeOff, Shield, Database, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INTEGRATION_META, ALL_INTEGRATION_KEYS,
  type IntegrationKey, type ConfigStatus,
  getConfigStatuses, saveIntegrationUrl, testIntegrationUrl,
  refreshIntegrationConfigs,
} from "@/lib/integrationConfig";

// ─── Types ────────────────────────────────────────────────────────────────────

type ConnStatus = "untested" | "testing" | "ok" | "error";

// ─── Group ordering ───────────────────────────────────────────────────────────

const GROUP_ORDER = ["Documents", "Automation", "Financials", "Reporting", "Infrastructure"];

// ─── Single webhook row ───────────────────────────────────────────────────────

function WebhookRow({
  cfg,
  isBuyer,
  onSaved,
}: {
  cfg:      ConfigStatus;
  isBuyer:  boolean;
  onSaved:  () => void;
}) {
  const [url,    setUrl]    = useState(cfg.value);
  const [status, setStatus] = useState<ConnStatus>(cfg.isConfigured ? "untested" : "untested");
  const [msg,    setMsg]    = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty,  setDirty]  = useState(false);

  useEffect(() => { setUrl(cfg.value); setDirty(false); }, [cfg.value]);

  const handleSave = useCallback(async () => {
    if (!isBuyer) return;
    setSaving(true);
    setMsg("");
    const result = await saveIntegrationUrl(cfg.key, url);
    setSaving(false);
    if (result.ok) {
      setDirty(false);
      setStatus("untested");
      onSaved();
    } else {
      setMsg(result.error ?? "Save failed");
      setStatus("error");
    }
  }, [cfg.key, url, isBuyer, onSaved]);

  const handleTest = useCallback(async () => {
    if (!cfg.isConfigured && !url.trim()) {
      setMsg("Save a valid URL first.");
      setStatus("error");
      return;
    }
    setStatus("testing");
    setMsg("");
    const result = await testIntegrationUrl(cfg.key);
    if (result.ok) {
      setStatus("ok");
      setMsg(`Connected — HTTP ${result.status ?? 200}`);
    } else {
      setStatus("error");
      setMsg(result.error ?? "Connection failed");
    }
  }, [cfg.key, cfg.isConfigured, url]);

  const statusIcon = {
    untested: <Wifi      className="w-4 h-4 text-muted-foreground" />,
    testing:  <Loader2   className="w-4 h-4 text-blue-500 animate-spin" />,
    ok:       <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    error:    <AlertTriangle className="w-4 h-4 text-red-500" />,
  }[status];

  const isConfigured = cfg.isConfigured || url.trim().startsWith("http");

  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-3 transition-all",
      status === "ok"    ? "border-emerald-500/30 bg-emerald-500/[0.04]" :
      status === "error" ? "border-red-500/30 bg-red-500/[0.04]"         :
      isConfigured       ? "border-border bg-card"                        :
                           "border-dashed border-border/60 bg-muted/20"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          {statusIcon}
          <div className="min-w-0">
            <p className="text-sm font-bold truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {cfg.label}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{cfg.description}</p>
            <p className="text-[10px] font-mono text-muted-foreground/50 mt-1">{cfg.key}</p>
          </div>
        </div>
        <span className={cn(
          "text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5",
          isConfigured ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
        )}>
          {isConfigured ? "Configured" : "Not set"}
        </span>
      </div>

      {isBuyer ? (
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setDirty(true); setStatus("untested"); setMsg(""); }}
            placeholder="https://your-n8n-instance.com/webhook/..."
            className="flex-1 text-xs bg-background border border-border rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-0"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className={cn(
              "text-xs font-semibold px-3 py-2 rounded-lg border transition-colors flex-shrink-0 disabled:opacity-50",
              saving
                ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                : dirty
                  ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                  : "bg-primary/5 text-primary border-primary/20 hover:bg-primary/10"
            )}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={handleTest}
            disabled={status === "testing"}
            className="text-xs font-semibold px-3 py-2 rounded-lg border border-border bg-muted text-foreground/80 hover:bg-muted/80 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            Test
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
          <Shield className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Admin-only — contact your platform administrator to update this integration.</span>
        </div>
      )}

      {msg && (
        <p className={cn(
          "text-xs font-medium flex items-center gap-1.5",
          status === "ok" ? "text-emerald-600" : "text-red-500"
        )}>
          {status === "ok"
            ? <CheckCircle2 className="w-3.5 h-3.5" />
            : <AlertTriangle className="w-3.5 h-3.5" />}
          {msg}
        </p>
      )}
    </div>
  );
}

// ─── Email config section ────────────────────────────────────────────────────

function EmailConfigSection() {
  const [show, setShow] = useState(false);
  return (
    <div className="rounded-xl border border-dashed border-blue-500/30 bg-blue-500/[0.04] p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <Mail className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Email Sending (Gmail)
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Required for sending LOI PDFs directly to the seller. Uses a Gmail App Password — your main password is never stored.
          </p>
        </div>
      </div>
      <button
        onClick={() => setShow(!show)}
        className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
      >
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        {show ? "Hide setup instructions" : "Show setup instructions"}
      </button>
      {show && (
        <div className="bg-background border border-border rounded-lg p-4 space-y-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">How to set up Gmail sending:</p>
          <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
            <li>Go to <strong>myaccount.google.com → Security → 2-Step Verification</strong> (must be enabled)</li>
            <li>Under "App passwords", create a new app password for "Mail"</li>
            <li>Copy the 16-character password</li>
            <li>In this project, set two environment secrets:
              <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5">
                <li><code className="bg-muted px-1 rounded">GMAIL_USER</code> → your Gmail address</li>
                <li><code className="bg-muted px-1 rounded">GMAIL_APP_PASSWORD</code> → the 16-character app password</li>
              </ul>
            </li>
            <li>Restart the API server — email sending will be active</li>
          </ol>
          <div className="flex items-start gap-2 mt-2 p-2.5 bg-amber-500/8 border border-amber-500/20 rounded-lg">
            <Info className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p>Until configured, the app falls back to opening your email client with the LOI for manual sending.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── n8n guide ────────────────────────────────────────────────────────────────

function N8nGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <img
            src="https://n8n.io/favicon.ico"
            className="w-4 h-4"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <span className="text-sm font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            n8n Workflow Setup Guide
          </span>
        </div>
        <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="mt-4 space-y-3 text-xs text-muted-foreground">
          <p className="text-foreground font-semibold">Eight webhook integration points power this platform:</p>
          <div className="grid gap-2">
            {ALL_INTEGRATION_KEYS.map((key) => {
              const meta = INTEGRATION_META[key];
              return (
                <div key={key} className="flex gap-2.5 p-2.5 bg-muted/40 rounded-lg">
                  <ChevronRight className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground">{meta.label}</p>
                    <p className="mt-0.5">{meta.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <a
              href="https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/"
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> n8n Webhook docs
            </a>
            <span className="text-border">·</span>
            <a
              href="https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.googleDrive/"
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> Google Drive node
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Config status bar ────────────────────────────────────────────────────────

function ConfigStatusBar({ statuses }: { statuses: ConfigStatus[] }) {
  const configured = statuses.filter((s) => s.isConfigured).length;
  const total      = statuses.length;
  const pct        = Math.round((configured / total) * 100);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Integration Coverage
          </span>
        </div>
        <span className={cn(
          "text-xs font-bold",
          pct === 100 ? "text-emerald-500" : pct > 50 ? "text-amber-500" : "text-red-500"
        )}>
          {configured}/{total} configured
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            pct === 100 ? "bg-emerald-500" : pct > 50 ? "bg-amber-500" : "bg-red-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {statuses.map((s) => (
          <span
            key={s.key}
            className={cn(
              "text-[10px] font-medium px-2 py-0.5 rounded-full border",
              s.isConfigured
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                : "bg-muted text-muted-foreground border-border"
            )}
          >
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function IntegrationsPanel({
  onClose,
  isBuyer = false,
}: {
  onClose?:  () => void;
  isBuyer?:  boolean;
}) {
  const [statuses,  setStatuses]  = useState<ConfigStatus[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    await refreshIntegrationConfigs();
    setStatuses(getConfigStatuses());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshIntegrationConfigs();
    setStatuses(getConfigStatuses());
    setRefreshing(false);
  }, []);

  const handleSaved = useCallback(() => {
    setStatuses(getConfigStatuses());
  }, []);

  // Group keys by group
  const groups: Record<string, ConfigStatus[]> = {};
  for (const s of statuses) {
    if (!groups[s.group]) groups[s.group] = [];
    groups[s.group].push(s);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Settings2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Integrations &amp; Webhooks
              </h3>
              <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <Shield className="w-2.5 h-2.5" /> Admin Only
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {isBuyer
                ? "Webhook URLs are stored securely in the database. Changes apply platform-wide immediately."
                : "These settings are managed by your platform administrator."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Refresh from database"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          </button>
          {onClose && (
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Loading integration config from database…</p>
          </div>
        </div>
      ) : (
        <>
          {/* Status bar */}
          {statuses.length > 0 && <ConfigStatusBar statuses={statuses} />}

          {/* Grouped webhook rows */}
          {GROUP_ORDER.filter((g) => groups[g]).map((group) => (
            <div key={group} className="space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {group}
              </p>
              {groups[group].map((cfg) => (
                <WebhookRow
                  key={cfg.key}
                  cfg={cfg}
                  isBuyer={isBuyer}
                  onSaved={handleSaved}
                />
              ))}
            </div>
          ))}

          {/* Email config */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email</p>
            <EmailConfigSection />
          </div>

          {/* n8n guide */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Documentation</p>
            <N8nGuide />
          </div>
        </>
      )}
    </div>
  );
}
