import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateResult, radarPoint, scoreBand } from '../src/results.js';
import { initialQuizState, quizReducer, getQuestion } from '../src/quiz.js';
function attempt(correct, skipIndex = -1) {
  let state = initialQuizState(1000, () => 0.5);
  while (!state.completedAt) {
    const q = getQuestion(state.questionIds[state.index]);
    const isCorrect = typeof correct === 'function' ? correct(state.index) : correct;
    const option = isCorrect ? q.correctAnswer : 'ABCD'.split('').find(x => x !== q.correctAnswer);
    state = quizReducer(state, { type: 'select', option, now: 2000 + state.index * 2000 });
    state = quizReducer(state, { type: state.index === skipIndex ? 'skip' : 'next', now: 3000 + state.index * 2000, random: () => 0.5 });
  }
  return state;
}
test('results use per-dimension EMA scores and mean score, while retaining accuracy separately', () => {
  const state = attempt(true);
  const r = calculateResult(state);
  assert.equal(r.totalCorrect, 18);
  assert.equal(r.accuracy, 100);
  assert.equal(r.total, 74);
  for (const d of r.dimensions) {
    assert.equal(d.total, 3);
    assert.equal(d.score, 74);
    assert.ok(Math.abs(d.rawScore - 74.075) < 1e-8);
  }
  assert.ok(calculateResult(attempt(false)).total < r.total);
});
test('accuracy displays 94.4 for 17 correct answers and keeps skips in the denominator', () => {
  const oneWrong = calculateResult(attempt(index => index !== 17));
  assert.equal(oneWrong.totalCorrect, 17);
  assert.equal(oneWrong.accuracy, 94.4);
  assert.equal(oneWrong.total, 72);
  const oneSkipped = calculateResult(attempt(true, 17));
  assert.equal(oneSkipped.totalCorrect, 17);
  assert.equal(oneSkipped.skipped, 1);
  assert.equal(oneSkipped.accuracy, 94.4);
  assert.equal(calculateResult(attempt(false)).accuracy, 0);
});
test('results replay contributions using the actual drawn tier, not the unavailable target tier', () => {
  const s = attempt(true);
  const final = s.answers[12];
  assert.equal(final.targetDifficulty, 5);
  assert.equal(final.actualDifficulty, 4);
  assert.equal(final.contribution, 90);
  assert.ok(calculateResult(s));
  s.answers[12].contribution = 100;
  assert.equal(calculateResult(s), null);
});
test('no report before all dimensions meet coverage', () => {
  assert.equal(calculateResult(null), null);
  assert.equal(calculateResult(initialQuizState()), null);
});
test('score colors and radar geometry remain unchanged', () => {
  assert.equal(scoreBand(81), 'strength');
  assert.equal(scoreBand(80), 'balanced');
  assert.equal(scoreBand(60), 'balanced');
  assert.equal(scoreBand(59), 'growth');
  for (let i = 0; i < 6; i++) {
    assert.deepEqual(radarPoint(i, 0), [260, 240]);
    const [x,y] = radarPoint(i, 100);
    assert.ok(Math.abs(Math.hypot(x-260,y-240) - 160) < 1e-8);
  }
});
