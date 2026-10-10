import { defaultEquipment } from "./equipment-logic";
import type { DailyMetric, ProfileSettings, SetLog, TrackerState, WorkoutLog } from "./tracker-types";
import { canonicalExerciseId, EXERCISE_LIBRARY, isTrainingDayNumber, scheduledTrainingDays, WORKOUTS, workoutIdForDay, workingSetsForDay } from "./workout-data";
import { FOUR_DAY_EXERCISES, FOUR_DAY_KEY_START, FOUR_DAY_OFFSETS, FOUR_DAY_SESSION_LIMIT, fourDayWorkoutId, initialFourDaySets, isFourDayKey, type FourDayWorkoutId, type ExercisePrescription } from "./four-day-data";

const ZERO_DATE = new Date(0).toISOString();
export const EMPTY_PROFILE: ProfileSettings = {
  loadUnit: "lb", modifiedAt: ZERO_DATE, proteinGoal: "", stepGoal: "7000", weightUnit: "lb",
};
export const EMPTY_STATE: TrackerState = {
  fourDayPlan: null, equipment: defaultEquipment(),
  blockId: null, dailyMetrics: {}, programVersion: 3, profile: EMPTY_PROFILE, schedule: {},
  scheduleModifiedAt: ZERO_DATE, schemaVersion: 7, startDate: null, workouts: {},
};

export function localIsoDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function isoDateOffset(startDate: string, offset: number) {
  const [year, month, date] = startDate.split("-").map(Number);
  return localIsoDate(new Date(year, month - 1, date + offset, 12));
}
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function dayDifference(first: string, second: string) {
  return Math.round((Date.parse(second + "T12:00:00Z") - Date.parse(first + "T12:00:00Z")) / 86_400_000);
}
export function defaultSchedule() {
  return {};
}

// Preserve the identity and lifting unit of every previously saved session.
export function normalizeTrackerState(value: Partial<TrackerState> | null | undefined): TrackerState {
  if (!value) return { ...EMPTY_STATE, profile: { ...EMPTY_PROFILE } };
  const startDate = value.startDate ?? null;
  const priorVersion = value.programVersion ?? (startDate ? 1 : 3);
  const profile = { ...EMPTY_PROFILE, ...(value.profile ?? {}) };
  const workouts = Object.fromEntries(
    Object.entries(value.workouts ?? {}).filter(([, log]) => Boolean(log)).map(([day, log]) => [
      day, {
        ...log,
        loadUnit: (log.loadUnit === "kg" ? "kg" : "lb") as "kg" | "lb",
        workoutId: log.workoutId && WORKOUTS[log.workoutId] ? log.workoutId : workoutIdForDay(Number(day), priorVersion),
        readiness: { ...(log.readiness ?? { energy: "", sleepHours: "", soreness: "" }) },
        substitutions: log.substitutions ?? {}, warmup: log.warmup ?? {}, sets: log.sets ?? {},
      },
    ]),
  );
  const dailyMetrics = Object.fromEntries(Object.entries(value.dailyMetrics ?? {}).map(([date, metric]) => [
    date, { ...metric, weightUnit: metric.weightUnit ?? profile.weightUnit },
  ]));
  return {
    blockId: value.blockId ?? startDate, dailyMetrics, programVersion: 3, profile, workouts, startDate, schemaVersion: 7,
    fourDayPlan: value.fourDayPlan ?? null, equipment: value.equipment ?? defaultEquipment(),
    schedule: value.schedule && Object.keys(value.schedule).length > 0 ? value.schedule : defaultSchedule(),
    scheduleModifiedAt: value.scheduleModifiedAt ?? ZERO_DATE,
  };
}
export function scheduledDate(state: TrackerState, day: number) {
  if (isFourDayKey(day)) {
    if (!state.fourDayPlan) return null;
    const index = day - FOUR_DAY_KEY_START;
    const shift = Object.entries(state.fourDayPlan.shifts).reduce((sum, [key, days]) => Number(key) <= day ? sum + days : sum, 0);
    return state.schedule[String(day)] ?? isoDateOffset(state.fourDayPlan.startsOn, Math.floor(index / 4) * 7 + FOUR_DAY_OFFSETS[index % 4] + shift);
  }
  return state.startDate ? state.schedule[String(day)] ?? isoDateOffset(state.startDate, day - 1) : null;
}
export function isSessionKey(state: TrackerState, key: number) {
  return (key <= 36_525 && isTrainingDayNumber(key)) || Boolean(state.fourDayPlan && isFourDayKey(key));
}
export function challengeDayForDate(startDate: string, date: string) { return dayDifference(startDate, date) + 1; }
export function scheduledDaysInRange(state: TrackerState, rangeStart: string, rangeEnd: string) {
  if (!state.startDate || rangeEnd < state.startDate || rangeEnd < rangeStart) return [];
  const firstDay = Math.max(1, challengeDayForDate(state.startDate, rangeStart));
  const lastDay = challengeDayForDate(state.startDate, rangeEnd);
  const days = new Set<number>();
  const lastLegacyDate = state.fourDayPlan ? isoDateOffset(state.fourDayPlan.startsOn, -2) : null;
  for (const day of scheduledTrainingDays(firstDay, lastDay)) {
    const override = state.schedule[String(day)];
    const date = override ?? scheduledDate(state, day)!;
    if (date >= rangeStart && date <= rangeEnd && (!lastLegacyDate || date <= lastLegacyDate || state.workouts[String(day)])) days.add(day);
  }
  for (const key of new Set([...Object.keys(state.schedule), ...Object.keys(state.workouts)])) {
    const day = Number(key);
    const date = scheduledDate(state, day);
    if (isSessionKey(state, day) && date && date >= rangeStart && date <= rangeEnd
      && (isFourDayKey(day) || !lastLegacyDate || date <= lastLegacyDate || state.workouts[key])) days.add(day);
  }
  if (state.fourDayPlan) {
    const plan = state.fourDayPlan;
    const shiftMargin = Object.values(plan.shifts).reduce((sum, days) => sum + Math.abs(days), 0);
    const first = Math.max(0, Math.floor((dayDifference(plan.startsOn, rangeStart) - shiftMargin) / 7) * 4 - 4);
    const last = Math.min(FOUR_DAY_SESSION_LIMIT - 1, Math.ceil((dayDifference(plan.startsOn, rangeEnd) + shiftMargin) / 7) * 4 + 4);
    for (let index = first; index <= last; index++) {
      const key = FOUR_DAY_KEY_START + index;
      const date = scheduledDate(state, key)!;
      if (date >= rangeStart && date <= rangeEnd) days.add(key);
    }
  }
  return [...days].sort((a, b) => {
    const byDate = (scheduledDate(state, a) ?? "").localeCompare(scheduledDate(state, b) ?? "");
    return byDate || a - b;
  });
}
export function workoutDayForDate(state: TrackerState, date: string) {
  return scheduledDaysInRange(state, date, date)[0] ?? null;
}
export function nextWorkoutDay(state: TrackerState, today = localIsoDate()) {
  if (!state.startDate) return 1;
  const unfinished = Object.entries(state.workouts)
    .filter(([day, log]) => isSessionKey(state, Number(day)) && !log.completed
      && (scheduledDate(state, Number(day)) ?? "") <= today
      && (Object.values(log.warmup).some(Boolean) || Object.values(log.sets).flat().some(set => set.done || set.load || set.reps)))
    .sort((a, b) => Date.parse(b[1].modifiedAt) - Date.parse(a[1].modifiedAt));
  if (unfinished.length) return Number(unfinished[0][0]);
  if (state.fourDayPlan) {
    // Continue the sequence after missed visits instead of skipping a template.
    const upcomingLegacy = scheduledDaysInRange(state, today, isoDateOffset(state.fourDayPlan.startsOn, -1))
      .find(day => !state.workouts[String(day)]?.completed);
    if (upcomingLegacy) return upcomingLegacy;
    for (let index = 0; index < FOUR_DAY_SESSION_LIMIT; index++) {
      const key = FOUR_DAY_KEY_START + index;
      if (!state.workouts[String(key)]?.completed) return key;
    }
  }
  const searchStart = today < state.startDate ? state.startDate : today;
  const days = scheduledDaysInRange(state, searchStart, isoDateOffset(searchStart, 730));
  return days.find(day => !state.workouts[String(day)]?.completed) ?? days[0] ?? 1;
}
export function workoutForDay(state: TrackerState, day: number) {
  return WORKOUTS[state.workouts[String(day)]?.workoutId ?? (isFourDayKey(day) ? fourDayWorkoutId(day) : workoutIdForDay(day, state.programVersion))];
}
export function sessionNumberForKey(state: TrackerState, key: number) {
  if (!isFourDayKey(key) || !state.fourDayPlan || !state.startDate) {
    return scheduledTrainingDays(1, key).length || 1;
  }
  const legacy = scheduledDaysInRange(state, state.startDate, isoDateOffset(state.fourDayPlan.startsOn, -1)).filter(day => !isFourDayKey(day)).length;
  return legacy + key - FOUR_DAY_KEY_START + 1;
}
export function earliestFourDayStart(state: TrackerState, today = localIsoDate()) {
  const dates = Object.keys(state.workouts).map(Number).map(key => scheduledDate(state, key)).filter((date): date is string => Boolean(date)).sort();
  const afterLastLog = dates.length ? isoDateOffset(dates.at(-1)!, 2) : today;
  return afterLastLog > today ? afterLastLog : today;
}
export function suggestedFourDayStart(state: TrackerState, today = localIsoDate()) {
  const earliest = earliestFourDayStart(state, today);
  const weekday = new Date(earliest + "T12:00:00Z").getUTCDay();
  return isoDateOffset(earliest, (8 - weekday) % 7);
}
export function activateFourDayPlan(state: TrackerState, startsOn: string, id: string, now = new Date().toISOString(), today = localIsoDate()): TrackerState {
  if (state.fourDayPlan) throw new Error("Your four-day plan is already active.");
  if (!state.startDate || !isIsoDate(startsOn) || startsOn < earliestFourDayStart(state, today)) throw new Error("Choose a date at least two days after your latest saved workout, and no earlier than today.");
  return { ...state, schemaVersion: 7, fourDayPlan: { id, version: 1, startsOn, modifiedAt: now, sets: initialFourDaySets(), rir: 3, shifts: {} } };
}
export function changeFourDaySets(state: TrackerState, template: FourDayWorkoutId, slot: string, count: number, now = new Date().toISOString()): TrackerState {
  const plan = state.fourDayPlan;
  const exercise = FOUR_DAY_EXERCISES[template]?.find(item => item.id === slot);
  if (!plan || !exercise || !Number.isInteger(count) || count < 1 || count > exercise.targetSets) throw new Error("Choose a set count within the plan's gradual target.");
  return { ...state, fourDayPlan: { ...plan, modifiedAt: now, sets: { ...plan.sets, [template]: { ...plan.sets[template], [slot]: count } } } };
}
export function rescheduleSession(state: TrackerState, key: number, date: string, now = new Date().toISOString()): TrackerState {
  if (!state.startDate || !isIsoDate(date) || date < state.startDate || !isSessionKey(state, key)) throw new Error("Choose a valid date on or after the plan start.");
  if (state.workouts[String(key)]?.completed) throw new Error("Completed sessions keep their original date.");
  const currentDate = scheduledDate(state, key)!;
  if (isFourDayKey(key) && state.fourDayPlan) {
    if (Object.keys(state.workouts).some(other => Number(other) > key)) throw new Error("A later session already has entries. Its date is protected; finish the earlier session on its existing date.");
    if (date < state.fourDayPlan.startsOn) throw new Error("Choose a date on or after your four-day transition.");
    const previous = key > FOUR_DAY_KEY_START ? scheduledDate(state, key - 1) : null;
    const sameRegion = key > FOUR_DAY_KEY_START + 1 ? scheduledDate(state, key - 2) : null;
    const legacyLast = Object.keys(state.workouts).map(Number).filter(day => !isFourDayKey(day)).map(day => scheduledDate(state, day)!).sort().at(-1);
    if ((previous && dayDifference(previous, date) < 1) || (sameRegion && dayDifference(sameRegion, date) < 2)
      || (key === FOUR_DAY_KEY_START && legacyLast && dayDifference(legacyLast, date) < 2)) throw new Error("Keep sessions in order and at least one full day between training the same region.");
    const schedule = { ...state.schedule };
    delete schedule[String(key)];
    const delta = dayDifference(scheduledDate({ ...state, schedule }, key)!, date);
    return { ...state, schedule, scheduleModifiedAt: now, fourDayPlan: { ...state.fourDayPlan, modifiedAt: now,
      shifts: { ...state.fourDayPlan.shifts, [key]: (state.fourDayPlan.shifts[String(key)] ?? 0) + delta } } };
  }
  const neighbors = scheduledDaysInRange(state, isoDateOffset(date, -2), isoDateOffset(date, 2)).filter(day => day !== key);
  if (neighbors.some(day => Math.abs(dayDifference(scheduledDate(state, day)!, date)) < 2)) throw new Error("Keep a full recovery day between legacy workouts.");
  const all = scheduledDaysInRange(state, state.startDate, isoDateOffset(currentDate > date ? currentDate : date, 14));
  const previous = all.filter(day => day < key).at(-1), next = all.find(day => day > key);
  if ((previous && date <= scheduledDate(state, previous)!) || (next && date >= scheduledDate(state, next)!)) throw new Error("Keep your sessions in their original order.");
  if (state.fourDayPlan && date > isoDateOffset(state.fourDayPlan.startsOn, -2)) throw new Error("Keep a full recovery day before your four-day transition.");
  return { ...state, schedule: { ...state.schedule, [key]: date }, scheduleModifiedAt: now };
}
export function blankMetric(): DailyMetric {
  return { modifiedAt: ZERO_DATE, protein: "", sleepHours: "", steps: "", waist: "", weight: "" };
}
export function numeric(value: string | undefined | null) {
  if (typeof value !== "string" || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
export function convertLoad(value: number, from: "kg" | "lb", to: "kg" | "lb") {
  return from === to ? value : from === "kg" ? value * 2.2046226218 : value / 2.2046226218;
}
export function formatLoad(value: number) { return String(Math.round(value * 100) / 100); }
export function completedSets(sets: SetLog[]) { return sets.filter(set => set.done && (numeric(set.reps) ?? 0) > 0); }
export function effectiveExerciseId(log: WorkoutLog, slotId: string) { return log.substitutions?.[slotId] ?? slotId; }

export function workoutVolume(log?: WorkoutLog, targetUnit: "kg" | "lb" = "lb") {
  if (!log) return 0;
  return Object.entries(log.sets).reduce((total, [slot, sets]) => {
    if (/sec/i.test(EXERCISE_LIBRARY[effectiveExerciseId(log, slot)]?.reps ?? "")) return total;
    return total + completedSets(sets).reduce((sum, set) =>
      sum + convertLoad(numeric(set.load) ?? 0, log.loadUnit ?? "lb", targetUnit) * (numeric(set.reps) ?? 0), 0);
  }, 0);
}

type PerformanceEntry = { date: string | null; day: number; loadUnit: "kg" | "lb"; sets: SetLog[]; completed: boolean; prescribedCount: number; repTarget: string };

export function previousPerformance(state: TrackerState, selectedDay: number, _slotId: string, effectiveId: string) {
  const selectedDate = scheduledDate(state, selectedDay);
  const previous = Object.keys(state.workouts).map(Number).filter(day => isSessionKey(state, day) && day !== selectedDay)
    .map(day => ({ day, log: state.workouts[String(day)], date: scheduledDate(state, day) }))
    .filter(({ date, log }) => Boolean(log && date && selectedDate && date < selectedDate))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const history: PerformanceEntry[] = [];
  for (const { day, log, date } of previous) {
    if (!log) continue;
    const matched: SetLog[] = [];
    let prescribedCount = 0;
    let repTarget = "";
    for (const [slot, sets] of Object.entries(log.sets)) {
      if (canonicalExerciseId(effectiveExerciseId(log, slot)) === canonicalExerciseId(effectiveId)) {
        matched.push(...completedSets(sets));
        const slots = WORKOUTS[log.workoutId].pairs.flatMap(pair => pair.exercises);
        const index = slots.findIndex(item => item.id === slot);
        prescribedCount += log.prescription?.exercises[slot]?.sets ?? workingSetsForDay(day, index, log.lowSleep);
        repTarget = log.substitutions[slot] ? EXERCISE_LIBRARY[effectiveId]?.reps ?? "" : log.prescription?.exercises[slot]?.reps ?? slots[index]?.reps ?? "";
      }
    }
    if (matched.length) history.push({ day, date, sets: matched, loadUnit: log.loadUnit ?? "lb", completed: log.completed, prescribedCount, repTarget });
  }
  return history.length ? { ...history[0], history: history.slice(0, 4) } : null;
}
function repRange(reps: string) {
  const values = reps.match(/\d+/g)?.map(Number) ?? [];
  return { high: values[1] ?? values[0] ?? 0, low: values[0] ?? 0 };
}
export function loadRecommendation(
  effectiveId: string, previous: ReturnType<typeof previousPerformance>, loadUnit: "kg" | "lb" = "lb",
  prescription?: ExercisePrescription,
) {
  const exercise = EXERCISE_LIBRARY[effectiveId];
  const targetRir = prescription?.rir ?? 2;
  if (!exercise || !previous) return { kind: "start" as const, text: `Use preparation sets, then a familiar manageable load with about ${targetRir} clean reps in reserve.` };
  const repsText = prescription?.reps ?? exercise.reps;
  const { high, low } = repRange(repsText);
  const history = previous.history ?? [previous];
  const reps = previous.sets.map(set => numeric(set.reps) ?? 0);
  const rirs = previous.sets.map(set => set.rir === "4+" ? 4 : numeric(set.rir));
  const lastValue = numeric(previous.sets.at(-1)?.load);
  const lastLoad = lastValue === null ? null : convertLoad(lastValue, previous.loadUnit, loadUnit);
  if (/sec/i.test(repsText)) return { kind: "repeat" as const, text: reps.every(value => value >= high)
    ? "Keep the duration and brace controlled. Choose a harder variation only when appropriate."
    : "Build duration within the range while your brace stays controlled." };
  if (rirs.some(value => value === null)) return { kind: "repeat" as const, text: `Repeat a manageable load and record RIR. Aim for about ${targetRir} clean reps in reserve.` };
  if (reps.some(value => value < low) || rirs.some(value => value !== null && value < targetRir)) return {
    kind: "repeat" as const, text: `Hold the load, or reduce one increment if needed to reach the range with about ${targetRir} reps in reserve. One difficult visit is not a plateau.`,
  };
  const expected = prescription?.sets ?? previous.prescribedCount;
  const exposures = history.slice(0, 2);
  const allAtTop = exposures.length === 2 && exposures.every(entry => entry.completed && entry.repTarget === repsText
    && entry.prescribedCount === expected && entry.sets.length === expected
    && entry.sets.every(set => (numeric(set.reps) ?? 0) >= high && (set.rir === "4+" ? 4 : numeric(set.rir) ?? -1) >= targetRir));
  const loads = exposures.flatMap(entry => entry.sets.map(set => {
    const value = numeric(set.load);
    return value === null ? null : convertLoad(value, entry.loadUnit, loadUnit);
  }));
  const sameLoad = loads.length > 0 && loads.every(value => value !== null && value > 0 && Math.abs(value - loads[0]!) < 0.02);
  if (allAtTop && sameLoad && lastLoad) return { kind: "increase" as const,
    text: `Two comparable sessions reached the top of the range with reserve. If technique was consistent, try the smallest practical increase above ${formatLoad(lastLoad)} ${loadUnit}.`,
  };
  return { kind: "repeat" as const, text: `${lastLoad ? `Repeat about ${formatLoad(lastLoad)} ${loadUnit}` : "Keep a manageable load"} and build clean reps. Increase only after all prescribed sets reach the top with reserve on two comparable sessions.` };
}

function same(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b); }
function emptyWorkoutBase(remote: WorkoutLog, local: WorkoutLog): WorkoutLog {
  const slots = new Set([...Object.keys(remote.sets), ...Object.keys(local.sets)]);
  return {
    completed: false, completedAt: null, lowSleep: false, loadUnit: local.loadUnit, modifiedAt: ZERO_DATE, note: "",
    readiness: { energy: "", sleepHours: "", soreness: "" }, substitutions: {}, workoutId: local.workoutId,
    warmup: Object.fromEntries([...new Set([...Object.keys(remote.warmup), ...Object.keys(local.warmup)])].map(key => [key, false])),
    sets: Object.fromEntries([...slots].map(key => [key, Array.from({ length: Math.max(remote.sets[key]?.length ?? 0, local.sets[key]?.length ?? 0) }, () => ({ done: false, load: "", reps: "", rir: "" }))])),
  };
}
function mergeFields<T>(remote: T, local: T, base: T | undefined, preferLocal: boolean): T {
  if (same(local, base)) return remote;
  if (same(remote, base) || same(remote, local)) return local;
  if (Array.isArray(remote) && Array.isArray(local)) {
    return Array.from({ length: Math.max(remote.length, local.length) }, (_, index) =>
      mergeFields(remote[index], local[index], Array.isArray(base) ? base[index] : undefined, preferLocal)) as T;
  }
  if (remote && local && typeof remote === "object" && typeof local === "object" && !Array.isArray(remote) && !Array.isArray(local)) {
    const r = remote as Record<string, unknown>, l = local as Record<string, unknown>;
    const b = (base ?? {}) as Record<string, unknown>;
    return Object.fromEntries([...new Set([...Object.keys(r), ...Object.keys(l)])]
      .map(key => [key, mergeFields(r[key], l[key], b[key], preferLocal)])) as T;
  }
  return preferLocal ? local : remote;
}

/** Merge independent edits against the last acknowledged state; timestamps settle same-field conflicts. */
export function mergeTrackerStates(remoteValue: TrackerState | null, localValue: TrackerState, baseValue?: TrackerState | null): TrackerState {
  const remote = normalizeTrackerState(remoteValue), local = normalizeTrackerState(localValue);
  if (!remote.startDate) return local;
  if (!local.startDate) return remote;
  if (remote.blockId !== local.blockId || remote.startDate !== local.startDate) return remote;
  const base = baseValue?.blockId === local.blockId && baseValue.startDate === local.startDate ? normalizeTrackerState(baseValue) : null;
  const workouts: Record<string, WorkoutLog> = {};
  for (const key of new Set([...Object.keys(remote.workouts), ...Object.keys(local.workouts)])) {
    const r = remote.workouts[key], l = local.workouts[key];
    if (!r && !l) continue;
    const localNewer = Boolean(l && r && Date.parse(l.modifiedAt) > Date.parse(r.modifiedAt));
    // Exercise identity and units must stay attached to their recorded sets.
    const compatible = r && l && r.workoutId === l.workoutId && r.loadUnit === l.loadUnit && same(r.substitutions, l.substitutions) && same(r.prescription, l.prescription);
    workouts[key] = !r ? l : !l ? r : base && compatible
      ? mergeFields(r, l, base.workouts[key] ?? emptyWorkoutBase(r, l), localNewer) : localNewer ? l : r;
    const merged = workouts[key];
    const completedSource = localNewer && l?.completed ? l : r?.completed ? r : l?.completed ? l : null;
    if (merged.completed && completedSource && (!same(merged.sets, completedSource.sets)
      || !same(merged.warmup, completedSource.warmup) || merged.lowSleep !== completedSource.lowSleep)) {
      workouts[key] = { ...merged, completed: false, completedAt: null };
    }
  }
  const dailyMetrics: Record<string, DailyMetric> = {};
  for (const date of new Set([...Object.keys(remote.dailyMetrics), ...Object.keys(local.dailyMetrics)])) {
    const r = remote.dailyMetrics[date], l = local.dailyMetrics[date];
    const localNewer = Boolean(l && r && Date.parse(l.modifiedAt) > Date.parse(r.modifiedAt));
    dailyMetrics[date] = !r ? l : !l ? r : base && r.weightUnit === l.weightUnit
      ? mergeFields(r, l, base.dailyMetrics[date] ?? { ...blankMetric(), weightUnit: l.weightUnit }, localNewer) : localNewer ? l : r;
  }
  const localScheduleIsNewer = Date.parse(local.scheduleModifiedAt) > Date.parse(remote.scheduleModifiedAt);
  const localProfileIsNewer = Date.parse(local.profile.modifiedAt) > Date.parse(remote.profile.modifiedAt);
  return {
    blockId: remote.blockId, dailyMetrics, programVersion: 3,
    fourDayPlan: same(local.fourDayPlan, base?.fourDayPlan) ? remote.fourDayPlan
      : same(remote.fourDayPlan, base?.fourDayPlan) ? local.fourDayPlan
        : Date.parse(local.fourDayPlan?.modifiedAt ?? ZERO_DATE) > Date.parse(remote.fourDayPlan?.modifiedAt ?? ZERO_DATE) ? local.fourDayPlan : remote.fourDayPlan,
    equipment: base ? mergeFields(remote.equipment, local.equipment, base.equipment, Date.parse(local.equipment.modifiedAt) > Date.parse(remote.equipment.modifiedAt)) : Date.parse(local.equipment.modifiedAt) > Date.parse(remote.equipment.modifiedAt) ? local.equipment : remote.equipment,
    profile: base ? mergeFields(remote.profile, local.profile, base.profile, localProfileIsNewer) : localProfileIsNewer ? local.profile : remote.profile,
    schedule: base ? mergeFields(remote.schedule, local.schedule, base.schedule, localScheduleIsNewer) : localScheduleIsNewer ? local.schedule : remote.schedule,
    scheduleModifiedAt: localScheduleIsNewer ? local.scheduleModifiedAt : remote.scheduleModifiedAt,
    schemaVersion: 7, startDate: remote.startDate, workouts,
  };
}
