import { audio } from "./audio";

export type PresetId = "crypt" | "keys" | "pad" | "bell" | "lead" | "organ";

export const PRESET_META: { id: PresetId; label: string; hint: string }[] = [
  { id: "crypt", label: "Crypt", hint: "Slow dark dungeon pad" },
  { id: "keys", label: "Keys", hint: "Soft electric piano" },
  { id: "pad", label: "Pad", hint: "Wide wash for the bed" },
  { id: "bell", label: "Bell", hint: "Short ringing partials" },
  { id: "lead", label: "Lead", hint: "Focused melodic saw" },
  { id: "organ", label: "Organ", hint: "Held harmonic stack" },
];

type OscType = OscillatorType;

interface Partial {
  type: OscType;
  ratio: number;
  gain: number;
  detune: number;
}

interface Preset {
  partials: Partial[];
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  level: number;
  filter?: { freq: number; q: number };
}

const PRESETS: Record<PresetId, Preset> = {
  crypt: {
    partials: [
      { type: "sine", ratio: 0.5, gain: 0.62, detune: 0 },
      { type: "sawtooth", ratio: 1, gain: 0.2, detune: -8 },
      { type: "sawtooth", ratio: 1, gain: 0.2, detune: 8 },
      { type: "triangle", ratio: 2, gain: 0.045, detune: -2 },
    ],
    attack: 1.7,
    decay: 1.4,
    sustain: 0.84,
    release: 3.6,
    level: 0.15,
    filter: { freq: 520, q: 0.45 },
  },
  keys: {
    partials: [
      { type: "sine", ratio: 1, gain: 0.85, detune: 0 },
      { type: "triangle", ratio: 2, gain: 0.16, detune: 4 },
      { type: "sine", ratio: 3, gain: 0.05, detune: -3 },
    ],
    attack: 0.012,
    decay: 0.32,
    sustain: 0.38,
    release: 0.45,
    level: 0.5,
    filter: { freq: 2800, q: 0.6 },
  },
  pad: {
    partials: [
      { type: "sine", ratio: 0.5, gain: 0.4, detune: 0 },
      { type: "sawtooth", ratio: 1, gain: 0.3, detune: -8 },
      { type: "sawtooth", ratio: 1, gain: 0.3, detune: 8 },
    ],
    attack: 1.15,
    decay: 0.9,
    sustain: 0.8,
    release: 2.8,
    level: 0.17,
    filter: { freq: 780, q: 0.4 },
  },
  bell: {
    partials: [
      { type: "sine", ratio: 1, gain: 0.7, detune: 0 },
      { type: "sine", ratio: 2.76, gain: 0.28, detune: 2 },
      { type: "sine", ratio: 5.4, gain: 0.08, detune: -4 },
    ],
    attack: 0.006,
    decay: 0.85,
    sustain: 0.04,
    release: 0.9,
    level: 0.42,
  },
  lead: {
    partials: [
      { type: "sawtooth", ratio: 1, gain: 0.55, detune: -4 },
      { type: "square", ratio: 1, gain: 0.22, detune: 7 },
    ],
    attack: 0.04,
    decay: 0.18,
    sustain: 0.72,
    release: 0.28,
    level: 0.26,
    filter: { freq: 1600, q: 1.1 },
  },
  organ: {
    partials: [
      { type: "sine", ratio: 1, gain: 0.5, detune: 0 },
      { type: "sine", ratio: 2, gain: 0.32, detune: 0 },
      { type: "sine", ratio: 3, gain: 0.18, detune: 0 },
      { type: "sine", ratio: 4, gain: 0.1, detune: 0 },
    ],
    attack: 0.015,
    decay: 0.06,
    sustain: 0.92,
    release: 0.14,
    level: 0.34,
    filter: { freq: 3200, q: 0.4 },
  },
};

interface LiveVoice {
  ctx: AudioContext;
  gain: GainNode;
  oscs: OscillatorNode[];
  release: number;
}

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function noteName(midi: number) {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${NAMES[pc]}${oct}`;
}

export function pitchClass(midi: number) {
  return ((midi % 12) + 12) % 12;
}

class SynthEngine {
  private out: GainNode | null = null;
  private voices = new Map<number, LiveVoice>();
  private preset: PresetId = "pad";
  private level = 0.75;

  setPreset(id: PresetId) {
    this.preset = PRESETS[id] ? id : "pad";
  }

  setLevel(v: number) {
    this.level = Math.max(0, Math.min(1, v));
    const ctx = this.out?.context;
    if (this.out && ctx) this.out.gain.setTargetAtTime(this.level, ctx.currentTime, 0.05);
  }

  private dest(): { ctx: AudioContext; out: GainNode } | null {
    audio.unlock();
    const ctx = audio.context();
    const bus = audio.bus();
    if (!ctx || !bus) return null;
    if (!this.out) {
      this.out = ctx.createGain();
      this.out.gain.value = this.level;
      this.out.connect(bus);
    }
    return { ctx, out: this.out };
  }

  noteOn(midi: number, velocity = 0.8, voice?: PresetId) {
    const dest = this.dest();
    if (!dest) return;
    this.silence(midi, 0.02);
    const { ctx, out } = dest;
    const preset = PRESETS[voice ?? this.preset] ?? PRESETS[this.preset];
    const now = ctx.currentTime;
    const freq = 440 * 2 ** ((midi - 69) / 12);
    const peak = Math.max(0.0008, preset.level * Math.max(0.05, Math.min(1, velocity)));

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + Math.max(0.008, preset.attack));
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, peak * preset.sustain),
      now + Math.max(0.01, preset.attack) + preset.decay,
    );

    let target: AudioNode = gain;
    if (preset.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = Math.min(9000, preset.filter.freq * (0.65 + freq / 880));
      filter.Q.value = preset.filter.q;
      filter.connect(gain);
      target = filter;
    }

    const oscs = preset.partials.map((p) => {
      const osc = ctx.createOscillator();
      const trim = ctx.createGain();
      osc.type = p.type;
      osc.frequency.value = freq * p.ratio;
      osc.detune.value = p.detune;
      trim.gain.value = p.gain;
      osc.connect(trim);
      trim.connect(target);
      osc.start(now);
      return osc;
    });

    gain.connect(out);
    this.voices.set(midi, { ctx, gain, oscs, release: preset.release });
  }

  noteOff(midi: number) {
    const voice = this.voices.get(midi);
    if (!voice) return;
    this.silence(midi, voice.release);
  }

  releaseAll() {
    for (const midi of [...this.voices.keys()]) this.noteOff(midi);
  }

  private silence(midi: number, releaseSec: number) {
    const voice = this.voices.get(midi);
    if (!voice) return;
    this.voices.delete(midi);
    const now = voice.ctx.currentTime;
    const release = Math.max(0.02, releaseSec);
    const g = voice.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.0001, g.value), now);
    g.exponentialRampToValueAtTime(0.0001, now + release);
    const stopAt = now + release + 0.06;
    voice.oscs.forEach((osc) => {
      try {
        osc.stop(stopAt);
      } catch {
        /* already stopped */
      }
    });
    window.setTimeout(() => {
      try {
        voice.gain.disconnect();
      } catch {
        /* already disconnected */
      }
    }, (release + 0.25) * 1000);
  }
}

export const synth = new SynthEngine();
