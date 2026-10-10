import test from 'node:test';
import assert from 'node:assert/strict';
import { require, state, slot } from './fixtures.mjs';
const { exerciseHistory, filterExerciseHistory, bestCompletedLoad } = require('../.test-build/app/exercise-history.js');
const { EXERCISE_LIBRARY } = require('../.test-build/app/workout-data.js');
test('history retains partial/completed sessions, original units, local dates and stable IDs without mutation', () => {
  const value = state();
  value.schedule = { 1: '2025-12-31', 3: '2026-01-02' };
  value.workouts[1].sets[slot][0] = { done: true, load: '100', reps: '10', rir: '3' };
  value.workouts[3] = structuredClone(value.workouts[1]); value.workouts[3].loadUnit = 'kg'; value.workouts[3].completed = true; value.workouts[3].sets[slot][0].load = '50';
  const before = JSON.stringify(value); const rows = exerciseHistory(value);
  assert.deepEqual(rows.map(row => row.date), ['2026-01-02', '2025-12-31']);
  assert.equal(rows[0].sessionId, 'test-plan:3'); assert.equal(rows[1].completed, false);
  assert.equal(rows[0].sets[0].load, '50'); assert.equal(rows[0].unit, 'kg');
  assert.ok(Math.abs(bestCompletedLoad(rows[0], 'lb') - 110.231) < .01);
  assert.equal(filterExerciseHistory(rows, rows[0].exerciseId, '2026-01-01').length, 1);
  assert.equal(JSON.stringify(value), before);
});
test('substitutions stay separate, timed work has no load comparison and blank sets are excluded', () => {
  const value = state(); const replacement = Object.values(EXERCISE_LIBRARY).find(ex => /sec/i.test(ex.reps));
  value.workouts[1].substitutions[slot] = replacement.id;
  value.workouts[1].sets[slot][0] = { done: false, load: '', reps: '30', rir: '' };
  const rows = exerciseHistory(value); assert.equal(rows.length, 1); assert.equal(rows[0].countUnit, 'seconds'); assert.equal(bestCompletedLoad(rows[0], 'lb'), null);
  assert.equal(filterExerciseHistory(rows, slot, null).length, 0);
  assert.deepEqual(exerciseHistory(state()), []);
});
