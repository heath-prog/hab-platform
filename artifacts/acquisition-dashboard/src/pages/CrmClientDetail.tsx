import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Loader2, AlertTriangle, RefreshCw, Plus, Trash2,
  GraduationCap, CalendarDays, Flag, CheckCircle2, ShieldCheck,
  ClipboardCheck, Activity as ActivityIcon, Users, BarChart3, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import CrmShell from "@/components/CrmShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type CrmAdvisor, type CrmClientDetail as ClientDetail, type CrmModuleState, type CrmTenant,
  CALENDAR_COLORS, RESERVED_CALENDAR_COLOR_IDS,
  complianceStatus, cycleLabel, kpiStatus, moduleKey, stageLabel, weekTheme,
  useAddActivity, useAddAdvisor, useAddContact, useAddKpiSnapshot, useAddOnboardingTask,
  useCrmClient, useCrmTenant, useDeleteAdvisor, useDeleteContact, useDeleteKpiSnapshot,
  useGenerateOnboarding, useMoveClientStage, useToggleOnboardingTask, useUpdateAdvisor,
  useUpdateClient,
} from "@/lib/crm";

// ─── Client detail page (WP-CRM-UI) ──────────────────────────────────────────
// GET /api/crm/clients/:id (client + contacts + advisors + KPI snapshots +
// compliance + onboarding tasks + activity + derived curriculum week), with
// tenant config from GET /api/crm/tenants/:tid.

const HAB_GOLD = "#C8A75C";

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtTs(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const inputCls =
  "text-sm bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-primary w-full";
const btnPrimary =
  "flex items-center gap-1.5 px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60";
const cardCls = "rounded-xl border border-border bg-card p-5";

function useErrToast() {
  const { toast } = useToast();
  return (title: string, err: unknown) =>
    toast({ title, description: (err as Error).message, variant: "destructive" });
}

// ─── Overview tab ────────────────────────────────────────────────────────────

function OverviewTab({ client, tenant }: { client: ClientDetail; tenant: CrmTenant | undefined }) {
  const { toast } = useToast();
  const errToast = useErrToast();
  const update = useUpdateClient();

  // Details form
  const [name, setName]       = useState(client.name);
  const [emails, setEmails]   = useState(client.emails.join(", "));
  const [phone, setPhone]     = useState(client.phone ?? "");
  const [address, setAddress] = useState(client.address ?? "");
  const [notes, setNotes]     = useState(client.notes ?? "");
  // Curriculum form
  const [startDate, setStartDate] = useState(client.startDate?.slice(0, 10) ?? "");
  const [weekOverride, setWeekOverride] = useState(client.weekOverride?.toString() ?? "");
  // Flags
  const [newFlag, setNewFlag] = useState("");

  useEffect(() => {
    setName(client.name);
    setEmails(client.emails.join(", "));
    setPhone(client.phone ?? "");
    setAddress(client.address ?? "");
    setNotes(client.notes ?? "");
    setStartDate(client.startDate?.slice(0, 10) ?? "");
    setWeekOverride(client.weekOverride?.toString() ?? "");
  }, [client.id, client.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = async (p: Parameters<typeof update.mutateAsync>[0]["patch"], okMsg: string) => {
    try {
      await update.mutateAsync({ clientId: client.id, patch: p });
      toast({ title: okMsg });
    } catch (err) {
      errToast("Update failed", err);
    }
  };

  const saveDetails = (e: React.FormEvent) => {
    e.preventDefault();
    void patch(
      {
        name: name.trim() || client.name,
        emails: emails.split(",").map((s) => s.trim()).filter(Boolean),
        phone, address, notes,
      },
      "Details saved",
    );
  };

  const saveCurriculum = (e: React.FormEvent) => {
    e.preventDefault();
    const wo = weekOverride.trim() === "" ? null : Number(weekOverride);
    if (wo != null && (!Number.isInteger(wo) || wo < 1 || wo > 52)) {
      toast({ title: "Week override must be 1–52 (or blank)", variant: "destructive" });
      return;
    }
    void patch({ startDate: startDate || null, weekOverride: wo }, "Curriculum settings saved");
  };

  const toggleFlag = (flag: string) => {
    const has = client.flags.includes(flag);
    void patch(
      { flags: has ? client.flags.filter((f) => f !== flag) : [...client.flags, flag] },
      has ? `Flag removed: ${flag}` : `Flag added: ${flag}`,
    );
  };

  const addFlag = (e: React.FormEvent) => {
    e.preventDefault();
    const f = newFlag.trim();
    if (!f || client.flags.includes(f)) return;
    setNewFlag("");
    void patch({ flags: [...client.flags, f] }, `Flag added: ${f}`);
  };

  const setColor = (id: number | null) => {
    void patch({ calendarColorId: id }, id == null ? "Calendar color cleared" : `Calendar color → ${CALENDAR_COLORS[id].name}`);
  };

  const toggleDoc = (docId: string) => {
    const delivered = client.docsDelivered[docId] != null;
    void patch(
      { docsDelivered: { ...client.docsDelivered, [docId]: delivered ? null : todayIso() } },
      delivered ? "Marked not delivered" : "Marked delivered",
    );
  };

  const theme = weekTheme(tenant, client.curriculumWeek);

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      {/* Curriculum */}
      {tenant?.features?.curriculum && (
        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="w-4 h-4" style={{ color: HAB_GOLD }} />
            <h3 className="text-sm font-bold">Curriculum</h3>
          </div>
          <div className="flex items-baseline gap-3 mb-1">
            <span className="text-3xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {client.curriculumWeek != null ? `Week ${client.curriculumWeek}` : "Not started"}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {cycleLabel(client.curriculumCycle)}
            </span>
          </div>
          {theme && <p className="text-sm text-muted-foreground mb-4">{theme}</p>}
          {!theme && <div className="mb-4" />}
          <form onSubmit={saveCurriculum} className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Program start (Monday)</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Week override</label>
              <div className="flex gap-2">
                <input
                  type="number" min={1} max={52} placeholder="auto"
                  value={weekOverride} onChange={(e) => setWeekOverride(e.target.value)}
                  className={inputCls}
                />
                <button type="submit" disabled={update.isPending} className={btnPrimary}>Save</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Calendar color + slots */}
      {tenant?.features?.calendar && (
        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-4 h-4" style={{ color: HAB_GOLD }} />
            <h3 className="text-sm font-bold">Calendar</h3>
            {client.calendarColorId != null && CALENDAR_COLORS[client.calendarColorId] && (
              <span className="text-xs text-muted-foreground ml-auto">
                {CALENDAR_COLORS[client.calendarColorId].name} ({client.calendarColorId})
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {Object.entries(CALENDAR_COLORS).map(([idStr, c]) => {
              const id = Number(idStr);
              const reserved = RESERVED_CALENDAR_COLOR_IDS.has(id);
              const activeColor = client.calendarColorId === id;
              return (
                <button
                  key={id}
                  disabled={reserved}
                  onClick={() => setColor(activeColor ? null : id)}
                  title={reserved ? `${c.name} — reserved (9 Blueberry = 1:1s, 7 Peacock = legacy cohort)` : c.name}
                  className={cn(
                    "w-7 h-7 rounded-full transition-transform",
                    activeColor && "ring-2 ring-offset-2 ring-offset-card ring-primary scale-110",
                    reserved ? "opacity-25 cursor-not-allowed" : "hover:scale-110",
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mb-4">
            Google Calendar palette — 9 Blueberry and 7 Peacock are reserved. Click again to clear.
          </p>
          <p className="text-xs font-semibold mb-1.5">Weekly session slots</p>
          {client.slots.length === 0 ? (
            <p className="text-xs text-amber-400">No session slots booked yet.</p>
          ) : (
            <ul className="space-y-1">
              {client.slots.map((s, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{s.label ?? `Session ${i + 1}`}</span>
                  {" — "}{s.day ?? "?"} {s.time || <span className="text-amber-400">time TBD</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Details */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4" style={{ color: HAB_GOLD }} />
          <h3 className="text-sm font-bold">Details</h3>
        </div>
        <form onSubmit={saveDetails} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Emails (comma-separated)</label>
            <input value={emails} onChange={(e) => setEmails(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Address</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls} />
          </div>
          <button type="submit" disabled={update.isPending} className={btnPrimary}>
            {update.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save details
          </button>
        </form>
      </div>

      {/* Flags + docs delivered */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-4">
          <Flag className="w-4 h-4" style={{ color: HAB_GOLD }} />
          <h3 className="text-sm font-bold">Flags</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            onClick={() => toggleFlag("acquisition")}
            className={cn(
              "text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors",
              client.acquisitionFlag
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                : "bg-muted/40 text-muted-foreground border-border hover:text-foreground",
            )}
            title="Owner may sell the shop to Heath — deal-flow candidate"
          >
            Acquisition {client.acquisitionFlag ? "✓" : ""}
          </button>
          {client.flags.filter((f) => f !== "acquisition").map((f) => (
            <span key={f} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
              {f}
              <button onClick={() => toggleFlag(f)} className="opacity-50 hover:opacity-100" title="Remove flag">×</button>
            </span>
          ))}
        </div>
        <form onSubmit={addFlag} className="flex gap-2 mb-5">
          <input
            value={newFlag} onChange={(e) => setNewFlag(e.target.value)}
            placeholder="Add flag…" className={inputCls}
          />
          <button type="submit" disabled={!newFlag.trim()} className={btnPrimary}><Plus className="w-3.5 h-3.5" /></button>
        </form>

        {(tenant?.docs?.length ?? 0) > 0 && (
          <>
            <p className="text-xs font-semibold mb-2">Docs delivered</p>
            <div className="space-y-1.5">
              {tenant!.docs!.map((d) => {
                const date = client.docsDelivered[d.id] ?? null;
                return (
                  <label key={d.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={date != null} onChange={() => toggleDoc(d.id)} className="accent-current" />
                    <span className={cn("flex-1", date == null && "text-muted-foreground")}>{d.label}</span>
                    {date && <span className="text-muted-foreground">{fmtDate(date)}</span>}
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Seed note */}
      {client.isSeed && (
        <div
          className="rounded-xl border p-4 lg:col-span-2"
          style={{ borderColor: `${HAB_GOLD}55`, backgroundColor: `${HAB_GOLD}0d` }}
        >
          <p className="text-xs font-bold mb-1" style={{ color: HAB_GOLD }}>
            Seeded record — pending verification
          </p>
          <p className="text-xs text-muted-foreground">
            {client.seedNote ?? "Loaded from HAB records; verify contact details, start date and slots."}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Contacts tab ────────────────────────────────────────────────────────────

function ContactsTab({ client }: { client: ClientDetail }) {
  const { toast } = useToast();
  const errToast = useErrToast();
  const addContact = useAddContact();
  const deleteContact = useDeleteContact();
  const [form, setForm] = useState({ name: "", role: "", email: "", phone: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      await addContact.mutateAsync({
        clientId: client.id,
        name: form.name.trim(),
        role: form.role.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
      });
      toast({ title: `Contact added: ${form.name.trim()}` });
      setForm({ name: "", role: "", email: "", phone: "" });
    } catch (err) {
      errToast("Could not add contact", err);
    }
  };

  return (
    <div className="space-y-4">
      {client.contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No contacts yet.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Phone</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {client.contacts.map((c) => (
                <tr key={c.id} className="bg-card">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.role ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{c.phone ?? "—"}</td>
                  <td className="px-2 py-3">
                    <button
                      onClick={() => {
                        if (!confirm(`Remove contact ${c.name}?`)) return;
                        deleteContact.mutate({ contactId: c.id }, {
                          onError: (err) => errToast("Delete failed", err),
                        });
                      }}
                      className="opacity-40 hover:opacity-100 hover:text-red-400 transition-all"
                      title="Remove contact"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={submit} className="grid md:grid-cols-5 gap-2 items-end">
        <input placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
        <input placeholder="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputCls} />
        <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
        <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
        <button type="submit" disabled={addContact.isPending || !form.name.trim()} className={cn(btnPrimary, "justify-center")}>
          {addContact.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Add contact
        </button>
      </form>
    </div>
  );
}

// ─── Advisors tab ────────────────────────────────────────────────────────────

const MODULE_STATE_NEXT: Record<CrmModuleState, CrmModuleState> = { "": "ip", ip: "done", done: "" };

function AdvisorCard({ advisor, tenant }: { advisor: CrmAdvisor; tenant: CrmTenant | undefined }) {
  const errToast = useErrToast();
  const updateAdvisor = useUpdateAdvisor();
  const deleteAdvisor = useDeleteAdvisor();
  const levels = tenant?.masteryLevels ?? ["Rookie", "Advisor", "Closer", "Pro", "Champion"];
  const modules = tenant?.modules ?? [];
  const levelName = levels[advisor.level - 1] ?? `Level ${advisor.level}`;
  const doneCount = modules.filter((m) => advisor.progress[moduleKey(m)] === "done").length;

  const cycleModule = (key: string) => {
    const current: CrmModuleState = advisor.progress[key] ?? "";
    updateAdvisor.mutate(
      { advisorId: advisor.id, progress: { [key]: MODULE_STATE_NEXT[current] } },
      { onError: (err) => errToast("Progress update failed", err) },
    );
  };

  return (
    <div className={cardCls}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
          {advisor.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{advisor.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {modules.length ? `${doneCount}/${modules.length} modules done` : "No modules configured"}
          </p>
        </div>
        <select
          value={advisor.level}
          onChange={(e) =>
            updateAdvisor.mutate(
              { advisorId: advisor.id, level: Number(e.target.value) },
              { onError: (err) => errToast("Level update failed", err) },
            )
          }
          title={`Mastery level: ${levelName}`}
          className="text-xs bg-background border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary"
        >
          {levels.map((l, i) => (
            <option key={l} value={i + 1}>{i + 1} · {l}</option>
          ))}
        </select>
        <button
          onClick={() => {
            if (!confirm(`Remove advisor ${advisor.name}?`)) return;
            deleteAdvisor.mutate({ advisorId: advisor.id }, { onError: (err) => errToast("Delete failed", err) });
          }}
          className="opacity-40 hover:opacity-100 hover:text-red-400 transition-all flex-shrink-0"
          title="Remove advisor"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {modules.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {modules.map((m) => {
            const key = moduleKey(m);
            const state: CrmModuleState = advisor.progress[key] ?? "";
            return (
              <button
                key={key}
                onClick={() => cycleModule(key)}
                disabled={updateAdvisor.isPending}
                title={`${m} — ${state === "done" ? "done" : state === "ip" ? "in progress" : "not started"} (click to cycle)`}
                className={cn(
                  "text-[10px] font-bold px-2 py-1 rounded-full border transition-colors",
                  state === "done" && "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                  state === "ip" && "bg-amber-500/15 text-amber-400 border-amber-500/30",
                  state === "" && "bg-muted/40 text-muted-foreground border-border hover:text-foreground",
                )}
              >
                {key}
              </button>
            );
          })}
        </div>
      )}
      {advisor.notes && <p className="text-xs text-muted-foreground mt-3">{advisor.notes}</p>}
    </div>
  );
}

function AdvisorsTab({ client, tenant }: { client: ClientDetail; tenant: CrmTenant | undefined }) {
  const { toast } = useToast();
  const errToast = useErrToast();
  const addAdvisor = useAddAdvisor();
  const [name, setName] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await addAdvisor.mutateAsync({ clientId: client.id, name: name.trim() });
      toast({ title: `Advisor added: ${name.trim()}` });
      setName("");
    } catch (err) {
      errToast("Could not add advisor", err);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Chips cycle not-started → in-progress → done. Mastery ladder:{" "}
        {(tenant?.masteryLevels ?? []).join(" → ") || "Rookie → Champion"}.
      </p>
      {client.advisors.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No advisors yet.</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {client.advisors.map((a) => (
            <AdvisorCard key={a.id} advisor={a} tenant={tenant} />
          ))}
        </div>
      )}
      <form onSubmit={submit} className="flex gap-2 max-w-sm">
        <input placeholder="Advisor name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        <button type="submit" disabled={addAdvisor.isPending || !name.trim()} className={btnPrimary}>
          {addAdvisor.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Add
        </button>
      </form>
    </div>
  );
}

// ─── KPIs tab ────────────────────────────────────────────────────────────────

function KpisTab({ client, tenant }: { client: ClientDetail; tenant: CrmTenant | undefined }) {
  const { toast } = useToast();
  const errToast = useErrToast();
  const addSnapshot = useAddKpiSnapshot();
  const deleteSnapshot = useDeleteKpiSnapshot();
  const kpiDefs = tenant?.kpiDefs ?? [];
  const latest = client.kpiSnapshots[0]; // API returns newest first

  const [date, setDate] = useState(todayIso());
  const [values, setValues] = useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed: Record<string, number> = {};
    for (const [k, v] of Object.entries(values)) {
      if (v.trim() === "") continue;
      const n = Number(v);
      if (Number.isNaN(n)) {
        toast({ title: `"${v}" is not a number`, variant: "destructive" });
        return;
      }
      parsed[k] = n;
    }
    if (!date || Object.keys(parsed).length === 0) {
      toast({ title: "Enter a date and at least one KPI value", variant: "destructive" });
      return;
    }
    try {
      await addSnapshot.mutateAsync({ clientId: client.id, date, values: parsed });
      toast({ title: `KPI snapshot recorded (${date})` });
      setValues({});
      setDate(todayIso());
    } catch (err) {
      errToast("Snapshot failed", err);
    }
  };

  const statusCls = (s: "good" | "bad" | "neutral") =>
    s === "good" ? "text-emerald-400" : s === "bad" ? "text-red-400" : "text-foreground";

  if (kpiDefs.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No KPI definitions configured for this tenant.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Latest snapshot */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Latest {latest ? `— ${fmtDate(latest.date)}` : ""}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {kpiDefs.map((def) => {
            const value = latest?.values[def.id];
            const s = kpiStatus(def, value);
            return (
              <div key={def.id} className="rounded-xl border border-border bg-card p-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 leading-tight">
                  {def.label}
                </p>
                <p className={cn("text-lg font-bold", statusCls(s))} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {value !== undefined ? value : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {def.target != null ? `target ≥ ${def.target}${def.unit ?? ""}` : "benchmark"}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Append form */}
      <form onSubmit={submit} className={cardCls}>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Record weekly snapshot</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
          {kpiDefs.map((def) => (
            <div key={def.id}>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5 truncate" title={def.label}>
                {def.label}
              </label>
              <input
                type="number" step="any" placeholder="—"
                value={values[def.id] ?? ""}
                onChange={(e) => setValues({ ...values, [def.id]: e.target.value })}
                className={inputCls}
              />
            </div>
          ))}
        </div>
        <button type="submit" disabled={addSnapshot.isPending} className={btnPrimary}>
          {addSnapshot.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Append snapshot
        </button>
        <p className="text-[11px] text-muted-foreground mt-2">Blank fields = not measured that week. Snapshots are append-only.</p>
      </form>

      {/* History */}
      {client.kpiSnapshots.length > 0 && (
        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Date</th>
                {kpiDefs.map((d) => (
                  <th key={d.id} className="text-right px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap" title={d.label}>
                    {d.id}
                  </th>
                ))}
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {client.kpiSnapshots.map((snap) => (
                <tr key={snap.id} className="bg-card">
                  <td className="px-4 py-2.5 whitespace-nowrap font-medium">{fmtDate(snap.date)}</td>
                  {kpiDefs.map((d) => {
                    const v = snap.values[d.id];
                    return (
                      <td key={d.id} className={cn("px-3 py-2.5 text-right tabular-nums", statusCls(kpiStatus(d, v)))}>
                        {v !== undefined ? v : "·"}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2.5">
                    <button
                      onClick={() => {
                        if (!confirm(`Delete snapshot from ${fmtDate(snap.date)}?`)) return;
                        deleteSnapshot.mutate({ snapshotId: snap.id }, { onError: (err) => errToast("Delete failed", err) });
                      }}
                      className="opacity-40 hover:opacity-100 hover:text-red-400 transition-all"
                      title="Delete snapshot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Compliance tab ──────────────────────────────────────────────────────────

function ComplianceTab({ client, tenant }: { client: ClientDetail; tenant: CrmTenant | undefined }) {
  const { toast } = useToast();
  const errToast = useErrToast();
  const update = useUpdateClient();
  const fields = tenant?.complianceFields ?? [];
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft({ ...client.compliance });
  }, [client.id, client.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (fields.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No compliance fields configured for this tenant.</p>;
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({ clientId: client.id, patch: { compliance: draft } });
      toast({ title: "Compliance fields saved" });
    } catch (err) {
      errToast("Save failed", err);
    }
  };

  return (
    <form onSubmit={save} className={cn(cardCls, "max-w-2xl space-y-4")}>
      {fields.map((f) => {
        const value = draft[f.id] ?? "";
        const status = complianceStatus(f, client.compliance[f.id]);
        return (
          <div key={f.id}>
            <div className="flex items-center gap-2 mb-1.5">
              <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
              {status === "past_due" && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                  Past due
                </span>
              )}
              {status === "due_soon" && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Due soon
                </span>
              )}
            </div>
            <input
              type={f.type === "date" ? "date" : "text"}
              value={f.type === "date" ? value.slice(0, 10) : value}
              onChange={(e) => setDraft({ ...draft, [f.id]: e.target.value })}
              className={inputCls}
            />
          </div>
        );
      })}
      <button type="submit" disabled={update.isPending} className={btnPrimary}>
        {update.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
        Save compliance
      </button>
      <p className="text-[11px] text-muted-foreground">
        Dated fields flagged for alerts show Past due / Due soon (60-day window).
      </p>
    </form>
  );
}

// ─── Onboarding tab ──────────────────────────────────────────────────────────

function OnboardingTab({ client, tenant }: { client: ClientDetail; tenant: CrmTenant | undefined }) {
  const { toast } = useToast();
  const errToast = useErrToast();
  const generate = useGenerateOnboarding();
  const toggleTask = useToggleOnboardingTask();
  const addTask = useAddOnboardingTask();
  const [label, setLabel] = useState("");

  const tasks = client.onboardingTasks;
  const done = tasks.filter((t) => t.done).length;
  const triggerLabel = tenant?.onboardingTriggerStage
    ? stageLabel(tenant, tenant.onboardingTriggerStage)
    : "the trigger stage";

  const handleGenerate = async () => {
    try {
      const result = await generate.mutateAsync({ clientId: client.id });
      toast({
        title: result.tasksGenerated > 0
          ? `Checklist generated (${result.tasksGenerated} tasks)`
          : "Checklist already exists — nothing generated",
      });
    } catch (err) {
      errToast("Generate failed", err);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    try {
      await addTask.mutateAsync({ clientId: client.id, label: label.trim() });
      setLabel("");
    } catch (err) {
      errToast("Could not add task", err);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {tasks.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-muted-foreground">
              {done}/{tasks.length} complete
              {client.onboardingGeneratedAt ? ` · generated ${fmtTs(client.onboardingGeneratedAt)}` : ""}
            </span>
            <span className="text-xs font-semibold">{tasks.length ? Math.round((done / tasks.length) * 100) : 0}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%`, backgroundColor: HAB_GOLD }}
            />
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className={cn(cardCls, "text-center py-8")}>
          <ClipboardCheck className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">No onboarding checklist yet</p>
          <p className="text-xs text-muted-foreground mb-4">
            The checklist auto-generates when this {tenant?.entityLabel?.toLowerCase() ?? "client"} enters{" "}
            <span className="font-semibold">{triggerLabel}</span> — or generate it now.
          </p>
          <button onClick={() => void handleGenerate()} disabled={generate.isPending} className={cn(btnPrimary, "mx-auto")}>
            {generate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
            Generate checklist
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {tasks.map((t) => (
            <label
              key={t.id}
              className={cn(
                "flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 cursor-pointer hover:border-primary/40 transition-colors",
                t.done && "opacity-70",
              )}
            >
              <input
                type="checkbox"
                checked={t.done}
                onChange={() =>
                  toggleTask.mutate(
                    { taskId: t.id, done: !t.done },
                    { onError: (err) => errToast("Task update failed", err) },
                  )
                }
                className="mt-0.5 accent-current"
              />
              <span className={cn("flex-1 text-sm", t.done && "line-through text-muted-foreground")}>{t.label}</span>
              {t.done && t.doneDate && (
                <span className="text-[11px] text-muted-foreground flex-shrink-0">{fmtDate(t.doneDate)}</span>
              )}
            </label>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={label} onChange={(e) => setLabel(e.target.value)}
          placeholder="Add custom task…" className={inputCls}
        />
        <button type="submit" disabled={addTask.isPending || !label.trim()} className={btnPrimary}>
          {addTask.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Add
        </button>
      </form>
    </div>
  );
}

// ─── Activity tab ────────────────────────────────────────────────────────────

function ActivityTab({ client }: { client: ClientDetail }) {
  const errToast = useErrToast();
  const addActivity = useAddActivity();
  const [text, setText] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await addActivity.mutateAsync({ clientId: client.id, text: text.trim() });
      setText("");
    } catch (err) {
      errToast("Could not log note", err);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Log a note…" className={inputCls}
        />
        <button type="submit" disabled={addActivity.isPending || !text.trim()} className={btnPrimary}>
          {addActivity.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Log
        </button>
      </form>
      {client.activity.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No activity yet.</p>
      ) : (
        <ol className="space-y-2">
          {client.activity.map((a, i) => (
            <li key={`${a.ts}-${i}`} className="flex gap-3 text-sm">
              <span className="text-[11px] text-muted-foreground whitespace-nowrap w-36 flex-shrink-0 pt-0.5">
                {fmtTs(a.ts)}
              </span>
              <span className="flex-1">{a.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

function ClientDetailContent({ id }: { id: string }) {
  const { toast } = useToast();
  const errToast = useErrToast();
  const clientQuery = useCrmClient(id);
  const client = clientQuery.data;
  const tenantQuery = useCrmTenant(client?.tenantId);
  const tenant = tenantQuery.data;
  const moveStage = useMoveClientStage();
  const update = useUpdateClient();

  const features = tenant?.features ?? {};
  const tabs = useMemo(() => {
    const list: { id: string; label: string; icon: React.ElementType }[] = [
      { id: "overview", label: "Overview", icon: FileText },
      { id: "contacts", label: "Contacts", icon: Users },
    ];
    if (features.advisors)   list.push({ id: "advisors",   label: "Advisors",   icon: GraduationCap });
    if (features.kpis)       list.push({ id: "kpis",       label: "KPIs",       icon: BarChart3 });
    if (features.compliance) list.push({ id: "compliance", label: "Compliance", icon: ShieldCheck });
    if (features.onboarding) list.push({ id: "onboarding", label: "Onboarding", icon: ClipboardCheck });
    list.push({ id: "activity", label: "Activity", icon: ActivityIcon });
    return list;
  }, [features.advisors, features.kpis, features.compliance, features.onboarding]);

  if (clientQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (clientQuery.isError || !client) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
        <p className="text-sm font-medium mb-1">Couldn't load this client</p>
        <p className="text-xs text-muted-foreground mb-4">{(clientQuery.error as Error)?.message}</p>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => void clientQuery.refetch()}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
          <Link href="/crm" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4">
            Back to pipeline
          </Link>
        </div>
      </div>
    );
  }

  const color = client.calendarColorId != null ? CALENDAR_COLORS[client.calendarColorId] : null;

  const handleStageChange = async (stageId: string) => {
    try {
      const result = await moveStage.mutateAsync({ clientId: client.id, stageId });
      const label = stageLabel(tenant, stageId);
      toast({
        title: `Stage → ${label}`,
        description: result.tasksGenerated > 0
          ? `Onboarding checklist auto-generated (${result.tasksGenerated} tasks).`
          : undefined,
      });
    } catch (err) {
      errToast("Stage move failed", err);
    }
  };

  const markVerified = async () => {
    try {
      await update.mutateAsync({ clientId: client.id, patch: { isSeed: false, seedNote: null } });
      toast({ title: "Marked verified — seed flag cleared" });
    } catch (err) {
      errToast("Update failed", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/crm"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Pipeline
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          {color && (
            <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" title={`Calendar: ${color.name}`} style={{ backgroundColor: color.hex }} />
          )}
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {client.name}
          </h1>
          {client.acquisitionFlag && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Acquisition
            </span>
          )}
          {client.isSeed && (
            <button
              onClick={() => void markVerified()}
              disabled={update.isPending}
              title={client.seedNote ?? "Seeded from HAB records — click to mark verified"}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-opacity hover:opacity-80"
              style={{ color: HAB_GOLD, borderColor: `${HAB_GOLD}55`, backgroundColor: `${HAB_GOLD}14` }}
            >
              <CheckCircle2 className="w-3 h-3" /> Seed — mark verified
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Stage</span>
            {tenant?.stages?.length ? (
              <select
                value={client.stageId}
                onChange={(e) => void handleStageChange(e.target.value)}
                disabled={moveStage.isPending}
                className="text-sm bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-primary"
              >
                {tenant.stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}{s.id === tenant.onboardingTriggerStage ? " (generates onboarding)" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm font-medium">{client.stageId}</span>
            )}
            {moveStage.isPending && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          {tabs.map(({ id: tabId, label, icon: Icon }) => (
            <TabsTrigger key={tabId} value={tabId} className="gap-1.5 text-xs">
              <Icon className="w-3.5 h-3.5" /> {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview" className="mt-5">
          <OverviewTab client={client} tenant={tenant} />
        </TabsContent>
        <TabsContent value="contacts" className="mt-5">
          <ContactsTab client={client} />
        </TabsContent>
        {features.advisors && (
          <TabsContent value="advisors" className="mt-5">
            <AdvisorsTab client={client} tenant={tenant} />
          </TabsContent>
        )}
        {features.kpis && (
          <TabsContent value="kpis" className="mt-5">
            <KpisTab client={client} tenant={tenant} />
          </TabsContent>
        )}
        {features.compliance && (
          <TabsContent value="compliance" className="mt-5">
            <ComplianceTab client={client} tenant={tenant} />
          </TabsContent>
        )}
        {features.onboarding && (
          <TabsContent value="onboarding" className="mt-5">
            <OnboardingTab client={client} tenant={tenant} />
          </TabsContent>
        )}
        <TabsContent value="activity" className="mt-5">
          <ActivityTab client={client} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CrmClientDetailPage({ id }: { id: string }) {
  return (
    <CrmShell>
      <ClientDetailContent id={id} />
    </CrmShell>
  );
}
