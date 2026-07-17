import { useDashboard } from "@/lib/context";
import { CheckCircle2, Circle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Day1() {
  const { state, setState } = useDashboard();

  const toggleDay1 = (id: string) => {
    setState((prev) => ({
      ...prev,
      day1Items: prev.day1Items.map((d) =>
        d.id === id ? { ...d, checked: !d.checked } : d
      ),
    }));
  };

  const updateNotes = (id: string, notes: string) => {
    setState((prev) => ({
      ...prev,
      day1Items: prev.day1Items.map((d) =>
        d.id === id ? { ...d, notes } : d
      ),
    }));
  };

  const done = state.day1Items.filter((d) => d.checked).length;
  const total = state.day1Items.length;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Day 1 Takeover Checklist
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Secure control of all business systems on closing day
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Items", value: total, color: "text-foreground" },
          { label: "Secured", value: done, color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Progress", value: `${pct}%`, color: pct === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-primary" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-card-border rounded-xl p-4 text-center shadow-sm">
            <p className={cn("text-3xl font-bold", color)} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      {pct === 100 && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 flex items-center gap-3">
          <Zap className="w-5 h-5 text-emerald-600" />
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            You own it. All systems secured. You are in full control.
          </p>
        </div>
      )}

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Control Items
          </h3>
          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="divide-y divide-border">
          {state.day1Items.map((item) => (
            <div key={item.id} data-testid={`day1-row-${item.id}`} className="px-6 py-4">
              <div className="flex items-start gap-4">
                <button
                  data-testid={`day1-toggle-${item.id}`}
                  onClick={() => toggleDay1(item.id)}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all mt-0.5",
                    item.checked
                      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.checked ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Circle className="w-4 h-4" />
                  )}
                </button>
                <div className="flex-1">
                  <p className={cn(
                    "text-sm font-medium",
                    item.checked ? "line-through text-muted-foreground" : ""
                  )}>
                    {item.label}
                  </p>
                  <input
                    type="text"
                    placeholder="Add notes..."
                    value={item.notes || ""}
                    onChange={(e) => updateNotes(item.id, e.target.value)}
                    data-testid={`day1-notes-${item.id}`}
                    className="mt-1 text-xs text-muted-foreground bg-transparent border-none outline-none w-full placeholder:text-muted-foreground/50 focus:text-foreground transition-colors"
                  />
                </div>
                <span className={cn(
                  "text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0",
                  item.checked
                    ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
                )}>
                  {item.checked ? "Secured" : "Needed"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Priority Notes */}
      <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
        <h4 className="font-semibold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Day 1 Priority Notes
        </h4>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p><span className="font-medium text-foreground">Bank access:</span> Open new business account the day before or morning of close. Wire seller proceeds, not cash.</p>
          <p><span className="font-medium text-foreground">Tekmetric:</span> Request admin transfer from previous owner before keys are handed over.</p>
          <p><span className="font-medium text-foreground">Google profile:</span> Take control of Business Profile to manage reviews and hours immediately.</p>
          <p><span className="font-medium text-foreground">Staff meeting:</span> Address all employees within first 2 hours. Be calm, confident, and specific about what stays the same.</p>
          <p><span className="font-medium text-foreground">Physical items:</span> Get all keys, gate codes, alarm codes, and safe combinations at close table — not after.</p>
        </div>
      </div>
    </div>
  );
}
