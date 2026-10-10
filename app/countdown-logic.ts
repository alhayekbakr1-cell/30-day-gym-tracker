export type Countdown = { duration: number; remaining: number; deadline: number | null; finished: boolean };
export function newCountdown(duration: number): Countdown {
  return { duration, remaining: duration, deadline: null, finished: false };
}
export function remainingSeconds(timer: Countdown, now: number) {
  return timer.deadline === null ? timer.remaining : Math.max(0, Math.ceil((timer.deadline - now) / 1000));
}
export function tickCountdown(timer: Countdown, now: number): Countdown {
  const remaining = remainingSeconds(timer, now);
  return timer.deadline !== null && remaining === 0
    ? { ...timer, remaining: 0, deadline: null, finished: true }
    : { ...timer, remaining };
}
export function startCountdown(timer: Countdown, now: number): Countdown {
  const remaining = remainingSeconds(timer, now) || timer.duration;
  return { ...timer, remaining, deadline: now + remaining * 1000, finished: false };
}
export function pauseCountdown(timer: Countdown, now: number): Countdown {
  const next = tickCountdown(timer, now);
  return { ...next, deadline: null };
}
export function readCountdown(value: unknown, duration: number, now: number): Countdown {
  if (!value || typeof value !== "object") return newCountdown(duration);
  const t = value as Countdown;
  if (!Number.isFinite(t.duration) || t.duration < 1 || t.duration > 3600
    || !Number.isFinite(t.remaining) || t.remaining < 0 || t.remaining > 3600
    || (t.deadline !== null && (!Number.isFinite(t.deadline) || t.deadline > now + 3600000))) return newCountdown(duration);
  return tickCountdown({ duration: t.duration, remaining: t.remaining, deadline: t.deadline, finished: t.finished === true }, now);
}
