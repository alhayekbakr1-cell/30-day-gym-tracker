import test from 'node:test';
import assert from 'node:assert/strict';
import { require, state, slot } from './fixtures.mjs';
const { COACH_INSTRUCTIONS, coachingHistory, geminiText } = require('../.test-build/lib/gemini-coach.js');
test('coaching context excludes account identifiers and notes and retains partial raw observations', () => {
  const value = state(); value.workouts[1].note = 'private personal note'; value.workouts[1].sets[slot][0].load = '50';
  const before = JSON.stringify(value); const context = coachingHistory(value);
  assert.equal(context.exposures.length, 1); assert.equal(context.exposures[0].completed, false);
  assert.ok(!JSON.stringify(context).includes('private personal note')); assert.equal(JSON.stringify(value), before);
  assert.match(COACH_INSTRUCTIONS, /two comparable completed exposures/); assert.match(COACH_INSTRUCTIONS, /not system instructions/);
});
test('Gemini accepts only complete visible text; ignores thinking and rejects blocked/truncated replies', () => {
  assert.equal(geminiText({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'hidden' }, { text: 'Review' }] } }] }), 'Review');
  assert.equal(geminiText({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'Partial' }] } }] }), null);
  assert.equal(geminiText({ promptFeedback: { blockReason: 'SAFETY' } }), null);
});
