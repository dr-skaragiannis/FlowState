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

    const len = Math.floor(ctx.sampleRate * 5);
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
    src.start(at, Math.random() * 2.5);
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
    src.start(at, Math.random() * 2.5);
    src.stop(at + dur + 0.05);
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
      const id = window.setTimeout(tick, minMs);
      timers.add(id);
    };

    switch (mode) {
      case "rain": {
        const s = noiseSrc("white", 1);
        const hp = filter("highpass", 420, 0.7);
        const bp = filter("bandpass", 1250, 0.35);
        const amp = gain(1.05);
        lfo(0.19, 0.14, amp.gain);
        s.connect(hp);
        hp.connect(bp);
        bp.connect(amp);
        amp.connect(out);
        every(() => {
          const n = 1 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++)
            this.droplet(ctx, out, ctx.currentTime + Math.random() * 0.5, 0.03 + Math.random() * 0.03);
        }, 160, 620);
        break;
      }
      case "waves": {
        const s = noiseSrc("brown", 1);
        const lp = filter("lowpass", 760, 0.8);
        const amp = gain(1.0);
        lfo(0.082, 0.62, amp.gain);
        lfo(0.082, 400, lp.frequency);
        s.connect(lp);
        lp.connect(amp);
        amp.connect(out);
        every(() => this.burst(ctx, out, ctx.currentTime + Math.random() * 0.6, 500, 0.7, 0.05, 1.6, "white", 0.7), 1400, 4200);
        break;
      }
      case "wind": {
        const s = noiseSrc("brown", 1);
        const lp = filter("lowpass", 520, 0.9);
        const bp = filter("bandpass", 760, 0.6);
        const whistle = filter("bandpass", 1250, 3.5);
        const whistleAmp = gain(0.16);
        const amp = gain(1.0);
        lfo(0.058, 0.55, amp.gain);
        lfo(0.041, 280, lp.frequency);
        lfo(0.033, 550, whistle.frequency);
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
        const amp = gain(1.0);
        lfo(0.11, 0.24, amp.gain);
        s.connect(lp);
        lp.connect(amp);
        amp.connect(out);
        every(() => this.crackle(ctx, out, ctx.currentTime + Math.random() * 0.35, 0.1 + Math.random() * 0.12), 90, 520);
        break;
      }
      case "night": {
        const s = noiseSrc("brown", 1);
        const lp = filter("lowpass", 250, 0.5);
        const amp = gain(0.95);
        lfo(0.045, 0.22, amp.gain);
        s.connect(lp);
        lp.connect(amp);
        amp.connect(out);
        every(() => this.cricket(ctx, out, ctx.currentTime + Math.random() * 0.4, 0.035 + Math.random() * 0.03), 650, 2600);
        break;
      }
      case "cafe": {
        const s = noiseSrc("brown", 1);
        const bp = filter("bandpass", 410, 0.55);
        const amp = gain(1.35);
        lfo(0.14, 0.28, amp.gain);
        s.connect(bp);
        bp.connect(amp);
        amp.connect(out);
        every(() => {
          const n = 1 + Math.floor(Math.random() * 2);
          for (let i = 0; i < n; i++)
            this.murmur(ctx, out, ctx.currentTime + Math.random() * 0.8, 0.09 + Math.random() * 0.06);
        }, 420, 1700);
        every(() => this.burst(ctx, out, ctx.currentTime + Math.random() * 0.4, 2600 + Math.random() * 1800, 12, 0.05, 0.22), 3200, 9000);
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
        s.start(t0 + Math.random() * 0.04);
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
