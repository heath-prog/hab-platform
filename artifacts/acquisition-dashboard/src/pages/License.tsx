import { useDashboard } from "@/lib/context";
import { CheckCircle2, Circle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export default function License() {
  const { state, setState } = useDashboard();

  const toggleLicense = (id: string) => {
    setState((prev) => ({
      ...prev,
      licenseItems: prev.licenseItems.map((l) =>
        l.id === id ? { ...l, status: !l.status } : l
      ),
    }));
  };

  const updateNotes = (id: string, notes: string) => {
    setState((prev) => ({
      ...prev,
      licenseItems: prev.licenseItems.map((l) =>
        l.id === id ? { ...l, notes } : l
      ),
    }));
  };

  const done = state.licenseItems.filter((l) => l.status).length;
  const total = state.licenseItems.length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          License & Compliance
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          {done}/{total} items cleared
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Items", value: total, color: "text-foreground" },
          { label: "Cleared", value: done, color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Remaining", value: total - done, color: done === total ? "text-muted-foreground" : "text-red-600 dark:text-red-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-card-border rounded-xl p-4 text-center shadow-sm">
            <p className={cn("text-3xl font-bold", color)} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <h3 className="font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            License Items
          </h3>
        </div>
        <div className="divide-y divide-border">
          {state.licenseItems.map((item) => (
            <div key={item.id} data-testid={`license-row-${item.id}`} className="px-6 py-4">
              <div className="flex items-start gap-4">
                <button
                  data-testid={`license-toggle-${item.id}`}
                  onClick={() => toggleLicense(item.id)}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all mt-0.5",
                    item.status
                      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.status ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Circle className="w-4 h-4" />
                  )}
                </button>
                <div className="flex-1">
                  <p className={cn(
                    "text-sm font-medium",
                    item.status ? "line-through text-muted-foreground" : ""
                  )}>
                    {item.item}
                  </p>
                  <input
                    type="text"
                    placeholder="Add notes..."
                    value={item.notes || ""}
                    onChange={(e) => updateNotes(item.id, e.target.value)}
                    data-testid={`license-notes-${item.id}`}
                    className="mt-1 text-xs text-muted-foreground bg-transparent border-none outline-none w-full placeholder:text-muted-foreground/50 focus:text-foreground transition-colors"
                  />
                </div>
                <span className={cn(
                  "text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0",
                  item.status
                    ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
                )}>
                  {item.status ? "Cleared" : "Pending"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
          <h4 className="font-semibold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>BAR License</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Bureau of Automotive Repair</p>
            <p className="font-mono font-medium text-foreground">855-735-0465</p>
            <p>Call early — transfer can take 4-6 weeks</p>
            <p>New owner must apply independently</p>
          </div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
          <h4 className="font-semibold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Smog / STAR</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Verify shop's STAR certification status</p>
            <p>Check if STAR cert transfers or requires new test</p>
            <p>STAR shops command higher customer trust</p>
            <p>Critical revenue driver if applicable</p>
          </div>
        </div>
      </div>
    </div>
  );
}
