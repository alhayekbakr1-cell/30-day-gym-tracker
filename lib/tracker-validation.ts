import { cleanEquipment, defaultEquipment } from "../app/equipment-logic";
import type {
  DailyMetric,
  ProfileSettings,
  ReadinessLog,
  SetLog,
  TrackerState,
  WorkoutLog,
} from "../app/tracker-types";
import type { WorkoutId } from "../app/workout-data";
import { dayDifference, isIsoDate, scheduledDate } from "../app/tracker-logic";
import { validSet } from "../app/session-logic";
import { isTrainingDayNumber, EXERCISE_LIBRARY, WARMUP_ITEMS, WORKOUTS, workoutIdForDay } from "../app/workout-data";
import { FOUR_DAY_EXERCISES, FOUR_DAY_ROTATION, FOUR_DAY_KEY_START, fourDayWorkoutId, isFourDayKey, type FourDayPlan, type FourDaySets, type SessionPrescription } from "../app/four-day-data";

const allowedWarmups = new Set<string>(WARMUP_ITEMS.map((item) => item.id));
const allowedExercises = new Set(Object.keys(EXERCISE_LIBRARY));
const allowedWorkoutIds = new Set(Object.keys(WORKOUTS));

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function cleanTimestamp(value: unknown): string {
  if (typeof value !== "string" || value.length > 40) return new Date(0).toISOString();
  return Number.isNaN(Date.parse(value)) ? new Date(0).toISOString() : value;
}

function cleanIsoDate(value: unknown): string | null {
  return isIsoDate(value) ? value : null;
}

function cleanSet(value: unknown): SetLog {
  const item = isRecord(value) ? value : {};
  const set = {
    done: item.done === true,
    load: cleanText(item.load, 12),
    reps: cleanText(item.reps, 12),
    rir: cleanText(item.rir, 4),
  };
  return { ...set, done: set.done && validSet(set) };
}

function cleanWorkout(value: unknown, day: number, programVersion: 1 | 2 | 3): WorkoutLog {
  const item = isRecord(value) ? value : {};
  const readinessSource = isRecord(item.readiness) ? item.readiness : {};
  const warmupSource = isRecord(item.warmup) ? item.warmup : {};
  const setsSource = isRecord(item.sets) ? item.sets : {};
  const substitutionsSource = isRecord(item.substitutions)
    ? item.substitutions
    : {};
  const warmup: Record<string, boolean> = {};
  const sets: Record<string, SetLog[]> = {};
  const substitutions: Record<string, string> = {};

  for (const [key, checked] of Object.entries(warmupSource)) {
    if (allowedWarmups.has(key)) warmup[key] = checked === true;
  }

  for (const [key, rawSets] of Object.entries(setsSource)) {
    if (!allowedExercises.has(key) || !Array.isArray(rawSets)) continue;
    sets[key] = rawSets.slice(0, 3).map(cleanSet);
  }

  for (const [key, substitution] of Object.entries(substitutionsSource)) {
    if (
      allowedExercises.has(key) &&
      typeof substitution === "string" &&
      allowedExercises.has(substitution)
    ) {
      substitutions[key] = substitution;
    }
  }

  const readiness: ReadinessLog = {
    energy: cleanText(readinessSource.energy, 2),
    sleepHours: cleanText(readinessSource.sleepHours, 5),
    soreness: cleanText(readinessSource.soreness, 2),
  };

  return {
    completed: item.completed === true,
    completedAt:
      item.completedAt === null ? null : cleanTimestamp(item.completedAt),
    lowSleep: item.lowSleep === true,
    loadUnit: item.loadUnit === "kg" ? "kg" : "lb",
    modifiedAt: cleanTimestamp(item.modifiedAt),
    note: cleanText(item.note, 500),
    readiness,
    sets,
    substitutions,
    warmup,
    workoutId: typeof item.workoutId === "string" && allowedWorkoutIds.has(item.workoutId)
      ? item.workoutId as WorkoutId
      : workoutIdForDay(day, programVersion),
  };
}

function cleanMetric(value: unknown, fallbackUnit: "kg" | "lb"): DailyMetric {
  const item = isRecord(value) ? value : {};
  return {
    modifiedAt: cleanTimestamp(item.modifiedAt),
    protein: cleanText(item.protein, 7),
    sleepHours: cleanText(item.sleepHours, 5),
    steps: cleanText(item.steps, 8),
    waist: cleanText(item.waist, 7),
    weight: cleanText(item.weight, 7),
    weightUnit: item.weightUnit === "kg" ? "kg" : item.weightUnit === "lb" ? "lb" : fallbackUnit,
  };
}

function cleanProfile(value: unknown): ProfileSettings {
  const item = isRecord(value) ? value : {};
  return {
    loadUnit: item.loadUnit === "kg" ? "kg" : "lb",
    modifiedAt: cleanTimestamp(item.modifiedAt),
    proteinGoal: cleanText(item.proteinGoal, 7),
    stepGoal: typeof item.stepGoal === "string" ? cleanText(item.stepGoal, 8) : "7000",
    weightUnit: item.weightUnit === "kg" ? "kg" : "lb",
  };
}

function cleanFourDayPlan(value: unknown): FourDayPlan | null {
  if (!isRecord(value) || value.version !== 1 || typeof value.id !== "string" || !/^[\w-]{1,80}$/.test(value.id)
    || !isIsoDate(value.startsOn) || !isRecord(value.sets) || !isRecord(value.shifts) || (value.rir !== 2 && value.rir !== 3)
    || value.modifiedAt !== cleanTimestamp(value.modifiedAt)) return null;
  const sets = {} as FourDaySets;
  if (Object.keys(value.sets).length !== 4) return null;
  for (const id of FOUR_DAY_ROTATION) {
    const raw = value.sets[id];
    if (!isRecord(raw) || Object.keys(raw).length !== FOUR_DAY_EXERCISES[id].length) return null;
    sets[id] = {};
    for (const item of FOUR_DAY_EXERCISES[id]) {
      const count = raw[item.id];
      if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > item.targetSets) return null;
      sets[id][item.id] = count;
    }
  }
  if (Object.keys(value.shifts).length > 5000) return null;
  const shifts: Record<string, number> = {};
  for (const [key, shift] of Object.entries(value.shifts)) {
    if (!isFourDayKey(Number(key)) || String(Number(key)) !== key || typeof shift !== "number" || !Number.isInteger(shift) || Math.abs(shift) > 36525) return null;
    shifts[key] = shift;
  }
  return { id: value.id, version: 1, startsOn: value.startsOn, modifiedAt: cleanTimestamp(value.modifiedAt), sets, rir: value.rir === 2 ? 2 : 3, shifts };
}

function cleanPrescription(value: unknown, key: number, plan: FourDayPlan): SessionPrescription | null {
  if (!isRecord(value) || value.program !== 4 || value.templateVersion !== 1 || value.sessionId !== `${plan.id}:${key}` || !isRecord(value.exercises)) return null;
  const template = FOUR_DAY_EXERCISES[fourDayWorkoutId(key)];
  if (Object.keys(value.exercises).length !== template.length) return null;
  const exercises: SessionPrescription["exercises"] = {};
  for (const item of template) {
    const raw = value.exercises[item.id];
    if (!isRecord(raw) || typeof raw.sets !== "number" || !Number.isInteger(raw.sets) || raw.sets < 1 || raw.sets > item.targetSets
      || raw.reps !== item.reps || raw.restSeconds !== item.restSeconds || (raw.rir !== 2 && raw.rir !== 3)) return null;
    exercises[item.id] = { sets: raw.sets, reps: item.reps, restSeconds: item.restSeconds, rir: raw.rir };
  }
  return { program: 4, templateVersion: 1, sessionId: `${plan.id}:${key}`, exercises };
}

export function sanitizeTrackerState(value: unknown): TrackerState | null {
  if (!isRecord(value)) return null;
  if (typeof value.schemaVersion === "number" && value.schemaVersion > 7) return null;
  const programVersion: 1 | 2 | 3 = value.programVersion === 1 ? 1 : value.programVersion === 2 ? 2 : 3;

  const startDate = value.startDate === null ? null : cleanIsoDate(value.startDate);
  if (value.startDate !== null && !startDate) {
    return null;
  }
  const fourDayPlan = value.fourDayPlan == null ? null : cleanFourDayPlan(value.fourDayPlan);
  if (value.fourDayPlan != null && (!fourDayPlan || (value.schemaVersion !== 6 && value.schemaVersion !== 7) || !startDate || fourDayPlan.startsOn < startDate)) return null;

  const source = isRecord(value.workouts) ? value.workouts : {};
  const workouts: Record<string, WorkoutLog> = {};
  for (const [day, workout] of Object.entries(source).slice(0, 2500)) {
    const dayNumber = Number(day);
    if (String(dayNumber) !== day) return null;
    if (isFourDayKey(dayNumber)) {
      if (!fourDayPlan || !isRecord(workout) || workout.workoutId !== fourDayWorkoutId(dayNumber)) return null;
      const prescription = cleanPrescription(workout.prescription, dayNumber, fourDayPlan);
      if (!prescription) return null;
      workouts[day] = { ...cleanWorkout(workout, dayNumber, programVersion), prescription };
    } else if (isTrainingDayNumber(dayNumber) && dayNumber <= 36_525) {
      if (isRecord(workout) && FOUR_DAY_ROTATION.includes(workout.workoutId as typeof FOUR_DAY_ROTATION[number])) return null;
      workouts[day] = cleanWorkout(workout, dayNumber, programVersion);
    }
  }


  const scheduleSource = isRecord(value.schedule) ? value.schedule : {};
  const schedule: Record<string, string> = {};
  for (const [day, rawDate] of Object.entries(scheduleSource).slice(0, 5000)) {
    const dayNumber = Number(day);
    const date = cleanIsoDate(rawDate);
    if (((isTrainingDayNumber(dayNumber) && dayNumber <= 36_525) || (fourDayPlan && isFourDayKey(dayNumber))) && date) schedule[day] = date;
  }

  const metricsSource = isRecord(value.dailyMetrics) ? value.dailyMetrics : {};
  const profile = cleanProfile(value.profile);
  const dailyMetrics: Record<string, DailyMetric> = {};
  for (const [date, metric] of Object.entries(metricsSource).slice(0, 3650)) {
    if (cleanIsoDate(date)) dailyMetrics[date] = cleanMetric(metric, profile.weightUnit);
  }

  const equipment = value.equipment === undefined && value.schemaVersion !== 7 ? defaultEquipment() : cleanEquipment(value.equipment, allowedExercises);
  if (!equipment) return null;
  const state: TrackerState = {
    equipment,
    fourDayPlan,
    blockId: typeof value.blockId === "string" ? cleanText(value.blockId, 80) : startDate,
    dailyMetrics,
    programVersion,
    profile,
    schedule,
    scheduleModifiedAt: cleanTimestamp(value.scheduleModifiedAt),
    schemaVersion: 7,
    startDate,
    workouts,
  };
  if (fourDayPlan) {
    // Date discontinuities occur only at a shift or an explicit override.
    // Check those boundaries so malformed backups cannot hide colliding sessions.
    const boundaries = new Set([FOUR_DAY_KEY_START, ...Object.keys(fourDayPlan.shifts).map(Number), ...Object.keys(schedule).map(Number).filter(isFourDayKey)]);
    for (const key of [...boundaries]) {
      if (isFourDayKey(key + 1)) boundaries.add(key + 1);
      if (isFourDayKey(key + 2)) boundaries.add(key + 2);
    }
    for (const key of boundaries) {
      const date = scheduledDate(state, key)!;
      if (!isIsoDate(date) || date < fourDayPlan.startsOn) return null;
      if (key > FOUR_DAY_KEY_START && dayDifference(scheduledDate(state, key - 1)!, date) < 1) return null;
      if (key > FOUR_DAY_KEY_START + 1 && dayDifference(scheduledDate(state, key - 2)!, date) < 2) return null;
    }
    const firstDate = scheduledDate(state, FOUR_DAY_KEY_START)!;
    if (Object.keys(workouts).map(Number).filter(key => !isFourDayKey(key)).some(key => dayDifference(scheduledDate(state, key)!, firstDate) < 2)) return null;
  }
  return state;
}
