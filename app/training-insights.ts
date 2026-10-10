import { exercisePrescriptionFor, hydratedWorkoutLog, visibleWorkoutPairs } from "./session-logic";
import type { TrackerState, WorkoutLog } from "./tracker-types";
import {
  canonicalExerciseId,
  EXERCISE_LIBRARY,
} from "./workout-data";
import {
  isSessionKey,
  sessionNumberForKey,
  completedSets,
  convertLoad,
  effectiveExerciseId,
  isoDateOffset,
  localIsoDate,
  nextWorkoutDay,
  numeric,
  scheduledDate,
  scheduledDaysInRange,
  workoutForDay,
} from "./tracker-logic";

export const MUSCLE_GROUPS = ["Chest", "Back", "Quads", "Hamstrings", "Lateral delts", "Biceps", "Triceps", "Calves", "Core", "Glutes"] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_BY_EXERCISE: Record<string, MuscleGroup> = {
  "cable-crunch": "Core",
  "db-hip-thrust": "Glutes",
  "db-rdl": "Hamstrings",
  "dead-bug": "Core",
  "flat-db-bench": "Chest",
  "front-plank": "Core",
  "hammer-curl": "Biceps",
  "incline-db-bench": "Chest",
  "lat-pulldown": "Back",
  "lateral-raise-a": "Lateral delts",
  "lateral-raise-c": "Lateral delts",
  "leg-curl": "Hamstrings",
  "leg-press": "Quads",
  "leg-press-c": "Quads",
  "machine-press": "Chest",
  "one-arm-row": "Back",
  "seated-row": "Back",
  "split-squat": "Quads",
  "triceps-extension": "Triceps",
  "calf-raise": "Calves",
};

function mondayFor(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(year, month - 1, day, 12).getDay();
  return isoDateOffset(date, -(weekday === 0 ? 6 : weekday - 1));
}

export function weeklyMuscleBalance(state: TrackerState, today = localIsoDate()) {
  const weekStart = mondayFor(today);
  const weekEnd = isoDateOffset(weekStart, 6);
  const target = Object.fromEntries(MUSCLE_GROUPS.map((group) => [group, 0])) as Record<MuscleGroup, number>;
  const completed = Object.fromEntries(MUSCLE_GROUPS.map((group) => [group, 0])) as Record<MuscleGroup, number>;

  for (const day of scheduledDaysInRange(state, weekStart, weekEnd)) {
    const workout = workoutForDay(state, day);
    const log = hydratedWorkoutLog(state, day);
    const visible = new Set(visibleWorkoutPairs(state, day, log).flatMap(pair => pair.exercises.map(item => item.id)));
    const slots = workout.pairs.flatMap((pair) => pair.exercises);
    slots.forEach((exercise) => {
      const effectiveId = log ? effectiveExerciseId(log, exercise.id) : exercise.id;
      const group = MUSCLE_BY_EXERCISE[effectiveId] ?? MUSCLE_BY_EXERCISE[canonicalExerciseId(effectiveId)];
      if (!group) return;
      target[group] += visible.has(exercise.id) ? exercisePrescriptionFor(state, day, exercise.id, log).sets : 0;
      completed[group] += completedSets(log?.sets[exercise.id] ?? []).length;
    });
  }

  return {
    items: MUSCLE_GROUPS.map((group) => ({
      completed: completed[group],
      group,
      percent: target[group] ? Math.min(100, Math.round((completed[group] / target[group]) * 100)) : 0,
      target: target[group],
    })),
    weekEnd,
    weekStart,
  };
}

type ProgressionWatch = {
  detail: string;
  exercise: string | null;
  kind: "baseline" | "building" | "fatigue" | "plateau";
  title: string;
};

function completedWorkoutEntries(state: TrackerState) {
  return Object.keys(state.workouts)
    .map(Number)
    .filter(day => isSessionKey(state, day))
    .sort((a, b) => a - b)
    .flatMap((day) => {
      const log = state.workouts[String(day)];
      return log?.completed ? [{ day, log }] : [];
    });
}

function sessionEffort(log: WorkoutLog, slotId: string) {
  const values = completedSets(log.sets[slotId] ?? [])
    .map((set) => set.rir === "4+" ? 4 : numeric(set.rir))
    .filter((value): value is number => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function progressionWatch(state: TrackerState): ProgressionWatch {
  const histories = new Map<string, { effort: number | null; score: number }[]>();
  for (const { log } of completedWorkoutEntries(state)) {
    for (const [slotId, sets] of Object.entries(log.sets)) {
      const id = canonicalExerciseId(effectiveExerciseId(log, slotId));
      if (/sec/i.test(EXERCISE_LIBRARY[id]?.reps ?? "")) continue;
      const scores = completedSets(sets).flatMap((set) => {
        const load = numeric(set.load);
        const reps = numeric(set.reps);
        if (load === null || load <= 0 || reps === null || reps <= 0) return [];
        const normalizedLoad = convertLoad(load, log.loadUnit, state.profile.loadUnit);
        return [normalizedLoad * (1 + reps / 30)];
      });
      if (!scores.length) continue;
      histories.set(id, [...(histories.get(id) ?? []), {
        effort: sessionEffort(log, slotId),
        score: Math.max(...scores),
      }]);
    }
  }

  const priority = ["flat-db-bench", "incline-db-bench", "machine-press", "lateral-raise-a", "lat-pulldown", "leg-press", "db-rdl"];
  const candidates = [...histories.entries()]
    .filter(([, values]) => values.length >= 3)
    .map(([id, values]) => {
      const recent = values.slice(-3);
      const change = (recent.at(-1)!.score - recent[0].score) / recent[0].score;
      const efforts = recent.map((item) => item.effort).filter((value): value is number => value !== null);
      const averageEffort = efforts.length ? efforts.reduce((sum, value) => sum + value, 0) / efforts.length : null;
      return { averageEffort, change, id, recent };
    })
    .sort((a, b) => {
      const priorityDifference = (priority.indexOf(a.id) < 0 ? 999 : priority.indexOf(a.id))
        - (priority.indexOf(b.id) < 0 ? 999 : priority.indexOf(b.id));
      return (priorityDifference || a.change - b.change);
    });

  const stalled = candidates.find((item) => item.change <= 0.01);
  if (stalled) {
    const exercise = EXERCISE_LIBRARY[stalled.id]?.name ?? stalled.id;
    if (stalled.averageEffort !== null && stalled.averageEffort <= 1) {
      return {
        detail: "Three logged exposures were similar at high effort. This is a rough trend, not a fatigue diagnosis. Review recovery and technique before changing volume or load.",
        exercise,
        kind: "fatigue",
        title: `${exercise} has a trend to review`,
      };
    }
    return {
      detail: "Three similar estimated scores are a prompt to review technique, effort, and recovery. They do not establish a plateau or require a load increase.",
      exercise,
      kind: "plateau",
      title: `${exercise} has similar recent scores`,
    };
  }

  if (candidates.length) {
    return {
      detail: "Your recent repeat exposures are still moving forward. Keep the current exercises and progress one variable at a time.",
      exercise: null,
      kind: "building",
      title: "Progression is moving",
    };
  }

  return {
    detail: "Log repeat exposures with load, reps, and RIR to see a rough performance trend. It is not a validated readiness score.",
    exercise: null,
    kind: "baseline",
    title: "Building your baseline",
  };
}

export function smartTodayInsight(state: TrackerState, today = localIsoDate()) {
  if (!state.startDate) {
    return {
      date: null,
      detail: "Start the four-day plan to schedule Upper A with a gradual starting workload.",
      energy: null,
      focus: "Chest, back, shoulders, and arms",
      mode: "start" as const,
      modeLabel: "Ready to begin",
      progression: progressionWatch(state),
      session: 1,
      sleep: null,
      soreness: null,
      title: "Your first session is ready",
      workoutId: "UA",
    };
  }

  const day = nextWorkoutDay(state, today);
  const workout = workoutForDay(state, day);
  const log = state.workouts[String(day)];
  const todaySleep = numeric(state.dailyMetrics[today]?.sleepHours);
  const sleep = todaySleep ?? numeric(log?.readiness.sleepHours);
  const energy = numeric(log?.readiness.energy);
  const soreness = numeric(log?.readiness.soreness);
  const date = scheduledDate(state, day);
  const until = date ? Math.max(0, Math.round((Date.parse(date + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 86_400_000)) : 0;
  const recover = (sleep !== null && sleep < 4) || energy === 1 || soreness === 5;
  const short = !recover && ((sleep !== null && sleep < 6) || (energy !== null && energy <= 2) || (soreness !== null && soreness >= 4));
  const mode = recover ? "recover" as const : short ? "short" as const : "full" as const;
  const timing = until === 0 ? "today" : until === 1 ? "tomorrow" : `in ${until} days`;

  return {
    date,
    detail: recover
      ? "Recovery signals are poor. Postpone heavy work, walk or mobilize gently, and reassess after sleep and soreness improve."
      : short
        ? "Consider the first four exercises, up to two working sets each, with about 3 reps in reserve. These are planning prompts, not a validated readiness score."
        : date && date < today ? `This session is waiting from ${date}. Move it and following sessions to dates that work for you; keep the rotation in order.` : `Your next ${workout.subtitle.split(" · ")[0]} session is ${timing}. Use your chosen set counts and adjust to how the warm-up feels.`,
    energy,
    focus: workout.focus,
    mode,
    modeLabel: recover ? "Consider recovery" : short ? "Short session" : "Full session",
    progression: progressionWatch(state),
    session: sessionNumberForKey(state, day),
    sleep,
    soreness,
    title: recover ? "Protect recovery today" : short ? "Train, but trim fatigue" : `${workout.subtitle.split(" · ")[0]} is up next`,
    workoutId: workout.id,
  };
}
