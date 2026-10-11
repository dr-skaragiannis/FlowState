import { useCallback, useEffect, useRef, useState } from "react";

/* ---------------------------------- ids ---------------------------------- */

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/* -------------------------------- storage -------------------------------- */

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      const parsed = JSON.parse(raw) as T;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && !Array.isArray(initial)) {
        return { ...(initial as object), ...(parsed as object) } as T;
      }
      return parsed;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota / private mode — ignore */
    }
  }, [key, value]);

  return [value, setValue] as const;
}

/* ---------------------------------- time --------------------------------- */

export const MIN = 60;

export function fmtClock(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function fmtDuration(seconds: number) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function dayLabel(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3);
}

export function isToday(ts: number) {
  return startOfDay(ts) === startOfDay(Date.now());
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/* -------------------------------- numbers -------------------------------- */

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/* --------------------------------- events -------------------------------- */

export function useToasts() {
  const [toasts, setToasts] = useState<{ id: string; text: string; icon?: string }[]>([]);
  const timers = useRef<Record<string, number>>({});

  const push = useCallback((text: string, icon?: string) => {
    const id = uid();
    setToasts((t) => [...t.slice(-2), { id, text, icon }]);
    timers.current[id] = window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
      delete timers.current[id];
    }, 2800);
  }, []);

  useEffect(
    () => () => {
      Object.values(timers.current).forEach(clearTimeout);
    },
    [],
  );

  return { toasts, push };
}

/** Fires when a value turns true. */
export function useOnTrue(value: boolean, fn: () => void) {
  const prev = useRef(value);
  useEffect(() => {
    if (value && !prev.current) fn();
    prev.current = value;
  }, [value, fn]);
}
