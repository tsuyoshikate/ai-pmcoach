import { questionBank } from './question-bank.js';
import { initialAbilities, isComplete, selectNextQuestion, updateAbility, TOTAL_QUESTIONS, difficultyLevel } from './cat.js';
import {saveSnapshot} from './snapshots.js';
export { questionBank, TOTAL_QUESTIONS };
export const QUIZ_STORAGE_KEY = 'ai-pmcoach-assessment-cat-v4';
export const HISTORY_STORAGE_KEY = 'ai-pmcoach-history-v1';
export const SEEN_STORAGE_KEY = 'ai-pmcoach-seen-questions-v1';
const bankById = new Map(questionBank.map(q => [q.id, q]));
export const getQuestion = id => bankById.get(id);
export function initialQuizState(now = Date.now(), random = Math.random, previouslySeenIds = []) {
  previouslySeenIds=[...new Set(previouslySeenIds)].filter(id=>bankById.has(id)).sort();
  const abilities = initialAbilities();
  const decision = selectNextQuestion(questionBank, abilities, 0, [], random, previouslySeenIds);
  return { version: 4, sessionId: globalThis.crypto?.randomUUID?.() ?? `${now}-${Math.random()}`,
    questionIds: [decision.questionId], decisions: [decision], abilities, cursor: decision.nextCursor,
    index: 0, selected: null, answers: [], startedAt: now, completedAt: null,
    questionElapsedMs: 0, timerStartedAt: now, previouslySeenIds };
}
function accrue(state, now) {
  return { ...state, questionElapsedMs: state.questionElapsedMs + (state.timerStartedAt === null ? 0 : Math.max(0, now - state.timerStartedAt)),
    timerStartedAt: state.timerStartedAt === null ? null : now };
}
export function quizReducer(state, action) {
  if (isComplete(state.index, state.abilities)) return state;
  const now = action.now ?? Date.now();
  if (action.type === 'next' && state.selected === null) return state;
  if (action.type === 'select' && !/^[ABCD]$/.test(action.option)) return state;
  if (!['select', 'next', 'skip', 'tick', 'pause', 'resume'].includes(action.type)) return state;
  const next = accrue(state, now);
  if (action.type === 'select') return { ...next, selected: action.option };
  if (action.type === 'pause') return { ...next, timerStartedAt: null };
  if (action.type === 'resume') return { ...next, timerStartedAt: now };
  if (action.type === 'tick') return next;
  const question = getQuestion(state.questionIds[state.index]);
  const userAnswer = action.type === 'skip' ? null : state.selected;
  const correct = userAnswer === question.correctAnswer;
  const before = state.abilities[question.dimensionId - 1];
  const actualDifficulty = difficultyLevel(question);
  const { ability, contribution } = updateAbility(before, actualDifficulty, correct);
  const abilities = state.abilities.map(a => a.dimensionId === ability.dimensionId ? ability : a);
  const index = state.index + 1;
  const complete = isComplete(index, abilities);
  const decision = complete ? null : selectNextQuestion(questionBank, abilities, state.cursor, state.questionIds, action.random, state.previouslySeenIds??[]);
  return { ...next, index, selected: null, abilities, cursor: decision?.nextCursor ?? state.cursor,
    questionIds: decision ? [...state.questionIds, decision.questionId] : state.questionIds,
    decisions: decision ? [...state.decisions, decision] : state.decisions,
    questionElapsedMs: 0, timerStartedAt: complete ? null : next.timerStartedAt,
    completedAt: complete ? now : null,
    answers: [...state.answers, { questionId: question.id, questionNumber: question.number,
      dimensionId: question.dimensionId, userAnswer, correctAnswer: question.correctAnswer,
      isCorrect: correct, skipped: userAnswer === null, timeMs: next.questionElapsedMs, answeredAt: now,
      actualDifficulty, targetDifficulty: before.difficulty, contribution,
      scoreBefore: before.score, scoreAfter: ability.score,
      difficultyBefore: before.difficulty, difficultyAfter: ability.difficulty }] };
}
const validOption = x => x === null || (typeof x === 'string' && /^[ABCD]$/.test(x));
const validTime = x => Number.isFinite(x) && x >= 0;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function validBase(s) {
  return s && typeof s.sessionId === 'string' && s.sessionId.length && validOption(s.selected)
    && validTime(s.startedAt) && validTime(s.questionElapsedMs)
    && (s.timerStartedAt === null || validTime(s.timerStartedAt))
    && Array.isArray(s.answers) && s.answers.length === s.index && Array.isArray(s.questionIds)
    && new Set(s.questionIds).size === s.questionIds.length && s.questionIds.every(id => bankById.has(id));
}
export function isValidQuizState(s) {
  if (!validBase(s) || s.version !== 4 || !Number.isInteger(s.index) || s.index < 0 || s.index > TOTAL_QUESTIONS
    || s.questionIds.length !== Math.min(s.index + 1, TOTAL_QUESTIONS) || !Array.isArray(s.decisions)
    || s.decisions.length !== s.questionIds.length || !Array.isArray(s.abilities) || s.abilities.length !== 6
    || (s.previouslySeenIds!==undefined&&(!Array.isArray(s.previouslySeenIds)||new Set(s.previouslySeenIds).size!==s.previouslySeenIds.length||s.previouslySeenIds.some(id=>!bankById.has(id))))) return false;
  let abilities = initialAbilities();
  let cursor = 0;
  const used = [];
  for (let i = 0; i < s.questionIds.length; i++) {
    const decision = s.decisions[i];
    const expected = selectNextQuestion(questionBank, abilities, cursor, used, () => 0, s.previouslySeenIds??[]);
    if (!decision || !expected || decision.questionId !== s.questionIds[i]
      || !expected.candidateIds.includes(decision.questionId)
      || !same({ ...expected, questionId: decision.questionId }, decision)) return false;
    cursor = decision.nextCursor;
    used.push(decision.questionId);
    if (i === s.index) break;
    const a = s.answers[i];
    const q = getQuestion(s.questionIds[i]);
    const correct = a?.userAnswer === q.correctAnswer;
    const before = abilities[q.dimensionId - 1];
    const { ability, contribution } = updateAbility(before, difficultyLevel(q), correct);
    if (!a || !validOption(a.userAnswer) || a.questionId !== q.id || a.questionNumber !== q.number
      || a.dimensionId !== q.dimensionId || a.correctAnswer !== q.correctAnswer || a.isCorrect !== correct
      || a.skipped !== (a.userAnswer === null) || !validTime(a.timeMs) || !validTime(a.answeredAt)
      || a.targetDifficulty !== before.difficulty || a.actualDifficulty !== difficultyLevel(q)
      || a.contribution !== contribution || a.scoreBefore !== before.score || a.scoreAfter !== ability.score
      || a.difficultyBefore !== before.difficulty || a.difficultyAfter !== ability.difficulty) return false;
    abilities = abilities.map(item => item.dimensionId === ability.dimensionId ? ability : item);
  }
  const complete = isComplete(s.index, abilities);
  return same(abilities, s.abilities) && cursor === s.cursor
    && (complete ? validTime(s.completedAt) && s.selected === null : s.completedAt === null);
}
function validLegacyHistory(s) {
  return validBase(s) && s.version === 3 && s.index === 15 && s.questionIds.length === 15
    && validTime(s.completedAt) && s.answers.every((a, i) => {
      const q = getQuestion(s.questionIds[i]);
      return a && a.questionId === q.id && a.questionNumber === q.number && a.dimensionId === q.dimensionId
        && validOption(a.userAnswer) && a.correctAnswer === q.correctAnswer
        && a.isCorrect === (a.userAnswer === q.correctAnswer) && validTime(a.timeMs) && validTime(a.answeredAt);
    });
}
export function readQuizState(storage, now = Date.now()) {
  try {
    const state = JSON.parse(storage.getItem(QUIZ_STORAGE_KEY));
    if (isValidQuizState(state)) return { ...state, timerStartedAt: state.completedAt === null ? now : null };
  } catch { /* Invalid or unavailable records cannot generate a report. */ }
  return null;
}
export function readQuizHistory(storage) {
  try {
    const history = JSON.parse(storage.getItem(HISTORY_STORAGE_KEY));
    return Array.isArray(history) ? history.filter(s => validLegacyHistory(s)
      || isValidQuizState(s) && isComplete(s.index, s.abilities)) : [];
  } catch { return []; }
}
export function saveQuizState(storage, state) {
  try {
    storage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(state));
    if(state.answers.length)storage.setItem(SEEN_STORAGE_KEY,JSON.stringify([...new Set([...readSeenQuestionIds(storage),...state.answers.map(a=>a.questionId)])].sort()));
    if (isComplete(state.index, state.abilities)) {
      const history = readQuizHistory(storage);
      if (!history.some(s => s.sessionId === state.sessionId)) storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify([...history, state]));
      if(isValidQuizState(state)&&state.answers.filter(a=>a.userAnswer!==null).length>=10&&!saveSnapshot(storage,state))return false;
    }
    return true;
  } catch { return false; }
}
export function readSeenQuestionIds(storage){
  let seen=[];try{const raw=JSON.parse(storage.getItem(SEEN_STORAGE_KEY));if(Array.isArray(raw))seen=raw.filter(id=>bankById.has(id));}catch{}
  const histories=readQuizHistory(storage);const current=readQuizState(storage);
  return [...new Set([...seen,...histories.flatMap(s=>s.answers.map(a=>a.questionId)),...(current?.answers.map(a=>a.questionId)??[])])].sort();
}
