import test from 'node:test';
import assert from 'node:assert/strict';
import { questionBank, initialQuizState, quizReducer, keepLatest, readSeenQuestionIds, saveQuizState } from '../src/quiz.js';
import { difficultyLevel, selectNextQuestion, initialAbilities } from '../src/cat.js';
import { dimensions } from '../src/dimensions.js';

function seeded(seed) { return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }; }
function runTest(seen, random) {
  let s = initialQuizState(1000, random, seen);
  while (s.completedAt === null) {
    s = quizReducer(s, { type: 'select', option: 'ABCD'[Math.floor(random() * 4)] });
    s = quizReducer(s, { type: 'next', random });
  }
  return s.answers.map(a => a.questionId);
}
const quiet = { info() {} };

test('every dimension has enough questions at every difficulty level', () => {
  for (const d of dimensions) {
    const own = questionBank.filter(q => q.dimensionId === d.id);
    assert.ok(own.length >= 46, `${d.name} only has ${own.length}`);
    for (let level = 1; level <= 5; level++) {
      const n = own.filter(q => difficultyLevel(q) === level).length;
      assert.ok(n >= 6, `${d.name} level ${level} only has ${n}`);
    }
    // 每个维度的第一题是 3 级：3 级里要有足够多的新题，避免老用户一开始总碰到旧题
    const freshL3 = own.filter(q => Number(q.id) > 100 && difficultyLevel(q) === 3).length;
    assert.ok(freshL3 >= 5, `${d.name} only has ${freshL3} new level-3 questions`);
  }
});

test('new questions do not give the answer away by option length or position', () => {
  const extra = questionBank.slice(100);
  const longest = extra.filter(q => {
    const len = q.options.map(o => [...o].length); const c = 'ABCD'.indexOf(q.correctAnswer);
    return len[c] > Math.max(...len.filter((_, i) => i !== c));
  }).length;
  assert.ok(longest / extra.length < 0.25, `correct option strictly longest in ${longest}/${extra.length}`);
  for (const letter of 'ABCD') {
    const share = extra.filter(q => q.correctAnswer === letter).length / extra.length;
    assert.ok(share > 0.2 && share < 0.3, `answer ${letter} share ${share}`);
  }
  assert.equal(new Set(questionBank.map(q => q.prompt)).size, questionBank.length, 'duplicate prompts');
});

test('the first six tests in a row never repeat a question', () => {
  const original = console.info; console.info = quiet.info;
  try {
    const random = seeded(7); let seen = [];
    for (let t = 0; t < 6; t++) {
      const ids = runTest(seen, random);
      assert.equal(ids.filter(id => seen.includes(id)).length, 0, `test ${t + 1} repeated questions`);
      seen = keepLatest([...seen, ...ids]);
    }
  } finally { console.info = original; }
});

test('once a dimension runs out, reuse comes from the older half, never the latest test', () => {
  const pool = questionBank.filter(q => q.dimensionId === 1);
  // Pretend every question in dimension 1 has been seen; the last three are the most recent.
  const seen = pool.map(q => q.id);
  const recent = new Set(seen.slice(-Math.floor(seen.length / 2)));
  for (let i = 0; i < 30; i++) {
    const abilities = initialAbilities();
    const d = selectNextQuestion(questionBank, abilities, 0, [], seeded(i + 1), seen);
    assert.equal(d.dimensionId, 1);
    assert.ok(!recent.has(d.questionId), `picked a recently seen question ${d.questionId}`);
    assert.match(d.historyPreference.reuseReason, /较早/);
  }
});

test('seen history is kept from oldest to most recent', () => {
  assert.deepEqual(keepLatest(['001', '002', '001', '003']), ['002', '001', '003']);
  const data = {}; const store = { getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
  const original = console.info; console.info = quiet.info;
  try {
    const random = seeded(3);
    let s = initialQuizState(1000, random, []);
    while (s.completedAt === null) { s = quizReducer(s, { type: 'select', option: 'A' }); s = quizReducer(s, { type: 'next', random }); }
    saveQuizState(store, s);
    const seen = readSeenQuestionIds(store);
    assert.deepEqual(seen, s.answers.map(a => a.questionId));
  } finally { console.info = original; }
});

test('a first-time user gets newer questions before the legacy 001–100 ones', () => {
  const original = console.info; console.info = quiet.info;
  try {
    for (let trial = 0; trial < 20; trial++) {
      let s = initialQuizState(1000, Math.random, []);
      while (!s.completedAt) {
        const q = questionBank.find(x => x.id === s.questionIds[s.index]);
        const pick = Math.random() < 0.5 ? q.correctAnswer : 'ABCD'.replace(q.correctAnswer, '')[0];
        s = quizReducer(quizReducer(s, { type: 'select', option: pick, now: 2000 }), { type: 'next', now: 3000, random: Math.random });
      }
      const legacy = s.questionIds.filter(id => Number(id) <= 100);
      assert.equal(legacy.length, 0, `legacy questions in first test: ${legacy}`);
    }
  } finally { console.info = original; }
});
