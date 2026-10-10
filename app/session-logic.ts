import { availableExercise } from "./equipment-logic";
import type { SetLog, TrackerState, WorkoutLog } from "./tracker-types";
import { convertLoad, formatLoad, numeric, previousPerformance, workoutForDay } from "./tracker-logic";
import { EXERCISE_LIBRARY, WARMUP_ITEMS, workingSetsForDay } from "./workout-data";
import { FOUR_DAY_EXERCISES, fourDayWorkoutId, isFourDayKey, type ExercisePrescription, type SessionPrescription } from "./four-day-data";

const blankSet = (): SetLog => ({ done: false, load: "", reps: "", rir: "" });
export function prescriptionForSession(state: TrackerState, day: number): SessionPrescription | undefined {
  const saved = state.workouts[String(day)]?.prescription;
  if (saved) return saved;
  const plan = state.fourDayPlan;
  if (!isFourDayKey(day) || !plan) return undefined;
  const id = fourDayWorkoutId(day);
  return { program: 4, templateVersion: 1, sessionId: `${plan.id}:${day}`,
    exercises: Object.fromEntries(FOUR_DAY_EXERCISES[id].map(item => [item.id, { sets: plan.sets[id][item.id], reps: item.reps, restSeconds: item.restSeconds, rir: plan.rir }])) };
}
export function hydratedWorkoutLog(state: TrackerState, day: number): WorkoutLog {
  const saved = state.workouts[String(day)];
  const workout = workoutForDay(state, day);
  const base: WorkoutLog = {
    completed: false, completedAt: null, lowSleep: false, loadUnit: state.profile.loadUnit,
    modifiedAt: new Date(0).toISOString(), note: "", readiness: { energy: "", sleepHours: "", soreness: "" },
    sets: Object.fromEntries(workout.pairs.flatMap(pair => pair.exercises).map(item => [item.id, [blankSet(), blankSet(), blankSet()]])),
    substitutions: {}, warmup: Object.fromEntries(WARMUP_ITEMS.map(item => [item.id, false])), workoutId: workout.id,
    ...(isFourDayKey(day) ? { prescription: prescriptionForSession(state, day) } : {}),
  };
  if (!saved) {
    if (workout.id === "UB" && state.equipment.futureUpperBFlat && availableExercise("flat-db-bench", state.equipment)) base.substitutions["machine-press"] = "flat-db-bench";
    return base;
  }
  return { ...base, ...saved, readiness: { ...base.readiness, ...saved.readiness },
    sets: { ...base.sets, ...saved.sets }, warmup: { ...base.warmup, ...saved.warmup }, substitutions: { ...saved.substitutions } };
}
export function exercisePrescriptionFor(state: TrackerState, day: number, slot: string, log = state.workouts[String(day)]): ExercisePrescription {
  const index = workoutForDay(state, day).pairs.flatMap(pair => pair.exercises).findIndex(item => item.id === slot);
  const exercise = workoutForDay(state, day).pairs.flatMap(pair => pair.exercises)[index];
  const frozen = log?.prescription ?? prescriptionForSession(state, day);
  const prescribed = frozen?.exercises[slot] ?? { sets: workingSetsForDay(day, index, Boolean(log?.lowSleep)), reps: exercise?.reps ?? "8–12 reps", restSeconds: index < 4 ? 120 : 90, rir: log?.lowSleep ? 3 : 2 };
  const adjusted = log?.substitutions[slot] ? { ...prescribed, reps: EXERCISE_LIBRARY[log.substitutions[slot]]?.reps ?? prescribed.reps } : prescribed;
  return log?.lowSleep ? { ...adjusted, sets: Math.min(2, adjusted.sets), rir: 3 } : adjusted;
}
export function visibleWorkoutPairs(state: TrackerState, day: number, log: WorkoutLog) {
  let remaining = log.lowSleep ? 4 : Infinity;
  return workoutForDay(state, day).pairs.map(pair => {
    const exercises = pair.exercises.slice(0, remaining);
    remaining -= exercises.length;
    return { ...pair, exercises };
  }).filter(pair => pair.exercises.length);
}
export function warmupItemsForSession(day: number) {
  if (!isFourDayKey(day)) return WARMUP_ITEMS;
  return [
    { id: "cardio", label: "Easy movement", detail: "Begin with a few comfortable minutes on a bike or treadmill." },
    { id: "squats", label: "Comfortable range", detail: "Rehearse today's movements gently; notice any limiting pain." },
    { id: "hinges", label: "Light preparation", detail: "Practice the first lift with a light load and controlled technique." },
    { id: "practice", label: "Ramp toward working weight", detail: "Add non-fatiguing preparation sets for the first lifts as needed." },
  ];
}

export function validSet(set: SetLog) {
  const reps = numeric(set.reps);
  const load = numeric(set.load);
  return reps !== null && Number.isInteger(reps) && reps > 0 && reps <= 10000
    && (!set.load.trim() || (load !== null && load <= 100000));
}

export function sessionProgress(state: TrackerState, day: number, log: WorkoutLog) {
  const pairs = visibleWorkoutPairs(state, day, log);
  const exercises = pairs.flatMap(pair => pair.exercises);
  let total = 0;
  let done = 0;
  let next: { slot: string; name: string; setIndex: number } | null = null;
  exercises.forEach((exercise) => {
    const count = exercisePrescriptionFor(state, day, exercise.id, log).sets;
    for (let setIndex = 0; setIndex < count; setIndex++) {
      total++;
      const set = log.sets[exercise.id]?.[setIndex];
      if (set?.done && validSet(set)) done++;
    }
  });
  // Legacy pairs alternate; the four-day templates use straight sets.
  for (const pair of pairs) {
    const rounds = Math.max(...pair.exercises.map(exercise => exercisePrescriptionFor(state, day, exercise.id, log).sets));
    for (let setIndex = 0; setIndex < rounds && !next; setIndex++) {
      for (const exercise of pair.exercises) {
        if (setIndex >= exercisePrescriptionFor(state, day, exercise.id, log).sets) continue;
        const set = log.sets[exercise.id]?.[setIndex];
        if (!set?.done || !validSet(set)) {
          next = { slot: exercise.id, name: log.substitutions[exercise.id] ? EXERCISE_LIBRARY[log.substitutions[exercise.id]]?.name ?? exercise.name : exercise.name, setIndex };
          break;
        }
      }
    }
  }
  const warmupDone = WARMUP_ITEMS.filter(item => log.warmup[item.id]).length;
  return { done, total, next: next as { slot: string; name: string; setIndex: number } | null, warmupDone, ready: done === total && warmupDone === WARMUP_ITEMS.length };
}

/** Only fill untouched rows. A previous effort is a reference, never a completed set. */
export function copyPreviousSets(state: TrackerState, day: number, log: WorkoutLog, slot: string, count: number) {
  const previous = previousPerformance(state, day, slot, log.substitutions[slot] ?? slot);
  if (!previous) return log;
  const sets = [...(log.sets[slot] ?? [])];
  for (let index = 0; index < count; index++) {
    const current = sets[index];
    if (current && (current.done || current.load || current.reps || current.rir)) continue;
    const prior = previous.sets[index];
    if (!prior) continue;
    const load = numeric(prior.load);
    sets[index] = { done: false, load: load === null ? "" : formatLoad(convertLoad(load, previous.loadUnit, log.loadUnit)), reps: prior.reps, rir: "" };
  }
  return { ...log, sets: { ...log.sets, [slot]: sets } };
}
