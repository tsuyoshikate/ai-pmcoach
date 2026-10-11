import { dimensions } from './dimensions.js';
import { getQuestion, isValidQuizState, TOTAL_QUESTIONS } from './quiz.js';
import { isComplete } from './cat.js';
import { diagnoseDimension } from './diagnostics.js';
export function calculateResult(state) {
  if (!isValidQuizState(state) || !isComplete(state.index, state.abilities)) return null;
  let totalCorrect = 0;
  const stats = dimensions.map(d => ({ ...d, total: 0, correct: 0, skipped: 0 }));
  for (const answer of state.answers) {
    const q = getQuestion(answer.questionId);
    const stat = stats[q.dimensionId - 1];
    stat.total++;
    if (answer.userAnswer === q.correctAnswer) { stat.correct++; totalCorrect++; }
    if (answer.userAnswer === null) stat.skipped++;
  }
  return { total: Math.round(state.abilities.reduce((sum, a) => sum + a.score, 0) / state.abilities.length), totalCorrect,
    accuracy: Math.round(totalCorrect / TOTAL_QUESTIONS * 1000) / 10,
    skipped: stats.reduce((sum, d) => sum + d.skipped, 0),
    timeMs: state.answers.reduce((sum, a) => sum + a.timeMs, 0),
    dimensions: stats.map((d, i) => {
      const score = Math.round(state.abilities[i].score);
      const answers = state.answers.filter(a => a.dimensionId === d.id).map(a => ({ ...getQuestion(a.questionId), ...a }));
      return { ...d, score, rawScore: state.abilities[i].score, diagnosis: diagnoseDimension({ name: d.name, score, answers }) };
    }) };
}
export function scoreBand(score) {
  return score === null ? 'unmeasured' : score > 80 ? 'strength' : score < 60 ? 'growth' : 'balanced';
}
export function radarPoint(index, score, radius = 160, center = [260, 240]) {
  const angle = index * Math.PI / 3 - Math.PI / 2;
  const distance = score / 100 * radius;
  return [center[0] + Math.cos(angle) * distance, center[1] + Math.sin(angle) * distance];
}
