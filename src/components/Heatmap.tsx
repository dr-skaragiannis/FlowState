import { useRef, useState } from "react";
import type { Session, Task } from "../types";
import { averageMinutes, bestDayMinutes, bucketByDay, dayDetail, type DayBucket } from "../lib/stats";
import { dayKey } from "../lib/utils";
import { cn } from "../utils/cn";
import { Icon } from "./ui";

const WEEKS = 12;
const CELL = 19;
const GAP = 5;
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function fullDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function shortDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function clockTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function Heatmap({ sessions, tasks }: { sessions: Session[]; tasks: Task[] }) {
  const weeks = bucketByDay(sessions, WEEKS * 7);
  const [hover, setHover] = useState<{ day: DayBucket; x: number; y: number } | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const heatMax = Math.max(bestDayMinutes(weeks), 50);
  const avg = averageMinutes(weeks);
  const firstWeekday = new Date(weeks[0].ts).getDay();
  const shownTs = pinned ?? hover?.day.ts ?? weeks[weeks.length - 1].ts;
  const detail = dayDetail(sessions, tasks, shownTs);
  const isToday = dayKey(shownTs) === dayKey(Date.now());

  const monthLabels: (string | null)[] = [];
  for (let w = 0; w < WEEKS; w++) {
    const d = new Date(weeks[w * 7].ts);
    const prev = w > 0 ? new Date(weeks[(w - 1) * 7].ts) : null;
    monthLabels.push(!prev || prev.getMonth() !== d.getMonth() ? d.toLocaleDateString(undefined, { month: "short" }) : null);
  }

  const intensity = (m: number) => (m > 0 ? Math.min(1, 0.3 + m / heatMax) : 0);

  const cellStyle = (m: number) => {
    const i = intensity(m);
    return {
      background:
        i > 0
          ? `color-mix(in srgb, var(--accent) ${Math.round(i * 100)}%, rgba(255,255,255,0.05))`
          : "rgba(255,255,255,0.045)",
    };
  };

  const position = (target: Element | null, day: DayBucket) => {
    const wrap = wrapRef.current;
    if (!wrap || !target) return;
    const wr = wrap.getBoundingClientRect();
    const cr = target.getBoundingClientRect();
    setHover({ day, x: cr.left - wr.left + cr.width / 2, y: cr.top - wr.top });
  };

  const onKey = (e: React.KeyboardEvent, idx: number) => {
    const deltas: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 };
    const d = deltas[e.key];
    if (d !== undefined) {
      e.preventDefault();
      const next = Math.max(0, Math.min(weeks.length - 1, idx + d));
      const el = wrapRef.current?.querySelectorAll<HTMLElement>("[data-cell]")[next];
      el?.focus();
      setPinned(weeks[next].ts);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setPinned((p) => (p === weeks[idx].ts ? null : weeks[idx].ts));
    }
  };

  const delta = avg > 0 ? Math.round(((detail.focusMinutes - avg) / avg) * 100) : 0;
  const tipLeft = hover ? Math.max(72, Math.min((wrapRef.current?.clientWidth ?? 300) - 72, hover.x)) : 0;

  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-[0.16em] text-white/35">
          Last {WEEKS} weeks
        </span>
        <span className="flex items-center gap-1.5 text-[10.5px] text-white/35">
          less
          {[0, 0.35, 0.6, 1].map((i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 rounded-[3px]"
              style={{
                background:
                  i === 0
                    ? "rgba(255,255,255,0.05)"
                    : `color-mix(in srgb, var(--accent) ${Math.round((0.3 + i * 0.7) * 100)}%, rgba(255,255,255,0.05))`,
              }}
            />
          ))}
          more
        </span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* grid */}
        <div className="shrink-0">
          {/* month labels */}
          <div className="flex" style={{ gap: GAP, marginLeft: 14 + GAP, marginBottom: 3 }}>
            {monthLabels.map((m, i) => (
              <span
                key={i}
                className="text-[9.5px] leading-none text-white/30"
                style={{ width: CELL, textAlign: "left" }}
              >
                {m ?? ""}
              </span>
            ))}
          </div>

          <div className="flex" style={{ gap: GAP }}>
            {/* weekday letters */}
            <div className="flex flex-col" style={{ gap: GAP }}>
              {Array.from({ length: 7 }).map((_, r) => {
                const wd = (firstWeekday + r) % 7;
                const show = wd === 1 || wd === 3 || wd === 5;
                return (
                  <span
                    key={r}
                    className="text-[9px] leading-none text-white/25"
                    style={{ height: CELL, width: 14, lineHeight: `${CELL}px` }}
                  >
                    {show ? WEEKDAYS[wd] : ""}
                  </span>
                );
              })}
            </div>

            <div
              ref={wrapRef}
              className="relative outline-none"
              tabIndex={0}
              role="grid"
              aria-label="Daily focus heatmap"
            >
              <div className="grid grid-flow-col" style={{ gridTemplateRows: `repeat(7, ${CELL}px)`, gap: GAP }}>
                {weeks.map((b, i) => {
                  const isPinned = pinned === b.ts;
                  return (
                    <button
                      key={b.key}
                      data-cell
                      type="button"
                      tabIndex={-1}
                      role="gridcell"
                      aria-label={`${fullDate(b.ts)} — ${Math.round(b.minutes)} minutes across ${b.sessions} sessions`}
                      onMouseEnter={(e) => position(e.currentTarget, b)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={(e) => position(e.currentTarget, b)}
                      onBlur={() => setHover(null)}
                      onClick={() => setPinned((p) => (p === b.ts ? null : b.ts))}
                      onKeyDown={(e) => onKey(e, i)}
                      className={cn(
                        "rounded-[5px] ring-1 ring-inset transition-transform duration-150",
                        isPinned
                          ? "ring-white/70 scale-[1.18] z-10"
                          : "ring-white/[0.05] hover:scale-[1.18] hover:ring-white/35",
                      )}
                      style={{ width: CELL, height: CELL, ...cellStyle(b.minutes) }}
                    />
                  );
                })}
              </div>

              {/* hover tooltip */}
              {hover && (
                <div
                  className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full"
                  style={{ left: tipLeft, top: hover.y - 8 }}
                >
                  <div className="anim-in whitespace-nowrap rounded-xl border border-white/12 bg-[#0b0c15]/96 px-2.5 py-1.5 shadow-[0_16px_40px_-16px_rgba(0,0,0,1)] backdrop-blur">
                    <div className="text-[11.5px] font-semibold text-white">
                      {isToday ? "Today" : shortDate(hover.day.ts)}
                    </div>
                    <div className="tabular text-[10.5px] text-white/50">
                      {Math.round(hover.day.minutes)}m · {hover.day.sessions} session
                      {hover.day.sessions === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* detail card */}
        <div className="min-w-0 flex-1 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[13.5px] font-semibold text-white">
                  {isToday ? "Today" : fullDate(detail.ts)}
                </h3>
                {pinned !== null && (
                  <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[9.5px] font-medium uppercase tracking-wider text-[var(--accent)] ring-1 ring-[var(--accent)]/25">
                    pinned
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-white/40">
                {detail.focusCount === 0
                  ? "No sessions recorded"
                  : detail.firstAt && detail.lastAt
                    ? `${clockTime(detail.firstAt)} → ${clockTime(detail.lastAt)}`
                    : ""}
              </p>
            </div>
            {pinned !== null && (
              <button
                type="button"
                onClick={() => setPinned(null)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white/40 ring-1 ring-white/10 transition hover:text-white"
                aria-label="Unpin day"
              >
                <Icon name="x" className="h-3 w-3" strokeWidth={2.2} />
              </button>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: "Focused", value: `${Math.round(detail.focusMinutes)}m` },
              { label: "Sessions", value: String(detail.focusCount) },
              { label: "Longest", value: `${Math.round(detail.longestMinutes)}m` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-black/25 px-2.5 py-2 ring-1 ring-white/[0.05]">
                <div className="text-[9.5px] uppercase tracking-[0.12em] text-white/35">{s.label}</div>
                <div className="tabular mt-0.5 text-[15px] font-semibold text-white">{s.value}</div>
              </div>
            ))}
          </div>

          {avg > 0 && detail.focusCount > 0 && (
            <div className="mt-2.5 flex items-center gap-2 text-[11px]">
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ring-1",
                  delta >= 0
                    ? "bg-emerald-400/12 text-emerald-300 ring-emerald-400/25"
                    : "bg-rose-400/12 text-rose-300 ring-rose-400/25",
                )}
              >
                <Icon name="arrowUp" className={cn("h-3 w-3", delta < 0 && "rotate-180")} strokeWidth={2.4} />
                {Math.abs(delta)}%
              </span>
              <span className="text-white/40">
                vs your {Math.round(avg)}m average day
                {detail.breakCount > 0 ? ` · ${Math.round(detail.breakMinutes)}m of breaks` : ""}
              </span>
            </div>
          )}

          <div className="mt-3">
            <div className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-white/30">
              Time by task
            </div>
            {detail.tasks.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 px-3 py-3 text-center text-[11.5px] text-white/35">
                {detail.focusCount === 0 ? "A rest day — or an untracked one." : "Unassigned focus blocks"}
              </p>
            ) : (
              <div className="space-y-1.5">
                {detail.tasks.slice(0, 4).map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5">
                    <span className="w-[42%] truncate text-[11.5px] text-white/70">{t.title}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (t.minutes / Math.max(1, detail.focusMinutes)) * 100)}%`,
                          backgroundImage: "linear-gradient(90deg, var(--accent), var(--accent-2))",
                        }}
                      />
                    </div>
                    <span className="tabular w-11 shrink-0 text-right text-[10.5px] text-white/40">
                      {Math.round(t.minutes)}m
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
