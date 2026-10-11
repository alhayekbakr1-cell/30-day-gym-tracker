import test from 'node:test';
import assert from 'node:assert/strict';
import { require, state, edit } from './fixtures.mjs';
const { TrackerSync } = require('../.test-build/lib/tracker-sync.js');
const { recoveryKey, isolatedTabKey, copyInitialRecovery, readDeviceDrafts } = require('../.test-build/lib/tab-recovery.js');
function disk() { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key,v) => data.set(key,v), key: index => [...data.keys()][index] ?? null, get length() { return data.size; } }; }
function cache(value) { return JSON.stringify({ format: 1, state: value, base: value, version: 1, pending: true, replacement: false, updatedAt: 1 }); }
test('same-account follower is read-only; ownership transfer re-reads draft before editing', async t => {
  const storage = disk(); storage.setItem('shared', cache(state())); let owner = true, follower = false; let writes = 0;
  const api = { read: async () => ({ state: state(), version: 1, updatedAt: 1 }), write: async value => { writes++; return { conflict: false, progress: { state: value, version: 2, updatedAt: 2 } }; } };
  const one = new TrackerSync('shared', () => storage, api, () => owner); const two = new TrackerSync('shared', () => storage, api, () => follower); t.after(() => { one.dispose(); two.dispose(); });
  one.hydrate(); two.hydrate(); one.mutate(value => edit(value, 'note', 'owner draft')); two.mutate(value => edit(value, 'note', 'follower overwrite'));
  assert.equal(await two.sync(), false); assert.equal(writes, 0); assert.equal(JSON.parse(storage.getItem('shared')).state.workouts[1].note, 'owner draft');
  owner = false; one.dispose(); follower = true; two.reloadRecovery(); assert.equal(two.getSnapshot().state.workouts[1].note, 'owner draft');
  await two.sync(); assert.equal(writes, 1); assert.equal(two.getSnapshot().pending, false);
});
test('late response after lost ownership cannot overwrite drafts or expose a changed account', async t => {
  const storage = disk(); let allowed = true, resolve; const pending = new Promise(done => { resolve = done; });
  const sync = new TrackerSync('account-a', () => storage, { read: () => pending, write: async () => { throw Error('must not write'); } }, () => allowed); t.after(() => sync.dispose());
  const task = sync.sync(); allowed = false; sync.clearAccountView(); resolve({ state: state(), version: 1, updatedAt: 1 });
  assert.equal(await task, false); assert.equal(sync.getSnapshot().state.startDate, null); assert.equal(storage.getItem('account-a'), null);
});
test('fallback tabs and crashed drafts remain independently exportable; accounts stay isolated', () => {
  const storage = disk(); const base = recoveryKey('first@example.test'), second = recoveryKey('second@example.test'); storage.setItem(base, cache(state()));
  const a = isolatedTabKey(base, 'a'), b = isolatedTabKey(base, 'b'); copyInitialRecovery(storage, base, a); copyInitialRecovery(storage, base, b);
  storage.setItem(a, cache(edit(state(), 'note', 'tab a'))); storage.setItem(b, cache(edit(state(), 'note', 'tab b')));
  assert.equal(readDeviceDrafts(storage, base).length, 3); assert.deepEqual(readDeviceDrafts(storage, second), []);
  // Reopening makes a new document key; neither crashed copy is removed or reused blindly.
  copyInitialRecovery(storage, base, isolatedTabKey(base, 'reloaded')); assert.equal(JSON.parse(storage.getItem(a)).state.workouts[1].note, 'tab a');
});

test('fallback preserves an immutable original draft before a competing server field wins', async t => {
  const storage = disk(), base = recoveryKey('athlete@example.test'), key = isolatedTabKey(base, 'one');
  const local = edit(state(), 'note', 'original local', '2026-10-02T12:00:00Z'); storage.setItem(key, cache(local));
  const newer = edit(state(), 'note', 'newer other tab', '2026-10-03T12:00:00Z');
  const sync = new TrackerSync(key, () => storage, { read: async () => ({ state: newer, version: 2, updatedAt: 2 }), write: async value => ({ conflict: false, progress: { state: value, version: 3, updatedAt: 3 } }) }, () => true, () => {}, true); t.after(() => sync.dispose()); sync.hydrate(); await sync.sync();
  assert.ok(readDeviceDrafts(storage, base).some(draft => draft.state.workouts[1].note === 'original local'));
});
