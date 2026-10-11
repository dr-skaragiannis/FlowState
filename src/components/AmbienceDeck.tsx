import {
  AMBIENT_GROUPS,
  AMBIENT_META,
  LAYER_KEYS,
  ambientMeta as metaOf,
  type Ambient,
  type Settings,
} from "../types";
import { cn } from "../utils/cn";
import { Icon } from "./ui";

export function AmbienceDeck({
  settings,
  live,
  onAmbient,
  onLayer,
  onVolume,
}: {
  settings: Settings;
  /** False until this visit turns a soundscape on. Saved choices stay quiet. */
  live: boolean;
  onAmbient: (a: Ambient) => void;
  onLayer: (a: Ambient) => void;
  onVolume: (v: number) => void;
}) {
  return (
    <div className="relative mt-5 border-t border-white/[0.07] pt-4">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.16em] text-white/35">Ambience</span>
        <div className="flex flex-1 items-center justify-end gap-2">
          {live && settings.ambient !== "off" && (
            <Icon name={metaOf(settings.ambient).icon} className="h-3.5 w-3.5 text-white/45" />
          )}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={settings.volume}
            onChange={(e) => onVolume(Number(e.target.value))}
            className="w-28 max-w-[45vw]"
            aria-label="Ambience volume"
          />
          <span className="tabular w-8 text-right text-[10.5px] text-white/40">
            {Math.round(settings.volume * 100)}%
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        {AMBIENT_GROUPS.map((group) => (
          <div key={group} className="flex items-start gap-2">
            <span className="w-[46px] shrink-0 pt-[7px] text-[9.5px] uppercase leading-none tracking-[0.1em] text-white/25">
              {group}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {AMBIENT_META.filter((m) => m.group === group).map((m) => {
                const on = live && settings.ambient === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    title={m.desc}
                    onClick={() => onAmbient(m.key)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-medium transition",
                      on
                        ? "bg-[var(--accent)]/20 text-[var(--accent)] ring-1 ring-[var(--accent)]/35"
                        : "text-white/45 ring-1 ring-white/[0.08] hover:bg-white/[0.06] hover:text-white/85",
                    )}
                  >
                    <Icon name={m.icon} className="h-3.5 w-3.5" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {live && settings.ambient !== "off" && (
        <div className="mt-2.5 flex items-start gap-2 rounded-2xl bg-black/20 p-2 ring-1 ring-white/[0.06]">
          <span className="flex w-[46px] shrink-0 items-center gap-1 pt-[7px] text-[9.5px] uppercase leading-none tracking-[0.1em] text-white/25">
            <Icon name="layers" className="h-3 w-3" />
            Mix
          </span>
          <div className="flex flex-wrap gap-1.5">
            {LAYER_KEYS.map((k) => {
              const m = metaOf(k);
              const on = settings.layer === k;
              return (
                <button
                  key={k}
                  type="button"
                  title={k === "off" ? "No second layer" : `Layer ${m.desc}`}
                  onClick={() => onLayer(k)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-medium transition",
                    on
                      ? "bg-white/[0.14] text-white ring-1 ring-white/25"
                      : "text-white/40 ring-1 ring-white/[0.07] hover:bg-white/[0.06] hover:text-white/80",
                  )}
                >
                  {k === "off" ? (
                    <Icon name="x" className="h-3 w-3" strokeWidth={2.2} />
                  ) : (
                    <Icon name={m.icon} className="h-3 w-3" />
                  )}
                  {k === "off" ? "Solo" : m.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
