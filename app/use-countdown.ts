"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { newCountdown, pauseCountdown, readCountdown, startCountdown, tickCountdown, type Countdown } from "./countdown-logic";

export function useCountdown(key: string, initialDuration: number) {
  const [saved, setSaved] = useState(() => ({ key, timer: newCountdown(initialDuration) }));
  const current = useRef(saved.timer);
  const commit = useCallback((next: Countdown) => {
    current.current = next;
    setSaved({ key, timer: next });
    try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* Workout persistence reports storage failures separately. */ }
  }, [key]);

  useEffect(() => {
    let next = newCountdown(initialDuration);
    try { next = readCountdown(JSON.parse(window.localStorage.getItem(key) ?? "null"), initialDuration, Date.now()); } catch { /* A bad timer never blocks workout recovery. */ }
    current.current = next;
    const initial = window.setTimeout(() => setSaved({ key, timer: current.current }), 0);
    const tick = () => {
      if (current.current.deadline === null) return;
      const nextTimer = tickCountdown(current.current, Date.now());
      if (nextTimer.remaining === current.current.remaining && nextTimer.deadline === current.current.deadline) return;
      current.current = nextTimer;
      setSaved({ key, timer: nextTimer });
      if (nextTimer.finished) {
        try { window.localStorage.setItem(key, JSON.stringify(nextTimer)); } catch { /* Nonessential timer state. */ }
        if (document.visibilityState === "visible" && navigator.vibrate) navigator.vibrate([180, 100, 180]);
      }
    };
    const interval = window.setInterval(tick, 500);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); document.removeEventListener("visibilitychange", tick); };
  }, [key, initialDuration]);

  const visible = saved.key === key ? saved.timer : newCountdown(initialDuration);
  return {
    ...visible,
    running: visible.deadline !== null,
    start: (duration?: number) => commit(startCountdown(duration ? newCountdown(duration) : current.current, Date.now())),
    pause: () => commit(pauseCountdown(current.current, Date.now())),
    reset: (duration = current.current.duration) => commit(newCountdown(duration)),
    addTime: (seconds: number) => {
      const next = tickCountdown(current.current, Date.now());
      commit({ ...next, remaining: Math.min(3600, next.remaining + seconds), duration: Math.min(3600, next.duration + seconds), deadline: next.deadline === null ? null : next.deadline + seconds * 1000, finished: false });
    },
  };
}
