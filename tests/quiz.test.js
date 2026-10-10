import test from 'node:test';
import assert from 'node:assert/strict';
import { questionBank, getQuestion, initialQuizState, quizReducer, readQuizState, saveQuizState,
  readQuizHistory, isValidQuizState, QUIZ_STORAGE_KEY, HISTORY_STORAGE_KEY, TOTAL_QUESTIONS } from '../src/quiz.js';
const storage = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
const initial = () => initialQuizState(1000, () => 0.5);
export function finish(state, mode = 'correct') {
  while (!state.completedAt) {
    const q = getQuestion(state.questionIds[state.index]);
    const answer = mode === 'correct' ? q.correctAnswer : 'ABCD'.split('').find(x => x !== q.correctAnswer);
    if (mode !== 'skip') state = quizReducer(state, { type: 'select', option: answer, now: 2000 + state.index * 2000 });
    state = quizReducer(state, { type: mode === 'skip' ? 'skip' : 'next', now: 3000 + state.index * 2000, random: () => 0.5 });
  }
  return state;
}
test('the bank remains 100 real questions; only the first question is drawn initially', () => {
  assert.equal(questionBank.length, 100);
  assert.equal(TOTAL_QUESTIONS, 18);
  const state = initial();
  assert.equal(state.questionIds.length, 1);
  assert.ok(state.abilities.every(a => a.difficulty === 3 && a.score === 50 && a.count === 0));
  assert.ok(isValidQuizState(state));
  assert.notEqual(initialQuizState(1000, () => 0).questionIds[0], initialQuizState(1000, () => 0.99).questionIds[0]);
});
test('a selection is required; next records correctness, time, difficulty and score changes', () => {
  let state = initial();
  assert.equal(quizReducer(state, { type: 'next' }), state);
  assert.equal(quizReducer(state, { type: 'select', option: 'E' }), state);
  const q = getQuestion(state.questionIds[0]);
  state = quizReducer(state, { type: 'select', option: q.correctAnswer, now: 2000 });
  state = quizReducer(state, { type: 'next', now: 3500, random: () => 0.5 });
  const a = state.answers[0];
  assert.equal(a.questionId, q.id);
  assert.equal(a.questionNumber, q.number);
  assert.equal(a.isCorrect, true);
  assert.equal(a.timeMs, 2500);
  assert.equal(a.contribution, 75);
  assert.equal(a.scoreBefore, 50);
  assert.equal(a.scoreAfter, 57.5);
  assert.equal(a.difficultyAfter, 4);
  assert.equal(state.selected, null);
  assert.equal(state.questionIds.length, 2);
  assert.ok(isValidQuizState(state));
});
test('skip discards draft, updates as wrong, counts toward coverage and completes at 18', () => {
  let state = quizReducer(initial(), { type: 'select', option: 'A', now: 2000 });
  state = quizReducer(state, { type: 'skip', now: 3000, random: () => 0.5 });
  assert.equal(state.answers[0].userAnswer, null);
  assert.equal(state.answers[0].isCorrect, false);
  assert.equal(state.answers[0].contribution, 45);
  assert.equal(state.answers[0].difficultyAfter, 2);
  state = finish(state, 'skip');
  assert.equal(state.answers.length, 18);
  assert.ok(state.abilities.every(a => a.count === 3));
  assert.ok(isValidQuizState(state));
  assert.equal(quizReducer(state, { type: 'skip' }), state);
});
test('refresh preserves drawn IDs, decisions, draft, active time and all adaptive state', () => {
  const store = storage();
  let state = quizReducer(initial(), { type: 'skip', now: 2000, random: () => 0.5 });
  state = quizReducer(state, { type: 'select', option: 'C', now: 2500 });
  state = quizReducer(state, { type: 'pause', now: 3000 });
  assert.ok(saveQuizState(store, state));
  const restored = readQuizState(store, 50000);
  assert.deepEqual(restored, { ...state, timerStartedAt: 50000 });
  assert.equal(restored.questionElapsedMs, 1000);
  const done = finish(initial());
  saveQuizState(store, done);
  saveQuizState(store, done);
  assert.equal(readQuizHistory(store).length, 1);
  saveQuizState(store, finish(initialQuizState(100000, () => 0.7)));
  saveQuizState(store, initialQuizState(200000));
  assert.equal(readQuizHistory(store).length, 2);
});
test('legacy completed 15-question history is preserved when archiving a CAT session', () => {
  const store = storage();
  const ids = questionBank.slice(0, 15).map(q => q.id);
  const legacy = { version: 3, sessionId: 'previous-attempt', index: 15, selected: null,
    questionIds: ids, startedAt: 1000, completedAt: 3000, questionElapsedMs: 0, timerStartedAt: null,
    answers: ids.map(id => { const q = getQuestion(id); return { questionId: id, questionNumber: q.number,
      dimensionId: q.dimensionId, userAnswer: q.correctAnswer, correctAnswer: q.correctAnswer, isCorrect: true, timeMs: 100, answeredAt: 3000 }; }) };
  store.setItem(HISTORY_STORAGE_KEY, JSON.stringify([legacy]));
  saveQuizState(store, finish(initial()));
  assert.equal(readQuizHistory(store).length, 2);
  assert.deepEqual(readQuizHistory(store)[0], legacy);
});
test('hidden or closed time is excluded from per-question active time', () => {
  let state = quizReducer(initial(), { type: 'pause', now: 2000 });
  state = quizReducer(state, { type: 'tick', now: 40000 });
  assert.equal(state.questionElapsedMs, 1000);
  state = quizReducer(state, { type: 'resume', now: 50000 });
  state = quizReducer(state, { type: 'skip', now: 52000 });
  assert.equal(state.answers[0].timeMs, 3000);
});
test('invalid state, duplicate questions and tampered adaptive scores are rejected', () => {
  const store = storage();
  assert.equal(readQuizState(store), null);
  const changed = finish(initial());
  changed.abilities[0].score = 100;
  const changedDecision = initial();
  changedDecision.decisions[0].targetDifficulty = 5;
  for (const bad of ['{', JSON.stringify({ version: 3 }), JSON.stringify(changed), JSON.stringify(changedDecision),
    JSON.stringify({ ...initial(), selected: 2 }), JSON.stringify({ ...finish(initial()), answers: [] })]) {
    store.setItem(QUIZ_STORAGE_KEY, bad);
    assert.equal(readQuizState(store), null);
  }
  assert.equal(saveQuizState({ setItem: () => { throw new Error('quota'); } }, initial()), false);
});
