import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Ambient, Settings } from "../types";
import { noteName, pitchClass, PRESET_META, synth, type PresetId } from "../lib/synth";
import { useLocalStorage } from "../lib/utils";
import { cn } from "../utils/cn";
import { AmbienceDeck } from "../components/AmbienceDeck";

type ScaleId = "major" | "minor" | "dorian" | "penta";

interface Chord {
  name: string;
  intervals: number[];
}

const SCALES: { id: ScaleId; label: string; chords: Chord[] }[] = [
  {
    id: "major",
    label: "Major",
    chords: [
      { name: "I", intervals: [0, 4, 7] },
      { name: "ii", intervals: [2, 5, 9] },
      { name: "iii", intervals: [4, 7, 11] },
      { name: "IV", intervals: [5, 9, 12] },
      { name: "V", intervals: [7, 11, 14] },
      { name: "vi", intervals: [9, 12, 16] },
      { name: "vii°", intervals: [11, 14, 17] },
    ],
  },
  {
    id: "minor",
    label: "Minor",
    chords: [
      { name: "i", intervals: [0, 3, 7] },
      { name: "ii°", intervals: [2, 5, 8] },
      { name: "III", intervals: [3, 7, 10] },
      { name: "iv", intervals: [5, 8, 12] },
      { name: "v", intervals: [7, 10, 14] },
      { name: "VI", intervals: [8, 12, 15] },
      { name: "VII", intervals: [10, 14, 17] },
    ],
  },
  {
    id: "dorian",
    label: "Dorian",
    chords: [
      { name: "i", intervals: [0, 3, 7] },
      { name: "ii", intervals: [2, 5, 9] },
      { name: "III", intervals: [3, 7, 10] },
      { name: "IV", intervals: [5, 9, 12] },
      { name: "v", intervals: [7, 10, 14] },
      { name: "vi°", intervals: [9, 12, 15] },
      { name: "VII", intervals: [10, 14, 17] },
    ],
  },
  {
    id: "penta",
    label: "Penta",
    chords: [
      { name: "1", intervals: [0, 7, 12] },
      { name: "2", intervals: [2, 9, 14] },
      { name: "3", intervals: [4, 11, 16] },
      { name: "5", intervals: [7, 14, 19] },
      { name: "6", intervals: [9, 16, 21] },
    ],
  },
];

const PITCHES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** Computer-key offsets from the keyboard's lowest C. Two octaves, piano layout. */
const KEY_OFFSET: Record<string, number> = {
  KeyZ: 0,
  KeyS: 1,
  KeyX: 2,
  KeyD: 3,
  KeyC: 4,
  KeyV: 5,
  KeyG: 6,
  KeyB: 7,
  KeyH: 8,
  KeyN: 9,
  KeyJ: 10,
  KeyM: 11,
  KeyQ: 12,
  Digit2: 13,
  KeyW: 14,
  Digit3: 15,
  KeyE: 16,
  KeyR: 17,
  Digit5: 18,
  KeyT: 19,
  Digit6: 20,
  KeyY: 21,
  KeyU: 22,
  Digit7: 23,
  KeyI: 24,
};

const LABEL_BY_OFFSET: Record<number, string> = {
  0: "Z",
  1: "S",
  2: "X",
  3: "D",
  4: "C",
  5: "V",
  6: "G",
  7: "B",
  8: "H",
  9: "N",
  10: "J",
  11: "M",
  12: "Q",
  13: "2",
  14: "W",
  15: "3",
  16: "E",
  17: "R",
  18: "5",
  19: "T",
  20: "6",
  21: "Y",
  22: "U",
  23: "7",
  24: "I",
};

const BLACK = new Set([1, 3, 6, 8, 10]);

interface Rig {
  preset: PresetId;
  startMidi: number;
  tonic: number;
  scale: ScaleId;
  level: number;
}

const DEFAULT_RIG: Rig = {
  preset: "pad",
  startMidi: 48,
  tonic: 0,
  scale: "major",
  level: 0.75,
};

function isBlack(midi: number) {
  return BLACK.has(((midi % 12) + 12) % 12);
}

export function PlayPage({
  armed,
  settings,
  onAmbient,
  onLayer,
  onVolume,
}: {
  armed: boolean;
  settings: Settings;
  onAmbient: (a: Ambient) => void;
  onLayer: (a: Ambient) => void;
  onVolume: (v: number) => void;
}) {
  const [rig, setRig] = useLocalStorage<Rig>("lifeform.synth.v1", DEFAULT_RIG);
  const [sounding, setSounding] = useState<number[]>([]);
  const [sustainOn, setSustainOn] = useState(false);

  const counts = useRef(new Map<number, number>());
  const latched = useRef(new Set<number>());
  const sustainRef = useRef(false);
  const pointers = useRef(new Map<number, number>());
  const pads = useRef(new Map<number, number[]>());
  const keyMidi = useRef(new Map<string, number>());
  const startRef = useRef(rig.startMidi);
  startRef.current = rig.startMidi;

  const sync = useCallback(() => {
    const notes = new Set<number>();
    counts.current.forEach((n, midi) => {
      if (n > 0) notes.add(midi);
    });
    latched.current.forEach((midi) => notes.add(midi));
    setSounding([...notes].sort((a, b) => a - b));
  }, []);

  const press = useCallback(
    (midi: number, velocity = 0.8) => {
      const n = counts.current.get(midi) ?? 0;
      counts.current.set(midi, n + 1);
      if (n === 0) {
        latched.current.delete(midi);
        synth.noteOn(midi, velocity);
      }
      sync();
    },
    [sync],
  );

  const release = useCallback(
    (midi: number) => {
      const n = (counts.current.get(midi) ?? 0) - 1;
      if (n > 0) counts.current.set(midi, n);
      else {
        counts.current.delete(midi);
        if (sustainRef.current) latched.current.add(midi);
        else synth.noteOff(midi);
      }
      sync();
    },
    [sync],
  );

  const pressRef = useRef(press);
  const releaseRef = useRef(release);
  pressRef.current = press;
  releaseRef.current = release;

  const setSustain = useCallback(
    (on: boolean) => {
      sustainRef.current = on;
      setSustainOn(on);
      if (!on) {
        latched.current.forEach((midi) => {
          if ((counts.current.get(midi) ?? 0) === 0) synth.noteOff(midi);
        });
        latched.current.clear();
        sync();
      }
    },
    [sync],
  );

  useEffect(() => {
    synth.setPreset(rig.preset);
  }, [rig.preset]);

  useEffect(() => {
    synth.setLevel(rig.level);
  }, [rig.level]);

  useEffect(() => {
    document.title = sounding.length
      ? `${noteName(sounding[sounding.length - 1])} · LIFEFORM`
      : "LIFEFORM · Play";
  }, [sounding]);

  useEffect(() => {
    return () => {
      synth.releaseAll();
    };
  }, []);

  useEffect(() => {
    if (armed) return;
    counts.current.clear();
    latched.current.clear();
    pointers.current.clear();
    pads.current.clear();
    keyMidi.current.clear();
    sustainRef.current = false;
    setSustainOn(false);
    synth.releaseAll();
    setSounding([]);
  }, [armed]);

  const shiftOctave = useCallback((dir: number) => {
    setRig((r) => ({
      ...r,
      startMidi: Math.min(72, Math.max(36, r.startMidi + dir * 12)),
    }));
  }, [setRig]);

  useEffect(() => {
    if (!armed) return;
    const onDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) setSustain(true);
        return;
      }
      if (e.code === "ArrowLeft" || e.code === "Minus" || e.code === "NumpadSubtract") {
        e.preventDefault();
        if (!e.repeat) shiftOctave(-1);
        return;
      }
      if (e.code === "ArrowRight" || e.code === "Equal" || e.code === "NumpadAdd") {
        e.preventDefault();
        if (!e.repeat) shiftOctave(1);
        return;
      }
      const offset = KEY_OFFSET[e.code];
      if (offset == null || e.repeat || keyMidi.current.has(e.code)) return;
      e.preventDefault();
      const midi = startRef.current + offset;
      keyMidi.current.set(e.code, midi);
      pressRef.current(midi, 0.84);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSustain(false);
        return;
      }
      const midi = keyMidi.current.get(e.code);
      if (midi == null) return;
      keyMidi.current.delete(e.code);
      releaseRef.current(midi);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      keyMidi.current.forEach((midi) => releaseRef.current(midi));
      keyMidi.current.clear();
    };
  }, [armed, setSustain, shiftOctave]);

  const keys = useMemo(() => {
    const all: number[] = [];
    for (let m = rig.startMidi; m <= rig.startMidi + 24; m++) all.push(m);
    return all;
  }, [rig.startMidi]);
  const whites = keys.filter((m) => !isBlack(m));
  const blacks = keys.filter((m) => isBlack(m));
  const soundingSet = useMemo(() => new Set(sounding), [sounding]);

  const scale = SCALES.find((s) => s.id === rig.scale) ?? SCALES[0];
  const chordRoot = rig.startMidi + rig.tonic;
  const last = sounding.length ? sounding[sounding.length - 1] : null;

  const hitMidi = (e: ReactPointerEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const node = el?.closest("[data-midi]") as HTMLElement | null;
    if (!node) return null;
    const midi = Number(node.dataset.midi);
    return Number.isFinite(midi) ? { midi, node } : null;
  };

  const movePointer = (e: ReactPointerEvent) => {
    const hit = hitMidi(e);
    const prev = pointers.current.get(e.pointerId);
    const next = hit?.midi;
    if (prev === next) return;
    if (prev != null) release(prev);
    if (next != null && hit) {
      const rect = hit.node.getBoundingClientRect();
      const vel = 0.32 + 0.68 * Math.min(1, Math.max(0, (e.clientY - rect.top) / Math.max(1, rect.height)));
      press(next, vel);
      pointers.current.set(e.pointerId, next);
    } else {
      pointers.current.delete(e.pointerId);
    }
  };

  return (
    <div className="anim-in space-y-5">
      <section className="glass relative overflow-hidden rounded-[32px] p-5 shadow-[0_30px_90px_-40px_rgba(0,0,0,1)] sm:p-7">
        <div
          className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--accent), transparent 65%)" }}
        />

        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">Instrument</p>
            <div className="mt-1 flex items-baseline gap-3">
            <h2
              className={cn(
                "tabular text-[42px] font-light leading-none tracking-tight sm:text-[56px]",
                last != null ? "text-white" : "text-white/30",
              )}
            >
              {last != null ? noteName(last) : noteName(chordRoot)}
            </h2>
              <p className="text-[13px] text-white/45">
                {PITCHES[rig.tonic]} {scale.label.toLowerCase()} · {noteName(rig.startMidi)}
              </p>
            </div>
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-1.5">
            {PITCHES.map((name, pc) => {
              const lit = sounding.some((m) => pitchClass(m) === pc);
              const tonic = rig.tonic === pc;
              return (
                <button
                  key={name}
                  type="button"
                  title={`Key of ${name}`}
                  aria-label={`Set key to ${name}`}
                  onClick={() => setRig((r) => ({ ...r, tonic: pc }))}
                  className={cn(
                    "h-8 w-8 rounded-[6px] text-[10px] font-semibold transition",
                    tonic
                      ? "text-[#061014]"
                      : lit
                        ? "text-[#061014]"
                        : "bg-white/10 text-white/35 hover:bg-white/16 hover:text-white/70",
                  )}
                  style={
                    tonic || lit
                      ? {
                          background: "var(--accent)",
                          boxShadow: lit
                            ? "0 0 14px color-mix(in srgb, var(--accent) 70%, transparent)"
                            : undefined,
                          opacity: tonic ? 1 : 0.8,
                        }
                      : undefined
                  }
                >
                  {name.replace("#", "♯")}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap items-center gap-2">
          {PRESET_META.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.hint}
              onClick={() => setRig((r) => ({ ...r, preset: p.id }))}
              className={cn(
                "rounded-xl px-3.5 py-2 text-[13px] font-medium transition",
                rig.preset === p.id
                  ? "bg-[var(--accent)]/20 text-[var(--accent)] ring-1 ring-[var(--accent)]/40"
                  : "text-white/50 ring-1 ring-white/10 hover:bg-white/[0.06] hover:text-white",
              )}
            >
              {p.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center rounded-xl bg-black/25 p-1 ring-1 ring-white/10">
              <button
                type="button"
                className="rounded-lg px-2.5 py-1.5 text-[13px] text-white/60 hover:text-white"
                onClick={() => shiftOctave(-1)}
                aria-label="Octave down"
              >
                −
              </button>
              <span className="tabular min-w-[3.2rem] text-center text-[12px] font-medium text-white/75">
                {noteName(rig.startMidi)}
              </span>
              <button
                type="button"
                className="rounded-lg px-2.5 py-1.5 text-[13px] text-white/60 hover:text-white"
                onClick={() => shiftOctave(1)}
                aria-label="Octave up"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={() => setSustain(!sustainOn)}
              className={cn(
                "rounded-xl px-3.5 py-2 text-[13px] font-medium transition",
                sustainOn
                  ? "bg-white text-[#061014]"
                  : "text-white/55 ring-1 ring-white/10 hover:text-white",
              )}
            >
              Sustain
            </button>
            <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-white/35">
              Notes
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={rig.level}
                aria-label="Synth volume"
                onChange={(e) => setRig((r) => ({ ...r, level: Number(e.target.value) }))}
                className="w-24"
              />
            </label>
          </div>
        </div>

        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          <span className="w-12 text-[10px] uppercase tracking-[0.14em] text-white/30">Scale</span>
          {SCALES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setRig((r) => ({ ...r, scale: s.id }))}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[12px] font-medium transition",
                rig.scale === s.id ? "bg-white/15 text-white" : "text-white/40 hover:text-white/75",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="relative mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {scale.chords.map((chord) => {
            const midis = chord.intervals.map((i) => chordRoot + i);
            const on = midis.every((m) => soundingSet.has(m));
            return (
              <button
                key={chord.name}
                type="button"
                className={cn(
                  "rounded-2xl px-3 py-3 text-left transition",
                  on
                    ? "text-[#061014]"
                    : "bg-white/[0.04] text-white/75 ring-1 ring-white/10 hover:bg-white/[0.08]",
                )}
                style={
                  on
                    ? {
                        background: "var(--accent)",
                        boxShadow: "0 10px 30px -12px var(--accent)",
                      }
                    : undefined
                }
                onPointerDown={(e) => {
                  e.preventDefault();
                  try {
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  } catch {
                    /* pointer already gone */
                  }
                  pads.current.set(e.pointerId, midis);
                  midis.forEach((m) => press(m, 0.72));
                }}
                onPointerUp={(e) => {
                  const held = pads.current.get(e.pointerId) ?? [];
                  pads.current.delete(e.pointerId);
                  held.forEach((m) => release(m));
                }}
                onPointerCancel={(e) => {
                  const held = pads.current.get(e.pointerId) ?? [];
                  pads.current.delete(e.pointerId);
                  held.forEach((m) => release(m));
                }}
              >
                <span className="block text-[11px] uppercase tracking-[0.16em] opacity-70">{chord.name}</span>
                <span className="mt-0.5 block text-[13px] font-medium">{noteName(midis[0])}</span>
              </button>
            );
          })}
        </div>

        <div
          className="relative mt-4 h-[210px] touch-none select-none sm:h-[250px] xl:h-[280px]"
          onPointerDown={(e) => {
            const board = e.currentTarget as HTMLElement;
            try {
              board.setPointerCapture(e.pointerId);
            } catch {
              /* pointer already gone */
            }
            e.preventDefault();
            movePointer(e);
          }}
          onPointerMove={(e) => {
            if (!pointers.current.has(e.pointerId) && e.buttons === 0) return;
            movePointer(e);
          }}
          onPointerUp={(e) => {
            const midi = pointers.current.get(e.pointerId);
            pointers.current.delete(e.pointerId);
            if (midi != null) release(midi);
          }}
          onPointerCancel={(e) => {
            const midi = pointers.current.get(e.pointerId);
            pointers.current.delete(e.pointerId);
            if (midi != null) release(midi);
          }}
        >
          <div className="absolute inset-0 flex">
            {whites.map((midi) => {
              const on = soundingSet.has(midi);
              const offset = midi - rig.startMidi;
              return (
                <div
                  key={midi}
                  data-midi={midi}
                  className={cn(
                    "flex flex-1 flex-col justify-end border-x border-[#12141c] pb-2 transition-colors first:rounded-bl-2xl last:rounded-br-2xl",
                    on ? "text-[#061014]" : "bg-[#f4f1ea] text-black/45",
                  )}
                  style={
                    on
                      ? {
                          background: "var(--accent)",
                          boxShadow: "0 16px 40px -18px var(--accent)",
                        }
                      : undefined
                  }
                >
                  <span className="pointer-events-none text-center text-[10px] font-semibold uppercase tracking-wide">
                    {LABEL_BY_OFFSET[offset] ?? ""}
                  </span>
                </div>
              );
            })}
          </div>
          {blacks.map((midi) => {
            const on = soundingSet.has(midi);
            const boundary = whites.filter((w) => w < midi).length;
            const widthPct = 100 / whites.length;
            const width = widthPct * 0.62;
            const left = boundary * widthPct - width / 2;
            const offset = midi - rig.startMidi;
            return (
              <div
                key={midi}
                data-midi={midi}
                className={cn(
                  "absolute top-0 z-10 flex h-[58%] items-end justify-center rounded-b-xl pb-1.5 text-[9px] font-semibold",
                  on ? "text-[#061014]" : "bg-[#16181f] text-white/55 ring-1 ring-white/10",
                )}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  background: on ? "var(--accent)" : undefined,
                  boxShadow: on ? "0 10px 24px -8px var(--accent)" : "0 8px 16px rgba(0,0,0,0.45)",
                }}
              >
                <span className="pointer-events-none">{LABEL_BY_OFFSET[offset] ?? ""}</span>
              </div>
            );
          })}
        </div>

        <p className="relative mt-3 text-[12px] text-white/35">
          Play the keys or the row above. Lower on a key is louder.{" "}
          <span className="text-white/55">Z–M</span> and <span className="text-white/55">Q–I</span> are the
          keyboard, space holds sustain, arrows shift the octave. Notes sit on top of the ambience bed.
        </p>

        <AmbienceDeck settings={settings} onAmbient={onAmbient} onLayer={onLayer} onVolume={onVolume} />
      </section>
    </div>
  );
}
