import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { Icon } from "./ui";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: string;
  group: string;
  run: () => void;
}

export function CommandPalette({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      const t = window.setTimeout(() => inputRef.current?.focus(), 40);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.slice(0, 9);
    return commands
      .map((c) => {
        const label = c.label.toLowerCase();
        const score = label.startsWith(q) ? 3 : label.includes(q) ? 2 : (c.hint ?? "").toLowerCase().includes(q) ? 1 : 0;
        return { c, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.c);
  }, [query, commands]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${cursor}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  const execute = (c?: Command) => {
    if (!c) return;
    c.run();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/65 px-4 pt-[12vh] backdrop-blur-md">
      <div onClick={onClose} className="absolute inset-0" />
      <div className="anim-in relative w-full max-w-[560px] overflow-hidden rounded-2xl border border-white/12 bg-[#0b0c15]/95 shadow-[0_40px_120px_-30px_rgba(0,0,0,1)]">
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3.5">
          <Icon name="command" className="h-4 w-4 text-[var(--accent)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((i) => Math.min(results.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                execute(results[cursor]);
              } else if (e.key === "Escape") {
                onClose();
              }
              e.stopPropagation();
            }}
            placeholder="Search commands, jump to a task…"
            className="flex-1 bg-transparent text-[14px] text-white placeholder:text-white/30 focus:outline-none"
          />
          <kbd className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-white/45 ring-1 ring-white/10">
            esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <p className="px-3 py-8 text-center text-[13px] text-white/40">No matching commands.</p>
          )}
          {results.map((c, i) => (
            <button
              key={c.id}
              data-idx={i}
              type="button"
              onMouseEnter={() => setCursor(i)}
              onClick={() => execute(c)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                i === cursor ? "bg-[var(--accent)]/16 ring-1 ring-[var(--accent)]/30" : "hover:bg-white/[0.05]",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-white/10",
                  i === cursor ? "bg-white/10 text-white" : "bg-white/[0.04] text-white/55",
                )}
              >
                <Icon name={c.icon} className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-white/90">{c.label}</span>
                {c.hint && <span className="block truncate text-[11px] text-white/40">{c.hint}</span>}
              </span>
              <span className="shrink-0 rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/35">
                {c.group}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
