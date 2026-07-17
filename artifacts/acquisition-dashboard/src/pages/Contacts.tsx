import { useDashboard } from "@/lib/context";
import { Phone, PhoneCall, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Contacts() {
  const { state, setState } = useDashboard();

  const toggleCalled = (id: string) => {
    setState((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c) =>
        c.id === id ? { ...c, called: !c.called } : c
      ),
    }));
  };

  const updatePhone = (id: string, phone: string) => {
    setState((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c) =>
        c.id === id ? { ...c, phone } : c
      ),
    }));
  };

  const updateNotes = (id: string, notes: string) => {
    setState((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c) =>
        c.id === id ? { ...c, notes } : c
      ),
    }));
  };

  const called = state.contacts.filter((c) => c.called).length;
  const total = state.contacts.length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Call Tracker
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          {called}/{total} calls completed
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Contacts", value: total, color: "text-foreground" },
          { label: "Calls Made", value: called, color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Remaining", value: total - called, color: "text-amber-600 dark:text-amber-400" },
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
            Must Call — Execution List
          </h3>
        </div>
        <div className="divide-y divide-border">
          {state.contacts.map((contact) => (
            <div key={contact.id} data-testid={`contact-row-${contact.id}`} className="px-6 py-4">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                    contact.called
                      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {contact.called ? (
                    <PhoneCall className="w-4 h-4" />
                  ) : (
                    <PhoneOff className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">{contact.contact}</p>
                      <p className="text-xs text-muted-foreground">{contact.purpose}</p>
                    </div>
                    <button
                      data-testid={`contact-called-${contact.id}`}
                      onClick={() => toggleCalled(contact.id)}
                      className={cn(
                        "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all flex-shrink-0",
                        contact.called
                          ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                          : "bg-primary text-primary-foreground hover:opacity-90"
                      )}
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {contact.called ? "Called" : "Mark Called"}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        value={contact.phone}
                        onChange={(e) => updatePhone(contact.id, e.target.value)}
                        data-testid={`contact-phone-${contact.id}`}
                        className="text-xs font-mono bg-transparent border-none outline-none text-foreground focus:text-primary transition-colors"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Add notes..."
                      value={contact.notes || ""}
                      onChange={(e) => updateNotes(contact.id, e.target.value)}
                      data-testid={`contact-notes-${contact.id}`}
                      className="text-xs text-muted-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/50 focus:text-foreground transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
