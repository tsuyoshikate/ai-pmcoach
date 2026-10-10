import test from 'node:test';
import assert from 'node:assert/strict';
import { contributionFor, initialAbilities, isComplete, selectNextQuestion, updateAbility, logQuestionDecision, logScoreChange } from '../src/cat.js';
import { initialQuizState, quizReducer, getQuestion, questionBank, isValidQuizState } from '../src/quiz.js';
test('fixed contributions cover all ten difficulty/correctness combinations', () => {
  assert.deepEqual([1,2,3,4,5].map(l => contributionFor(l, true)), [50,60,75,90,100]);
  assert.deepEqual([1,2,3,4,5].map(l => contributionFor(l, false)), [20,30,45,50,60]);
  assert.throws(() => contributionFor(6, true));
  for (const level of [1,2,3,4,5]) {
    for (const correct of [true, false]) {
      const before = { dimensionId: 1, count: 0, difficulty: level, score: 60 };
      const { ability, contribution } = updateAbility(before, level, correct);
      assert.equal(ability.score, 60 * 0.7 + contribution * 0.3);
      assert.equal(ability.difficulty, Math.max(1, Math.min(5, level + (correct ? 1 : -1))));
    }
  }
});
test('round robin skips already-covered dimensions, picks exact difficulty and excludes repeats', () => {
  const abilities = initialAbilities();
  abilities[0].count = 3;
  const decision = selectNextQuestion(questionBank, abilities, 0, [], () => 0);
  assert.equal(decision.dimensionId, 2);
  assert.equal(decision.actualDifficulty, 3);
  assert.equal(decision.fallbackReason, null);
  const second = selectNextQuestion(questionBank, abilities, 0, [decision.questionId], () => 0);
  assert.notEqual(second.questionId, decision.questionId);
});
test('missing or exhausted tier falls back only within the dimension; ties choose lower tier', () => {
  const bank = [ { id: 'low', dimensionId: 1, difficultyLevel: 2 }, { id: 'high', dimensionId: 1, difficultyLevel: 4 } ];
  const a = initialAbilities();
  const d = selectNextQuestion(bank, a, 0, [], () => 0);
  assert.equal(d.questionId, 'low');
  assert.ok(d.fallbackReason);
  const exhausted = selectNextQuestion(bank, a, 0, ['low'], () => 0);
  assert.equal(exhausted.actualDifficulty, 4);
  assert.throws(() => selectNextQuestion(bank, a, 0, ['low', 'high']));
});
test('completion requires both total question count and three measurements in every dimension', () => {
  assert.equal(isComplete(15, initialAbilities().map(a => ({ ...a, count: 3 }))), false);
  assert.equal(isComplete(18, initialAbilities()), false);
  assert.equal(isComplete(18, initialAbilities().map(a => ({ ...a, count: 3 }))), true);
});
test('50 varied answer paths complete with exactly 18 unique questions and correct round-robin coverage', () => {
  for (let seed = 1; seed <= 50; seed++) {
    let value = seed;
    const random = () => { value = (value * 16807) % 2147483647; return (value - 1) / 2147483646; };
    let state = initialQuizState(1000, random);
    for (let i = 0; i < 18; i++) {
      const q = getQuestion(state.questionIds[i]);
      assert.equal(q.dimensionId, i % 6 + 1);
      const option = random() > 0.5 ? q.correctAnswer : 'ABCD'.split('').find(x => x !== q.correctAnswer);
      state = quizReducer(state, { type: 'select', option, now: 2000 + i * 2000 });
      state = quizReducer(state, { type: 'next', now: 3000 + i * 2000, random });
      assert.ok(isValidQuizState(state));
      assert.equal(!!state.completedAt, i === 17);
    }
    assert.equal(new Set(state.questionIds).size, 18);
    assert.ok(state.abilities.every(a => a.count === 3));
  }
});
test('console instrumentation contains selection candidates, fallback and numerical score transition', () => {
  const entries = [];
  const logger = { info: (...args) => entries.push(args) };
  let s = initialQuizState(1000, () => 0.5);
  logQuestionDecision(s, false, logger);
  s = quizReducer(s, { type: 'select', option: getQuestion(s.questionIds[0]).correctAnswer, now: 2000 });
  s = quizReducer(s, { type: 'next', now: 3000, random: () => 0.5 });
  logScoreChange(s, s.answers[0], logger);
  assert.equal(entries[0][1].目标难度, 3);
  assert.ok(entries[0][1].候选题号.length);
  assert.equal(entries[1][1].旧分数, 50);
  assert.equal(entries[1][1].新分数, 57.5);
  assert.match(entries[1][1].公式, /0.7/);
});
