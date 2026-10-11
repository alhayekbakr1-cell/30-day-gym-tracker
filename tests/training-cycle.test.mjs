import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { state, workout, require } from "./fixtures.mjs";
const cycle = require("../.test-build/app/training-cycle.js");
const logic = require("../.test-build/app/tracker-logic.js");
const sessions = require("../.test-build/app/session-logic.js");
const equipment = require("../.test-build/app/equipment-logic.js");
const { FOUR_DAY_KEY_START: first } = require("../.test-build/app/four-day-data.js");
const { EXERCISE_LIBRARY, canonicalExerciseId } = require("../.test-build/app/workout-data.js");
const { parseBackup, serializeBackup } = require("../.test-build/app/backup-logic.js");
const { sanitizeTrackerState } = require("../.test-build/lib/tracker-validation.js");
const { TrackerSync } = require("../.test-build/lib/tracker-sync.js");
const stamp = "2026-10-05T12:00:00.000Z";
function enabled(four = false) {
  let value = state();
  if (four) value = logic.activateFourDayPlan(value, "2026-10-05", "four", stamp, "2026-10-01");
  return cycle.activateTrainingCycle(value, "2026-10-05", "cycle", stamp, "2026-10-01");
}
function complete(value, key, { rir = "3", load = "25", unit = "lb" } = {}) {
  const log = sessions.hydratedWorkoutLog(value, key);
  log.loadUnit = unit; log.completed = true; log.completedAt = `${logic.scheduledDate(value, key)}T12:00:00Z`; log.modifiedAt = log.completedAt;
  for (const item of logic.workoutForDay(value, key).pairs.flatMap(pair => pair.exercises)) {
    const target = sessions.exercisePrescriptionFor(value, key, item.id, log);
    const high = target.reps.match(/\d+/g).map(Number)[1];
    log.sets[item.id] = Array.from({ length: target.sets }, () => ({ done: true, load, reps: String(high), rir }));
  }
  for (const id of Object.keys(log.warmup)) log.warmup[id] = true;
  return { ...value, workouts: { ...value.workouts, [key]: log } };
}
test("two-calendar-month checkpoints keep the original day, leap years and timezone boundaries", () => {
  for (const [start, months, expected] of [["2026-10-11", 2, "2026-12-11"], ["2026-12-31", 2, "2027-02-28"], ["2027-12-31", 2, "2028-02-29"], ["2026-12-31", 4, "2027-04-30"], ["2027-01-31", 2, "2027-03-31"]]) assert.equal(cycle.cycleDate(start, months), expected);
  assert.equal(cycle.cycleBlock("2026-12-31", "2027-02-27"), 0);
  assert.equal(cycle.cycleBlock("2026-12-31", "2027-02-28"), 1);
  assert.equal(cycle.cycleBlock("2026-12-31", "2027-04-29"), 1);
  assert.equal(cycle.cycleBlock("2026-12-31", "2027-04-30"), 2);
  assert.equal(cycle.cycleBlock("2026-12-31", "2026-12-30"), -1);
});
test("enabling variety preserves legacy plan identity, completed and unfinished data exactly", () => {
  const original = state(); original.workouts[1].completed = true;
  original.workouts[3] = workout(3); original.workouts[3].sets["hammer-curl"][0] = { done: false, load: "30", reps: "8", rir: "3" };
  original.workouts[3].note = "Pending edit"; original.schedule[3] = "2026-10-03";
  const changed = cycle.activateTrainingCycle(original, "2026-10-05", "cycle", stamp, "2026-10-01");
  for (const key of ["workouts", "schedule", "blockId", "startDate", "programVersion", "profile", "dailyMetrics", "equipment", "cardio", "fourDayPlan"]) assert.deepEqual(changed[key], original[key]);
  assert.equal(changed.fourDayPlan, null);
  assert.equal(sessions.prescriptionForSession(changed, 3), undefined);
  assert.equal(sessions.hydratedWorkoutLog(changed, 3).sets["hammer-curl"][0].load, "30");
});
test("upper A/B use different arm movements and only available gym equipment", () => {
  const value = enabled(true), a = sessions.hydratedWorkoutLog(value, first), b = sessions.hydratedWorkoutLog(value, first + 2);
  assert.equal(a.substitutions["hammer-curl"] ?? "hammer-curl", "hammer-curl");
  assert.equal(b.substitutions["hammer-curl"], "db-supinated-curl");
  assert.equal(b.substitutions["triceps-extension"], "lying-db-triceps");
  assert.equal(b.substitutions["lateral-raise-a"], "chest-supported-rear-delt-fly");
  assert.equal(b.substitutions["machine-press"], "flat-db-bench");
  const lower = sessions.hydratedWorkoutLog(value, first + 1);
  assert.notEqual(lower.substitutions["cable-crunch"], "cable-crunch");
  for (let offset = 0; offset < 4; offset++) {
    const log = sessions.hydratedWorkoutLog(value, first + offset);
    for (const item of logic.workoutForDay(value, first + offset).pairs.flatMap(pair => pair.exercises)) assert.ok(equipment.availableExercise(log.substitutions[item.id] ?? item.id, value.equipment));
  }
  const noBench = structuredClone(value); noBench.equipment.available.bench = false;
  const changed = sessions.hydratedWorkoutLog(noBench, first + 2);
  assert.ok(equipment.availableExercise(changed.substitutions["triceps-extension"] ?? "triceps-extension", noBench.equipment));
});
test("accessories vary at block boundaries, main lifts stay stable and new IDs have separate histories", () => {
  const value = enabled(true), future = first + 36; // Dec 7, after the Dec 5 checkpoint.
  const log = sessions.hydratedWorkoutLog(value, future);
  assert.equal(log.prescription.block, 1);
  assert.equal(log.substitutions["hammer-curl"], "incline-db-curl");
  assert.equal(log.substitutions["triceps-extension"], "single-arm-overhead-triceps");
  assert.equal(log.substitutions["flat-db-bench"], undefined);
  assert.notEqual(canonicalExerciseId("db-supinated-curl"), canonicalExerciseId("hammer-curl"));
  assert.notEqual(canonicalExerciseId("lying-db-triceps"), canonicalExerciseId("triceps-extension"));
  assert.equal(sessions.exercisePrescriptionFor(value, future, "hammer-curl", log).rir, 3);
  assert.equal(log.sets["hammer-curl"][0].load, "");
});
test("checkpoint effort advances only after recent comparable completed exposures with reserve", () => {
  let value = complete(complete(enabled(true), first + 28), first + 32);
  const future = sessions.hydratedWorkoutLog(value, first + 36);
  assert.equal(future.prescription.exercises["flat-db-bench"].rir, 2);
  assert.equal(future.prescription.exercises["flat-db-bench"].sets, 2);
  for (const mutate of [v => v.workouts[first + 32].completed = false, v => v.workouts[first + 32].sets["flat-db-bench"][0].rir = "", v => v.workouts[first + 32].sets["flat-db-bench"][0].done = false, v => v.workouts[first + 32].readiness.sleepHours = "5", v => v.workouts[first + 32].readiness.energy = "2", v => v.workouts[first + 32].readiness.soreness = "4", v => v.workouts[first + 32].lowSleep = true]) {
    const held = structuredClone(value); mutate(held);
    assert.equal(sessions.hydratedWorkoutLog(held, first + 36).prescription.exercises["flat-db-bench"].rir, 3);
  }
});
test("calendar passage, stale history and duration-based movements never force intensity", () => {
  const value = complete(complete(enabled(true), first), first + 4);
  const future = sessions.hydratedWorkoutLog(value, first + 36);
  assert.equal(future.prescription.exercises["flat-db-bench"].rir, 3);
  assert.equal(future.prescription.exercises["flat-db-bench"].sets, 2);
  const lower = sessions.hydratedWorkoutLog(enabled(true), first + 39);
  assert.equal(lower.prescription.exercises["front-plank"].sets, 2);
  assert.equal(lower.prescription.exercises["front-plank"].rir, 3);
});
test("an unmarked recent comparable effort is not skipped to force progression", () => {
  let value = complete(complete(enabled(true), first + 24), first + 28);
  const pending = sessions.hydratedWorkoutLog(value, first + 32);
  pending.sets["flat-db-bench"][0] = { done: false, load: "25", reps: "10", rir: "3" };
  value.workouts[first + 32] = pending;
  assert.equal(sessions.hydratedWorkoutLog(value, first + 36).prescription.exercises["flat-db-bench"].rir, 3);
});
test("assistance-based loads never trigger a checkpoint intensity increase", () => {
  let value = enabled(true); value.equipment.available.pulldown = false;
  value = complete(complete(value, first + 28), first + 32);
  const future = sessions.hydratedWorkoutLog(value, first + 36);
  assert.equal(future.substitutions["lat-pulldown"], "assisted-pullup");
  assert.equal(future.prescription.exercises["lat-pulldown"].rir, 3);
  assert.equal(future.prescription.exercises["lat-pulldown"].sets, 2);
});
test("a later checkpoint adds one capped set per template and keeps the larger dose thereafter", () => {
  let value = complete(complete(enabled(true), first + 28), first + 32);
  for (let offset = 36; offset <= 68; offset += 4) value = complete(value, first + offset, { rir: "2" });
  const future = sessions.hydratedWorkoutLog(value, first + 72);
  assert.equal(future.prescription.block, 2);
  assert.equal(future.prescription.advancedSlot, "flat-db-bench");
  assert.equal(future.prescription.exercises["flat-db-bench"].sets, 3);
  assert.equal(future.prescription.exercises["seated-row"].sets, 2);
  value = { ...value, workouts: { ...value.workouts, [first + 72]: future } };
  const again = sessions.hydratedWorkoutLog(value, first + 76);
  assert.equal(again.prescription.advancedSlot, null);
  assert.equal(again.prescription.exercises["flat-db-bench"].sets, 3);
  assert.equal(again.prescription.exercises["seated-row"].sets, 2);
});
test("returning after a gap does not inherit a stale higher dose or tighter reserve", () => {
  let value = complete(complete(enabled(true), first + 28), first + 32);
  value = complete(value, first + 36, { rir: "2" });
  assert.equal(value.workouts[first + 36].prescription.exercises["flat-db-bench"].rir, 2);
  const afterGap = sessions.hydratedWorkoutLog(value, first + 72);
  assert.equal(afterGap.prescription.exercises["flat-db-bench"].rir, 3);
  assert.equal(afterGap.prescription.exercises["flat-db-bench"].sets, 2);
});
test("historical kg/lb retain their values while progression compares converted loads", () => {
  const value = complete(complete(enabled(true), first + 28, { load: "25", unit: "kg" }), first + 32, { load: "55.12", unit: "lb" });
  assert.equal(sessions.hydratedWorkoutLog(value, first + 36).prescription.exercises["flat-db-bench"].rir, 2);
  assert.equal(value.workouts[first + 28].sets["flat-db-bench"][0].load, "25");
  assert.equal(value.workouts[first + 28].loadUnit, "kg");
});
test("started prescriptions survive changed equipment, later blocks, pauses and backup reload", () => {
  let value = enabled(true); const log = sessions.hydratedWorkoutLog(value, first + 2);
  log.sets["hammer-curl"][0] = { done: false, load: "12", reps: "8", rir: "" };
  value.workouts[first + 2] = log;
  value.trainingCycle.enabled = false; value.equipment.available.bench = false;
  const restored = parseBackup(serializeBackup(value));
  assert.deepEqual(sessions.hydratedWorkoutLog(restored, first + 2), log);
  assert.equal(sessions.hydratedWorkoutLog(restored, first + 6).prescription.program, 4);
  assert.deepEqual(restored.workouts, value.workouts);
});
test("schema 5–8 migrate with no opt-in; schema 9 validates cycles and frozen prescriptions strictly", () => {
  for (const version of [5, 6, 7, 8]) {
    const old = state(); old.schemaVersion = version; delete old.trainingCycle;
    if (version < 7) delete old.equipment;
    if (version < 8) delete old.cardio;
    const restored = parseBackup(JSON.stringify(old));
    assert.equal(restored.schemaVersion, 9); assert.equal(restored.trainingCycle, null); assert.deepEqual(restored.workouts, old.workouts);
  }
  const value = enabled(true); value.workouts[first] = sessions.hydratedWorkoutLog(value, first);
  assert.deepEqual(parseBackup(serializeBackup(value)), value);
  for (const mutate of [v => v.trainingCycle.startsOn = "2026-02-30", v => v.trainingCycle.extra = "unknown", v => delete v.trainingCycle,
    v => v.workouts[first].prescription.cycleId = "other", v => v.workouts[first].prescription.exercises["flat-db-bench"].sets = 4,
    v => v.workouts[first].prescription.exercises["flat-db-bench"].rir = 0, v => v.workouts[first].prescription.exercises["flat-db-bench"].reps = "1 rep", v => v.schemaVersion = "9"]) {
    const invalid = structuredClone(value); mutate(invalid); assert.equal(sanitizeTrackerState(invalid), null); assert.throws(() => parseBackup(JSON.stringify(invalid)));
  }
});
test("legacy variety prescriptions and active substitutions round-trip with IDs, dates and pending sets", () => {
  const value = enabled(); const log = sessions.hydratedWorkoutLog(value, 10);
  assert.equal(log.substitutions["hammer-curl"], "db-supinated-curl");
  log.sets["hammer-curl"][0] = { done: false, load: "15", reps: "10", rir: "3" }; value.workouts[10] = log;
  assert.deepEqual(parseBackup(serializeBackup(value)), value);
  assert.equal(logic.scheduledDate(value, 10), "2026-10-10");
  assert.equal(log.workoutId, "K");
});
test("actual SQL rejects cached schema-8 writes, including matching CAS, without crossing accounts", () => {
  const sql = readFileSync(new URL("../lib/progress-store.ts", import.meta.url), "utf8").match(/"(UPDATE gym_progress SET state_json = .*?json_extract.*?)"/)[1];
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE gym_progress(user_email TEXT PRIMARY KEY,state_json TEXT,version INTEGER,updated_at INTEGER)");
    const saved = enabled(); db.prepare("INSERT INTO gym_progress VALUES(?,?,1,1)").run("owner", JSON.stringify(saved));
    const old = { ...saved, schemaVersion: 8, trainingCycle: undefined };
    assert.equal(db.prepare(sql).run(JSON.stringify(old), 2, 2, "owner", 1, 8, 8, 8, 8).changes, 0);
    assert.equal(db.prepare(sql).run(JSON.stringify(saved), 2, 2, "other", 1, 9, 9, 9, 9).changes, 0);
    assert.equal(db.prepare(sql).run(JSON.stringify(saved), 2, 2, "owner", 1, 9, 9, 9, 9).changes, 1);
    assert.equal(db.prepare(sql).run(JSON.stringify(saved), 3, 3, "owner", 1, 9, 9, 9, 9).changes, 0);
  } finally { db.close(); }
});
test("offline variety edits remain recoverable and a competing plan change pauses writes", async t => {
  const base = enabled(true), data = new Map(); const disk = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  let remote = { state: base, version: 1, updatedAt: 1 }, offline = false, writes = 0;
  const api = { read: async () => remote, write: async (value, version) => { writes++; if (offline) throw Error("offline"); remote = { state: value, version: version + 1, updatedAt: 2 }; return { conflict: false, progress: remote }; } };
  const firstDevice = new TrackerSync("athlete", () => disk, api); t.after(() => firstDevice.dispose()); firstDevice.hydrate(); await firstDevice.sync();
  offline = true; firstDevice.mutate(value => ({ ...value, workouts: { ...value.workouts, [first + 2]: sessions.hydratedWorkoutLog(value, first + 2) } }));
  assert.equal(await firstDevice.sync(false), false); firstDevice.dispose();
  const reloaded = new TrackerSync("athlete", () => disk, api); t.after(() => reloaded.dispose()); reloaded.hydrate();
  assert.equal(reloaded.getSnapshot().state.workouts[first + 2].prescription.program, "variety");
  assert.equal(reloaded.getSnapshot().pending, true);
  remote = { state: { ...base, trainingCycle: { ...base.trainingCycle, enabled: false, modifiedAt: "2026-10-06T12:00:00Z" } }, version: 2, updatedAt: 3 };
  offline = false; const before = writes; assert.equal(await reloaded.sync(), false); assert.equal(writes, before); assert.equal(reloaded.getSnapshot().conflict, true);
  assert.ok(parseBackup(serializeBackup(reloaded.getSnapshot().state)).workouts[first + 2].prescription);
});
test("every new movement keeps its own guide cue, equipment requirement and metric identity", () => {
  for (const id of ["db-supinated-curl", "incline-db-curl", "concentration-curl", "lying-db-triceps", "single-arm-overhead-triceps", "chest-supported-rear-delt-fly", "standing-db-lateral-raise", "side-plank", "bird-dog"]) {
    assert.ok(EXERCISE_LIBRARY[id].cue.length > 30); assert.notEqual(equipment.requirements(id), null); assert.equal(canonicalExerciseId(id), id);
  }
});
