// Facts and hypotheses are separate. No model calls or claims about personal history.
const reference = a => a.sessionNumber ? `本次第${a.sessionNumber}题（题库 #${a.questionId}）` : `题库 #${a.questionId}`;
function readingFor(a) {
  const topic = [...a.keywords, a.focus].join(' ');
  if (/RAG|微调|Fine.tuning|提示词/i.test(topic)) return {
    title: 'OpenAI · Model optimization', url: 'https://developers.openai.com/api/docs/guides/model-optimization',
    task: '读文档中提示词与微调的介绍，再为本题写两行：问题需要补充什么上下文、是否需要改变模型行为；分别给出题干依据。',
  };
  if (/评估|评测|召回|指标/.test(topic) && /大模型|LLM|RAG|生成|提示词/i.test([...a.keywords, a.prompt].join(' '))) return {
    title: 'OpenAI · Evaluation best practices', url: 'https://developers.openai.com/api/docs/guides/evaluation-best-practices',
    task: '读文档后，为本题场景写3条评测样本，每条列出输入、合格输出和失败判定；说明指标如何对应题干目标。',
  };
  return null;
}
export function diagnoseDimension({ name, score, answers }) {
  const correct = answers.filter(a => a.userAnswer === a.correctAnswer);
  const wrong = answers.filter(a => a.userAnswer !== null && a.userAnswer !== a.correctAnswer);
  const skipped = answers.filter(a => a.userAnswer === null);
  const answered = correct.length + wrong.length;
  const points = new Set(answers.filter(a => a.userAnswer !== null).flatMap(a => a.assessmentPoints));
  const tiers = new Set(answers.filter(a => a.userAnswer !== null).map(a => a.actualDifficulty));
  const confidence = answered === 0 ? 0 : Math.min(80, answered * 15 + Math.min(15, points.size * 3) + Math.min(10, tiers.size * 5));
  const keywordGroups = new Map();
  for (const a of wrong) for (const keyword of new Set(a.keywords)) {
    if (!keywordGroups.has(keyword)) keywordGroups.set(keyword, []);
    keywordGroups.get(keyword).push(a.questionId);
  }
  const repeatedIssues = [...keywordGroups].filter(([keyword, ids]) => ids.length >= 2 && [...keyword].length <= 16)
    .sort((a,b) => b[1].length - a[1].length).slice(0,1).map(([keyword, questionIds]) => ({ keyword, questionIds,
      text: `${questionIds.map(id=>reference(wrong.find(a=>a.questionId===id))).join('、')}均涉及“${keyword}”，且均答错；该考核主题出现了重复失分。` }));
  const focus = wrong[0]?.focus.replace(/[。；]$/, '');
  const topic = wrong[0]?.keywords.find(k=>[...k].length <= 16) ?? '场景';
  const summary = answered === 0 ? '作答证据不足，暂不能判断水平'
    : wrong.length ? repeatedIssues.length ? `本次多题在${repeatedIssues[0].keyword}判断上失准`
      : [...focus].length <= 21 ? `本次未分清${focus}` : `本次${topic}判断失准`
      : skipped.length ? '已答题判断准确，未答部分尚未验证' : '本次已测场景判断准确';
  return {
    summary,
    repeatedIssues,
    scope: `${name}本次答对 ${correct.length}/${answers.length} 题，辅助估计 ${score} 分。总结仅指本次已测内容。`,
    weaknesses: wrong.map(a => ({
      questionId: a.questionId, reference: reference(a), title: a.focus, assessmentPoints: a.assessmentPoints,
      evidence: `${reference(a)}（${a.difficulty}，实际难度 ${a.actualDifficulty}/5）选了 ${a.userAnswer}，最佳答案为 ${a.correctAnswer}。在本题约束下：${a.explanations[a.userAnswer]}`,
      hypothesis: `可能在做判断时，把“${a.options['ABCD'.indexOf(a.userAnswer)]}”放在了关键约束之前，未充分区分“${a.focus}”。依据是你在 #${a.questionId} 选择了 ${a.userAnswer}，该选项的缺陷是：${a.explanations[a.userAnswer]}`,
      verification: `待验证：先不看解析，说明 ${a.userAnswer} 与 ${a.correctAnswer} 的关键区别，再核对最佳答案依据“${a.explanations[a.correctAnswer]}”。如果你能正确解释差异，这次失分不能支持上述推测。`,
      action: `现在用10分钟复盘 #${a.questionId}：建一张两列对照表，左列写你选的 ${a.userAnswer}，右列写最佳方案“${a.options['ABCD'.indexOf(a.correctAnswer)]}”；各写1条适用条件，再围绕“${a.focus}”标出本题决定选型的约束，最后遮住解析重答。`,
      doneWhen: `完成标准：能引用题干的一项明确条件，解释 ${a.correctAnswer} 为什么成立、${a.userAnswer} 为什么不成立；判断依据应符合“${a.explanations[a.correctAnswer]}”。`,
      reading: readingFor(a),
    })),
    pending: skipped.map(a => ({ questionId: a.questionId, text: `${reference(a)}已跳过，不能据此判断是否掌握“${a.focus}”；请补答，并写出选择依据。` })),
    encouragement: correct.length
      ? correct.map(a => `${reference(a)}答对了：${a.explanations[a.correctAnswer]}。这次选择证明你在本题中做到了“${a.assessmentPoints.join('、').replace(/。/g, '')}”；复盘错题时，可以沿用这道题的判断依据。`).join(' ')
      : '本次没有答对题目，暂不作优势判断。先按上方决策卡复核一道已答错的题目，或补答一道跳过的题目，用下一次正确判断建立新的证据。',
    confidence,
    confidenceReason: `基于 ${answered} 道已作答题、${points.size} 个不同考核点、${tiers.size} 个实际难度档。规则分 = 已作答题数×15 + 考核点数×3（最多15）+ 难度档数×5（最多10），最高80。表示证据充分程度，并非判断正确的概率；当前每维度仅3题，不能据此判断整项能力。`,
    evidence: answers,
  };
}
