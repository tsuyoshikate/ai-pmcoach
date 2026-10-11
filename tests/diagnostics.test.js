import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateResult } from '../src/results.js';
import { questionBank, initialQuizState, quizReducer, getQuestion, readQuizState, saveQuizState } from '../src/quiz.js';
function finish(mode) {
  let s = initialQuizState(1000, () => 0.5);
  while (!s.completedAt) {
    const q = getQuestion(s.questionIds[s.index]);
    const wrong = mode === 'wrong' || (mode === 'mixed' && s.index === 0);
    const option = wrong ? 'ABCD'.split('').find(x => x !== q.correctAnswer) : q.correctAnswer;
    s = quizReducer(s, { type: 'select', option, now: 2000 + s.index * 1000 });
    s = quizReducer(s, { type: mode === 'skip' ? 'skip' : 'next', now: 2500 + s.index * 1000, random: () => 0.5 });
  }
  return s;
}
test('every question has original assessment points, focus and four explanations', () => {
  for (const q of questionBank) {
    assert.ok(q.assessmentPoints.length >= 1);
    assert.ok(q.focus.length > 0);
    assert.equal(Object.keys(q.explanations).sort().join(''), 'ABCD');
  }
});
test('wrong answers are cited individually; encouragement cites only correct answers', () => {
  const s = finish('mixed');
  const r = calculateResult(s);
  for (const d of r.dimensions) {
    const a = s.answers.filter(x => x.dimensionId === d.id);
    const wrong = a.filter(x => !x.isCorrect);
    assert.deepEqual(d.diagnosis.weaknesses.map(x => x.questionId), wrong.map(x => x.questionId));
    for (const w of d.diagnosis.weaknesses) {
      assert.ok(w.evidence.includes(`#${w.questionId}`));
      assert.ok(w.action.includes(getQuestion(w.questionId).focus));
      assert.ok(w.action.includes(getQuestion(w.questionId).options['ABCD'.indexOf(getQuestion(w.questionId).correctAnswer)]));
      assert.ok(!d.diagnosis.encouragement.includes(`#${w.questionId}`));
    }
    for (const correct of a.filter(x => x.isCorrect)) assert.ok(d.diagnosis.encouragement.includes(`#${correct.questionId}`));
    assert.equal(d.diagnosis.evidence.length, 3);
    assert.ok(d.diagnosis.confidence > 0 && d.diagnosis.confidence <= 80);
    assert.ok(d.diagnosis.confidenceReason.includes('并非判断正确的概率'));
  }
});
test('all-correct does not invent weaknesses; all-wrong does not invent strengths', () => {
  for (const d of calculateResult(finish('correct')).dimensions) {
    assert.equal(d.diagnosis.weaknesses.length, 0);
    assert.match(d.diagnosis.summary, /暂未发现/);
  }
  for (const d of calculateResult(finish('wrong')).dimensions) {
    assert.equal(d.diagnosis.weaknesses.length, 3);
    assert.match(d.diagnosis.encouragement, /暂不作优势判断/);
  }
});
test('skipped answers are missing evidence, not demonstrated skill weaknesses', () => {
  for (const d of calculateResult(finish('skip')).dimensions) {
    assert.equal(d.diagnosis.weaknesses.length, 0);
    assert.equal(d.diagnosis.pending.length, 3);
    assert.equal(d.diagnosis.confidence, 0);
    assert.match(d.diagnosis.summary, /尚无已作答证据/);
  }
});
test('saved existing assessment produces the same diagnosis after refresh', () => {
  const values = new Map();
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v) };
  const s = finish('mixed');
  saveQuizState(storage, s);
  assert.deepEqual(calculateResult(readQuizState(storage, 99000)), calculateResult(s));
  assert.equal(calculateResult(initialQuizState()), null);
});
