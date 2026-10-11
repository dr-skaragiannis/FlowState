import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ACCENTS,
  AMBIENT_META,
  DEFAULT_SETTINGS,
  LAYER_KEYS,
  PHASE_META,
  ambientMeta,
  type AccentKey,
  type Ambient,
  type Phase,
  type Priority,
  type Session,
  type Settings,
  type Task,
} from "./types";
import { audio } from "./lib/audio";
import { focusSecondsOn, streak as calcStreak } from "./lib/stats";
import { seedSessions, seedTasks } from "./lib/seed";
import { dayKey, fmtClock, fmtDuration, greeting, uid, useLocalStorage, useToasts } from "./lib/utils";
import { usePage } from "./lib/route";
import { usePomodoro } from "./hooks/usePomodoro";
import { CommandPalette, type Command } from "./components/CommandPalette";
import { SettingsPanel } from "./components/SettingsPanel";
import { StatsPanel } from "./components/StatsPanel";
import { TaskPanel } from "./components/TaskPanel";
import { TimerPanel } from "./components/TimerPanel";
import { CellularMark } from "./components/Logo";
import { Icon, Pill } from "./components/ui";
import { PlayPage } from "./pages/PlayPage";
import { cn } from "./utils/cn";

const CYCLE_ORDER: Ambient[] = ["off", ...AMBIENT_META.map((m) => m.key)];

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function App() {
  const [settings, setSettings] = useLocalStorage<Settings>("flowstate.settings.v1", DEFAULT_SETTINGS);
  const [tasks, setTasks] = useLocalStorage<Task[]>("flowstate.tasks.v1", seedTasks());
  const [sessions, setSessions] = useLocalStorage<Session[]>("flowstate.sessions.v1", seedSessions());
  const [activeId, setActiveId] = useLocalStorage<string | undefined>("flowstate.active.v1", undefined);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [page, go] = usePage();
  const { toasts, push } = useToasts();

  /* ------------------------------ derived ------------------------------ */
  const activeTask = tasks.find((t) => t.id === activeId && !t.completed);
  const todaySeconds = useMemo(() => focusSecondsOn(sessions, Date.now()), [sessions]);
  const todaySessions = useMemo(
    () => sessions.filter((s) => s.phase === "focus" && dayKey(s.at) === dayKey(Date.now())).length,
    [sessions],
  );
  const streak = useMemo(() => calcStreak(sessions), [sessions]);
  const recent = useMemo(() => [...sessions].sort((a, b) => b.at - a.at).slice(0, 6), [sessions]);

  /* ------------------------------ timer ------------------------------ */
  const handleComplete = useCallback(
    (phase: Phase, seconds: number) => {
      setSessions((prev) => [
        ...prev,
        { id: uid(), phase, seconds, at: Date.now(), taskId: phase === "focus" ? activeId : undefined },
      ]);
      if (phase === "focus") {
        if (activeId) {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === activeId
                ? { ...t, done: t.done + 1, completed: t.done + 1 >= t.estimate ? true : t.completed }
                : t,
            ),
          );
        }
        push("Focus block complete — time to recover", "check");
      } else {
        push("Break's over. One task, no tabs.", "coffee");
      }
      if (settings.chime) audio.chime(Math.max(0.25, settings.volume));
      if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(phase === "focus" ? "Focus complete" : "Break finished", {
            body: phase === "focus" ? "Step away for a few minutes." : "Back to the work that matters.",
          });
        } catch {
          /* ignore */
        }
      }
    },
    [activeId, push, setSessions, setTasks, settings.chime, settings.volume],
  );

  const timer = usePomodoro({ settings, onComplete: handleComplete, liveTitle: page === "focus" });

  /* ------------------------------ effects ------------------------------ */
  useEffect(() => {
    const a = ACCENTS[settings.accent] ?? ACCENTS.lime;
    document.documentElement.style.setProperty("--accent", a.a);
    document.documentElement.style.setProperty("--accent-2", a.b);
  }, [settings.accent]);

  useEffect(() => {
    if (settings.stableTheme) return;
    const order = Object.keys(ACCENTS) as AccentKey[];
    const id = window.setInterval(() => {
      setSettings((s) => {
        if (s.stableTheme) return s;
        const i = Math.max(0, order.indexOf(s.accent));
        const next = order[(i + 1) % order.length];
        return next === s.accent ? s : { ...s, accent: next };
      });
    }, 5000);
    return () => window.clearInterval(id);
  }, [settings.stableTheme, setSettings]);

  useEffect(() => {
    audio.setVolume(settings.volume);
    if (settings.ambient === "off") audio.stop();
    else audio.play(settings.ambient);
  }, [settings.ambient, settings.volume]);

  useEffect(() => {
    if (settings.layer === "off") audio.setLayer("off");
    else audio.setLayer(settings.layer);
  }, [settings.layer, settings.ambient]);

  /* browsers block audio until a gesture happens — resume on first interaction */
  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const patchSettings = useCallback(
    (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })),
    [setSettings],
  );

  const setAmbient = useCallback(
    (a: Ambient) => {
      // a sound can't sit on top of itself — drop the layer if it collides
      patchSettings(a === settings.layer ? { ambient: a, layer: "off" } : { ambient: a });
      const m = ambientMeta(a);
      push(a === "off" ? "Ambience off" : `${m.label} — ${m.desc.toLowerCase()}`, a === "off" ? "x" : m.icon);
    },
    [patchSettings, push, settings.layer],
  );

  const setLayer = useCallback(
    (a: Ambient) => {
      patchSettings({ layer: a });
      if (a === "off") push("Layer removed — solo ambience", "layers");
      else push(`Layering ${ambientMeta(a).label.toLowerCase()} on top`, ambientMeta(a).icon);
    },
    [patchSettings, push],
  );

  const setVolume = useCallback((v: number) => patchSettings({ volume: v }), [patchSettings]);

  const cycleAmbient = useCallback(() => {
    const i = CYCLE_ORDER.indexOf(settings.ambient);
    setAmbient(CYCLE_ORDER[(i + 1) % CYCLE_ORDER.length]);
  }, [setAmbient, settings.ambient]);

  const toggleTimer = useCallback(() => {
    timer.toggle();
    if (!timer.running && "Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, [timer]);

  /* ------------------------------ tasks ------------------------------ */
  const addTask = useCallback(
    (title: string, estimate: number, priority: Priority) => {
      const task: Task = { id: uid(), title, estimate, done: 0, completed: false, priority, createdAt: Date.now() };
      setTasks((prev) => [task, ...prev]);
      if (!activeId) setActiveId(task.id);
      audio.blip(settings.volume);
    },
    [activeId, setActiveId, setTasks, settings.volume],
  );

  const toggleTask = useCallback(
    (id: string) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, completed: !t.completed, done: !t.completed ? t.estimate : t.done } : t)),
      );
      setActiveId((cur) => (cur === id ? undefined : cur));
    },
    [setActiveId, setTasks],
  );

  const deleteTask = useCallback(
    (id: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setActiveId((cur) => (cur === id ? undefined : cur));
    },
    [setActiveId, setTasks],
  );

  const bumpTask = useCallback(
    (id: string, delta: number) =>
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, done: Math.max(0, Math.min(t.estimate + 4, t.done + delta)) } : t,
        ),
      ),
    [setTasks],
  );

  /* ------------------------------ commands ------------------------------ */
  const commands: Command[] = useMemo(() => {
    const base: Command[] = [
      {
        id: "toggle",
        label: timer.running ? "Pause timer" : "Start timer",
        hint: "Space",
        icon: timer.running ? "pause" : "play",
        group: "Timer",
        run: toggleTimer,
      },
      { id: "reset", label: "Reset timer", hint: "R", icon: "reset", group: "Timer", run: timer.reset },
      { id: "skip", label: "Skip to next phase", hint: "S", icon: "skip", group: "Timer", run: timer.skip },
      ...(["focus", "short", "long"] as Phase[]).map((p) => ({
        id: `phase-${p}`,
        label: `Switch to ${PHASE_META[p].label.toLowerCase()}`,
        hint: PHASE_META[p].key,
        icon: p === "focus" ? "target" : "coffee",
        group: "Timer",
        run: () => timer.select(p),
      })),
      ...(["off", ...AMBIENT_META.map((m) => m.key)] as Ambient[]).map((a) => ({
        id: `amb-${a}`,
        label: a === "off" ? "Turn ambience off" : `Play ${ambientMeta(a).label.toLowerCase()} ambience`,
        hint: a === "off" ? "M" : ambientMeta(a).desc,
        icon: a === "off" ? "x" : ambientMeta(a).icon,
        group: "Sound",
        run: () => setAmbient(a),
      })),
      ...(settings.ambient === "off" ? [] : LAYER_KEYS).map((a) => ({
        id: `layer-${a}`,
        label: a === "off" ? "Remove the ambience layer" : `Layer ${ambientMeta(a).label.toLowerCase()} on top`,
        icon: a === "off" ? "x" : "layers",
        group: "Sound",
        run: () => setLayer(a),
      })),
      {
        id: "vol-up",
        label: "Ambience volume up",
        hint: "Louder",
        icon: "sliders",
        group: "Sound",
        run: () => setVolume(Math.min(1, Math.round((settings.volume + 0.1) * 10) / 10)),
      },
      {
        id: "vol-down",
        label: "Ambience volume down",
        hint: "Quieter",
        icon: "sliders",
        group: "Sound",
        run: () => setVolume(Math.max(0, Math.round((settings.volume - 0.1) * 10) / 10)),
      },
      ...(Object.keys(ACCENTS) as AccentKey[]).map((k) => ({
        id: `accent-${k}`,
        label: `Use ${ACCENTS[k].label} accent`,
        icon: "sparkles",
        group: "Theme",
        run: () => patchSettings({ accent: k }),
      })),
      {
        id: "composer",
        label: "Add a new task",
        hint: "N",
        icon: "plus",
        group: "Tasks",
        run: () => document.getElementById("task-composer")?.focus(),
      },
      { id: "go-play", label: "Open the instrument", hint: "Home", icon: "wave", group: "App", run: () => go("play") },
      { id: "go-focus", label: "Open the focus counter", hint: "Timer", icon: "clock", group: "App", run: () => go("focus") },
      { id: "settings", label: "Open settings", icon: "sliders", group: "App", run: () => setSettingsOpen(true) },
      {
        id: "clear",
        label: "Clear session history",
        icon: "trash",
        group: "App",
        run: () => {
          setSessions([]);
          push("History cleared", "trash");
        },
      },
    ];
    return [
      ...base,
      ...tasks.map((t) => ({
        id: `task-${t.id}`,
        label: t.title,
        hint: t.completed ? "Completed" : `${t.done}/${t.estimate} pomodoros · set active`,
        icon: "target",
        group: "Tasks",
        run: () => !t.completed && setActiveId(t.id),
      })),
    ];
  }, [go, patchSettings, push, setActiveId, setAmbient, setSessions, tasks, timer, toggleTimer]);

  /* ------------------------------ shortcuts ------------------------------ */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (e.key === "Escape") {
        setSettingsOpen(false);
        setPaletteOpen(false);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (page !== "focus") return;
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key.toLowerCase()) {
        case " ":
          e.preventDefault();
          toggleTimer();
          break;
        case "r":
          timer.reset();
          break;
        case "s":
          timer.skip();
          break;
        case "1":
          timer.select("focus");
          break;
        case "2":
          timer.select("short");
          break;
        case "3":
          timer.select("long");
          break;
        case "n":
          document.getElementById("task-composer")?.focus();
          break;
        case "m":
          cycleAmbient();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, timer, toggleTimer, cycleAmbient]);

  /* ------------------------------ render ------------------------------ */
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#06070d]" />
        <div className="absolute left-1/2 top-[-22%] -translate-x-1/2">
          <div
            className="glow-drift h-[680px] w-[1100px] rounded-full opacity-[0.28] blur-[140px]"
            style={{ background: "radial-gradient(circle, var(--accent), transparent 68%)" }}
          />
        </div>
        <div
          className="glow-drift absolute bottom-[-16%] right-[-8%] h-[520px] w-[680px] rounded-full opacity-[0.18] blur-[130px]"
          style={{ background: "radial-gradient(circle, var(--accent-2), transparent 70%)", animationDelay: "-6s" }}
        />
        <div className="grid-bg absolute inset-0" />
      </div>

      {/* header */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#06070d]/75 backdrop-blur-xl">
        <div className="mx-auto flex w-[90%] items-center gap-4 py-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <CellularMark />
            <div className="min-w-0 leading-none">
              <h1 className="text-[26px] font-black tracking-[-0.045em] text-white sm:text-[32px]">
                LIFEFORM
                <span className="text-[var(--accent)]">.</span>
              </h1>
              <p className="mt-1.5 hidden items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.28em] text-white/40 md:flex">
                <span>{page === "play" ? "Instrument" : "Focus counter"}</span>
                <span className="text-white/20">·</span>
                <span className="normal-case tracking-normal text-white/50">
                  {page === "play"
                    ? "Notes over ambience"
                    : `${greeting()} — ${PHASE_META[timer.phase].label.toLowerCase()}`}
                </span>
              </p>
            </div>
          </div>

          <nav className="flex items-center rounded-2xl bg-black/30 p-1 ring-1 ring-white/10">
            <button
              type="button"
              onClick={() => go("play")}
              className={cn(
                "rounded-xl px-3.5 py-2 text-[13px] font-semibold transition",
                page === "play" ? "bg-white/[0.14] text-white ring-1 ring-white/15" : "text-white/45 hover:text-white",
              )}
            >
              Play
            </button>
            <button
              type="button"
              onClick={() => go("focus")}
              className={cn(
                "rounded-xl px-3.5 py-2 text-[13px] font-semibold transition",
                page === "focus" ? "bg-white/[0.14] text-white ring-1 ring-white/15" : "text-white/45 hover:text-white",
              )}
            >
              Focus
              {timer.running && (
                <span className="tabular ml-1.5 text-[11px] text-[var(--accent)]">{fmtClock(timer.remaining)}</span>
              )}
            </button>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className={cn("items-center gap-2.5", page === "focus" ? "hidden xl:flex" : "hidden")}>
              {settings.ambient !== "off" && (
                <Pill tone="accent" className="cursor-default">
                  <Icon name={ambientMeta(settings.ambient).icon} className="h-3.5 w-3.5" />
                  {ambientMeta(settings.ambient).label}
                  {settings.layer !== "off" && (
                    <span className="flex items-center gap-1 text-white/55">
                      <Icon name="layers" className="h-3 w-3" />
                      {ambientMeta(settings.layer).label}
                    </span>
                  )}
                </Pill>
              )}
              <Pill>
                <Icon name="flame" className="h-3.5 w-3.5" />
                {streak}d streak
              </Pill>
              <Pill tone="accent">
                <Icon name="clock" className="h-3.5 w-3.5" />
                {fmtDuration(todaySeconds)} today
              </Pill>
              <Pill tone={todaySessions >= settings.dailyGoal ? "accent" : "neutral"}>
                <Icon name="target" className="h-3.5 w-3.5" />
                {todaySessions}/{settings.dailyGoal} sessions
              </Pill>
            </div>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex h-11 items-center gap-2 rounded-xl bg-white/[0.04] px-3.5 text-[13px] text-white/60 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:text-white"
            >
              <Icon name="command" className="h-4 w-4" />
              <span className="hidden sm:inline">Commands</span>
              <kbd className="hidden rounded-md bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-white/45 ring-1 ring-white/10 sm:inline">
                ⌘K
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Open settings"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.04] text-white/60 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:text-white"
            >
              <Icon name="sliders" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-[90%] pb-16 pt-8">
        {page === "play" ? (
          <PlayPage
            armed={!paletteOpen && !settingsOpen}
            settings={settings}
            onAmbient={setAmbient}
            onLayer={setLayer}
            onVolume={setVolume}
          />
        ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.86fr)]">
          <div className="anim-in space-y-5">
            <TimerPanel
              phase={timer.phase}
              remaining={timer.remaining}
              progress={timer.progress}
              running={timer.running}
              round={timer.round}
              settings={settings}
              activeTask={activeTask}
              onToggle={toggleTimer}
              onReset={timer.reset}
              onSkip={timer.skip}
              onSelect={timer.select}
              onAmbient={setAmbient}
              onLayer={setLayer}
              onVolume={setVolume}
            />
            <StatsPanel sessions={sessions} tasks={tasks} settings={settings} />
          </div>

          <div className="anim-in space-y-5" style={{ animationDelay: "80ms" }}>
            <div>
              <TaskPanel
                tasks={tasks}
                activeId={activeId}
                focusSecondsToday={todaySeconds}
                inputId="task-composer"
                onAdd={addTask}
                onToggle={toggleTask}
                onDelete={deleteTask}
                onSetActive={setActiveId}
                onBump={bumpTask}
              />
            </div>

            {/* session log */}
            <div className="glass rounded-[28px] p-5">
              <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold tracking-tight text-white">
                <Icon name="clock" className="h-4 w-4 text-[var(--accent)]" />
                Session log
              </h2>
              {recent.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-[12.5px] text-white/40">
                  No sessions yet — press Space to start your first.
                </p>
              ) : (
                <ol className="space-y-1">
                  {recent.map((s) => {
                    const task = s.taskId ? tasks.find((t) => t.id === s.taskId) : undefined;
                    return (
                      <li
                        key={s.id}
                        className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/[0.04]"
                      >
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            s.phase === "focus" ? "" : "bg-white/25",
                          )}
                          style={s.phase === "focus" ? { background: "var(--accent)" } : undefined}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] text-white/80">
                            {task?.title ?? (s.phase === "focus" ? "Unassigned focus" : "Break")}
                          </span>
                          <span className="text-[11px] text-white/35">
                            {PHASE_META[s.phase].label} · {timeAgo(s.at)}
                          </span>
                        </span>
                        <span className="tabular shrink-0 text-[11.5px] text-white/45">
                          {fmtDuration(s.seconds)}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {/* tip card */}
            <div className="relative overflow-hidden rounded-[28px] p-5 ring-1 ring-white/[0.08]">
              <div
                className="absolute inset-0 opacity-90"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, color-mix(in srgb, var(--accent) 22%, #0a0b13), #0a0b13 70%)",
                }}
              />
              <div className="relative">
                <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-white">
                  <Icon name="sparkles" className="h-4 w-4" filled />
                  The one-tab rule
                </h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/60">
                  Pick a single task, silence the notifications, and let the ring do the rest. Momentum is a
                  byproduct of finishing — not of planning.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Pill>Space to start</Pill>
                  <Pill>M cycles ambience</Pill>
                  <Pill>Click any heatmap day</Pill>
                  <Pill>100% local</Pill>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        <footer className="mt-12 flex flex-col items-center gap-1 text-center text-[12.5px] text-white/35">
          <p>LIFEFORM — play notes over ambience, or keep time on the focus counter. Everything stays in this browser.</p>
        </footer>
      </main>

      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        onChange={patchSettings}
        onClose={() => setSettingsOpen(false)}
        onClearSessions={() => {
          setSessions([]);
          setSettingsOpen(false);
          push("Session history cleared", "trash");
        }}
        onResetAll={() => {
          setSessions([]);
          setTasks([]);
          setActiveId(undefined);
          setSettings(DEFAULT_SETTINGS);
          setSettingsOpen(false);
          push("Everything reset to defaults", "reset");
        }}
      />

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />

      {/* toasts */}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast-in flex items-center gap-2.5 rounded-2xl border border-white/12 bg-[#0c0d16]/95 px-4 py-2.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,1)] backdrop-blur-xl"
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-lg text-white"
              style={{ backgroundImage: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
            >
              <Icon name={t.icon ?? "check"} className="h-3.5 w-3.5" strokeWidth={2.4} />
            </span>
            <span className="text-[12.5px] text-white/85">{t.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
