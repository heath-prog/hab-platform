import { useDashboard } from "@/lib/context";
import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Lease() {
  const { state, setState } = useDashboard();

  const toggleLease = (id: string) => {
    setState((prev) => ({
      ...prev,
      leaseItems: prev.leaseItems.map((l) =>
        l.id === id ? { ...l, status: !l.status } : l
      ),
    }));
  };

  const updateNotes = (id: string, notes: string) => {
    setState((prev) => ({
      ...prev,
      leaseItems: prev.leaseItems.map((l) =>
        l.id === id ? { ...l, notes } : l
      ),
    }));
  };

  const done = state.leaseItems.filter((l) => l.status).length;
  const total = state.leaseItems.length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Lease Tracker
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          {done}/{total} items confirmed
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Items", value: total, color: "text-foreground" },
          { label: "Confirmed", value: done, color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Outstanding", value: total - done, color: "text-amber-600 dark:text-amber-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-card-border rounded-xl p-4 text-center shadow-sm">
            <p className={cn("text-3xl font-bold", color)} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Lease Items
          </h3>
        </div>
        <div className="divide-y divide-border">
          {state.leaseItems.map((item) => (
            <div key={item.id} data-testid={`lease-row-${item.id}`} className="px-6 py-4">
              <div className="flex items-start gap-4">
                <button
                  data-testid={`lease-toggle-${item.id}`}
                  onClick={() => toggleLease(item.id)}
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
                    data-testid={`lease-notes-${item.id}`}
                    className="mt-1 text-xs text-muted-foreground bg-transparent border-none outline-none w-full placeholder:text-muted-foreground/50 focus:text-foreground transition-colors"
                  />
                </div>
                <span className={cn(
                  "text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0",
                  item.status
                    ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
                )}>
                  {item.status ? "Done" : "Pending"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Lease Terms */}
      <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
        <h4 className="font-semibold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Lease Review Checklist
        </h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {[
            "Confirm assignment clause allows business transfer",
            "Verify rent is $8,000/mo or negotiate to acceptable level",
            "Check for CAM/NNN charges that add to base rent",
            "Confirm repair/maintenance responsibility boundaries",
            "Negotiate ROFR (Right of First Refusal) to purchase property",
            "Secure minimum 5-year term (ideally 10) for business stability",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 flex-shrink-0 mt-1.5" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
