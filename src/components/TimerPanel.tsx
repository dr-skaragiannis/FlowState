import {
  PHASE_META,
  type Ambient,
  type Phase,
  type Settings,
  type Task,
} from "../types";
import { fmtClock } from "../lib/utils";
import { cn } from "../utils/cn";
import { AmbienceDeck } from "./AmbienceDeck";
import { GhostButton, Icon } from "./ui";

const PHASES: Phase[] = ["focus", "short", "long"];

export function TimerPanel({
  phase,
  remaining,
  progress,
  running,
  round,
  settings,
  activeTask,
  onToggle,
  onReset,
  onSkip,
  onSelect,
  onAmbient,
  onLayer,
  onVolume,
}: {
  phase: Phase;
  remaining: number;
  progress: number;
  running: boolean;
  round: number;
  settings: Settings;
  activeTask?: Task;
  onToggle: () => void;
  onReset: () => void;
  onSkip: () => void;
  onSelect: (p: Phase) => void;
  onAmbient: (a: Ambient) => void;
  onLayer: (a: Ambient) => void;
  onVolume: (v: number) => void;
}) {
  const R = 128;
  const C = 2 * Math.PI * R;
  const p = Math.min(1, Math.max(0, progress));
  const dash = C * (1 - p);
  const nearDone = remaining <= 5 && running;

  return (
    <div className="glass relative overflow-hidden rounded-[32px] p-6 shadow-[0_30px_90px_-40px_rgba(0,0,0,1)] sm:p-8">
      {/* corner glow */}
      <div
        className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent), transparent 65%)" }}
      />
      {running && (
        <div
          className="breathe pointer-events-none absolute left-1/2 top-[38%] h-[330px] w-[330px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, var(--accent), transparent 62%)", opacity: 0.22 }}
        />
      )}

      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-2xl bg-black/25 p-1 ring-1 ring-white/10">
          {PHASES.map((p2) => (
            <button
              key={p2}
              type="button"
              onClick={() => onSelect(p2)}
              className={cn(
                "rounded-xl px-4 py-2 text-[13.5px] font-medium transition",
                phase === p2
                  ? "bg-white/[0.14] text-white shadow-inner ring-1 ring-white/15"
                  : "text-white/45 hover:text-white/80",
              )}
            >
              {PHASE_META[p2].short}
              {p2 === "long" && (
                <span className="ml-1.5 text-[10px] text-white/35">×{settings.longEvery}</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[11.5px] text-white/50">
          <span className="tabular rounded-full bg-white/[0.05] px-2.5 py-1 ring-1 ring-white/10">
            Round {round}
          </span>
          <span className="hidden rounded-full bg-white/[0.05] px-2.5 py-1 ring-1 ring-white/10 sm:inline">
            Goal {settings.dailyGoal}/day
          </span>
        </div>
      </div>

      {/* ring */}
      <div className="relative mx-auto mt-6 flex h-[340px] w-[340px] items-center justify-center sm:h-[400px] sm:w-[400px] xl:h-[460px] xl:w-[460px]">
        <svg viewBox="0 0 300 300" className="absolute inset-0 h-full w-full -rotate-90">
          <defs>
            <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--accent-2)" />
            </linearGradient>
          </defs>
          <circle cx="150" cy="150" r={R} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="12" />
          <circle
            cx="150"
            cy="150"
            r={R}
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={dash}
            style={{
              transition: "stroke-dashoffset 260ms linear, stroke-width 220ms ease",
              filter: "drop-shadow(0 0 12px color-mix(in srgb, var(--accent) 55%, transparent))",
            }}
          />
          {/* tick marks */}
          {Array.from({ length: 60 }).map((_, i) => {
            const a = (i / 60) * Math.PI * 2;
            const inner = R - 20;
            const outer = i % 5 === 0 ? R - 27 : R - 24;
            const lit = i / 60 <= p;
            return (
              <line
                key={i}
                x1={150 + Math.cos(a) * inner}
                y1={150 + Math.sin(a) * inner}
                x2={150 + Math.cos(a) * outer}
                y2={150 + Math.sin(a) * outer}
                stroke={lit ? "var(--accent)" : "rgba(255,255,255,0.13)"}
                strokeWidth={i % 5 === 0 ? 2 : 1}
                opacity={lit ? 0.75 : 1}
              />
            );
          })}
        </svg>

        <div className="relative z-10 flex flex-col items-center">
          <span
            className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40"
            style={nearDone ? { color: "var(--accent)" } : undefined}
          >
            {PHASE_META[phase].label}
          </span>
          <div
            className={cn(
              "tabular text-[72px] font-light leading-none tracking-tight text-white sm:text-[92px] xl:text-[108px]",
              nearDone && "animate-pulse",
            )}
          >
            {fmtClock(remaining)}
          </div>
          <p className="mt-2 max-w-[190px] text-center text-[11.5px] leading-relaxed text-white/40">
            {activeTask ? activeTask.title : PHASE_META[phase].hint}
          </p>
          {activeTask && (
            <span className="tabular mt-2 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/55 ring-1 ring-white/10">
              {activeTask.done}/{activeTask.estimate} pomodoros
            </span>
          )}
        </div>
      </div>

      {/* controls */}
      <div className="relative mt-2 flex items-center justify-center gap-2.5">
        <GhostButton title="Reset timer (R)" onClick={onReset} className="w-11 px-0">
          <Icon name="reset" className="h-4 w-4" />
        </GhostButton>
        <button
          type="button"
          onClick={onToggle}
          className="group relative flex h-16 min-w-[210px] items-center justify-center gap-2.5 overflow-hidden rounded-2xl text-[16px] font-semibold text-white shadow-[0_16px_48px_-12px_var(--accent)] transition active:scale-[0.98]"
          style={{ backgroundImage: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
        >
          <Icon name={running ? "pause" : "play"} className="h-5 w-5" filled={!running} />
          {running ? "Pause" : remaining === settings[phase] * 60 ? "Start" : "Resume"}
        </button>
        <GhostButton title="Skip to next phase (S)" onClick={onSkip} className="w-11 px-0">
          <Icon name="skip" className="h-4 w-4" />
        </GhostButton>
      </div>

      <AmbienceDeck settings={settings} onAmbient={onAmbient} onLayer={onLayer} onVolume={onVolume} />
    </div>
  );
}
