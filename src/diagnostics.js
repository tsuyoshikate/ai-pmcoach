// Evidence-based reporting. No model calls; never infer a cause from one wrong answer.
export function diagnoseDimension({ name, score, answers }) {
  const correct = answers.filter(a => a.userAnswer === a.correctAnswer);
  const wrong = answers.filter(a => a.userAnswer !== null && a.userAnswer !== a.correctAnswer);
  const skipped = answers.filter(a => a.userAnswer === null);
  const answered = correct.length + wrong.length;
  const points = new Set(answers.filter(a => a.userAnswer !== null).flatMap(a => a.assessmentPoints));
  const tiers = new Set(answers.filter(a => a.userAnswer !== null).map(a => a.actualDifficulty));
  const confidence = answered === 0 ? 0 : Math.min(80, answered * 15 + Math.min(15, points.size * 3) + Math.min(10, tiers.size * 5));
  const refs = list => list.map(a => `#${a.questionId}`).join('、');
  const summary = answered === 0
    ? `${name}估计 ${score} 分；本次 ${answers.length} 题均跳过，尚无已作答证据支持能力判断。`
    : wrong.length
      ? `${name}估计 ${score} 分，本次答对 ${correct.length}/${answers.length} 题；${refs(wrong)}关于“${wrong.map(a => a.focus.replace(/[。；]$/, '')).join('；')}”的判断需要优先复核。`
      : `${name}估计 ${score} 分；已作答的 ${answered} 题均答对，暂未发现已测考核点的错误${skipped.length ? `，但 ${refs(skipped)}仍缺少作答证据` : '，结论仅适用于本次题目'}。`;
  return {
    summary,
    weaknesses: wrong.map(a => ({
      questionId: a.questionId, title: a.focus, assessmentPoints: a.assessmentPoints,
      evidence: `#${a.questionId}（${a.difficulty}，实际难度 ${a.actualDifficulty}/5）选了 ${a.userAnswer}，最佳答案为 ${a.correctAnswer}。在本题约束下：${a.explanations[a.userAnswer]}`,
      action: `用本题场景写一张决策卡：列出目标与约束，说明为什么选择“${a.options['ABCD'.indexOf(a.correctAnswer)]}”，再用“${a.focus}”检查你原选的 ${a.userAnswer} 在哪项约束上不成立；遮住解析重做一次。`,
    })),
    pending: skipped.map(a => ({ questionId: a.questionId, text: `#${a.questionId}已跳过，不能据此判断是否掌握“${a.focus}”；请补答，并写出选择依据。` })),
    encouragement: correct.length
      ? correct.map(a => `#${a.questionId}答对了：本题考查${a.assessmentPoints.join('、').replace(/。/g, '')}。你的选择符合本题目标与约束，可以把这道题作为复习时的对照案例。`).join(' ')
      : '本次没有答对题目，暂不作优势判断。先按上方决策卡复核一道已答错的题目，或补答一道跳过的题目，用下一次正确判断建立新的证据。',
    confidence,
    confidenceReason: `基于 ${answered} 道已作答题、${points.size} 个不同考核点、${tiers.size} 个实际难度档。规则分 = 已作答题数×15 + 考核点数×3（最多15）+ 难度档数×5（最多10），最高80。表示证据充分程度，并非判断正确的概率；当前每维度仅3题，不能据此判断整项能力。`,
    evidence: answers,
  };
}
