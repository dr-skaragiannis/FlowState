import type { Session, Task } from "../types";
import { uid } from "./utils";

/** Deterministic pseudo-random so first-run demo data looks the same for everyone. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const TITLES = [
  "Draft the Q3 narrative",
  "Refactor the auth module",
  "Sketch onboarding flow",
  "Read: Deep Work, ch. 2",
  "Inbox to zero",
  "Compile research notes",
  "Prototype the dashboard",
  "Write weekly review",
];

export function seedTasks(): Task[] {
  const now = Date.now();
  return TITLES.slice(0, 4).map((title, i) => ({
    id: uid(),
    title,
    estimate: 2 + (i % 3),
    done: i === 0 ? 1 : 0,
    completed: false,
    priority: i === 0 ? "high" : i === 1 ? "normal" : "low",
    createdAt: now - i * 3600_000,
  }));
}

export function seedSessions(): Session[] {
  const rand = rng(20260214);
  const out: Session[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = 83; d >= 0; d--) {
    // skip a few days entirely so the streak & rest-day logic is visible
    if (d === 6 || d === 13 || (d > 40 && d % 11 === 0)) continue;
    const dayStart = today.getTime() - d * 86400000;
    const count = d === 0 ? 2 : 1 + Math.floor(rand() * 4);
    for (let i = 0; i < count; i++) {
      const hour = 9 + Math.floor(rand() * 9);
      const at = dayStart + hour * 3600000 + Math.floor(rand() * 55) * 60000;
      if (at > Date.now()) continue;
      out.push({
        id: uid(),
        phase: "focus",
        seconds: (22 + Math.floor(rand() * 8)) * 60,
        at,
      });
      if (rand() > 0.35) {
        out.push({ id: uid(), phase: rand() > 0.7 ? "long" : "short", seconds: 5 * 60, at: at + 26 * 60000 });
      }
    }
  }
  return out.sort((a, b) => a.at - b.at);
}
