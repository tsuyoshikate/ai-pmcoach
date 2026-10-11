import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateResult } from '../src/results.js';
import { diagnoseDimension } from '../src/diagnostics.js';
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
    assert.match(d.diagnosis.summary, /已测场景判断准确/);
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
    assert.match(d.diagnosis.summary, /作答证据不足/);
  }
});
test('all 100 questions produce summaries within 30 characters and evidence-bound hypotheses', () => {
  for (const q of questionBank) {
    for (const option of 'ABCD') {
      if (option === q.correctAnswer) continue;
      const a = { ...q, questionId: q.id, userAnswer: option, actualDifficulty: 3 };
      const d = diagnoseDimension({ name: q.dimension, score: 45, answers: [a] });
      assert.ok([...d.summary].length <= 30, d.summary);
      const w = d.weaknesses[0];
      assert.ok(w.hypothesis.startsWith('可能'));
      assert.ok(w.hypothesis.includes(q.options['ABCD'.indexOf(option)]));
      assert.ok(w.hypothesis.includes(q.explanations[option]));
      assert.ok(w.verification.includes(q.explanations[q.correctAnswer]));
      assert.ok(w.doneWhen.includes(q.explanations[q.correctAnswer]));
      assert.ok(!/没有实际做过|缺少项目经验/.test(w.hypothesis));
      assert.ok(w.action.includes('10分钟'));
    }
  }
});
test('repeated errors group only actual wrong question IDs sharing the stated keyword', () => {
  const q1 = questionBank.find(q=>q.id === '003');
  const q2 = questionBank.find(q=>q.id !== q1.id && q.dimensionId === q1.dimensionId && q.keywords.some(k=>q1.keywords.includes(k) && [...k].length <= 16));
  assert.ok(q2);
  const answers = [q1,q2].map(q=>({...q, questionId:q.id, userAnswer:'ABCD'.split('').find(x=>x!==q.correctAnswer),actualDifficulty:3}));
  const d = diagnoseDimension({name:q1.dimension,score:45,answers});
  assert.ok(d.repeatedIssues.length);
  for (const issue of d.repeatedIssues) {
    assert.deepEqual(issue.questionIds, [q1.id,q2.id]);
    assert.ok(answers.every(a=>a.keywords.includes(issue.keyword)));
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
