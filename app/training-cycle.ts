import { availableExercise, equipmentAlternatives } from "./equipment-logic";
import { FOUR_DAY_EXERCISES, fourDayWorkoutId, isFourDayKey, type ExercisePrescription, type VarietyPrescription } from "./four-day-data";
import { dayDifference, isIsoDate, loadRecommendation, localIsoDate, previousPerformance, scheduledDate, workoutForDay } from "./tracker-logic";
import type { TrackerState } from "./tracker-types";
import { canonicalExerciseId, EXERCISE_LIBRARY, workoutIndexForDay } from "./workout-data";

export type TrainingCycle = { id: string; version: 1; enabled: boolean; startsOn: string; modifiedAt: string };

/** Calendar months, anchored to the original day; Jan 31 -> Mar 31, never 56 days. */
export function cycleDate(startsOn: string, months: number) {
  const [year, month, day] = startsOn.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1 + months, 1, 12));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12)).getUTCDate();
  first.setUTCDate(Math.min(day, lastDay));
  return first.toISOString().slice(0, 10);
}
export function cycleBlock(startsOn: string, date: string) {
  if (date < startsOn) return -1;
  const a = startsOn.split("-").map(Number), b = date.split("-").map(Number);
  let block = Math.max(0, Math.floor(((b[0] - a[0]) * 12 + b[1] - a[1]) / 2));
  if (date < cycleDate(startsOn, block * 2)) block--;
  return block;
}
export function cleanTrainingCycle(value: unknown): TrainingCycle | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as TrainingCycle;
  if (Object.keys(raw).length !== 5 || Object.keys(raw).some(key => !["id", "version", "enabled", "startsOn", "modifiedAt"].includes(key))) return null;
  if (raw.version !== 1 || typeof raw.id !== "string" || !/^[\w-]{1,80}$/.test(raw.id)
    || typeof raw.enabled !== "boolean" || !isIsoDate(raw.startsOn) || typeof raw.modifiedAt !== "string"
    || raw.modifiedAt.length > 40 || !Number.isFinite(Date.parse(raw.modifiedAt))) return null;
  return { id: raw.id, version: 1, enabled: raw.enabled, startsOn: raw.startsOn, modifiedAt: raw.modifiedAt };
}
export function activateTrainingCycle(state: TrackerState, startsOn: string, id: string, now = new Date().toISOString(), today = localIsoDate()): TrackerState {
  const existing = state.trainingCycle;
  if (!state.startDate || (!existing && (!isIsoDate(startsOn) || startsOn < today || startsOn < state.startDate || !/^[\w-]{1,80}$/.test(id)))) throw new Error("Choose a start on or after today in your existing plan.");
  return { ...state, schemaVersion: 9, trainingCycle: existing
    ? { ...existing, enabled: true, modifiedAt: now }
    : { id, version: 1, enabled: true, startsOn, modifiedAt: now } };
}

const pools: Record<string, readonly (readonly string[])[]> = {
  "hammer-curl": [["hammer-curl", "db-supinated-curl"], ["incline-db-curl", "concentration-curl"], ["db-supinated-curl", "hammer-curl"]],
  "triceps-extension": [["triceps-extension", "lying-db-triceps"], ["single-arm-overhead-triceps", "lying-db-triceps"], ["lying-db-triceps", "triceps-extension"]],
  "lateral-raise-a": [["lateral-raise-a", "chest-supported-rear-delt-fly"], ["standing-db-lateral-raise", "chest-supported-rear-delt-fly"], ["lateral-raise-a", "chest-supported-rear-delt-fly"]],
  "calf-raise": [["calf-raise", "leg-press-calf"], ["leg-press-calf", "calf-raise"]],
  "front-plank": [["front-plank", "dead-bug"], ["side-plank", "bird-dog"], ["dead-bug", "front-plank"]],
  "dead-bug": [["dead-bug", "bird-dog"], ["bird-dog", "dead-bug"], ["dead-bug", "side-plank"]],
  "cable-crunch": [["dead-bug", "front-plank"], ["bird-dog", "side-plank"], ["front-plank", "dead-bug"]],
};
export function varietyOptions(slot: string) {
  return [...new Set([slot, ...Object.values(pools[canonicalExerciseId(slot)] ?? []).flat()])];
}
function laneFor(id: string, day: number) {
  if (isFourDayKey(day)) return id === "UA" || id === "LA" ? 0 : 1;
  if (["G", "H", "I"].includes(id)) return 0;
  if (["J", "K", "L"].includes(id)) return 1;
  return workoutIndexForDay(day) % 2;
}
function movementFor(state: TrackerState, slot: string, block: number, lane: number, chosen: Set<string>) {
  const choices = pools[canonicalExerciseId(slot)];
  const preferred = choices?.[block % choices.length]?.[lane];
  // A confirmed cable-crunch station stays available; never infer a high pulley
  // or a rope attachment from the separate pulldown or seated-row station.
  const candidates = slot === "cable-crunch" && availableExercise(slot, state.equipment)
    ? [slot, ...(choices?.[block % choices.length] ?? [])]
    : [preferred, ...(choices?.[block % choices.length] ?? []), slot, ...varietyOptions(slot), ...equipmentAlternatives(slot, state.equipment)];
  const available = [...new Set(candidates.filter((id): id is string => !!id))].filter(id => availableExercise(id, state.equipment));
  return available.find(id => !chosen.has(id)) ?? available[0] ?? slot;
}
function recoveryAllowsIncrease(state: TrackerState, days: number[]) {
  return days.every(day => {
    const log = state.workouts[String(day)];
    const sleep = Number(log.readiness.sleepHours), energy = Number(log.readiness.energy), sore = Number(log.readiness.soreness);
    return !log.lowSleep && !(sleep > 0 && sleep < 6) && !(energy > 0 && energy <= 2) && sore < 4;
  });
}
function mayAdvance(state: TrackerState, day: number, slot: string, id: string, target: ExercisePrescription, startsOn: string) {
  if (/sec/i.test(target.reps) || id === "assisted-pullup") return false;
  const date = scheduledDate(state, day)!;
  const recentUnfinished = Object.entries(state.workouts).some(([key, log]) => {
    const exposure = scheduledDate(state, Number(key));
    return exposure && exposure >= startsOn && exposure < date && dayDifference(exposure, date) <= 28 && !log.completed
      && Object.entries(log.sets).some(([savedSlot, sets]) => canonicalExerciseId(log.substitutions[savedSlot] ?? savedSlot) === canonicalExerciseId(id)
        && sets.some(set => set.done || set.load || set.reps || set.rir));
  });
  if (recentUnfinished) return false;
  const previous = previousPerformance(state, day, slot, id);
  if (!previous) return false;
  const history = previous.history.filter(entry => entry.date && entry.date >= startsOn && dayDifference(entry.date, date) <= 28);
  if (history.length < 2 || !recoveryAllowsIncrease(state, history.slice(0, 2).map(entry => entry.day))) return false;
  return loadRecommendation(id, { ...history[0], history }, state.profile.loadUnit, target).kind === "increase";
}

/** Pure prospective generation. A saved session never runs through this path. */
export function varietyForSession(state: TrackerState, day: number, base: Record<string, ExercisePrescription>) {
  const cycle = state.trainingCycle, date = scheduledDate(state, day);
  if (!cycle?.enabled || !date || date < cycle.startsOn || state.workouts[String(day)]) return null;
  const block = cycleBlock(cycle.startsOn, date), workout = workoutForDay(state, day);
  const lane = laneFor(workout.id, day), chosen = new Set<string>();
  const substitutions: Record<string, string> = {};
  const exercises: Record<string, ExercisePrescription> = {};
  const earlier = Object.entries(state.workouts).filter(([key, log]) => (scheduledDate(state, Number(key)) ?? "") < date && log.workoutId === workout.id
    && log.prescription?.program === "variety" && log.prescription.cycleId === cycle.id)
    .sort(([a], [b]) => (scheduledDate(state, Number(b)) ?? "").localeCompare(scheduledDate(state, Number(a)) ?? ""));
  const alreadyAdvanced = earlier.some(([, log]) => log.prescription?.program === "variety" && log.prescription.block === block && log.prescription.advancedSlot);
  let advancedSlot: string | null = null;
  for (const item of workout.pairs.flatMap(pair => pair.exercises)) {
    const id = movementFor(state, item.id, block, lane, chosen); chosen.add(id);
    if (id !== item.id) substitutions[item.id] = id;
    const configured = base[item.id];
    const cap = isFourDayKey(day) ? FOUR_DAY_EXERCISES[fourDayWorkoutId(day)].find(exercise => exercise.id === item.id)!.targetSets : 3;
    const latest = earlier.find(([, log]) => (log.substitutions[item.id] ?? item.id) === id);
    const last = latest && dayDifference(scheduledDate(state, Number(latest[0]))!, date) <= 28 ? latest[1].prescription?.exercises[item.id] : undefined;
    const reps = id === item.id ? configured.reps : EXERCISE_LIBRARY[id].reps;
    const target = { ...configured, reps, sets: Math.min(cap, Math.max(configured.sets, last?.sets ?? 0)), rir: last?.rir ?? 3 };
    const ready = block > 0 && mayAdvance(state, day, item.id, id, target, cycle.startsOn);
    // One variable at a time: the first checkpoint adjusts reserve; later
    // checkpoints can add one set to one movement, within existing volume caps.
    if (block > 0 && ready && target.rir === 3) target.rir = 2;
    else if (block >= 2 && ready && target.rir === 2 && target.sets < cap && !alreadyAdvanced && !advancedSlot) {
      target.sets++; advancedSlot = item.id;
    }
    // As with the original four-day prescription, reps belong to the slot;
    // the frozen substitution resolves its actual rep/duration range.
    exercises[item.id] = { ...target, reps: configured.reps };
  }
  const prescription: VarietyPrescription = { program: "variety", templateVersion: 1, sessionId: `${state.blockId}:${day}`, cycleId: cycle.id, block, advancedSlot, exercises };
  return { prescription, substitutions };
}
