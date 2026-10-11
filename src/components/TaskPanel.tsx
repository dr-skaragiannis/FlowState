import { useState } from "react";
import type { Priority, Task } from "../types";
import { cn } from "../utils/cn";
import { GhostButton, Icon } from "./ui";

const PRIORITIES: { key: Priority; label: string; dot: string }[] = [
  { key: "low", label: "Low", dot: "bg-sky-400/80" },
  { key: "normal", label: "Normal", dot: "bg-amber-400/80" },
  { key: "high", label: "High", dot: "bg-rose-400/80" },
];

const priorityOf = (p: Priority) => PRIORITIES.find((x) => x.key === p) ?? PRIORITIES[1];

export function TaskPanel({
  tasks,
  activeId,
  focusSecondsToday,
  inputId,
  onAdd,
  onToggle,
  onDelete,
  onSetActive,
  onBump,
}: {
  tasks: Task[];
  activeId?: string;
  focusSecondsToday: number;
  inputId?: string;
  onAdd: (title: string, estimate: number, priority: Priority) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onSetActive: (id?: string) => void;
  onBump: (id: string, delta: number) => void;
}) {
  const [title, setTitle] = useState("");
  const [estimate, setEstimate] = useState(2);
  const [priority, setPriority] = useState<Priority>("normal");
  const [filter, setFilter] = useState<"active" | "done" | "all">("active");

  const visible = tasks.filter((t) =>
    filter === "all" ? true : filter === "done" ? t.completed : !t.completed,
  );
  const openCount = tasks.filter((t) => !t.completed).length;
  const totalEstimate = tasks.filter((t) => !t.completed).reduce((a, t) => a + t.estimate, 0);
  const openMinutes = Math.max(0, totalEstimate * 25 - Math.round(focusSecondsToday / 60));

  const submit = () => {
    const clean = title.trim();
    if (!clean) return;
    onAdd(clean, estimate, priority);
    setTitle("");
    setEstimate(2);
    setPriority("normal");
  };

  return (
    <div className="glass flex flex-col overflow-hidden rounded-[28px] p-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-white">
            <Icon name="target" className="h-4 w-4 text-[var(--accent)]" />
            Task board
          </h2>
          <p className="mt-0.5 text-[11.5px] text-white/45">
            {openCount} open · ~{Math.max(0, openMinutes)} min of work left
          </p>
        </div>
        <div className="inline-flex rounded-xl bg-black/25 p-0.5 ring-1 ring-white/10">
          {(["active", "done", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[11px] font-medium capitalize transition",
                filter === f ? "bg-white/[0.14] text-white" : "text-white/40 hover:text-white/75",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      {/* composer */}
      <div className="rounded-2xl bg-black/20 p-2.5 ring-1 ring-white/[0.07]">
        <div className="flex items-center gap-2">
          <input
            id={inputId}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              e.stopPropagation();
            }}
            placeholder="What deserves your focus?"
            className="min-w-0 flex-1 bg-transparent px-1.5 py-1.5 text-[13.5px] text-white placeholder:text-white/30 focus:outline-none"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white transition disabled:cursor-not-allowed disabled:opacity-35"
            style={{ backgroundImage: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
            aria-label="Add task"
          >
            <Icon name="plus" className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-white/35">Pomos</span>
            <button
              type="button"
              onClick={() => setEstimate((v) => Math.max(1, v - 1))}
              className="h-6 w-6 rounded-md bg-white/[0.06] text-[13px] leading-none text-white/70 ring-1 ring-white/10 hover:text-white"
            >
              −
            </button>
            <span className="tabular w-5 text-center text-[12px] font-semibold text-white">{estimate}</span>
            <button
              type="button"
              onClick={() => setEstimate((v) => Math.min(12, v + 1))}
              className="h-6 w-6 rounded-md bg-white/[0.06] text-[13px] leading-none text-white/70 ring-1 ring-white/10 hover:text-white"
            >
              +
            </button>
          </div>
          <div className="flex items-center gap-1">
            {PRIORITIES.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPriority(p.key)}
                title={p.label}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] transition",
                  priority === p.key
                    ? "bg-white/[0.12] text-white ring-1 ring-white/15"
                    : "text-white/40 hover:text-white/70",
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", p.dot)} />
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* list */}
      <div className="mt-3 -mr-2 max-h-[42vh] flex-1 space-y-1.5 overflow-y-auto pr-2 lg:max-h-[380px]">
        {visible.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-white/10 px-4 py-9 text-center">
            <Icon name="sparkles" className="h-5 w-5 text-white/25" />
            <p className="text-[12.5px] text-white/45">
              {filter === "done" ? "Nothing finished yet." : "Add your first task to begin."}
            </p>
          </div>
        )}

        {visible.map((t) => {
          const isActive = t.id === activeId && !t.completed;
          const pr = priorityOf(t.priority);
          return (
            <div
              key={t.id}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-2xl px-3 py-2.5 transition",
                isActive
                  ? "bg-[var(--accent)]/12 ring-1 ring-[var(--accent)]/35"
                  : "bg-white/[0.03] ring-1 ring-white/[0.06] hover:bg-white/[0.06]",
                t.completed && "opacity-45",
              )}
            >
              {isActive && (
                <span className="absolute inset-y-2 left-0 w-[3px] rounded-full" style={{ background: "var(--accent)" }} />
              )}
              <button
                type="button"
                onClick={() => onToggle(t.id)}
                aria-label={t.completed ? "Mark incomplete" : "Mark complete"}
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition",
                  t.completed
                    ? "border-transparent text-[#0b0c14]"
                    : "border-white/25 text-transparent hover:border-white/50",
                )}
                style={t.completed ? { background: "var(--accent)" } : undefined}
              >
                <Icon name="check" className="h-3 w-3" strokeWidth={3} />
              </button>

              <button
                type="button"
                onClick={() => onSetActive(isActive ? undefined : t.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span
                  className={cn(
                    "block truncate text-[13.5px] text-white/90",
                    t.completed && "line-through decoration-white/40",
                  )}
                >
                  {t.title}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/40">
                  <span className={cn("h-1.5 w-1.5 rounded-full", pr.dot)} />
                  <span className="tabular">
                    {t.done}/{t.estimate} pomos
                  </span>
                  <span className="text-white/20">·</span>
                  <span>{Math.round(t.estimate * 25)}m</span>
                </span>
              </button>

              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => onBump(t.id, -1)}
                  title="Remove a pomodoro"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => onBump(t.id, 1)}
                  title="Add a pomodoro"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(t.id)}
                  title="Delete task"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-white/35 hover:bg-rose-500/20 hover:text-rose-300"
                >
                  <Icon name="trash" className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {tasks.some((t) => t.completed) && (
        <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
          <span className="text-[11px] text-white/35">
            {tasks.filter((t) => t.completed).length} finished
          </span>
          <GhostButton onClick={() => tasks.filter((t) => t.completed).forEach((t) => onDelete(t.id))} className="h-7 px-2 text-[11px]">
            Clear done
          </GhostButton>
        </div>
      )}
    </div>
  );
}
