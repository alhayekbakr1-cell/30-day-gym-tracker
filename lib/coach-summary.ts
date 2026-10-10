import { isFourDayKey } from "@/app/four-day-data";
import { isSessionKey, sessionNumberForKey } from "@/app/tracker-logic";
import type { TrackerState, WorkoutLog } from "@/app/tracker-types";
import { canonicalExerciseId, EXERCISE_LIBRARY, trainingPhaseForDay } from "@/app/workout-data";
import { completedSets, convertLoad, effectiveExerciseId, isoDateOffset, nextWorkoutDay, numeric, scheduledDate, scheduledDaysInRange, workoutForDay, workoutVolume } from "@/app/tracker-logic";
import { progressionWatch as buildProgressionWatch, weeklyMuscleBalance } from "@/app/training-insights";

export type CoachSummary = {
  averageRir: number | null;
  averageSleepHours: number | null;
  completedSessions: number;
  consistencyPct: number;
  generatedForDate: string;
  latestWeight: number | null;
  loadUnit: "kg" | "lb";
  muscleWeek: ReturnType<typeof weeklyMuscleBalance>;
  nextWorkout: { date: string | null; focus: string; phase: string; session: number; workout: string } | null;
  program: string;
  progressionWatch: ReturnType<typeof buildProgressionWatch>;
  recommendation: { detail: string; title: string };
  rirCoveragePct: number;
  sessionsDue: number;
  strongestProgress: { change: number; exercise: string } | null;
  totalSessions: number;
  totalVolume: number;
  volumeChangePct: number | null;
  weightChange: number | null;
  weightUnit: "kg" | "lb";
};

function rounded(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function completedSessionEntries(state: TrackerState) {
  return Object.keys(state.workouts).map(Number).filter(day => isSessionKey(state, day)).sort((a, b) => a - b).flatMap((day) => {
    const log = state.workouts[String(day)];
    return log?.completed ? [{ day, log }] : [];
  });
}

function rirSignals(logs: WorkoutLog[]) {
  const values: number[] = [];
  let completedSetCount = 0;
  for (const log of logs) {
    for (const [slotId, sets] of Object.entries(log.sets)) {
      if (/sec/i.test(EXERCISE_LIBRARY[effectiveExerciseId(log, slotId)]?.reps ?? "")) continue;
      for (const set of completedSets(sets)) {
        completedSetCount += 1;
        const value = set.rir === "4+" ? 4 : numeric(set.rir);
        if (value !== null) values.push(value);
      }
    }
  }
  return { completedSetCount, values };
}

function recentSleepValues(state: TrackerState, today: string) {
  const firstDay = isoDateOffset(today, -6);
  const daily = Object.entries(state.dailyMetrics)
    .filter(([date]) => date >= firstDay && date <= today)
    .map(([, metric]) => numeric(metric.sleepHours))
    .filter((value): value is number => value !== null);
  if (daily.length) return daily;
  return completedSessionEntries(state).slice(-4)
    .map(({ log }) => numeric(log.readiness.sleepHours))
    .filter((value): value is number => value !== null);
}

function strongestLoadProgress(state: TrackerState) {
  const history = new Map<string, number[]>();
  for (const { log } of completedSessionEntries(state)) {
    for (const [slotId, sets] of Object.entries(log.sets)) {
      const effectiveId = effectiveExerciseId(log, slotId);
      if (/sec/i.test(EXERCISE_LIBRARY[effectiveId]?.reps ?? "")) continue;
      const loads = completedSets(sets)
        .map((set) => numeric(set.load))
        .filter((value): value is number => value !== null && value > 0)
        .map((value) => convertLoad(value, log.loadUnit, state.profile.loadUnit));
      if (!loads.length) continue;
      const id = canonicalExerciseId(effectiveId);
      history.set(id, [...(history.get(id) ?? []), Math.max(...loads)]);
    }
  }
  return [...history.entries()]
    .filter(([, values]) => values.length > 1)
    .map(([id, values]) => ({ change: rounded(values.at(-1)! - values[0]), exercise: EXERCISE_LIBRARY[id]?.name ?? id }))
    .filter(({ change }) => change > 0)
    .sort((a, b) => b.change - a.change)[0] ?? null;
}

function recommendationFor(summary: Omit<CoachSummary, "recommendation">) {
  if (summary.completedSessions === 0) return { title: "Make session one deliberately easy", detail: "Choose loads that leave about 3 clean reps in reserve. The first workout is a baseline, not a test." };
  if (summary.sessionsDue >= 2 && summary.consistencyPct < 70) return { title: "Protect the next training slot", detail: "Consistency is the highest-value adjustment right now. Consider a shorter session before adding more load or volume." };
  if (summary.averageSleepHours !== null && summary.averageSleepHours < 6) return { title: "Keep the stimulus and trim the fatigue", detail: "Recent logged sleep is under 6 hours. Consider the first four exercises, up to two sets each, and about 3 reps in reserve. This is a planning prompt, not a validated readiness score." };
  if (summary.progressionWatch.kind === "fatigue") return { title: summary.progressionWatch.title, detail: summary.progressionWatch.detail };
  if (summary.progressionWatch.kind === "plateau") return { title: summary.progressionWatch.title, detail: summary.progressionWatch.detail };
  if (summary.rirCoveragePct < 60) return { title: "Log RIR on the next session", detail: "RIR is the missing signal the progression rule needs to distinguish a clean win from an all-out set." };
  if (summary.averageRir !== null && summary.averageRir < 1) return { title: "Hold the load for one exposure", detail: "Recent sets are very close to failure. Repeat the load and finish most sets with 1–3 reps in reserve." };
  if (summary.averageRir !== null && summary.averageRir > 3) return { title: "Add one clean rep before weight", detail: "Recent sets look comfortable. Move toward the top of each rep range while keeping technique unchanged." };
  if (summary.strongestProgress) return { title: `Keep building ${summary.strongestProgress.exercise}`, detail: "That movement has your clearest load gain. Repeat the same progression rule instead of forcing a max." };
  return { title: "Beat one number, not every number", detail: "Add one rep to one or two clean sets. Consider a small load increase after all prescribed sets reach the top with reserve in two comparable sessions." };
}

export function buildCoachSummary(state: TrackerState, today = new Date().toISOString().slice(0, 10)): CoachSummary {
  const completed = completedSessionEntries(state);
  const due = state.startDate ? scheduledDaysInRange(state, isoDateOffset(today, -29), today) : [];
  const completedDue = due.filter((day) => state.workouts[String(day)]?.completed).length;
  const { completedSetCount, values: rirValues } = rirSignals(completed.slice(-4).map(({ log }) => log));
  const sleepValues = recentSleepValues(state, today);
  const weights = Object.entries(state.dailyMetrics).sort(([a], [b]) => a.localeCompare(b)).flatMap(([, metric]) => {
    const value = numeric(metric.weight);
    return value === null ? [] : [convertLoad(value, metric.weightUnit ?? state.profile.weightUnit, state.profile.weightUnit)];
  });
  const volumes = completed.map(({ log }) => workoutVolume(log, state.profile.loadUnit));
  const recentAverage = volumes.length >= 2 ? (volumes.at(-1)! + volumes.at(-2)!) / 2 : null;
  const priorAverage = volumes.length >= 4 ? (volumes.at(-3)! + volumes.at(-4)!) / 2 : null;
  const nextDay = state.startDate ? nextWorkoutDay(state, today) : null;
  const nextPlan = nextDay ? workoutForDay(state, nextDay) : null;
  const phase = nextDay ? isFourDayKey(nextDay) ? { label: "Ongoing · chosen volume" } : trainingPhaseForDay(nextDay) : null;
  const base: Omit<CoachSummary, "recommendation"> = {
    averageRir: rirValues.length ? rounded(rirValues.reduce((a, b) => a + b, 0) / rirValues.length) : null,
    averageSleepHours: sleepValues.length ? rounded(sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length) : null,
    completedSessions: completed.length,
    consistencyPct: due.length ? Math.round((completedDue / due.length) * 100) : 0,
    generatedForDate: today,
    latestWeight: weights.at(-1) ?? null,
    loadUnit: state.profile.loadUnit,
    muscleWeek: weeklyMuscleBalance(state, today),
    nextWorkout: nextDay && nextPlan && phase ? { date: scheduledDate(state, nextDay), focus: nextPlan.focus, phase: phase.label, session: sessionNumberForKey(state, nextDay), workout: nextPlan.id } : null,
    program: state.fourDayPlan ? "Four-day upper/lower · gradual, user-selected volume" : "Legacy three-day rotation",
    progressionWatch: buildProgressionWatch(state),
    rirCoveragePct: completedSetCount ? Math.round((rirValues.length / completedSetCount) * 100) : 0,
    sessionsDue: due.length,
    strongestProgress: strongestLoadProgress(state),
    totalSessions: due.length,
    totalVolume: Math.round(volumes.reduce((a, b) => a + b, 0)),
    volumeChangePct: recentAverage !== null && priorAverage !== null && priorAverage > 0 ? Math.round(((recentAverage - priorAverage) / priorAverage) * 100) : null,
    weightChange: weights.length > 1 ? rounded(weights.at(-1)! - weights[0]) : null,
    weightUnit: state.profile.weightUnit,
  };
  return { ...base, recommendation: recommendationFor(base) };
}

export function recentWorkoutDetails(state: TrackerState, limit = 4) {
  return completedSessionEntries(state).slice(-Math.max(1, Math.min(limit, 8))).reverse().map(({ day, log }) => ({
    completedAt: log.completedAt,
    date: scheduledDate(state, day),
    exercises: Object.entries(log.sets).flatMap(([slotId, sets]) => {
      const id = effectiveExerciseId(log, slotId);
      const countUnit = /sec/i.test(EXERCISE_LIBRARY[id]?.reps ?? "") ? "seconds" : "reps";
      const values = completedSets(sets).map((set) => ({ load: numeric(set.load), reps: numeric(set.reps), rir: set.rir === "4+" ? 4 : numeric(set.rir) }));
      return values.length ? [{ exercise: EXERCISE_LIBRARY[id]?.name ?? id, sets: values, countUnit }] : [];
    }),
    loadUnit: log.loadUnit,
    session: sessionNumberForKey(state, day),
    workout: log.workoutId,
  }));
}

function displayNumber(value: number | null, suffix = "") { return value === null ? "not enough data" : `${value}${suffix}`; }

export function coachSnapshotText(state: TrackerState) {
  const summary = buildCoachSummary(state);
  const recent = recentWorkoutDetails(state, 3);
  const lines = [
    "Review my ongoing Gym Tracker and give me 3 specific adjustments for the next week.", "",
    `Program: ${summary.program}`,
    `Sessions: ${summary.completedSessions} completed all time; ${summary.consistencyPct}% consistency over the rolling 30-day window`,
    `Logged load × reps: ${summary.totalVolume.toLocaleString("en-US")} ${summary.loadUnit}·reps (converted to one unit for comparison)`,
    `Average RIR over recent sessions: ${displayNumber(summary.averageRir)}; recorded on ${summary.rirCoveragePct}% of completed rep-based sets`,
    `Average recent logged sleep: ${displayNumber(summary.averageSleepHours, " h")}`,
    `Body weight: ${displayNumber(summary.latestWeight, ` ${summary.weightUnit}`)}; change ${displayNumber(summary.weightChange, ` ${summary.weightUnit}`)}`,
    `Next: ${summary.nextWorkout ? `session ${summary.nextWorkout.session}, workout ${summary.nextWorkout.workout} (${summary.nextWorkout.focus})` : "plan not started"}`,
    `Progression watch: ${summary.progressionWatch.title} — ${summary.progressionWatch.detail}`,
    `Muscle groups this week: ${summary.muscleWeek.items.map((item) => `${item.group} ${item.completed}/${item.target || 0} sets`).join("; ")}`,
    `Rule-based recommendation: ${summary.recommendation.title} — ${summary.recommendation.detail}`, "", "Recent workouts:",
    ...recent.map((workout) => `- Session ${workout.session} (${workout.date ?? "date unavailable"}): ${workout.exercises.map((exercise) => `${exercise.exercise}: ${exercise.sets.map((set) => [set.load === null ? null : `${set.load} ${workout.loadUnit}`, set.reps === null ? null : `${set.reps} ${exercise.countUnit}`, set.rir === null ? null : `${set.rir} RIR`].filter(Boolean).join(" · ")).join("; ")}`).join(" | ") || "completed"}`),
    "", "Please prioritize adherence, safe progression, technique, recovery, and my logged trend. Do not recommend one-rep-max testing.",
  ];
  return lines.join("\n");
}
