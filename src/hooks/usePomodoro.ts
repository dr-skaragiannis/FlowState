import { useCallback, useEffect, useRef, useState } from "react";
import type { Phase, Settings } from "../types";
import { fmtClock } from "../lib/utils";

interface Options {
  settings: Settings;
  onComplete: (phase: Phase, seconds: number) => void;
}

export function usePomodoro({ settings, onComplete }: Options) {
  const durationFor = useCallback(
    (p: Phase) => Math.max(1, Math.round(settings[p])) * 60,
    [settings],
  );

  const [phase, setPhase] = useState<Phase>("focus");
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(() => Math.max(1, settings.focus) * 60);
  const [round, setRound] = useState(1); // 1-based focus round within the current set
  const [totalFocus, setTotalFocus] = useState(0); // completed focus sessions this app-lifetime
  const endsAt = useRef<number | null>(null);
  const raf = useRef<number | null>(null);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  const duration = durationFor(phase);
  const progress = 1 - remaining / duration;

  /* phase changes snap the (idle) timer back to a full duration */
  useEffect(() => {
    if (!running) setRemaining(durationFor(phase));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* duration edits in settings update an idle timer for that phase */
  const prevDur = useRef({ focus: settings.focus, short: settings.short, long: settings.long });
  useEffect(() => {
    const prev = prevDur.current;
    prevDur.current = { focus: settings.focus, short: settings.short, long: settings.long };
    if (running) return;
    if (prev[phase] !== settings[phase]) setRemaining(durationFor(phase));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.focus, settings.short, settings.long]);

  /* ticker — derives remaining from an absolute end timestamp so it stays
     accurate even if the tab is throttled or backgrounded */
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      if (endsAt.current === null) return;
      const left = (endsAt.current - Date.now()) / 1000;
      setRemaining(Math.max(0, left));
      if (left <= 0) {
        endsAt.current = null;
        setRunning(false);
        handleFinish();
      } else {
        raf.current = window.setTimeout(tick, 200);
      }
    };
    raf.current = window.setTimeout(tick, 200);
    return () => {
      if (raf.current) window.clearTimeout(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase, round, settings]);

  const handleFinish = () => {
    const finished = phase;
    completeRef.current(finished, durationFor(finished));

    let next: Phase;
    let nextRound = round;
    if (finished === "focus") {
      setTotalFocus((n) => n + 1);
      next = round % Math.max(1, settings.longEvery) === 0 ? "long" : "short";
      nextRound = round % Math.max(1, settings.longEvery) === 0 ? 1 : round + 1;
    } else {
      next = "focus";
    }
    setRound(nextRound);
    setPhase(next);
    const nextDuration = durationFor(next);
    setRemaining(nextDuration);
    const auto = next === "focus" ? settings.autoFocus : settings.autoBreak;
    if (auto) {
      endsAt.current = Date.now() + nextDuration * 1000;
      setRunning(true);
    } else {
      endsAt.current = null;
    }
  };

  const start = () => {
    if (running) return;
    endsAt.current = Date.now() + remaining * 1000;
    setRunning(true);
  };

  const pause = () => {
    if (!running) return;
    if (endsAt.current) setRemaining(Math.max(0, (endsAt.current - Date.now()) / 1000));
    endsAt.current = null;
    setRunning(false);
  };

  const toggle = () => (running ? pause() : start());

  const reset = () => {
    endsAt.current = null;
    setRunning(false);
    setRemaining(durationFor(phase));
  };

  const skip = () => {
    endsAt.current = null;
    setRunning(false);
    handleFinish();
  };

  const select = (p: Phase) => {
    endsAt.current = null;
    setRunning(false);
    setPhase(p);
    setRemaining(durationFor(p));
  };

  /* live document title */
  useEffect(() => {
    const prefix = running ? "▶" : "❚❚";
    document.title = `${prefix} ${fmtClock(remaining)} · ${phase === "focus" ? "Focus" : "Break"} — Flowstate`;
  }, [remaining, running, phase]);

  return {
    phase,
    running,
    remaining,
    duration,
    progress,
    round,
    totalFocus,
    start,
    pause,
    toggle,
    reset,
    skip,
    select,
  };
}
