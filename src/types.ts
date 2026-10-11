export type Phase = "focus" | "short" | "long";

export type Priority = "low" | "normal" | "high";

export interface Task {
  id: string;
  title: string;
  estimate: number;
  done: number;
  completed: boolean;
  priority: Priority;
  createdAt: number;
}

export interface Session {
  id: string;
  phase: Phase;
  seconds: number;
  at: number;
  taskId?: string;
}

export type Ambient =
  | "off"
  | "rain"
  | "waves"
  | "wind"
  | "fire"
  | "night"
  | "cafe"
  | "deep"
  | "white"
  | "pink"
  | "drone";

export type AccentKey = "violet" | "sky" | "emerald" | "amber" | "rose";

export interface Settings {
  focus: number;
  short: number;
  long: number;
  longEvery: number;
  autoBreak: boolean;
  autoFocus: boolean;
  chime: boolean;
  ambient: Ambient;
  layer: Ambient;
  volume: number;
  accent: AccentKey;
  dailyGoal: number;
}

export const ACCENTS: Record<AccentKey, { label: string; a: string; b: string }> = {
  violet: { label: "Violet", a: "#8b5cf6", b: "#6366f1" },
  sky: { label: "Sky", a: "#38bdf8", b: "#0ea5e9" },
  emerald: { label: "Emerald", a: "#34d399", b: "#10b981" },
  amber: { label: "Amber", a: "#fbbf24", b: "#f59e0b" },
  rose: { label: "Rose", a: "#fb7185", b: "#f43f5e" },
};

export const PHASE_META: Record<
  Phase,
  { label: string; short: string; hint: string; key: string }
> = {
  focus: { label: "Focus", short: "Focus", hint: "Deep work — one task only", key: "1" },
  short: { label: "Short break", short: "Short", hint: "Stand, breathe, look far away", key: "2" },
  long: { label: "Long break", short: "Long", hint: "Step away and reset", key: "3" },
};

export interface AmbientMeta {
  key: Ambient;
  label: string;
  icon: string;
  group: "Nature" | "Places" | "Noise" | "Tones";
  desc: string;
}

export const AMBIENT_META: AmbientMeta[] = [
  { key: "rain", label: "Rain", icon: "rain", group: "Nature", desc: "Steady rainfall with soft droplets" },
  { key: "waves", label: "Waves", icon: "waves", group: "Nature", desc: "Slow ocean swell on a shore" },
  { key: "wind", label: "Wind", icon: "wind", group: "Nature", desc: "Gusts moving across a field" },
  { key: "fire", label: "Fire", icon: "fire", group: "Nature", desc: "Crackling hearth, low ember rumble" },
  { key: "night", label: "Night", icon: "moon", group: "Nature", desc: "Distant crickets and still air" },
  { key: "cafe", label: "Café", icon: "cafe", group: "Places", desc: "Murmured chatter and cups" },
  { key: "white", label: "White", icon: "wave", group: "Noise", desc: "Even white noise, gently tamed" },
  { key: "pink", label: "Pink", icon: "wave", group: "Noise", desc: "Balanced pink noise, warmer" },
  { key: "deep", label: "Brown", icon: "deep", group: "Noise", desc: "Low rumble that masks speech" },
  { key: "drone", label: "Drone", icon: "drone", group: "Tones", desc: "Slow harmonic pad for flow" },
];

export const AMBIENT_GROUPS = ["Nature", "Places", "Noise", "Tones"] as const;

export const ambientMeta = (k: Ambient): AmbientMeta =>
  AMBIENT_META.find((m) => m.key === k) ?? {
    key: "off",
    label: "Silent",
    icon: "x",
    group: "Nature",
    desc: "No ambience",
  };

/** Sounds that work nicely stacked on top of a main ambience. */
export const LAYER_KEYS: Ambient[] = ["off", "fire", "night", "wind", "rain", "drone"];

export const DEFAULT_SETTINGS: Settings = {
  focus: 25,
  short: 5,
  long: 15,
  longEvery: 4,
  autoBreak: true,
  autoFocus: false,
  chime: true,
  ambient: "off",
  layer: "off",
  volume: 0.45,
  accent: "violet",
  dailyGoal: 8,
};
