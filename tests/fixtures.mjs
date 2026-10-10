import { createRequire } from "node:module";
export const require = createRequire(import.meta.url);
const { EMPTY_STATE, normalizeTrackerState } = require("../.test-build/app/tracker-logic.js");
export const { WORKOUTS, WARMUP_ITEMS, workingSetsForDay, workoutIdForDay } = require("../.test-build/app/workout-data.js");
export const blankSet = () => ({ done: false, load: "", reps: "", rir: "" });
export function workout(day = 1) {
  const id = workoutIdForDay(day, 3);
  return {
    completed: false, completedAt: null, lowSleep: false, loadUnit: "lb", modifiedAt: "2026-10-01T12:00:00.000Z", note: "",
    readiness: { energy: "", sleepHours: "", soreness: "" },
    sets: Object.fromEntries(WORKOUTS[id].pairs.flatMap(pair => pair.exercises).map(e => [e.id, [blankSet(), blankSet(), blankSet()]])),
    substitutions: {}, warmup: Object.fromEntries(WARMUP_ITEMS.map(item => [item.id, false])), workoutId: id,
  };
}
export function state() {
  return normalizeTrackerState({ ...structuredClone(EMPTY_STATE), startDate: "2026-10-01", blockId: "test-plan", workouts: { 1: workout() } });
}
export const slot = Object.keys(workout().sets)[0];
export function edit(current, field, value, timestamp = "2026-10-02T12:00:00.000Z") {
  const next = structuredClone(current);
  next.workouts[1][field] = value;
  next.workouts[1].modifiedAt = timestamp;
  return next;
}
