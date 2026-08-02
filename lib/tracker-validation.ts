import type {
  DailyMetric,
  ProfileSettings,
  ReadinessLog,
  SetLog,
  TrackerState,
  WorkoutLog,
} from "@/app/tracker-types";
import { SCHEDULED_DAYS, WARMUP_ITEMS, WORKOUTS } from "@/app/workout-data";

const allowedDays = new Set(SCHEDULED_DAYS.map(String));
const allowedWarmups = new Set(WARMUP_ITEMS.map((item) => item.id));
const allowedExercises = new Set(
  Object.values(WORKOUTS).flatMap((workout) =>
    workout.pairs.flatMap((pair) => pair.exercises.map((exercise) => exercise.id)),
  ),
);

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
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : null;
}

function cleanSet(value: unknown): SetLog {
  const item = isRecord(value) ? value : {};
  return {
    done: item.done === true,
    load: cleanText(item.load, 12),
    reps: cleanText(item.reps, 12),
    rir: cleanText(item.rir, 4),
  };
}

function cleanWorkout(value: unknown): WorkoutLog {
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
    modifiedAt: cleanTimestamp(item.modifiedAt),
    note: cleanText(item.note, 500),
    readiness,
    sets,
    substitutions,
    warmup,
  };
}

function cleanMetric(value: unknown): DailyMetric {
  const item = isRecord(value) ? value : {};
  return {
    modifiedAt: cleanTimestamp(item.modifiedAt),
    protein: cleanText(item.protein, 7),
    sleepHours: cleanText(item.sleepHours, 5),
    steps: cleanText(item.steps, 8),
    waist: cleanText(item.waist, 7),
    weight: cleanText(item.weight, 7),
  };
}

function cleanProfile(value: unknown): ProfileSettings {
  const item = isRecord(value) ? value : {};
  return {
    modifiedAt: cleanTimestamp(item.modifiedAt),
    proteinGoal: cleanText(item.proteinGoal, 7),
    stepGoal: cleanText(item.stepGoal, 8) || "7000",
    weightUnit: item.weightUnit === "kg" ? "kg" : "lb",
  };
}

export function sanitizeTrackerState(value: unknown): TrackerState | null {
  if (!isRecord(value)) return null;

  const startDate = value.startDate === null ? null : cleanIsoDate(value.startDate);
  if (value.startDate !== null && !startDate) {
    return null;
  }

  const source = isRecord(value.workouts) ? value.workouts : {};
  const workouts: Record<string, WorkoutLog> = {};
  for (const [day, workout] of Object.entries(source)) {
    if (allowedDays.has(day)) workouts[day] = cleanWorkout(workout);
  }


  const scheduleSource = isRecord(value.schedule) ? value.schedule : {};
  const schedule: Record<string, string> = {};
  for (const [day, rawDate] of Object.entries(scheduleSource)) {
    const date = cleanIsoDate(rawDate);
    if (allowedDays.has(day) && date) schedule[day] = date;
  }

  const metricsSource = isRecord(value.dailyMetrics) ? value.dailyMetrics : {};
  const dailyMetrics: Record<string, DailyMetric> = {};
  for (const [date, metric] of Object.entries(metricsSource).slice(0, 400)) {
    if (cleanIsoDate(date)) dailyMetrics[date] = cleanMetric(metric);
  }

  return {
    dailyMetrics,
    profile: cleanProfile(value.profile),
    schedule,
    scheduleModifiedAt: cleanTimestamp(value.scheduleModifiedAt),
    schemaVersion: 2,
    startDate,
    workouts,
  };
}
