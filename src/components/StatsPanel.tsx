import { useMemo } from "react";
import type { Session, Settings, Task } from "../types";
import { bucketByDay, bestDayMinutes, streak as calcStreak } from "../lib/stats";
import { dayLabel, fmtDuration } from "../lib/utils";
import { cn } from "../utils/cn";
import { Heatmap } from "./Heatmap";
import { Icon, SectionTitle } from "./ui";

function Ring({ value, size = 74 }: { value: number; size?: number }) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.2,0.7,0.2,1)" }}
        />
      </svg>
      <span className="tabular absolute inset-0 flex items-center justify-center text-[15px] font-semibold text-white">
        {Math.round(v * 100)}%
      </span>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.03] p-3.5 ring-1 ring-white/[0.06]">
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] text-white/35">
        <Icon name={icon} className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="tabular mt-1.5 text-[21px] font-semibold leading-none text-white">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-white/40">{sub}</div>}
    </div>
  );
}

export function StatsPanel({
  sessions,
  tasks,
  settings,
}: {
  sessions: Session[];
  tasks: Task[];
  settings: Settings;
}) {
  const week = useMemo(() => bucketByDay(sessions, 7), [sessions]);
  const max = Math.max(bestDayMinutes(week), 60);
  const today = week[week.length - 1];
  const streak = calcStreak(sessions);
  const totalFocusMin = sessions.filter((s) => s.phase === "focus").reduce((a, s) => a + s.seconds, 0) / 60;
  const weekMin = week.reduce((a, b) => a + b.minutes, 0);
  const breaks = sessions.filter((s) => s.phase !== "focus").length;
  const goalRatio = settings.dailyGoal > 0 ? today.sessions / settings.dailyGoal : 0;

  const topTasks = [...tasks].sort((a, b) => b.done - a.done).filter((t) => t.done > 0).slice(0, 3);

  return (
    <div className="glass rounded-[28px] p-5 sm:p-6">
      <SectionTitle
        icon="chart"
        title="Momentum"
        hint="Everything is stored locally in your browser"
        right={
          <span className="flex items-center gap-1.5 rounded-full bg-[var(--accent)]/12 px-2.5 py-1 text-[11px] font-medium text-[var(--accent)] ring-1 ring-[var(--accent)]/25">
            <Icon name="flame" className="h-3.5 w-3.5" filled />
            {streak} day{streak === 1 ? "" : "s"}
          </span>
        }
      />

      <div className="flex flex-wrap items-center gap-5">
        <div className="flex items-center gap-4 rounded-2xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/[0.06]">
          <Ring value={goalRatio} />
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/35">Today</div>
            <div className="tabular mt-0.5 text-[19px] font-semibold leading-tight text-white">
              {today.sessions}
              <span className="text-[13px] font-normal text-white/40"> / {settings.dailyGoal} sessions</span>
            </div>
            <div className="tabular text-[12px] text-white/45">{fmtDuration(today.minutes * 60)} focused</div>
          </div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2.5 sm:grid-cols-3">
          <Tile label="This week" value={fmtDuration(weekMin * 60)} sub={`${Math.round(weekMin / 60)}h total`} icon="clock" />
          <Tile label="All time" value={fmtDuration(totalFocusMin * 60)} sub={`${sessions.length} sessions`} icon="sparkles" />
          <Tile label="Breaks" value={String(breaks)} sub="recharge stops" icon="coffee" />
        </div>
      </div>

      {/* weekly bars */}
      <div className="mt-6">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] uppercase tracking-[0.16em] text-white/35">Last 7 days</span>
          <span className="tabular text-[11px] text-white/35">peak {Math.round(max)}m</span>
        </div>
        <div className="flex h-[132px] items-end gap-2">
          {week.map((b, i) => {
            const h = b.minutes > 0 ? Math.max(6, (b.minutes / max) * 100) : 4;
            const isToday = i === week.length - 1;
            return (
              <div key={b.key} className="flex flex-1 flex-col items-center gap-2">
                <div className="relative flex h-full w-full items-end justify-center">
                  <div
                    className="group relative w-full rounded-t-lg transition-all duration-500"
                    style={{
                      height: `${h}%`,
                      backgroundImage: b.minutes > 0 ? "linear-gradient(180deg, var(--accent), var(--accent-2))" : undefined,
                      background: b.minutes > 0 ? undefined : "rgba(255,255,255,0.07)",
                      opacity: isToday ? 1 : 0.82,
                    }}
                  >
                    <span className="tabular pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
                      {Math.round(b.minutes)}m
                    </span>
                  </div>
                </div>
                <span
                  className={cn(
                    "text-[10.5px]",
                    isToday ? "font-semibold text-white/80" : "text-white/35",
                  )}
                >
                  {dayLabel(b.ts)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* heatmap — hover or click any day */}
      <div className="mt-6 border-t border-white/[0.06] pt-5">
        <Heatmap sessions={sessions} tasks={tasks} />
      </div>

      {topTasks.length > 0 && (
        <div className="mt-6 border-t border-white/[0.06] pt-4">
          <div className="mb-2.5 text-[11px] uppercase tracking-[0.16em] text-white/35">Most worked on</div>
          <div className="space-y-2">
            {topTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3">
                <span className="w-1/2 truncate text-[12.5px] text-white/70">{t.title}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (t.done / Math.max(1, t.estimate)) * 100)}%`,
                      backgroundImage: "linear-gradient(90deg, var(--accent), var(--accent-2))",
                    }}
                  />
                </div>
                <span className="tabular text-[11px] text-white/40">
                  {t.done}/{t.estimate}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
