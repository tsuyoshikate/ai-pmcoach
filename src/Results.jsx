import React, { useEffect, useRef, useState } from 'react';
import { calculateResult, radarPoint, scoreBand } from './results.js';
import { readQuizState, TOTAL_QUESTIONS } from './quiz.js';
import { startNewQuiz } from './Assessment.jsx';
import {useLocalDiagnosis,GeneratedDiagnosis} from './LocalAIDiagnosis.jsx';

function RadarChart({ dimensions }) {
  const polygon = score => dimensions.map((_, index) => radarPoint(index, score).join(',')).join(' ');
  const measured = dimensions.map((dimension, index) => ({ ...dimension, index })).filter(d => d.score !== null);
  const outline = measured.map(d => radarPoint(d.index, d.score).join(',')).join(' ');
  return <svg className="results-radar" viewBox="0 0 520 480" role="img" aria-labelledby="radar-title radar-description">
    <title id="radar-title">六维度自适应能力估计雷达图</title>
    <desc id="radar-description">各轴范围为0至100分，刻度间隔20分。{dimensions.map(d => `${d.name}${d.score === null ? '本次未测' : `${d.score}分，答对${d.correct}/${d.total}题`}`).join('，')}。超过80分为绿色，低于60分为橙色。未测维度不连入分数轮廓。</desc>
    {[20,40,60,80,100].map(score => <polygon key={score} points={polygon(score)} className="results-radar-ring"/>)}
    {dimensions.map((dimension,index) => {
      const [x,y] = radarPoint(index,100);
      const [labelX,labelY] = radarPoint(index,129);
      const angle = index * Math.PI / 3 - Math.PI / 2;
      return <g key={dimension.id} data-dimension={dimension.id}>
        <line x1="260" y1="240" x2={x} y2={y} className={`results-radar-axis ${scoreBand(dimension.score)}`}/>
        {[20,40,60,80,100].map(score => {
          const [tickX,tickY] = radarPoint(index,score);
          return <text key={score} x={tickX - Math.sin(angle)*10} y={tickY + Math.cos(angle)*10} className="radar-tick" textAnchor="middle" dominantBaseline="middle">{score}</text>;
        })}
        <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle" className={`radar-axis-label ${scoreBand(dimension.score)}`}>{dimension.axis}{dimension.score === null ? '·未测' : ''}</text>
      </g>;
    })}
    {measured.length >= 3 && <polygon points={outline} className="results-radar-area"/>}
    {measured.length === 2 && <polyline points={outline} className="results-radar-area" fill="none"/>}
    {measured.map(d => {
      const [x,y]=radarPoint(d.index,d.score);
      return <circle key={d.id} data-dimension={d.id} cx={x} cy={y} r="4.5" className={`results-radar-point ${scoreBand(d.score)}`}/>;
    })}
    <text x="260" y="249" textAnchor="middle" className="radar-tick">0</text>
  </svg>;
}
export default function Results({ completedState }) {
  const headingRef = useRef(null);
  const [storedState] = useState(() => { try { return readQuizState(window.localStorage); } catch { return null; } });
  const state = completedState ?? storedState;
  const result = calculateResult(state);
  const ai = useLocalDiagnosis(state,result);
  useEffect(() => { headingRef.current?.focus({preventScroll:true}); }, []);
  if (!result) return <main className="results-main empty-results">
    <span className="section-label">能力诊断报告</span>
    <h1 ref={headingRef} tabIndex={-1}>{state ? '完成答题后，再看看你的能力轮廓' : '还没有完成的测评记录'}</h1>
    <p>{state ? `你已完成 ${state.index} / ${TOTAL_QUESTIONS} 题，继续作答后即可生成报告。` : '完成 18 道自适应题目，每个维度至少 3 题，再查看报告。'}</p>
    <a className="primary-button inline-flex items-center justify-center" href={state ? '#/assessment' : '#/intro'}>{state ? '继续答题' : '开始测评'}</a>
  </main>;
  return <main className="results-main">
    <header className="result-summary">
      <span className="section-label">本次答题报告 <span className="mock-report-tag">正确率</span></span>
      <h1 ref={headingRef} tabIndex={-1}>你的本次测评正确率</h1>
      <div className="result-score-line"><strong>{result.accuracy.toFixed(1)}</strong><span>%</span><i/><span className="result-level">答对 {result.totalCorrect} / {TOTAL_QUESTIONS} 题</span></div>
      <p>本次用时 {Math.floor(result.timeMs / 60000)} 分 {Math.floor(result.timeMs / 1000) % 60} 秒{result.skipped ? ` · 跳过 ${result.skipped} 题` : ''}。正确率 = 答对题数 ÷ 总题数 × 100%，跳过计为未答对。</p>
      <p className="mock-result-note">辅助指标：自适应能力估计 {result.total} / 100 分，为下方六维度估计分的平均值。下方诊断依据本次答案、考核点与题库解析生成，仅覆盖本次测到的内容。</p>
      {ai.enabled && <div className="local-ai-controls"><button type="button" className="primary-button" disabled={ai.busy} onClick={ai.generate}>{ai.busy?'正在生成诊断…':'生成六维度 AI 诊断'}</button><p role="status" aria-live="polite">{ai.progress || '本地版可调用已登录的 GPT；点击后，仅将本次六维度答题数据发送用于诊断。'}</p></div>}
    </header>
    <div className="result-body">
      <section className="radar-panel" aria-labelledby="radar-heading">
        <div className="result-panel-heading"><h2 id="radar-heading">你的能力轮廓</h2><span>自适应估计 · 0–100 分</span></div>
        <RadarChart dimensions={result.dimensions}/>
        <div className="result-chart-legend"><span><b className="strength"/>强项 &gt;80</span><span><b className="balanced"/>发展中 60–80</span><span><b className="growth"/>待提升 &lt;60</span></div>
        <p className="score-method">每个维度初始 50 分，逐题按“旧分 × 0.7 + 本题贡献 × 0.3”更新。贡献由题目实际难度与对错确定，跳过按答错处理；展示分数四舍五入为整数。</p>
      </section>
      <section className="diagnosis-panel" aria-labelledby="diagnosis-heading">
        <h2 id="diagnosis-heading">你的弱点诊断 <span className="diagnosis-demo-tag">基于本次答题证据</span></h2>
        <div className="diagnosis-list">{result.dimensions.map(d => <article className="diagnosis-row" key={d.id} data-dimension={d.id}>
          <div className="diagnosis-row-heading"><h3>{d.name}<b className="dimension-swatch" aria-hidden="true"/></h3><span className={`dimension-score ${scoreBand(d.score)}`}>{d.score === null ? '本次未测' : <>{d.score}<small> / 100</small></>}</span></div>
          <div className="dimension-answer-count">{d.total ? `答对 ${d.correct} / ${d.total} 题${d.skipped ? ` · 跳过 ${d.skipped} 题` : ''}` : '本次随机抽题未覆盖该维度'}</div>
          {ai.reports[d.id] ? <GeneratedDiagnosis report={ai.reports[d.id]}/> : <div className="personal-diagnosis">
            <h4>一句话总结</h4><p className="diagnosis-summary">{d.diagnosis.summary}</p><p>{d.diagnosis.scope}</p>
            <h4>具体错在哪里</h4>
            {d.diagnosis.repeatedIssues.map(issue => <p key={issue.keyword}>{issue.text}</p>)}
            {d.diagnosis.weaknesses.length ? <ul className="weakness-list">{d.diagnosis.weaknesses.map(w => <li key={w.questionId}><strong>#{w.questionId} · {w.title}</strong><p>{w.evidence}</p></li>)}</ul> : <p>{d.skipped === d.total ? '尚无已作答题，暂不判断薄弱点。' : '本次已作答题未出现错误，暂不列出薄弱点。'}</p>}
            {d.diagnosis.pending.map(p => <p className="pending-evidence" key={p.questionId}>{p.text}</p>)}
            <h4>可能为什么会错 <span className="diagnosis-demo-tag">待验证假设</span></h4>
            {d.diagnosis.weaknesses.length ? d.diagnosis.weaknesses.map(w => <div key={w.questionId} className="cause-hypothesis"><p>{w.hypothesis}</p><details><summary>如何验证这条推测？</summary><p>{w.verification}</p></details></div>) : <p>没有已作答错题，不推测错误原因。</p>}
            <h4>下一步，现在就做</h4>
            {d.diagnosis.weaknesses.length ? d.diagnosis.weaknesses.map(w => <div key={w.questionId} className="next-step"><p><b>#{w.questionId} · 10分钟练习：</b>{w.action}</p><p>{w.doneWhen}</p>{w.reading && <p><a href={w.reading.url} target="_blank" rel="noopener noreferrer">{w.reading.title} ↗</a><br/>{w.reading.task}</p>}</div>) : <p>{d.skipped ? '先补答上方跳过的题目，写出选择依据，再核对解析。' : '选本维度一道答对题，改变其中一项业务约束，再判断最佳方案是否变化；写出条件变化前后的两条判断依据。'}</p>}
            <h4>正向鼓励</h4><p className="diagnosis-encouragement">{d.diagnosis.encouragement}</p>
            <div className="diagnosis-confidence"><h4>诊断信心分</h4><span>{d.diagnosis.confidence}<small> / 100 · 证据充分度</small></span></div>
            <details className="confidence-explanation"><summary>信心分如何计算？</summary><p>{d.diagnosis.confidenceReason}</p></details>
            <details className="answer-evidence"><summary>查看本维度的 {d.total} 道答题依据</summary>{d.diagnosis.evidence.map(a => <div className="evidence-question" key={a.questionId}>
              <strong>本次第{a.sessionNumber}题（题库 #{a.questionId}） · {a.difficulty} · 实际难度 {a.actualDifficulty}/5 · {a.skipped ? '已跳过' : a.isCorrect ? '答对' : '答错'}</strong>
              <p>考核点：{a.assessmentPoints.join(' ')}</p><p>{a.prompt}</p>
              <ul>{a.options.map((option,i) => <li key={i}>{'ABCD'[i]}. {option}{a.userAnswer === 'ABCD'[i] ? '（你的选择）' : ''}{a.correctAnswer === 'ABCD'[i] ? '（最佳答案）' : ''}</li>)}</ul>
              <p>最佳答案依据：{a.explanations[a.correctAnswer]}</p>
              {a.userAnswer && !a.isCorrect && <p>你的选项解析：{a.explanations[a.userAnswer]}</p>}
            </div>)}</details>
          </div>}
          {ai.reports[d.id] && <details className="personal-diagnosis"><summary>查看规则诊断与答题依据</summary><p>{d.diagnosis.summary}</p>{d.diagnosis.evidence.map(a=><p key={a.questionId}>本次第{a.sessionNumber}题（题库 #{a.questionId}）：{a.prompt}；{a.skipped?'跳过':a.isCorrect?'答对':'答错'}。考核点：{a.assessmentPoints.join(' ')} 最佳答案依据：{a.explanations[a.correctAnswer]}</p>)}</details>}
        </article>)}</div>
      </section>
    </div>
    <div className="results-actions"><button type="button" className="primary-button">开始你的学习计划</button><a className="retake-link" href="#/assessment" onClick={startNewQuiz}>重新抽题测评</a></div>
  </main>;
}
