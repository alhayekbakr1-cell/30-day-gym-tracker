import type { TrackerState, SetLog } from "./tracker-types";
import { effectiveExerciseId, scheduledDate, convertLoad, numeric } from "./tracker-logic";
import { EXERCISE_LIBRARY, canonicalExerciseId } from "./workout-data";
import { exercisePrescriptionFor } from "./session-logic";

export type ExerciseExposure = {
  id: string; exerciseId: string; name: string; date: string; sessionKey: string;
  sessionId: string; workoutId: string; slot: string; unit: "kg" | "lb";
  countUnit: "reps" | "seconds"; completed: boolean; sets: SetLog[];
  prescription: ReturnType<typeof exercisePrescriptionFor>;
};
/** Read-only projection. Each variant keeps its own effective identity and raw units. */
export function exerciseHistory(state: TrackerState): ExerciseExposure[] {
  return Object.entries(state.workouts).flatMap(([key, log]) => {
    const date = scheduledDate(state, Number(key));
    if (!date) return [];
    return Object.entries(log.sets).flatMap(([slot, sets]) => {
      if (!sets.some(set => set.done || set.load || set.reps || set.rir)) return [];
      const exerciseId = canonicalExerciseId(effectiveExerciseId(log, slot));
      const prescription = exercisePrescriptionFor(state, Number(key), slot, log);
      return [{ id: `${key}:${slot}`, exerciseId, name: EXERCISE_LIBRARY[exerciseId]?.name ?? exerciseId,
        date, sessionKey: key, sessionId: log.prescription?.sessionId ?? `${state.blockId ?? "legacy"}:${key}`,
        workoutId: log.workoutId, slot, unit: log.loadUnit, countUnit: /sec/i.test(prescription.reps) ? "seconds" as const : "reps" as const,
        completed: log.completed, sets: sets.map(set => ({ ...set })), prescription: { ...prescription } }];
    });
  }).sort((a, b) => b.date.localeCompare(a.date) || Number(b.sessionKey) - Number(a.sessionKey) || a.slot.localeCompare(b.slot));
}
export function filterExerciseHistory(rows: ExerciseExposure[], id: string, firstDate: string | null) {
  return rows.filter(row => row.exerciseId === id && (!firstDate || row.date >= firstDate));
}
export function bestCompletedLoad(row: ExerciseExposure, unit: "kg" | "lb") {
  if (row.countUnit === "seconds") return null;
  const loads = row.sets.filter(set => set.done && numeric(set.reps) !== null && Number(set.reps) > 0)
    .flatMap(set => { const load = numeric(set.load); return load === null ? [] : [convertLoad(load, row.unit, unit)]; });
  return loads.length ? Math.max(...loads) : null;
}
