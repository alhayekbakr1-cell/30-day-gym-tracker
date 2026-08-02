import type { SetLog, TrackerState, WorkoutLog } from "@/app/tracker-types";
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
  const warmupSource = isRecord(item.warmup) ? item.warmup : {};
  const setsSource = isRecord(item.sets) ? item.sets : {};
  const warmup: Record<string, boolean> = {};
  const sets: Record<string, SetLog[]> = {};

  for (const [key, checked] of Object.entries(warmupSource)) {
    if (allowedWarmups.has(key)) warmup[key] = checked === true;
  }

  for (const [key, rawSets] of Object.entries(setsSource)) {
    if (!allowedExercises.has(key) || !Array.isArray(rawSets)) continue;
    sets[key] = rawSets.slice(0, 3).map(cleanSet);
  }

  return {
    completed: item.completed === true,
    completedAt:
      item.completedAt === null ? null : cleanTimestamp(item.completedAt),
    lowSleep: item.lowSleep === true,
    modifiedAt: cleanTimestamp(item.modifiedAt),
    note: cleanText(item.note, 500),
    sets,
    warmup,
  };
}

export function sanitizeTrackerState(value: unknown): TrackerState | null {
  if (!isRecord(value)) return null;

  const startDate = value.startDate;
  if (
    startDate !== null &&
    (typeof startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(startDate))
  ) {
    return null;
  }

  const source = isRecord(value.workouts) ? value.workouts : {};
  const workouts: Record<string, WorkoutLog> = {};
  for (const [day, workout] of Object.entries(source)) {
    if (allowedDays.has(day)) workouts[day] = cleanWorkout(workout);
  }

  return { startDate, workouts };
}
