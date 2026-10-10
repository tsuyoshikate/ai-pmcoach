import { dimensions } from './dimensions.js';
import { getQuestion, isValidQuizState, TOTAL_QUESTIONS } from './quiz.js';
import { isComplete } from './cat.js';
const mockDiagnoses = [
  '你能区分 RAG、微调与提示词优化的适用场景，大模型选型的判断较扎实。面对幻觉与上下文限制时，仍需把风险判断转化为明确的产品约束。',
  '你能从任务频率与耗时识别 AI 的切入点，但对异常场景和人工复核成本考虑不足。访谈时应追问错误发生后的补救流程，再判断场景是否值得优先投入。',
  '你能设计基本的 AI 交互流程，但对低置信度回答、工具失败和用户撤销的处理不够完整。优先补齐确认、兜底与转人工流程，让主流程之外的体验也可控。',
  '你容易把响应速度或点击率当作效果提升，尚未建立任务解决率与事实准确性的评估框架。需要先构建代表性评测集，并把质量、延迟和单次解决成本一起纳入上线标准。',
  '你能说明团队分工，但对交付依赖、风险升级与验收责任的描述仍不够具体。建议用一个项目练习记录决策依据、责任边界和可复用的复盘流程。',
  '你能识别节省时间的付费价值，但对不同客户的使用成本与续费信号分析不够细。下一步按场景核算单次解决成本，并用付费转化与持续使用验证定价假设。',
];
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
    dimensions: stats.map((d, i) => ({ ...d, score: Math.round(state.abilities[i].score), rawScore: state.abilities[i].score,
      diagnosis: mockDiagnoses[i] })) };
}
export function scoreBand(score) {
  return score === null ? 'unmeasured' : score > 80 ? 'strength' : score < 60 ? 'growth' : 'balanced';
}
export function radarPoint(index, score, radius = 160, center = [260, 240]) {
  const angle = index * Math.PI / 3 - Math.PI / 2;
  const distance = score / 100 * radius;
  return [center[0] + Math.cos(angle) * distance, center[1] + Math.sin(angle) * distance];
}
