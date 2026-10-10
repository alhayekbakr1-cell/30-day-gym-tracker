import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { require, state, workout, slot } from "./fixtures.mjs";
const logic = require("../.test-build/app/tracker-logic.js");
const data = require("../.test-build/app/four-day-data.js");
const sessions = require("../.test-build/app/session-logic.js");
const insights = require("../.test-build/app/training-insights.js");
const { parseBackup, serializeBackup } = require("../.test-build/app/backup-logic.js");
const { sanitizeTrackerState } = require("../.test-build/lib/tracker-validation.js");
const first = data.FOUR_DAY_KEY_START;
const plan = (value = state()) => logic.activateFourDayPlan(value, "2026-10-12", "program-4", "2026-10-10T12:00:00Z", "2026-10-10");
function logAll(value, key, reps = "10") {
  const log = sessions.hydratedWorkoutLog(value, key);
  for (const item of sessions.warmupItemsForSession(key)) log.warmup[item.id] = true;
  for (const [slot, prescription] of Object.entries(log.prescription.exercises)) {
    for (let i = 0; i < prescription.sets; i++) log.sets[slot][i] = { done: true, reps, load: "40", rir: "3" };
  }
  log.completed = true;
  log.completedAt = "2026-10-12T12:00:00Z";
  value.workouts[key] = log;
  return log;
}

test("four-day activation preserves old completed and partial records, units, dates, and identity", () => {
  const original = state();
  original.workouts[1].completed = true;
  original.workouts[1].sets[slot][0] = { done: true, load: "20", reps: "10", rir: "2" };
  original.workouts[1].loadUnit = "kg";
  original.workouts[3] = workout(3);
  original.workouts[3].note = "Session in progress";
  original.workouts[3].sets[Object.keys(original.workouts[3].sets)[0]][0].load = "25";
  original.schedule[3] = "2026-10-04";
  const before = JSON.stringify(original);
  const upgraded = plan(original);
  assert.equal(JSON.stringify(original), before);
  assert.deepEqual(upgraded.workouts, original.workouts);
  assert.deepEqual(upgraded.schedule, original.schedule);
  assert.equal(upgraded.blockId, original.blockId);
  assert.equal(upgraded.startDate, original.startDate);
  assert.equal(logic.scheduledDate(upgraded, 3), "2026-10-04");
  assert.equal(logic.nextWorkoutDay(upgraded, "2026-10-12"), 3);
  assert.throws(() => logic.activateFourDayPlan(upgraded, "2026-10-19", "second"), /already/);
  assert.throws(() => logic.activateFourDayPlan(original, "2026-10-05", "early", undefined, "2026-10-04"), /two days/);
});

test("schema-5 backups migrate without starting a new program or dropping legacy templates", () => {
  for (const id of ["A", "F", "G", "L"]) {
    const old = state();
    old.schemaVersion = 5;
    delete old.fourDayPlan;
    old.workouts[1].workoutId = id;
    const migrated = parseBackup(JSON.stringify(old));
    assert.equal(migrated.schemaVersion, 6);
    assert.equal(migrated.fourDayPlan, null);
    assert.deepEqual(migrated.workouts, old.workouts);
    assert.equal(logic.workoutForDay(migrated, 1).id, id);
  }
});

test("four-day dates and template IDs remain stable across months and daylight-saving changes", () => {
  const value = plan();
  const week = logic.scheduledDaysInRange(value, "2026-10-12", "2026-10-18");
  assert.deepEqual(week, [first, first + 1, first + 2, first + 3]);
  assert.deepEqual(week.map(key => logic.workoutForDay(value, key).id), ["UA", "LA", "UB", "LB"]);
  assert.deepEqual(week.map(key => logic.scheduledDate(value, key)), ["2026-10-12", "2026-10-13", "2026-10-15", "2026-10-16"]);
  assert.equal(logic.scheduledDaysInRange(value, "2026-11-02", "2026-11-08").length, 4);
  assert.equal(logic.scheduledDaysInRange(value, "2027-03-15", "2027-03-21").length, 4);
  assert.equal(logic.scheduledDaysInRange(value, "2028-02-28", "2028-03-05").length, 4);
  assert.equal(logic.sessionNumberForKey(value, first + 4), logic.sessionNumberForKey(value, first) + 4);
});

test("the transition leaves a full recovery day after every possible legacy calendar alignment", () => {
  for (let offset = 0; offset < 7; offset++) {
    const original = state(); original.startDate = logic.isoDateOffset("2026-10-01", offset);
    const value = plan(original);
    const legacy = logic.scheduledDaysInRange(value, original.startDate, "2026-10-11");
    assert.ok(legacy.every(key => logic.dayDifference(logic.scheduledDate(value, key), "2026-10-12") >= 2));
  }
});

test("transition totals are 43, target totals are 58, and the seventh upper exercise counts", () => {
  const value = plan();
  const totals = [0, 1, 2, 3].map(index => sessions.sessionProgress(value, first + index, sessions.hydratedWorkoutLog(value, first + index)).total);
  assert.deepEqual(totals, [14, 7, 14, 8]);
  let target = value;
  for (const id of data.FOUR_DAY_ROTATION) for (const item of data.FOUR_DAY_EXERCISES[id]) target = logic.changeFourDaySets(target, id, item.id, item.targetSets);
  assert.deepEqual([0, 1, 2, 3].map(index => sessions.sessionProgress(target, first + index, sessions.hydratedWorkoutLog(target, first + index)).total), [17, 11, 17, 13]);
  const log = logAll(value, first);
  assert.equal(sessions.sessionProgress(value, first, log).ready, true);
  log.sets["triceps-extension"][1].done = false;
  assert.equal(sessions.sessionProgress(value, first, log).ready, false);
  assert.equal(sessions.sessionProgress(value, first, log).next.slot, "triceps-extension");
});

test("straight sets, short mode, and exercise-specific rest use the saved prescription", () => {
  const value = plan(), log = sessions.hydratedWorkoutLog(value, first);
  log.sets["flat-db-bench"][0] = { done: true, reps: "8", load: "40", rir: "3" };
  assert.deepEqual(sessions.sessionProgress(value, first, log).next, { slot: "flat-db-bench", name: "Flat dumbbell bench press", setIndex: 1 });
  assert.equal(sessions.exercisePrescriptionFor(value, first, "flat-db-bench", log).restSeconds, 180);
  assert.equal(sessions.exercisePrescriptionFor(value, first, "hammer-curl", log).restSeconds, 90);
  log.lowSleep = true;
  assert.equal(sessions.sessionProgress(value, first, log).total, 8);
  const lower = sessions.hydratedWorkoutLog(value, first + 1); lower.lowSleep = true;
  assert.equal(sessions.sessionProgress(value, first + 1, lower).total, 5);
});

test("changing future volume or effort never rewrites a begun session or increases volume by time alone", () => {
  const value = plan();
  value.workouts[first] = sessions.hydratedWorkoutLog(value, first);
  value.workouts[first].note = "Started";
  const frozen = structuredClone(value.workouts[first]);
  const changed = logic.changeFourDaySets(value, "UA", "flat-db-bench", 3);
  changed.fourDayPlan.rir = 2;
  assert.deepEqual(changed.workouts[first], frozen);
  assert.equal(sessions.exercisePrescriptionFor(changed, first, "flat-db-bench").sets, 2);
  assert.equal(sessions.exercisePrescriptionFor(changed, first, "flat-db-bench").rir, 3);
  assert.equal(sessions.exercisePrescriptionFor(changed, first + 4, "flat-db-bench").sets, 3);
  assert.equal(sessions.exercisePrescriptionFor(value, first + 400, "flat-db-bench").sets, 2);
  assert.throws(() => logic.changeFourDaySets(value, "UA", "flat-db-bench", 4), /set count/);
});

test("missed sessions stay next and rescheduling moves the future sequence without moving history", () => {
  const value = plan();
  value.workouts[1].completed = true;
  assert.equal(logic.nextWorkoutDay(value, "2026-11-01"), first);
  const moved = logic.rescheduleSession(value, first, "2026-11-02");
  assert.equal(logic.scheduledDate(moved, 1), logic.scheduledDate(value, 1));
  assert.deepEqual([0, 1, 2, 3].map(index => logic.scheduledDate(moved, first + index)), ["2026-11-02", "2026-11-03", "2026-11-05", "2026-11-06"]);
  assert.equal(logic.scheduledDaysInRange(moved, "2026-10-12", "2026-10-18").length, 0);
  logAll(moved, first);
  assert.equal(logic.nextWorkoutDay(moved, "2026-11-04"), first + 1);
  assert.throws(() => logic.rescheduleSession(moved, first, "2026-11-03"), /Completed/);
  assert.throws(() => logic.rescheduleSession(moved, first + 1, "2026-11-02"), /order/);
  const shiftedAgain = logic.rescheduleSession(moved, first + 1, "2026-11-04");
  assert.equal(logic.scheduledDate(shiftedAgain, first), "2026-11-02");
  assert.equal(logic.scheduledDate(shiftedAgain, first + 2), "2026-11-06");
});

test("a future session with entries blocks moving dates underneath it", () => {
  const value = plan();
  value.workouts[first + 2] = sessions.hydratedWorkoutLog(value, first + 2);
  value.workouts[first + 2].note = "Planned load already entered";
  assert.throws(() => logic.rescheduleSession(value, first, "2026-10-20"), /later session/);
});

test("four-day backups round-trip prescriptions, shifts, and legacy data; malformed programs fail", () => {
  const value = logic.rescheduleSession(plan(), first, "2026-10-19");
  logAll(value, first);
  assert.deepEqual(parseBackup(serializeBackup(value)), value);
  assert.deepEqual(sanitizeTrackerState(value), value);
  const invalid = structuredClone(value);
  invalid.workouts[first].prescription.sessionId = "wrong";
  assert.equal(sanitizeTrackerState(invalid), null);
  assert.throws(() => parseBackup(JSON.stringify(invalid)), /invalid/);
  const tooMany = structuredClone(value); tooMany.fourDayPlan.sets.UA["flat-db-bench"] = 20;
  assert.equal(sanitizeTrackerState(tooMany), null);
  const orphan = structuredClone(value); orphan.fourDayPlan = null;
  assert.equal(sanitizeTrackerState(orphan), null);
  const overlap = structuredClone(value); overlap.fourDayPlan.shifts[first + 1] = -1;
  assert.equal(sanitizeTrackerState(overlap), null);
  const wrongEffort = structuredClone(value); wrongEffort.fourDayPlan.rir = "2";
  assert.equal(sanitizeTrackerState(wrongEffort), null);
});

test("past loads carry from legacy workouts into new workouts with unit conversion", () => {
  const value = plan();
  value.workouts[1].sets["flat-db-bench"][0] = { done: true, reps: "9", load: "100", rir: "2" };
  const log = sessions.hydratedWorkoutLog(value, first); log.loadUnit = "kg";
  const copied = sessions.copyPreviousSets(value, first, log, "flat-db-bench", 2);
  assert.equal(copied.sets["flat-db-bench"][0].load, "45.36");
  assert.equal(copied.sets["flat-db-bench"][0].done, false);
});

test("weekly muscle totals follow actual prescribed and completed sets, including calves and hamstrings", () => {
  let value = plan();
  for (const id of data.FOUR_DAY_ROTATION) for (const item of data.FOUR_DAY_EXERCISES[id]) value = logic.changeFourDaySets(value, id, item.id, item.targetSets);
  for (let index = 0; index < 4; index++) logAll(value, first + index);
  const muscle = Object.fromEntries(insights.weeklyMuscleBalance(value, "2026-10-18").items.map(item => [item.group, [item.target, item.completed]]));
  assert.deepEqual(muscle.Chest, [10, 10]); assert.deepEqual(muscle.Back, [10, 10]);
  assert.deepEqual(muscle.Quads, [8, 8]); assert.deepEqual(muscle.Hamstrings, [8, 8]);
  assert.deepEqual(muscle.Calves, [4, 4]); assert.deepEqual(muscle.Core, [4, 4]);
});

test("load increases require two completed comparable sessions, enough sets, stable loads, and intended reserve", () => {
  const value = plan();
  logAll(value, first);
  const target = sessions.exercisePrescriptionFor(value, first + 4, "flat-db-bench");
  let previous = logic.previousPerformance(value, first + 4, "flat-db-bench", "flat-db-bench");
  assert.equal(logic.loadRecommendation("flat-db-bench", previous, "lb", target).kind, "repeat");
  logAll(value, first + 4);
  previous = logic.previousPerformance(value, first + 8, "flat-db-bench", "flat-db-bench");
  assert.equal(logic.loadRecommendation("flat-db-bench", previous, "lb", target).kind, "increase");
  value.workouts[first + 4].sets["flat-db-bench"][1].rir = "1";
  previous = logic.previousPerformance(value, first + 8, "flat-db-bench", "flat-db-bench");
  assert.equal(logic.loadRecommendation("flat-db-bench", previous, "lb", target).kind, "repeat");
  value.workouts[first + 4].sets["flat-db-bench"][1].rir = "3";
  value.workouts[first + 4].completed = false;
  previous = logic.previousPerformance(value, first + 8, "flat-db-bench", "flat-db-bench");
  assert.equal(logic.loadRecommendation("flat-db-bench", previous, "lb", target).kind, "repeat");
});

test("the actual SQL write gate prevents a cached schema-5 client erasing a four-day program", () => {
  const source = readFileSync(new URL("../lib/progress-store.ts", import.meta.url), "utf8");
  const sql = source.match(/"(UPDATE gym_progress SET state_json = .*?json_extract.*?)"/)[1];
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE gym_progress (user_email TEXT PRIMARY KEY, state_json TEXT, version INTEGER, updated_at INTEGER)");
    db.prepare("INSERT INTO gym_progress VALUES (?, ?, 1, 1)").run("athlete", JSON.stringify(plan()));
    assert.equal(db.prepare(sql).run(JSON.stringify(state()), 2, 2, "athlete", 1, 5).changes, 0);
    assert.equal(db.prepare(sql).run(JSON.stringify(plan()), 2, 2, "athlete", 1, 6).changes, 1);
    assert.equal(db.prepare(sql).run(JSON.stringify(plan()), 3, 3, "athlete", 1, 6).changes, 0);
    db.prepare("UPDATE gym_progress SET state_json = ?, version = 1").run(JSON.stringify(state()));
    assert.equal(db.prepare(sql).run(JSON.stringify(state()), 2, 2, "athlete", 1, 5).changes, 1);
  } finally { db.close(); }
});
