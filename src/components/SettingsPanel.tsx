import {
  ACCENTS,
  AMBIENT_META,
  LAYER_KEYS,
  ambientMeta,
  type AccentKey,
  type Ambient,
  type Settings,
} from "../types";
import { cn } from "../utils/cn";
import { Icon, Stepper, Toggle } from "./ui";

const SHORTCUTS: [string, string][] = [
  ["Space", "Start / pause timer"],
  ["R", "Reset current timer"],
  ["S", "Skip to next phase"],
  ["1 / 2 / 3", "Focus · short · long"],
  ["N", "Focus the task composer"],
  ["M", "Cycle ambience sound"],
  ["← / →", "Move on the heatmap"],
  ["Enter", "Pin a heatmap day"],
  ["⌘K / Ctrl K", "Command palette"],
  ["Esc", "Close overlays"],
];

export function SettingsPanel({
  open,
  settings,
  onChange,
  onClose,
  onClearSessions,
  onResetAll,
}: {
  open: boolean;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  onClearSessions: () => void;
  onResetAll: () => void;
}) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });

  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-[400px] flex-col border-l border-white/10 bg-[#0a0b13]/95 backdrop-blur-2xl transition-transform duration-400 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-white">
            <Icon name="sliders" className="h-4 w-4 text-[var(--accent)]" />
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.05] text-white/60 ring-1 ring-white/10 transition hover:text-white"
            aria-label="Close settings"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <div className="space-y-2">
            <h3 className="text-[11px] uppercase tracking-[0.16em] text-white/35">Durations</h3>
            <Stepper label="Focus length" value={settings.focus} suffix="m" min={1} max={120} onChange={(v) => set({ focus: v })} />
            <Stepper label="Short break" value={settings.short} suffix="m" min={1} max={30} onChange={(v) => set({ short: v })} />
            <Stepper label="Long break" value={settings.long} suffix="m" min={1} max={60} onChange={(v) => set({ long: v })} />
            <Stepper label="Long break every" value={settings.longEvery} suffix="×" min={2} max={10} onChange={(v) => set({ longEvery: v })} />
            <Stepper label="Daily goal" value={settings.dailyGoal} suffix=" sessions" min={1} max={20} onChange={(v) => set({ dailyGoal: v })} />
          </div>

          <div className="space-y-2">
            <h3 className="text-[11px] uppercase tracking-[0.16em] text-white/35">Flow</h3>
            <Toggle
              label="Auto-start breaks"
              hint="Dive straight into recovery"
              checked={settings.autoBreak}
              onChange={(v) => set({ autoBreak: v })}
            />
            <Toggle
              label="Auto-start next focus"
              hint="Chain sessions without touching the keyboard"
              checked={settings.autoFocus}
              onChange={(v) => set({ autoFocus: v })}
            />
            <Toggle
              label="Completion chime"
              hint="Soft bell when a timer ends"
              checked={settings.chime}
              onChange={(v) => set({ chime: v })}
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-[11px] uppercase tracking-[0.16em] text-white/35">Sound</h3>
            <div className="rounded-2xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/[0.07]">
              <div className="mb-1 flex items-center justify-between text-[12px] text-white/70">
                <span>Volume</span>
                <span className="tabular text-white/50">{Math.round(settings.volume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={settings.volume}
                onChange={(e) => set({ volume: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/[0.07]">
              <div className="mb-2 text-[12px] text-white/70">Default soundscape</div>
              <div className="grid grid-cols-3 gap-1.5">
                {(["off", ...AMBIENT_META.map((m) => m.key)] as Ambient[]).map((k) => {
                  const m = ambientMeta(k);
                  const on = settings.ambient === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      title={k === "off" ? "No ambience" : m.desc}
                      onClick={() => set({ ambient: k })}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl px-1.5 py-2 text-[10.5px] font-medium transition",
                        on
                          ? "bg-[var(--accent)]/20 text-[var(--accent)] ring-1 ring-[var(--accent)]/35"
                          : "text-white/45 ring-1 ring-white/[0.07] hover:bg-white/[0.06] hover:text-white/85",
                      )}
                    >
                      <Icon name={k === "off" ? "x" : m.icon} className="h-4 w-4" />
                      {k === "off" ? "Silent" : m.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {settings.ambient !== "off" && (
              <div className="rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/[0.07]">
                <div className="mb-2 flex items-center gap-1.5 text-[12px] text-white/70">
                  <Icon name="layers" className="h-3.5 w-3.5" />
                  Layer a second sound
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {LAYER_KEYS.map((k) => {
                    const m = ambientMeta(k);
                    const on = settings.layer === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => set({ layer: k })}
                        className={cn(
                          "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-medium transition",
                          on
                            ? "bg-white/[0.14] text-white ring-1 ring-white/25"
                            : "text-white/45 ring-1 ring-white/[0.07] hover:bg-white/[0.06] hover:text-white/85",
                        )}
                      >
                        <Icon name={k === "off" ? "x" : m.icon} className="h-3 w-3" />
                        {k === "off" ? "Solo" : m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-[11px] uppercase tracking-[0.16em] text-white/35">Accent</h3>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ACCENTS) as AccentKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => set({ accent: k })}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-medium transition",
                    settings.accent === k
                      ? "bg-white/[0.13] text-white ring-1 ring-white/20"
                      : "bg-white/[0.03] text-white/50 ring-1 ring-white/[0.07] hover:text-white/85",
                  )}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full ring-1 ring-white/20"
                    style={{ backgroundImage: `linear-gradient(135deg, ${ACCENTS[k].a}, ${ACCENTS[k].b})` }}
                  />
                  {ACCENTS[k].label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-white/35">
              <Icon name="keyboard" className="h-3.5 w-3.5" />
              Shortcuts
            </h3>
            <div className="overflow-hidden rounded-2xl ring-1 ring-white/[0.07]">
              {SHORTCUTS.map(([key, label], i) => (
                <div
                  key={key}
                  className={cn(
                    "flex items-center justify-between px-3.5 py-2 text-[12px]",
                    i % 2 === 0 ? "bg-white/[0.03]" : "bg-transparent",
                  )}
                >
                  <span className="text-white/55">{label}</span>
                  <kbd className="rounded-md bg-black/40 px-2 py-0.5 font-mono text-[10.5px] text-white/70 ring-1 ring-white/10">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t border-white/[0.07] pt-4">
            <h3 className="text-[11px] uppercase tracking-[0.16em] text-white/35">Data</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClearSessions}
                className="flex-1 rounded-xl bg-white/[0.04] px-3 py-2.5 text-[12px] text-white/65 ring-1 ring-white/10 transition hover:text-white"
              >
                Clear history
              </button>
              <button
                type="button"
                onClick={onResetAll}
                className="flex-1 rounded-xl bg-rose-500/10 px-3 py-2.5 text-[12px] text-rose-300 ring-1 ring-rose-400/25 transition hover:bg-rose-500/20"
              >
                Reset everything
              </button>
            </div>
            <p className="pt-1 text-[11px] leading-relaxed text-white/35">
              Flowstate keeps every session, task and preference in this browser only — nothing leaves your
              machine.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
