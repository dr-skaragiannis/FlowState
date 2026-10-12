import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Ambient, Settings } from "../types";
import { ARP_META, ARP_SPEEDS, arpChordStep, voiceChord, type ArpId, type ArpSpeed } from "../lib/arp";
import { audio } from "../lib/audio";
import { noteName, pitchClass, PRESET_META, synth, type PresetId } from "../lib/synth";
import { useLocalStorage } from "../lib/utils";
import { cn } from "../utils/cn";
import { Icon } from "../components/ui";
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
  arp: ArpId;
  arpSpeed: ArpSpeed;
}

const DEFAULT_RIG: Rig = {
  preset: "crypt",
  startMidi: 36,
  tonic: 0,
  scale: "minor",
  level: 0.72,
  arp: "ping",
  arpSpeed: "slow",
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
  ambienceLive,
}: {
  armed: boolean;
  settings: Settings;
  onAmbient: (a: Ambient) => void;
  onLayer: (a: Ambient) => void;
  onVolume: (v: number) => void;
  ambienceLive: boolean;
}) {
  const [rig, setRig] = useLocalStorage<Rig>("lifeform.synth.v1", DEFAULT_RIG);
  const [sounding, setSounding] = useState<number[]>([]);
  const [sustainOn, setSustainOn] = useState(false);
  const [arpOn, setArpOn] = useState(false);
  /** Chord index while the arp follows a pad. Null plays the whole scale. */
  const [arpChord, setArpChord] = useState<number | null>(null);
  /** Scale chord currently held by the arp. */
  const [arpLive, setArpLive] = useState<number | null>(null);

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
    (midi: number, velocity = 0.8, voice?: PresetId, shape?: { attack?: number; level?: number }) => {
      const n = counts.current.get(midi) ?? 0;
      counts.current.set(midi, n + 1);
      if (n === 0) {
        latched.current.delete(midi);
        synth.noteOn(midi, velocity, voice, shape);
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
  const arpHeld = useRef(new Set<number>());
  const arpOnRef = useRef(false);
  arpOnRef.current = arpOn;
  /** Computer keys currently held, used as the arpeggio when the arp is running. */
  const fingered = useRef(new Set<number>());
  const pointed = useRef<number | null>(null);

  const releaseArp = useCallback(() => {
    arpHeld.current.forEach((midi) => releaseRef.current(midi));
    arpHeld.current.clear();
  }, []);

  const playArp = useCallback((midi: number, velocity: number) => {
    arpHeld.current.add(midi);
    // The Crypt pad's own attack is longer than an arp step, so it never
    // reaches an audible level before the next note cuts it off.
    pressRef.current(midi, velocity, "crypt", { attack: 0.16, level: 0.46 });
  }, []);

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
    document.title = sounding.length ? `${noteName(sounding[0])} · LIFEFORM` : "LIFEFORM · Play";
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
    arpHeld.current.clear();
    setArpOn(false);
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
      if (e.code === "KeyA") {
        e.preventDefault();
        if (!e.repeat) {
          audio.unlock();
          setArpOn((on) => !on);
        }
        return;
      }
      const patternByKey: Partial<Record<string, ArpId>> = {
        Digit1: "up",
        Digit4: "down",
        Digit8: "wave",
        Digit9: "ping",
        Digit0: "spark",
        KeyP: "strum",
      };
      const picked = patternByKey[e.code];
      if (picked) {
        e.preventDefault();
        if (!e.repeat) setRig((r) => ({ ...r, arp: picked }));
        return;
      }
      if (e.code === "BracketLeft" || e.code === "BracketRight") {
        e.preventDefault();
        if (e.repeat) return;
        const order = ARP_SPEEDS.map((s) => s.id);
        setRig((r) => {
          const i = Math.max(0, order.indexOf(r.arpSpeed));
          const next = order[Math.min(order.length - 1, Math.max(0, i + (e.code === "BracketRight" ? 1 : -1)))];
          return next === r.arpSpeed ? r : { ...r, arpSpeed: next };
        });
        return;
      }
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
      if (arpOnRef.current) fingered.current.add(midi);
      else pressRef.current(midi, 0.84);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSustain(false);
        return;
      }
      const midi = keyMidi.current.get(e.code);
      if (midi == null) return;
      keyMidi.current.delete(e.code);
      fingered.current.delete(midi);
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
  }, [armed, setSustain, shiftOctave, setRig]);

  const scale = SCALES.find((s) => s.id === rig.scale) ?? SCALES[0];
  const chordRoot = rig.startMidi + rig.tonic;
  const arpShape = arpChord != null ? scale.chords[arpChord] : undefined;
  const chords = useMemo(() => {
    const source = arpShape ? [arpShape] : scale.chords;
    return source.map((chord) => voiceChord(chord.intervals.map((i) => chordRoot + i)));
  }, [chordRoot, arpShape, scale]);
  const chordsRef = useRef(chords);
  chordsRef.current = chords;
  const patternRef = useRef(rig.arp);
  patternRef.current = rig.arp;
  const liveRef = useRef(setArpLive);
  liveRef.current = setArpLive;
  const speedMs = ARP_SPEEDS.find((s) => s.id === rig.arpSpeed)?.ms ?? 540;

  useEffect(() => {
    if (!arpOn || !armed) return;
    let dead = false;
    let step = 0;
    let previous = -1;
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        if (!dead) fn();
      }, ms);
      timers.add(id);
    };

    const tick = () => {
      const held = [...fingered.current];
      if (pointed.current != null) held.push(pointed.current);
      const shapes = held.length ? [voiceChord(held)] : chordsRef.current;
      const pattern = patternRef.current;
      if (shapes.length === 0) {
        later(tick, speedMs);
        return;
      }
      const hit = arpChordStep(pattern, shapes, step, previous);
      previous = hit.cursor;
      step += 1;
      liveRef.current(shapes.length > 1 ? hit.cursor : null);
      const keep = new Set(hit.notes);
      arpHeld.current.forEach((midi) => {
        if (keep.has(midi)) return;
        arpHeld.current.delete(midi);
        releaseRef.current(midi);
      });
      hit.notes.forEach((midi, i) => {
        if (arpHeld.current.has(midi)) return;
        // Play in this turn so the note is scheduled while the audio clock is running.
        if (i === 0 || hit.stagger === 0) playArp(midi, 0.84);
        else later(() => playArp(midi, 0.62), i * hit.stagger);
      });
      later(tick, speedMs);
    };

    tick();
    return () => {
      dead = true;
      timers.forEach((id) => window.clearTimeout(id));
      releaseArp();
      liveRef.current(null);
    };
  }, [arpOn, armed, rig.arp, speedMs, chords, playArp, releaseArp]);

  const keys = useMemo(() => {
    const all: number[] = [];
    for (let m = rig.startMidi; m <= rig.startMidi + 24; m++) all.push(m);
    return all;
  }, [rig.startMidi]);
  const whites = keys.filter((m) => !isBlack(m));
  const blacks = keys.filter((m) => isBlack(m));
  const soundingSet = useMemo(() => new Set(sounding), [sounding]);
  const last = sounding.length ? sounding[0] : null;

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
    if (arpOnRef.current) {
      pointed.current = next ?? null;
      if (next != null) pointers.current.set(e.pointerId, next);
      else pointers.current.delete(e.pointerId);
      return;
    }
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

        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          <span className="w-12 text-[10px] uppercase tracking-[0.14em] text-white/30">Arp</span>
          <button
            type="button"
            aria-pressed={arpOn}
            onClick={() => {
              audio.unlock();
              setArpOn((on) => !on);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition",
              arpOn ? "text-[#061014]" : "text-white/85 ring-1 ring-white/15 hover:bg-white/[0.06]",
            )}
            style={arpOn ? { background: "var(--accent)", boxShadow: "0 8px 24px -12px var(--accent)" } : undefined}
          >
            <Icon name={arpOn ? "pause" : "play"} className="h-3.5 w-3.5" filled />
            {arpOn ? "Stop" : "Play"}
            <kbd className="rounded bg-black/25 px-1 py-px text-[10px] font-semibold text-white/70">A</kbd>
          </button>
          {ARP_META.map((pattern) => (
            <button
              key={pattern.id}
              type="button"
              title={pattern.hint}
              aria-pressed={rig.arp === pattern.id}
              onClick={() => setRig((r) => ({ ...r, arp: pattern.id }))}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition",
                rig.arp === pattern.id
                  ? "bg-[var(--accent)]/20 text-[var(--accent)] ring-1 ring-[var(--accent)]/40"
                  : "text-white/45 ring-1 ring-white/10 hover:text-white",
              )}
            >
              {pattern.label}
              <kbd className="rounded bg-black/30 px-1 py-px text-[10px] font-semibold text-white/50">{pattern.key}</kbd>
            </button>
          ))}
          <div className="ml-auto flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setArpChord(null)}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition",
                arpChord == null ? "bg-white/15 text-white" : "text-white/40 hover:text-white/75",
              )}
            >
              Scale
            </button>
            <span className="px-1 text-[10px] font-semibold tracking-wide text-white/35">
              <kbd className="rounded bg-black/30 px-1 py-px">[</kbd>
              <kbd className="ml-0.5 rounded bg-black/30 px-1 py-px">]</kbd>
            </span>
            {ARP_SPEEDS.map((speed) => (
              <button
                key={speed.id}
                type="button"
                aria-pressed={rig.arpSpeed === speed.id}
                onClick={() => setRig((r) => ({ ...r, arpSpeed: speed.id }))}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition",
                  rig.arpSpeed === speed.id ? "bg-white/15 text-white" : "text-white/40 hover:text-white/75",
                )}
              >
                {speed.label}
              </button>
            ))}
          </div>
        </div>
        <p className="relative mt-2 text-[12px] text-white/35">
          {arpOn
            ? arpShape
              ? `Arpeggiating ${arpShape.name} ${noteName(chordRoot + arpShape.intervals[0])}. Hold keys to use those notes instead.`
              : "Walking the key, one low note at a time. Hold the keyboard to arpeggiate what you play."
            : "A starts it. 1 4 8 9 0 P choose the figure, [ ] the pace. It stays quiet until you start it."}
        </p>

        <div className="relative mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {scale.chords.map((chord, index) => {
            const midis = chord.intervals.map((i) => chordRoot + i);
            const selected = arpChord === index;
            const live = arpOn && arpChord == null && arpLive === index;
            const on = midis.every((m) => soundingSet.has(m)) || (arpOn && selected) || live;
            return (
              <button
                key={chord.name}
                type="button"
                aria-pressed={selected}
                className={cn(
                  "rounded-2xl px-3 py-3 text-left transition",
                  on
                    ? "text-[#061014]"
                    : "bg-white/[0.04] text-white/75 ring-1 ring-white/10 hover:bg-white/[0.08]",
                  selected && !on && "ring-[var(--accent)]/50",
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
                  setArpChord(index);
                  if (arpOnRef.current) return;
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
            if (pointers.current.size === 0) pointed.current = null;
            if (midi != null && !arpOnRef.current) release(midi);
          }}
          onPointerCancel={(e) => {
            const midi = pointers.current.get(e.pointerId);
            pointers.current.delete(e.pointerId);
            if (pointers.current.size === 0) pointed.current = null;
            if (midi != null && !arpOnRef.current) release(midi);
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
          Play the keys, a chord, or an arp. Lower on a key is louder.{" "}
          <span className="text-white/55">Z–M</span> and <span className="text-white/55">Q–I</span> are the
          keyboard — hold them while the arp runs and it walks those notes.{" "}
          <span className="text-white/55">A</span> starts and stops it. Space holds sustain, arrows shift the octave.
        </p>

        <AmbienceDeck
          settings={settings}
          live={ambienceLive}
          onAmbient={onAmbient}
          onLayer={onLayer}
          onVolume={onVolume}
        />
      </section>
    </div>
  );
}
