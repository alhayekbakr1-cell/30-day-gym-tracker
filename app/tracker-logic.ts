import type {
  DailyMetric,
  ProfileSettings,
  SetLog,
  TrackerState,
  WorkoutLog,
} from "./tracker-types";
import {
  EXERCISE_LIBRARY,
  SCHEDULED_DAYS,
  WORKOUTS,
  workoutIdForDay,
} from "./workout-data";

const ZERO_DATE = new Date(0).toISOString();

export const EMPTY_PROFILE: ProfileSettings = {
  modifiedAt: ZERO_DATE,
  proteinGoal: "",
  stepGoal: "7000",
  weightUnit: "lb",
};

export const EMPTY_STATE: TrackerState = {
  dailyMetrics: {},
  profile: EMPTY_PROFILE,
  schedule: {},
  scheduleModifiedAt: ZERO_DATE,
  schemaVersion: 2,
  startDate: null,
  workouts: {},
};

export function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isoDateOffset(startDate: string, offset: number) {
  const [year, month, date] = startDate.split("-").map(Number);
  return localIsoDate(new Date(year, month - 1, date + offset, 12));
}

export function dayDifference(first: string, second: string) {
  const [firstYear, firstMonth, firstDay] = first.split("-").map(Number);
  const [secondYear, secondMonth, secondDay] = second.split("-").map(Number);
  const firstUtc = Date.UTC(firstYear, firstMonth - 1, firstDay);
  const secondUtc = Date.UTC(secondYear, secondMonth - 1, secondDay);
  return Math.round((secondUtc - firstUtc) / 86_400_000);
}

export function defaultSchedule(startDate: string | null) {
  if (!startDate) return {};
  return Object.fromEntries(
    SCHEDULED_DAYS.map((day) => [String(day), isoDateOffset(startDate, day - 1)]),
  );
}

export function normalizeTrackerState(
  value: Partial<TrackerState> | null | undefined,
): TrackerState {
  if (!value) return EMPTY_STATE;
  const startDate = value.startDate ?? null;
  return {
    dailyMetrics: value.dailyMetrics ?? {},
    profile: { ...EMPTY_PROFILE, ...(value.profile ?? {}) },
    schedule:
      value.schedule && Object.keys(value.schedule).length > 0
        ? value.schedule
        : defaultSchedule(startDate),
    scheduleModifiedAt: value.scheduleModifiedAt ?? ZERO_DATE,
    schemaVersion: 2,
    startDate,
    workouts: value.workouts ?? {},
  };
}

export function scheduledDate(state: TrackerState, day: number) {
  if (!state.startDate) return null;
  return state.schedule[String(day)] ?? isoDateOffset(state.startDate, day - 1);
}

export function challengeDayForDate(startDate: string, date: string) {
  return dayDifference(startDate, date) + 1;
}

export function blankMetric(): DailyMetric {
  return {
    modifiedAt: ZERO_DATE,
    protein: "",
    sleepHours: "",
    steps: "",
    waist: "",
    weight: "",
  };
}

function numeric(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function completedSets(sets: SetLog[]) {
  return sets.filter((set) => set.done && numeric(set.reps) !== null);
}

export function workoutVolume(log?: WorkoutLog) {
  if (!log) return 0;
  return Object.values(log.sets)
    .flat()
    .reduce((total, set) => {
      if (!set.done) return total;
      const load = numeric(set.load);
      const reps = numeric(set.reps);
      return total + (load ?? 0) * (reps ?? 0);
    }, 0);
}

export function effectiveExerciseId(log: WorkoutLog, slotId: string) {
  return log.substitutions?.[slotId] ?? slotId;
}

export function previousPerformance(
  state: TrackerState,
  selectedDay: number,
  slotId: string,
  effectiveId: string,
) {
  const selectedIndex = SCHEDULED_DAYS.indexOf(
    selectedDay as (typeof SCHEDULED_DAYS)[number],
  );

  for (let index = selectedIndex - 1; index >= 0; index -= 1) {
    const day = SCHEDULED_DAYS[index];
    const workout = WORKOUTS[workoutIdForDay(day)];
    const containsSlot = workout.pairs.some((pair) =>
      pair.exercises.some((exercise) => exercise.id === slotId),
    );
    if (!containsSlot) continue;
    const log = state.workouts[String(day)];
    if (!log || effectiveExerciseId(log, slotId) !== effectiveId) continue;
    const sets = completedSets(log.sets[slotId] ?? []);
    if (sets.length === 0) continue;
    return { day, date: scheduledDate(state, day), sets };
  }
  return null;
}

function repRange(reps: string) {
  const values = reps.match(/\d+/g)?.map(Number) ?? [];
  return { high: values[1] ?? values[0] ?? 0, low: values[0] ?? 0 };
}

export function loadRecommendation(
  effectiveId: string,
  previous: ReturnType<typeof previousPerformance>,
) {
  const exercise = EXERCISE_LIBRARY[effectiveId];
  if (!exercise || !previous) {
    return {
      kind: "start" as const,
      text: "First logged exposure—use a light practice set and finish with 2–3 reps in reserve.",
    };
  }

  const { high, low } = repRange(exercise.reps);
  const reps = previous.sets.map((set) => numeric(set.reps) ?? 0);
  const rirs = previous.sets
    .map((set) => (set.rir === "4+" ? 4 : numeric(set.rir)))
    .filter((value): value is number => value !== null);
  const loads = previous.sets
    .map((set) => numeric(set.load))
    .filter((value): value is number => value !== null);
  const isTimed = /sec/i.test(exercise.reps);
  const allAtTop =
    reps.length >= 2 && reps.every((value) => value >= high);
  const anyBelowRange = reps.some((value) => value < low);
  const anyMaxEffort = rirs.some((value) => value <= 0);
  const controlled = rirs.length > 0 && rirs.every((value) => value >= 1 && value <= 3);
  const lastLoad = loads.at(-1);

  if (isTimed) {
    if (allAtTop && controlled) {
      return { kind: "increase" as const, text: "Add 5 seconds while keeping the same braced position." };
    }
    return { kind: "repeat" as const, text: "Repeat the last duration and keep every second technically clean." };
  }

  if (allAtTop && controlled) {
    return {
      kind: "increase" as const,
      text: lastLoad
        ? `Try the next available increment above ${lastLoad} lb.`
        : "Use the next available weight increment.",
    };
  }
  if (anyBelowRange || anyMaxEffort) {
    return {
      kind: "reduce" as const,
      text: "Repeat the load—or reduce one increment—until every set stays in range with control.",
    };
  }
  return {
    kind: "repeat" as const,
    text: lastLoad
      ? `Repeat ${lastLoad} lb and aim for one more clean rep per set.`
      : "Repeat the load and add one clean rep where possible.",
  };
}

export function mergeTrackerStates(
  remoteValue: TrackerState | null,
  localValue: TrackerState,
): TrackerState {
  const remote = normalizeTrackerState(remoteValue);
  const local = normalizeTrackerState(localValue);
  if (!remote.startDate) return local;
  if (!local.startDate) return remote;

  const workouts: Record<string, WorkoutLog> = {};
  for (const day of SCHEDULED_DAYS) {
    const key = String(day);
    const remoteLog = remote.workouts[key];
    const localLog = local.workouts[key];
    if (!remoteLog) workouts[key] = localLog;
    else if (!localLog) workouts[key] = remoteLog;
    else {
      workouts[key] =
        Date.parse(localLog.modifiedAt) >= Date.parse(remoteLog.modifiedAt)
          ? localLog
          : remoteLog;
    }
  }

  const dailyMetrics: Record<string, DailyMetric> = {};
  for (const date of new Set([
    ...Object.keys(remote.dailyMetrics),
    ...Object.keys(local.dailyMetrics),
  ])) {
    const remoteMetric = remote.dailyMetrics[date];
    const localMetric = local.dailyMetrics[date];
    if (!remoteMetric) dailyMetrics[date] = localMetric;
    else if (!localMetric) dailyMetrics[date] = remoteMetric;
    else {
      dailyMetrics[date] =
        Date.parse(localMetric.modifiedAt) >= Date.parse(remoteMetric.modifiedAt)
          ? localMetric
          : remoteMetric;
    }
  }

  const localScheduleIsNewer =
    Date.parse(local.scheduleModifiedAt) >= Date.parse(remote.scheduleModifiedAt);
  const localProfileIsNewer =
    Date.parse(local.profile.modifiedAt) >= Date.parse(remote.profile.modifiedAt);

  return {
    dailyMetrics,
    profile: localProfileIsNewer ? local.profile : remote.profile,
    schedule: localScheduleIsNewer ? local.schedule : remote.schedule,
    scheduleModifiedAt: localScheduleIsNewer
      ? local.scheduleModifiedAt
      : remote.scheduleModifiedAt,
    schemaVersion: 2,
    startDate: remote.startDate || local.startDate,
    workouts,
  };
}
