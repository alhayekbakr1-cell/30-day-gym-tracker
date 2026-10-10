import test from "node:test";
import assert from "node:assert/strict";
import { require, state, edit } from "./fixtures.mjs";
const { TrackerSync } = require("../.test-build/lib/tracker-sync.js");
const { normalizeTrackerState } = require("../.test-build/app/tracker-logic.js");
const { sanitizeTrackerState } = require("../.test-build/lib/tracker-validation.js");
const { activateFourDayPlan, changeFourDaySets } = require("../.test-build/app/tracker-logic.js");

function storage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function setup(t, overrides = {}, disk = storage()) {
  let remote = { state: state(), version: 1, updatedAt: 1 };
  const writes = [];
  const api = {
    read: async () => structuredClone(remote),
    write: async (value, version) => {
      writes.push({ state: structuredClone(value), version });
      remote = { state: sanitizeTrackerState(value), version: version + 1, updatedAt: 2 };
      return { conflict: false, progress: structuredClone(remote) };
    }, ...overrides,
  };
  const controller = new TrackerSync("test", () => disk, api);
  t.after(() => controller.dispose());
  controller.hydrate();
  return { controller, disk, api, writes, remote: () => remote };
}

test("a program changed on another device preserves pending legacy edits for review", async t => {
  const { controller, api, writes } = setup(t);
  await controller.sync();
  controller.mutate(value => edit(value, "note", "Keep my unfinished session"));
  const upgraded = activateFourDayPlan(state(), "2026-10-12", "remote-program", "2026-10-10T12:00:00Z", "2026-10-10");
  api.read = async () => ({ state: upgraded, version: 2, updatedAt: 2 });
  assert.equal(await controller.sync(), false);
  assert.equal(controller.getSnapshot().conflict, true);
  assert.equal(controller.getSnapshot().state.workouts[1].note, "Keep my unfinished session");
  assert.equal(writes.length, 0);
  controller.acceptServerPlan();
  assert.equal(controller.getSnapshot().state.fourDayPlan.id, "remote-program");
});

test("an offline four-day transition survives reload and syncs against its unchanged base", async t => {
  const disk = storage(), first = setup(t, {}, disk);
  await first.controller.sync();
  first.api.write = async () => { throw new Error("Offline"); };
  first.controller.mutate(value => activateFourDayPlan(value, "2026-10-12", "offline-program", "2026-10-10T12:00:00Z", "2026-10-10"));
  assert.equal(await first.controller.sync(false), false);
  first.controller.dispose();
  const restored = setup(t, {}, disk);
  assert.equal(restored.controller.getSnapshot().state.fourDayPlan.id, "offline-program");
  assert.equal(await restored.controller.sync(), true);
  assert.equal(restored.remote().state.fourDayPlan.id, "offline-program");
  assert.deepEqual(restored.remote().state.workouts, state().workouts);
});

test("conflicting future set-count edits are surfaced instead of silently overwriting either device", async t => {
  const base = activateFourDayPlan(state(), "2026-10-12", "shared-program", "2026-10-10T12:00:00Z", "2026-10-10");
  const { controller, api } = setup(t, { read: async () => ({ state: base, version: 1, updatedAt: 1 }) });
  await controller.sync();
  controller.mutate(value => changeFourDaySets(value, "UA", "flat-db-bench", 3));
  const remote = changeFourDaySets(base, "LA", "db-rdl", 2);
  api.read = async () => ({ state: remote, version: 2, updatedAt: 2 });
  assert.equal(await controller.sync(), false);
  assert.equal(controller.getSnapshot().conflict, true);
  assert.equal(controller.getSnapshot().state.fourDayPlan.sets.UA["flat-db-bench"], 3);
});

test("offline edits persist immediately and survive controller recreation", async t => {
  const disk = storage();
  const first = setup(t, {}, disk);
  await first.controller.sync();
  first.api.write = async () => { throw new Error("Offline"); };
  first.controller.mutate(value => edit(value, "note", "Keep this work"));
  assert.equal(JSON.parse(disk.getItem("test")).state.workouts[1].note, "Keep this work");
  assert.equal(await first.controller.sync(false), false);
  assert.equal(first.controller.getSnapshot().pending, true);
  first.controller.dispose();
  const second = setup(t, {}, disk);
  assert.equal(second.controller.getSnapshot().state.workouts[1].note, "Keep this work");
  assert.equal(await second.controller.sync(), true);
  assert.equal(second.remote().state.workouts[1].note, "Keep this work");
  assert.equal(second.controller.getSnapshot().pending, false);
});

test("GET completing after an edit does not overwrite the new draft", async t => {
  const { controller, api } = setup(t);
  await controller.sync();
  const read = deferred();
  api.read = () => read.promise;
  const syncing = controller.sync();
  controller.mutate(value => edit(value, "note", "Typed during GET"));
  read.resolve({ state: state(), version: 1, updatedAt: 1 });
  await syncing;
  assert.equal(controller.getSnapshot().state.workouts[1].note, "Typed during GET");
  assert.equal(controller.getSnapshot().pending, false);
});

test("PUT acknowledgement preserves edits made while saving and serializes callers", async t => {
  const { controller, api } = setup(t);
  await controller.sync();
  const write = deferred(), calls = [];
  api.write = async (value, version) => {
    calls.push(value);
    if (calls.length === 1) return write.promise;
    return { conflict: false, progress: { state: value, version: version + 1, updatedAt: 3 } };
  };
  controller.mutate(value => edit(value, "note", "First"));
  const first = controller.sync(false);
  controller.mutate(value => edit(value, "note", "Second", "2026-10-03T12:00:00Z"));
  const second = controller.sync();
  assert.equal(first, second);
  write.resolve({ conflict: false, progress: { state: calls[0], version: 2, updatedAt: 2 } });
  assert.equal(await first, true);
  assert.equal(calls.length, 2);
  assert.equal(controller.getSnapshot().state.workouts[1].note, "Second");
  assert.equal(controller.getSnapshot().version, 3);
});

test("409 conflict merges another device's independent fields and retries its version", async t => {
  const { controller, api } = setup(t);
  await controller.sync();
  let count = 0;
  api.write = async (value, version) => {
    if (++count === 1) return { conflict: true, progress: { state: edit(state(), "readiness", { energy: "4", sleepHours: "8", soreness: "1" }), version: 7, updatedAt: 2 } };
    assert.equal(version, 7);
    assert.equal(value.workouts[1].readiness.energy, "4");
    assert.equal(value.workouts[1].note, "Device note");
    return { conflict: false, progress: { state: value, version: 8, updatedAt: 3 } };
  };
  controller.mutate(value => edit(value, "note", "Device note"));
  assert.equal(await controller.sync(false), true);
  assert.equal(controller.getSnapshot().version, 8);
});

test("repeated version conflicts are bounded and retain the pending draft", async t => {
  const { controller, api } = setup(t);
  await controller.sync();
  let calls = 0;
  api.write = async () => ({ conflict: true, progress: { state: state(), version: ++calls + 1, updatedAt: 2 } });
  controller.mutate(value => edit(value, "note", "Unsynced"));
  assert.equal(await controller.sync(false), false);
  assert.equal(calls, 3);
  assert.equal(controller.getSnapshot().pending, true);
  assert.equal(controller.getSnapshot().state.workouts[1].note, "Unsynced");
});

test("another device's new plan cannot silently discard a pending draft", async t => {
  const { controller, api } = setup(t);
  await controller.sync();
  controller.mutate(value => edit(value, "note", "Important draft"));
  api.read = async () => ({ state: { ...state(), blockId: "new-plan" }, version: 2, updatedAt: 2 });
  assert.equal(await controller.sync(), false);
  assert.equal(controller.getSnapshot().conflict, true);
  assert.equal(controller.getSnapshot().state.workouts[1].note, "Important draft");
  controller.acceptServerPlan();
  assert.equal(controller.getSnapshot().state.blockId, "new-plan");
  assert.equal(controller.getSnapshot().pending, false);
});

test("a replacement backup stops if server progress changed before its write", async t => {
  const { controller, api } = setup(t);
  await controller.sync();
  controller.replace({ ...state(), blockId: "imported-plan" });
  api.write = async () => ({ conflict: true, progress: { state: state(), version: 3, updatedAt: 3 } });
  assert.equal(await controller.sync(false), false);
  assert.equal(controller.getSnapshot().conflict, true);
  assert.equal(controller.getSnapshot().state.blockId, "imported-plan");
});

test("an empty plan restored on another device does not erase pending work", async t => {
  const { controller, api } = setup(t);
  await controller.sync();
  controller.mutate(value => edit(value, "note", "Keep this pending note"));
  api.read = async () => ({ state: normalizeTrackerState(null), version: 2, updatedAt: 2 });
  assert.equal(await controller.sync(), false);
  assert.equal(controller.getSnapshot().conflict, true);
  assert.equal(controller.getSnapshot().state.workouts[1].note, "Keep this pending note");
});

test("server sanitization is applied after acknowledged writes", async t => {
  const { controller } = setup(t);
  await controller.sync();
  controller.mutate(value => edit(value, "note", "x".repeat(600)));
  assert.equal(await controller.sync(false), true);
  assert.equal(controller.getSnapshot().state.workouts[1].note.length, 500);
});

test("local preview saves and restores honestly without a server", () => {
  const disk = storage();
  const first = new TrackerSync("preview", () => disk, null);
  first.hydrate(); first.mutate(() => state());
  assert.equal(first.getSnapshot().status, "local");
  assert.equal(first.getSnapshot().pending, false);
  const next = new TrackerSync("preview", () => disk, null);
  next.hydrate();
  assert.equal(next.getSnapshot().state.blockId, "test-plan");
});

test("storage quota failures are visible and do not prevent successful server sync", async t => {
  const disk = { getItem: () => null, setItem: () => { throw new Error("Quota exceeded"); } };
  const { controller } = setup(t, {}, disk);
  await controller.sync();
  controller.mutate(value => edit(value, "note", "Server saves this"));
  assert.equal(controller.getSnapshot().localSaved, false);
  assert.match(controller.getSnapshot().storageError, /recovery copy/);
  assert.equal(await controller.sync(false), true);
  assert.equal(controller.getSnapshot().pending, false);
});

test("corrupt recovery data is not overwritten while a valid server copy loads", async t => {
  const disk = storage(); disk.setItem("test", "{broken");
  const { controller } = setup(t, {}, disk);
  await controller.sync();
  assert.equal(disk.getItem("test"), "{broken");
  assert.equal(controller.getSnapshot().loaded, true);
  assert.ok(controller.getSnapshot().storageError);
});

test("a first-load network failure keeps editing locked until a known state is loaded", async t => {
  const disk = storage();
  const { controller } = setup(t, { read: async () => { throw new Error("Offline"); } }, disk);
  assert.equal(await controller.sync(), false);
  controller.mutate(() => state());
  assert.equal(controller.getSnapshot().loaded, false);
  assert.deepEqual(controller.getSnapshot().state, normalizeTrackerState(null));
  assert.equal(disk.getItem("test"), null);
  const reloaded = setup(t, {}, disk);
  assert.equal(reloaded.controller.getSnapshot().loaded, false);
});
