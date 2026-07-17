import { useDashboard } from "@/lib/context";
import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

type WeekKey = "week1" | "week2" | "week3" | "week4";

const weeks: { key: WeekKey; label: string; theme: string; color: string; bg: string }[] = [
  {
    key: "week1",
    label: "Week 1 — Stabilize",
    theme: "Meet the team, understand the operation, secure all systems.",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900",
  },
  {
    key: "week2",
    label: "Week 2 — Diagnose",
    theme: "Pull numbers, identify revenue leaks, evaluate each employee.",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900",
  },
  {
    key: "week3",
    label: "Week 3 — Optimize",
    theme: "Implement pricing, improve inspection process, add follow-up system.",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900",
  },
  {
    key: "week4",
    label: "Week 4 — Grow",
    theme: "Activate dormant customers, push deferred maintenance, increase ARO.",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900",
  },
];

export default function Plan() {
  const { state, setState } = useDashboard();

  const toggleTask = (week: WeekKey, id: string) => {
    setState((prev) => ({
      ...prev,
      [week]: (prev[week] as typeof prev.week1).map((t) =>
        t.id === id ? { ...t, done: !t.done } : t
      ),
    }));
  };

  const allTasks = [
    ...state.week1,
    ...state.week2,
    ...state.week3,
    ...state.week4,
  ];
  const totalDone = allTasks.filter((t) => t.done).length;
  const totalTasks = allTasks.length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          30-Day Execution Plan
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          {totalDone}/{totalTasks} tasks completed across all weeks
        </p>
      </div>

      {/* Overall progress */}
      <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">Overall 30-Day Progress</span>
          <span className="text-sm font-bold text-primary">
            {Math.round((totalDone / totalTasks) * 100)}%
          </span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-700"
            style={{ width: `${(totalDone / totalTasks) * 100}%` }}
          />
        </div>
      </div>

      {/* Weeks */}
      <div className="space-y-6">
        {weeks.map((week) => {
          const tasks = state[week.key];
          const weekDone = tasks.filter((t) => t.done).length;
          const weekPct = Math.round((weekDone / tasks.length) * 100);

          return (
            <div key={week.key} className={cn("border rounded-xl overflow-hidden", week.bg)}>
              <div className="px-6 py-4 border-b border-inherit">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className={cn("font-bold text-sm", week.color)} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      {week.label}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{week.theme}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={cn("text-lg font-bold", week.color)}>
                      {weekPct}%
                    </span>
                    <p className="text-xs text-muted-foreground">{weekDone}/{tasks.length}</p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", week.color.includes("blue") ? "bg-blue-500" : week.color.includes("amber") ? "bg-amber-500" : week.color.includes("purple") ? "bg-purple-500" : "bg-emerald-500")}
                    style={{ width: `${weekPct}%` }}
                  />
                </div>
              </div>
              <div className="p-4 space-y-2">
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    data-testid={`task-${task.id}`}
                    onClick={() => toggleTask(week.key, task.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left",
                      task.done
                        ? "bg-white/50 dark:bg-black/20"
                        : "bg-white/80 dark:bg-black/20 hover:bg-white dark:hover:bg-black/30"
                    )}
                  >
                    {task.done ? (
                      <CheckCircle2 className={cn("w-4 h-4 flex-shrink-0", week.color)} />
                    ) : (
                      <Circle className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                    )}
                    <span className={cn(task.done && "line-through opacity-60")}>{task.task}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* RNSP note */}
      <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
        <h4 className="font-semibold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Revenue-Neutral Scale Principle
        </h4>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your goal in the first 30 days isn't to reinvent the shop — it's to stabilize, diagnose,
          and find the quick wins that improve revenue without adding cost. Focus on ARO, car count,
          and deferred maintenance before making any major operational changes.
        </p>
      </div>
    </div>
  );
}
