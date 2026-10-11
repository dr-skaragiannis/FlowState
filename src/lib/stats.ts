import type { Session, Task } from "../types";
import { dayKey, startOfDay } from "./utils";

export interface DayBucket {
  ts: number;
  key: string;
  minutes: number;
  sessions: number;
}

export function bucketByDay(sessions: Session[], days: number): DayBucket[] {
  const today = startOfDay(Date.now());
  const out: DayBucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const ts = today - i * 86400000;
    out.push({ ts, key: dayKey(ts), minutes: 0, sessions: 0 });
  }
  const index = new Map(out.map((b) => [b.key, b]));
  for (const s of sessions) {
    if (s.phase !== "focus") continue;
    const b = index.get(dayKey(s.at));
    if (b) {
      b.minutes += s.seconds / 60;
      b.sessions += 1;
    }
  }
  return out;
}

export interface DayDetail {
  ts: number;
  key: string;
  focusMinutes: number;
  breakMinutes: number;
  focusCount: number;
  breakCount: number;
  longestMinutes: number;
  firstAt?: number;
  lastAt?: number;
  tasks: { id: string; title: string; minutes: number; sessions: number }[];
}

export function dayDetail(sessions: Session[], tasks: Task[], ts: number): DayDetail {
  const key = dayKey(ts);
  const detail: DayDetail = {
    ts,
    key,
    focusMinutes: 0,
    breakMinutes: 0,
    focusCount: 0,
    breakCount: 0,
    longestMinutes: 0,
    firstAt: undefined,
    lastAt: undefined,
    tasks: [],
  };
  const perTask = new Map<string, { minutes: number; sessions: number }>();

  for (const s of sessions) {
    if (dayKey(s.at) !== key) continue;
    detail.firstAt = detail.firstAt === undefined ? s.at : Math.min(detail.firstAt, s.at);
    detail.lastAt = detail.lastAt === undefined ? s.at : Math.max(detail.lastAt, s.at);
    if (s.phase === "focus") {
      detail.focusCount++;
      detail.focusMinutes += s.seconds / 60;
      detail.longestMinutes = Math.max(detail.longestMinutes, s.seconds / 60);
      if (s.taskId) {
        const cur = perTask.get(s.taskId) ?? { minutes: 0, sessions: 0 };
        cur.minutes += s.seconds / 60;
        cur.sessions += 1;
        perTask.set(s.taskId, cur);
      }
    } else {
      detail.breakCount++;
      detail.breakMinutes += s.seconds / 60;
    }
  }

  detail.tasks = [...perTask.entries()]
    .map(([id, v]) => {
      const t = tasks.find((x) => x.id === id);
      return { id, title: t?.title ?? "Deleted task", minutes: v.minutes, sessions: v.sessions };
    })
    .sort((a, b) => b.minutes - a.minutes);

  return detail;
}

export function focusSecondsOn(sessions: Session[], ts: number) {
  const key = dayKey(ts);
  return sessions.reduce(
    (acc, s) => (s.phase === "focus" && dayKey(s.at) === key ? acc + s.seconds : acc),
    0,
  );
}

export function streak(sessions: Session[]) {
  const focusDays = new Set(sessions.filter((s) => s.phase === "focus").map((s) => dayKey(s.at)));
  let count = 0;
  let cursor = startOfDay(Date.now());
  // allow the streak to survive if today has no session yet
  if (!focusDays.has(dayKey(cursor))) cursor -= 86400000;
  while (focusDays.has(dayKey(cursor))) {
    count++;
    cursor -= 86400000;
  }
  return count;
}

export function bestDayMinutes(buckets: DayBucket[]) {
  return buckets.reduce((m, b) => Math.max(m, b.minutes), 0);
}

/** Average focused minutes across the given window (zero days included). */
export function averageMinutes(buckets: DayBucket[]) {
  const active = buckets.filter((b) => b.minutes > 0);
  if (active.length === 0) return 0;
  return buckets.reduce((a, b) => a + b.minutes, 0) / active.length;
}

export function taskStats(tasks: Task[]) {
  const done = tasks.filter((t) => t.completed).length;
  const pomos = tasks.reduce((a, t) => a + t.done, 0);
  return { done, total: tasks.length, pomos };
}
