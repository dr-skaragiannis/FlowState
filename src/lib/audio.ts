import type { Ambient } from "../types";

type NoiseKind = "white" | "pink" | "brown";

interface Voice {
  out: GainNode;
  fade: (target: number, at: number, tc: number) => void;
  kill: (at: number) => void;
}

/**
 * Procedural ambience engine. Every soundscape is synthesised live from
 * noise buffers, biquad filters, LFOs and one-shot event bursts — no assets,
 * no network, and infinitely long without looping artefacts.
 */
class AmbienceEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<NoiseKind, AudioBuffer>();
  private main: Voice | null = null;
  private layer: Voice | null = null;
  private mainKey: Ambient = "off";
  private layerKey: Ambient = "off";
  private vol = 0.45;

  get playing(): Ambient {
    return this.mainKey;
  }

  get layered(): Ambient {
    return this.layerKey;
  }

  /* ------------------------------- context ------------------------------- */

  private ensureCtx() {
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Call from a user gesture so browsers let us make sound. */
  unlock() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    if (this.mainKey !== "off" && !this.main) this.main = this.buildVoice(this.mainKey, 1);
    if (this.layerKey !== "off" && !this.layer) this.layer = this.buildVoice(this.layerKey, 0.6);
  }

  /** Shared output. Synth notes mix into the same bus as the ambience bed. */
  bus(): GainNode | null {
    this.ensureCtx();
    return this.master;
  }

  context(): AudioContext | null {
    return this.ensureCtx();
  }

  /* -------------------------------- buffers ------------------------------ */

  private noise(kind: NoiseKind): AudioBuffer {
    const ctx = this.ensureCtx()!;
    const cached = this.buffers.get(kind);
    if (cached) return cached;

    const len = Math.floor(ctx.sampleRate * 18);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);

    if (kind === "white") {
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    } else if (kind === "brown") {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.2;
      }
    } else {
      // Paul Kellet's pink noise approximation
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }

    this.buffers.set(kind, buf);
    return buf;
  }

  /* ------------------------------ one-shots ------------------------------ */

  private burst(
    ctx: AudioContext,
    dest: AudioNode,
    at: number,
    freq: number,
    q: number,
    level: number,
    decay: number,
    kind: NoiseKind = "white",
    rate = 1,
  ) {
    const src = ctx.createBufferSource();
    src.buffer = this.noise(kind);
    src.playbackRate.value = rate;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(level, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    src.connect(bp);
    bp.connect(g);
    g.connect(dest);
    src.start(at, Math.random() * Math.max(0.2, this.noise(kind).duration - decay - 0.1));
    src.stop(at + decay + 0.05);
  }

  /** Raindrop / click transient. */
  private droplet(ctx: AudioContext, dest: AudioNode, at: number, level: number) {
    this.burst(ctx, dest, at, 1400 + Math.random() * 2600, 6 + Math.random() * 8, level, 0.06, "white", 1.4);
  }

  /** Fire crackle — a tight cluster of transients. */
  private crackle(ctx: AudioContext, dest: AudioNode, at: number, level: number) {
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const t = at + i * (0.012 + Math.random() * 0.06);
      this.burst(
        ctx,
        dest,
        t,
        900 + Math.random() * 3000,
        1.5 + Math.random() * 5,
        level * (0.35 + Math.random() * 0.65),
        0.035 + Math.random() * 0.1,
        Math.random() > 0.5 ? "white" : "brown",
        0.8 + Math.random() * 1.8,
      );
    }
  }

  /** Cricket chirp: amplitude-modulated high tone. */
  private cricket(ctx: AudioContext, dest: AudioNode, at: number, level: number) {
    const base = 4100 + Math.random() * 900;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = base;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = base;
    bp.Q.value = 9;
    const g = ctx.createGain();
    const pulses = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < pulses; i++) {
      const t0 = at + i * 0.05;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(level, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.042);
    }
    osc.connect(bp);
    bp.connect(g);
    g.connect(dest);
    osc.start(at);
    osc.stop(at + pulses * 0.05 + 0.08);
  }

  /** Indistinct café murmur — a wobbling band of speech-ish energy. */
  private murmur(ctx: AudioContext, dest: AudioNode, at: number, level: number) {
    const dur = 0.45 + Math.random() * 0.9;
    const src = ctx.createBufferSource();
    src.buffer = this.noise("brown");
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(220 + Math.random() * 200, at);
    bp.frequency.linearRampToValueAtTime(320 + Math.random() * 420, at + dur);
    bp.Q.value = 4 + Math.random() * 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(level, at + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(dest);
    src.start(at, Math.random() * Math.max(0.2, this.noise("brown").duration - dur - 0.1));
    src.stop(at + dur + 0.05);
  }

  /**
   * A short melodic phrase. Blackbird calls slur; dawn chips stay short and separate.
   * Each phrase picks a new key, contour, and place in the stereo field.
   */
  private song(
    ctx: AudioContext,
    dest: AudioNode,
    at: number,
    level: number,
    kind: "blackbird" | "chip",
  ) {
    const slur = kind === "blackbird";
    const count = slur ? 5 + Math.floor(Math.random() * 6) : 2 + Math.floor(Math.random() * 3);
    const base = slur ? 86 + Math.floor(Math.random() * 8) : 96 + Math.floor(Math.random() * 7);
    const steps = slur ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7];

    const panner = ctx.createStereoPanner();
    panner.pan.value = (Math.random() * 2 - 1) * 0.8;
    panner.connect(dest);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    const air = ctx.createOscillator();
    air.type = "triangle";
    const airGain = ctx.createGain();
    airGain.gain.value = slur ? 0.12 : 0.05;
    const tone = ctx.createGain();
    const vib = ctx.createOscillator();
    const vibGain = ctx.createGain();
    vib.frequency.value = (slur ? 4.2 : 6.5) + Math.random() * 2;
    vibGain.gain.value = slur ? 5 + Math.random() * 7 : 2;
    vib.connect(vibGain);
    vibGain.connect(osc.frequency);

    let midi = base;
    let t = at;
    for (let i = 0; i < count; i++) {
      const freq = 440 * 2 ** ((midi - 69) / 12);
      const dur = slur ? 0.1 + Math.random() * 0.16 : 0.035 + Math.random() * 0.04;
      const gap = dur + (slur ? 0.02 + Math.random() * 0.07 : 0.03 + Math.random() * 0.06);
      const peak = level * (0.45 + Math.random() * 0.55);
      if (i === 0) {
        osc.frequency.setValueAtTime(freq, t);
        air.frequency.setValueAtTime(freq * 2, t);
      } else {
        osc.frequency.exponentialRampToValueAtTime(freq, t + Math.min(0.04, dur * 0.45));
        air.frequency.exponentialRampToValueAtTime(freq * 2, t + Math.min(0.04, dur * 0.45));
      }
      tone.gain.setValueAtTime(0.0001, t);
      tone.gain.linearRampToValueAtTime(peak, t + 0.016);
      tone.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const fall = i > count * 0.55;
      const dir = Math.random() < (fall ? 0.72 : 0.42) ? -1 : 1;
      const leap = steps[Math.floor(Math.random() * (slur ? steps.length : 3))];
      midi = Math.max(base - 9, Math.min(base + 10, midi + dir * (leap === 0 ? 0 : leap)));
      if (midi === base && Math.random() < 0.3) midi += dir * 2;
      t += gap;
    }

    const end = t + 0.08;
    osc.connect(tone);
    air.connect(airGain);
    airGain.connect(tone);
    tone.connect(panner);
    osc.start(at);
    air.start(at);
    vib.start(at);
    osc.stop(end);
    air.stop(end);
    vib.stop(end);
  }

  /** A soft high glint, used for the night sky. */
  private glint(ctx: AudioContext, dest: AudioNode, at: number, level: number) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = (Math.random() * 2 - 1) * 0.9;
    panner.connect(dest);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    const freq = 1400 + Math.random() * 4200;
    osc.frequency.setValueAtTime(freq, at);
    osc.frequency.exponentialRampToValueAtTime(freq * (0.82 + Math.random() * 0.3), at + 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(level, at + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.55 + Math.random() * 0.8);
    osc.connect(g);
    g.connect(panner);
    osc.start(at);
    osc.stop(at + 1.6);
  }

  /* -------------------------------- voices ------------------------------- */

  private buildVoice(mode: Ambient, scale: number): Voice | null {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master || mode === "off") return null;

    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.master);

    const sources: AudioScheduledSourceNode[] = [];
    const nodes: AudioNode[] = [out];
    const timers = new Set<number>();

    const noiseSrc = (kind: NoiseKind, rate = 1) => {
      const s = ctx.createBufferSource();
      s.buffer = this.noise(kind);
      s.loop = true;
      s.playbackRate.value = rate;
      sources.push(s);
      nodes.push(s);
      return s;
    };
    const osc = (type: OscillatorType, freq: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      sources.push(o);
      nodes.push(o);
      return o;
    };
    const filter = (type: BiquadFilterType, freq: number, q = 1) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      nodes.push(f);
      return f;
    };
    const gain = (v: number) => {
      const g = ctx.createGain();
      g.gain.value = v;
      nodes.push(g);
      return g;
    };
    const lfo = (rate: number, depth: number, target: AudioParam) => {
      const o = osc("sine", rate);
      const g = gain(depth);
      o.connect(g);
      g.connect(target);
    };
    const every = (fn: () => void, minMs: number, maxMs: number) => {
      const tick = () => {
        fn();
        const id = window.setTimeout(tick, minMs + Math.random() * (maxMs - minMs));
        timers.add(id);
      };
      const id = window.setTimeout(tick, Math.random() * minMs);
      timers.add(id);
    };
    /** Move a parameter in irregular steps so the bed does not pulse on a clock. */
    const drift = (param: AudioParam, center: number, spread: number) => {
      let value = center;
      every(() => {
        value += (Math.random() - 0.47) * spread * 0.55;
        value = Math.min(center + spread, Math.max(center - spread, value));
        param.setTargetAtTime(Math.max(0.05, value), ctx.currentTime, 0.45 + Math.random() * 1.4);
      }, 600, 2800);
    };

    switch (mode) {
      case "rain": {
        const s = noiseSrc("white", 1);
        const far = noiseSrc("pink", 0.72);
        const hp = filter("highpass", 380, 0.7);
        const bp = filter("bandpass", 1100, 0.4);
        const farLp = filter("lowpass", 900, 0.5);
        const amp = gain(0.85);
        const farAmp = gain(0.35);
        drift(bp.frequency, 1200, 700);
        drift(amp.gain, 0.85, 0.28);
        s.connect(hp);
        hp.connect(bp);
        bp.connect(amp);
        amp.connect(out);
        far.connect(farLp);
        farLp.connect(farAmp);
        farAmp.connect(out);
        every(() => {
          if (Math.random() < 0.22) return;
          const n = 1 + Math.floor(Math.random() * (Math.random() < 0.25 ? 7 : 3));
          for (let i = 0; i < n; i++)
            this.droplet(ctx, out, ctx.currentTime + Math.random() * 0.9, 0.02 + Math.random() * 0.045);
        }, 80, 1500);
        break;
      }
      case "waves": {
        const s = noiseSrc("brown", 1);
        const lp = filter("lowpass", 760, 0.8);
        const amp = gain(1.0);
        lfo(0.07, 0.45, amp.gain);
        drift(lp.frequency, 700, 380);
        drift(amp.gain, 1, 0.35);
        s.connect(lp);
        lp.connect(amp);
        amp.connect(out);
        every(() => {
          if (Math.random() < 0.35) return;
          this.burst(ctx, out, ctx.currentTime + Math.random() * 1.2, 280 + Math.random() * 700, 0.5 + Math.random(), 0.03 + Math.random() * 0.05, 0.8 + Math.random() * 1.4, "white", 0.5 + Math.random() * 0.6);
        }, 900, 6400);
        break;
      }
      case "wind": {
        const s = noiseSrc("brown", 1);
        const lp = filter("lowpass", 520, 0.9);
        const bp = filter("bandpass", 760, 0.6);
        const whistle = filter("bandpass", 1250, 3.5);
        const whistleAmp = gain(0.16);
        const amp = gain(1.0);
        drift(amp.gain, 1, 0.4);
        drift(lp.frequency, 520, 260);
        drift(whistle.frequency, 1300, 700);
        s.connect(lp);
        lp.connect(bp);
        bp.connect(amp);
        lp.connect(whistle);
        whistle.connect(whistleAmp);
        whistleAmp.connect(amp);
        amp.connect(out);
        break;
      }
      case "fire": {
        const s = noiseSrc("brown", 1);
        const lp = filter("lowpass", 430, 0.6);
        const amp = gain(0.9);
        drift(amp.gain, 0.9, 0.25);
        drift(lp.frequency, 420, 180);
        s.connect(lp);
        lp.connect(amp);
        amp.connect(out);
        every(() => {
          if (Math.random() < 0.18) return;
          this.crackle(ctx, out, ctx.currentTime + Math.random() * 0.5, 0.06 + Math.random() * 0.16);
        }, 70, 1100);
        break;
      }
      case "night": {
        const s = noiseSrc("brown", 1);
        const lp = filter("lowpass", 250, 0.5);
        const amp = gain(0.8);
        drift(amp.gain, 0.8, 0.2);
        drift(lp.frequency, 240, 120);
        s.connect(lp);
        lp.connect(amp);
        amp.connect(out);
        every(() => {
          if (Math.random() < 0.2) return;
          const voices = Math.random() < 0.3 ? 2 : 1;
          for (let i = 0; i < voices; i++)
            this.cricket(ctx, out, ctx.currentTime + Math.random() * 1.2, 0.02 + Math.random() * 0.04);
        }, 900, 6200);
        break;
      }
      case "forest": {
        const leaves = noiseSrc("pink", 0.85);
        const canopy = noiseSrc("brown", 0.55);
        const bp = filter("bandpass", 1400, 0.45);
        const lp = filter("lowpass", 700, 0.6);
        const leafAmp = gain(0.55);
        const bodyAmp = gain(0.7);
        drift(bp.frequency, 1500, 800);
        drift(lp.frequency, 640, 280);
        drift(leafAmp.gain, 0.55, 0.22);
        leaves.connect(bp);
        bp.connect(leafAmp);
        leafAmp.connect(out);
        canopy.connect(lp);
        lp.connect(bodyAmp);
        bodyAmp.connect(out);
        every(() => {
          if (Math.random() < 0.45) return;
          this.burst(
            ctx,
            out,
            ctx.currentTime + Math.random() * 0.4,
            1800 + Math.random() * 2200,
            0.6 + Math.random() * 0.8,
            0.02 + Math.random() * 0.03,
            0.12 + Math.random() * 0.2,
            "pink",
            0.8 + Math.random(),
          );
        }, 300, 2200);
        const sing = () => {
          if (Math.random() < 0.12) return;
          this.song(ctx, out, ctx.currentTime + Math.random() * 0.4, 0.07 + Math.random() * 0.05, "blackbird");
          if (Math.random() < 0.28) {
            this.song(ctx, out, ctx.currentTime + 0.9 + Math.random() * 1.6, 0.03 + Math.random() * 0.02, "blackbird");
          }
        };
        sing();
        every(sing, 5000, 18000);
        break;
      }
      case "sky": {
        const air = noiseSrc("pink", 0.6);
        const hp = filter("highpass", 900, 0.5);
        const lp = filter("lowpass", 2800, 0.4);
        const amp = gain(0.22);
        drift(hp.frequency, 1100, 600);
        drift(amp.gain, 0.22, 0.1);
        air.connect(hp);
        hp.connect(lp);
        lp.connect(amp);
        amp.connect(out);
        const sigh = noiseSrc("brown", 0.4);
        const sighLp = filter("lowpass", 280, 0.5);
        const sighAmp = gain(0.35);
        drift(sighAmp.gain, 0.3, 0.2);
        sigh.connect(sighLp);
        sighLp.connect(sighAmp);
        sighAmp.connect(out);
        every(() => {
          if (Math.random() < 0.25) return;
          const n = 1 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++)
            this.glint(ctx, out, ctx.currentTime + Math.random() * 1.8, 0.015 + Math.random() * 0.02);
        }, 3500, 14000);
        break;
      }
      case "brook": {
        const close = noiseSrc("white", 1);
        const far = noiseSrc("pink", 0.66);
        const closeBp = filter("bandpass", 900, 0.55);
        const farBp = filter("bandpass", 420, 0.7);
        const closeAmp = gain(0.55);
        const farAmp = gain(0.7);
        drift(closeBp.frequency, 980, 520);
        drift(farBp.frequency, 460, 240);
        drift(closeAmp.gain, 0.55, 0.25);
        close.connect(closeBp);
        closeBp.connect(closeAmp);
        closeAmp.connect(out);
        far.connect(farBp);
        farBp.connect(farAmp);
        farAmp.connect(out);
        every(() => {
          const n = Math.random() < 0.2 ? 1 : 2 + Math.floor(Math.random() * 6);
          for (let i = 0; i < n; i++) {
            this.burst(
              ctx,
              out,
              ctx.currentTime + Math.random() * 0.55,
              500 + Math.random() * 2200,
              1 + Math.random() * 4,
              0.03 + Math.random() * 0.05,
              0.05 + Math.random() * 0.12,
              Math.random() > 0.4 ? "white" : "pink",
              0.7 + Math.random() * 1.1,
            );
          }
        }, 90, 900);
        break;
      }
      case "dawn": {
        const air = noiseSrc("brown", 0.7);
        const lp = filter("lowpass", 640, 0.6);
        const amp = gain(0.45);
        drift(lp.frequency, 600, 250);
        drift(amp.gain, 0.45, 0.18);
        air.connect(lp);
        lp.connect(amp);
        amp.connect(out);
        const call = () => {
          if (Math.random() < 0.18) return;
          const flock = Math.random() < 0.35 ? 2 : 1;
          for (let i = 0; i < flock; i++)
            this.song(ctx, out, ctx.currentTime + i * (0.15 + Math.random() * 0.4), 0.04 + Math.random() * 0.03, "chip");
          if (Math.random() < 0.2)
            this.song(ctx, out, ctx.currentTime + 1.2 + Math.random(), 0.045, "blackbird");
        };
        call();
        every(call, 2800, 11000);
        break;
      }
      case "cafe": {
        const s = noiseSrc("brown", 1);
        const bp = filter("bandpass", 410, 0.55);
        const amp = gain(1.1);
        drift(amp.gain, 1.1, 0.3);
        drift(bp.frequency, 480, 220);
        s.connect(bp);
        bp.connect(amp);
        amp.connect(out);
        every(() => {
          if (Math.random() < 0.15) return;
          const n = 1 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++)
            this.murmur(ctx, out, ctx.currentTime + Math.random() * 1.4, 0.06 + Math.random() * 0.08);
        }, 500, 2800);
        every(() => {
          if (Math.random() < 0.4) return;
          this.burst(ctx, out, ctx.currentTime + Math.random() * 0.6, 1800 + Math.random() * 2800, 8 + Math.random() * 8, 0.03 + Math.random() * 0.04, 0.12 + Math.random() * 0.2);
        }, 2400, 12000);
        break;
      }
      case "deep": {
        const s = noiseSrc("brown", 1);
        const lp = filter("lowpass", 300, 0.4);
        const amp = gain(1.2);
        lfo(0.04, 0.12, amp.gain);
        s.connect(lp);
        lp.connect(amp);
        amp.connect(out);
        break;
      }
      case "white": {
        const s = noiseSrc("white", 1);
        const lp = filter("lowpass", 9500, 0.7);
        const amp = gain(0.42);
        s.connect(lp);
        lp.connect(amp);
        amp.connect(out);
        break;
      }
      case "pink": {
        const s = noiseSrc("pink", 1);
        const amp = gain(0.95);
        s.connect(amp);
        amp.connect(out);
        break;
      }
      case "drone": {
        const lp = filter("lowpass", 900, 0.7);
        lfo(0.028, 330, lp.frequency);
        const freqs = [110, 130.81, 164.81, 220, 329.63];
        freqs.forEach((f, i) => {
          const o = osc(i % 2 === 0 ? "triangle" : "sine", f * (1 + (Math.random() - 0.5) * 0.005));
          const g = gain(i === 0 ? 0.1 : 0.045);
          lfo(0.045 + i * 0.019, 0.02, g.gain);
          o.connect(g);
          g.connect(lp);
        });
        lp.connect(out);
        break;
      }
      default:
        out.disconnect();
        return null;
    }

    sources.forEach((s) => {
      try {
        if (s instanceof AudioBufferSourceNode && s.buffer) {
          s.start(t0, Math.random() * Math.max(0, s.buffer.duration - 0.5));
        } else {
          s.start(t0);
        }
      } catch {
        /* already started */
      }
    });

    out.gain.setTargetAtTime(this.vol * scale, t0, 1.1);

    return {
      out,
      fade: (target, at, tc) => out.gain.setTargetAtTime(target, at, tc),
      kill: (at) => {
        timers.forEach((id) => window.clearTimeout(id));
        timers.clear();
        out.gain.cancelScheduledValues(at);
        out.gain.setTargetAtTime(0, at, 0.35);
        const stopAt = at + 1.6;
        sources.forEach((s) => {
          try {
            s.stop(stopAt);
          } catch {
            /* noop */
          }
        });
        window.setTimeout(() => nodes.forEach((n) => n.disconnect()), 2600);
      },
    };
  }

  /* -------------------------------- public ------------------------------- */

  setVolume(v: number) {
    this.vol = Math.max(0, Math.min(1, v));
    const ctx = this.ctx;
    if (!ctx) return;
    const at = ctx.currentTime;
    this.main?.fade(this.vol, at, 0.3);
    this.layer?.fade(this.vol * 0.6, at, 0.3);
  }

  play(mode: Ambient) {
    const ctx = this.ensureCtx();
    if (mode === "off") {
      this.stopMain();
      return;
    }
    if (this.mainKey === mode && this.main) {
      this.main.fade(this.vol, ctx!.currentTime, 0.4);
      return;
    }
    this.stopMain();
    this.mainKey = mode;
    this.main = this.buildVoice(mode, 1);
  }

  setLayer(mode: Ambient) {
    const ctx = this.ensureCtx();
    if (mode === "off" || mode === this.mainKey) {
      this.stopLayer();
      return;
    }
    if (this.layerKey === mode && this.layer) {
      this.layer.fade(this.vol * 0.6, ctx!.currentTime, 0.4);
      return;
    }
    this.stopLayer();
    this.layerKey = mode;
    this.layer = this.buildVoice(mode, 0.6);
  }

  private stopMain() {
    const ctx = this.ctx;
    if (this.main && ctx) this.main.kill(ctx.currentTime);
    this.main = null;
    this.mainKey = "off";
  }

  private stopLayer() {
    const ctx = this.ctx;
    if (this.layer && ctx) this.layer.kill(ctx.currentTime);
    this.layer = null;
    this.layerKey = "off";
  }

  stop() {
    this.stopLayer();
    this.stopMain();
  }

  /** Soft three-note bell when a session ends. */
  chime(volume = 0.5) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      const t0 = now + i * 0.16;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.22 * volume, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 1.7);
    });
  }

  /** Short UI blip. */
  blip(volume = 0.4) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(760, now);
    osc.frequency.exponentialRampToValueAtTime(1240, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.12 * volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }
}

export const audio = new AmbienceEngine();
