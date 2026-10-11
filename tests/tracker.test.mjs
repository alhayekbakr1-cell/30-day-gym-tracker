import test from "node:test";
import assert from "node:assert/strict";
import { require, state, workout, slot, edit, WARMUP_ITEMS, WORKOUTS, workingSetsForDay } from "./fixtures.mjs";
const logic = require("../.test-build/app/tracker-logic.js");
const timer = require("../.test-build/app/countdown-logic.js");
const { validSet, copyPreviousSets, sessionProgress } = require("../.test-build/app/session-logic.js");
const { sanitizeTrackerState } = require("../.test-build/lib/tracker-validation.js");
const { parseBackup, serializeBackup, csvCell } = require("../.test-build/app/backup-logic.js");

test("timers use elapsed time after a background pause or reload", () => {
  const running = timer.startCountdown(timer.newCountdown(120), 1000);
  assert.equal(timer.tickCountdown(running, 76000).remaining, 45);
  assert.equal(timer.readCountdown(JSON.parse(JSON.stringify(running)), 120, 122000).finished, true);
  const paused = timer.pauseCountdown(running, 30500);
  assert.equal(paused.remaining, 91);
  assert.equal(timer.tickCountdown(paused, 900000).remaining, 91);
  assert.equal(timer.startCountdown(paused, 100000).deadline, 191000);
  assert.equal(timer.readCountdown({ ...running, deadline: Infinity }, 120, 0).deadline, null);
});

test("completion requires valid whole reps, supports bodyweight, and rejects nondecimal inputs", () => {
  const set = { done: true, load: "", reps: "8", rir: "2" };
  assert.equal(validSet(set), true);
  for (const reps of ["", "0", "-2", "Infinity", "2.5", "1e3", "0x10", "10001"]) assert.equal(validSet({ ...set, reps }), false, reps);
  for (const load of ["-2", "Infinity", "abc", "1e4"]) assert.equal(validSet({ ...set, load }), false, load);
  const value = state(); value.workouts[1].sets[slot][0] = { ...set, reps: "Infinity" };
  assert.equal(sanitizeTrackerState(value).workouts[1].sets[slot][0].done, false);
});

test("session progress follows the full and short plans", () => {
  const value = state(), log = value.workouts[1];
  assert.equal(sessionProgress(value, 1, log).total, 12);
  for (const item of WARMUP_ITEMS) log.warmup[item.id] = true;
  WORKOUTS[log.workoutId].pairs.flatMap(pair => pair.exercises).forEach((e, i) => {
    for (let index = 0; index < workingSetsForDay(1, i, false); index++) log.sets[e.id][index] = { done: true, reps: "8", load: "", rir: "2" };
  });
  assert.equal(sessionProgress(value, 1, log).ready, true);
  log.lowSleep = true;
  assert.equal(sessionProgress(value, 1, log).total, 8);
  log.sets[slot][0].reps = "";
  assert.equal(sessionProgress(value, 1, log).ready, false);
  assert.equal(sessionProgress(value, 1, log).next.slot, slot);
});

test("three-way merge preserves edits to separate fields and separate sets", () => {
  const base = state(), local = edit(base, "note", "Local note"), remote = edit(base, "readiness", { energy: "4", sleepHours: "7", soreness: "2" });
  local.workouts[1].sets[slot][0] = { done: true, load: "40", reps: "8", rir: "2" };
  remote.workouts[1].sets[slot][1] = { done: true, load: "40", reps: "9", rir: "2" };
  const merged = logic.mergeTrackerStates(remote, local, base);
  assert.equal(merged.workouts[1].note, "Local note");
  assert.equal(merged.workouts[1].readiness.energy, "4");
  assert.equal(merged.workouts[1].sets[slot][0].reps, "8");
  assert.equal(merged.workouts[1].sets[slot][1].reps, "9");
});

test("next-set navigation alternates movements within each pair", () => {
  const value = state(), log = value.workouts[1];
  const [first, second] = WORKOUTS[log.workoutId].pairs[0].exercises;
  log.sets[first.id][0] = { done: true, load: "30", reps: "8", rir: "2" };
  assert.equal(sessionProgress(value, 1, log).next.slot, second.id);
  assert.equal(sessionProgress(value, 1, log).next.setIndex, 0);
  log.sets[second.id][0] = { done: true, load: "30", reps: "8", rir: "2" };
  assert.equal(sessionProgress(value, 1, log).next.slot, first.id);
  assert.equal(sessionProgress(value, 1, log).next.setIndex, 1);
});

test("merge settles same-field conflicts by timestamp and keeps units with their loads", () => {
  const base = state(), local = edit(base, "note", "Newer", "2026-10-04T12:00:00Z"), remote = edit(base, "note", "Older");
  assert.equal(logic.mergeTrackerStates(remote, local, base).workouts[1].note, "Newer");
  remote.workouts[1].loadUnit = "kg";
  remote.workouts[1].sets[slot][0].load = "10";
  const merged = logic.mergeTrackerStates(remote, local, base).workouts[1];
  assert.equal(merged.loadUnit, "lb");
  assert.equal(merged.sets[slot][0].load, "");
});

test("concurrent first entries in a new session merge against empty fields", () => {
  const base = state(); base.workouts = {};
  const local = state(), remote = state();
  local.workouts[1].modifiedAt = "2026-10-04T12:00:00Z";
  local.workouts[1].sets[slot][1] = { done: true, load: "30", reps: "9", rir: "2" };
  remote.workouts[1].sets[slot][0] = { done: true, load: "30", reps: "8", rir: "2" };
  const merged = logic.mergeTrackerStates(remote, local, base);
  assert.equal(merged.workouts[1].sets[slot][0].reps, "8");
  assert.equal(merged.workouts[1].sets[slot][1].reps, "9");
});

test("merging new set edits into a completed session reopens it for review", () => {
  const base = state(), local = edit(base, "completed", true), remote = edit(base, "note", "Other device");
  local.workouts[1].completedAt = "2026-10-02T12:00:00Z";
  remote.workouts[1].sets[slot][0].reps = "9";
  assert.equal(logic.mergeTrackerStates(remote, local, base).workouts[1].completed, false);
});

test("resume favors an unfinished past session and scheduling continues beyond 30 days", () => {
  const value = state(); value.workouts[1].sets[slot][0].reps = "8";
  assert.equal(logic.nextWorkoutDay(value, "2026-10-10"), 1);
  value.workouts[1].completed = true;
  assert.ok(logic.nextWorkoutDay(value, "2026-12-10") > 30);
  assert.ok(logic.scheduledDaysInRange(value, "2027-01-01", "2027-01-31").length >= 12);
  assert.equal(logic.isoDateOffset("2026-12-31", 1), "2027-01-01");
  assert.equal(logic.isIsoDate("2026-02-30"), false);
});

test("copy prior sets converts units, fills only empty rows, and leaves Done unchecked", () => {
  const value = state(); const prior = value.workouts[1];
  prior.sets[slot][0] = { done: true, load: "100", reps: "8", rir: "2" };
  prior.sets[slot][1] = { done: true, load: "110", reps: "9", rir: "1" };
  const day = 43; // Six workout rotations later: the same movement slots.
  const current = workout(day); current.loadUnit = "kg";
  assert.ok(current.sets[slot]);
  current.sets[slot][1].reps = "7";
  value.workouts[day] = current;
  const result = copyPreviousSets(value, day, current, slot, 2);
  assert.equal(result.sets[slot][0].load, "45.36");
  assert.equal(result.sets[slot][0].done, false);
  assert.equal(result.sets[slot][0].rir, "");
  assert.equal(result.sets[slot][1].reps, "7");
  assert.equal(result.sets[slot][1].load, "");
});

test("backups accept old raw schema-5 exports and new envelopes without dropping data", () => {
  const value = state(); value.dailyMetrics["2026-10-01"] = { modifiedAt: "2026-10-01T12:00:00Z", weight: "75", protein: "", steps: "", waist: "", sleepHours: "" }; value.profile.weightUnit = "kg";
  assert.equal(parseBackup(JSON.stringify(value)).dailyMetrics["2026-10-01"].weightUnit, "kg");
  assert.equal(parseBackup(serializeBackup(value)).blockId, value.blockId);
  const emptyGoal = structuredClone(value); emptyGoal.profile.stepGoal = "";
  assert.equal(parseBackup(serializeBackup(emptyGoal)).profile.stepGoal, "");
  assert.throws(() => parseBackup("{}"), /supported/);
  assert.throws(() => parseBackup("{"), /JSON/);
  assert.throws(() => parseBackup(JSON.stringify({ ...value, schemaVersion: 10 })), /supported/);
  const brokenMetric = structuredClone(value); brokenMetric.dailyMetrics["2026-10-01"].weight = 75;
  assert.throws(() => parseBackup(JSON.stringify(brokenMetric)), /daily entries/);
  const brokenUnit = structuredClone(value); brokenUnit.workouts[1].loadUnit = "stones";
  assert.throws(() => parseBackup(JSON.stringify(brokenUnit)), /workout settings/);
  value.workouts["2"] = workout();
  assert.throws(() => parseBackup(JSON.stringify(value)), /unsupported/);
});

test("CSV exports escape delimiters and spreadsheet formula prefixes", () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell("=1+1"), "'=1+1");
  assert.equal(csvCell("\rhello"), '"\'\rhello"');
});
