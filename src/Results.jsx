import React, { useEffect, useRef, useState } from 'react';
import { calculateResult, radarPoint, scoreBand } from './results.js';
import { readQuizState, TOTAL_QUESTIONS } from './quiz.js';
import { startNewQuiz } from './Assessment.jsx';
import {useLocalDiagnosis,DiagnosisContent,DiagnosisLoading,hasEnoughEvidence} from './LocalAIDiagnosis.jsx';
import LearningResources from './LearningResources.jsx';

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
    </header>
    <div className="result-body">
      <section className="radar-panel" aria-labelledby="radar-heading">
        <div className="result-panel-heading"><h2 id="radar-heading">你的能力轮廓</h2><span>自适应估计 · 0–100 分</span></div>
        <RadarChart dimensions={result.dimensions}/>
        <div className="result-chart-legend"><span><b className="strength"/>强项 &gt;80</span><span><b className="balanced"/>发展中 60–80</span><span><b className="growth"/>待提升 &lt;60</span></div>
        <p className="score-method">每个维度初始 50 分，逐题按“旧分 × 0.7 + 本题贡献 × 0.3”更新。贡献由题目实际难度与对错确定，跳过按答错处理；展示分数四舍五入为整数。</p>
      </section>
      <section className="diagnosis-panel" aria-labelledby="diagnosis-heading">
        <h2 id="diagnosis-heading">你的能力诊断 <span className="diagnosis-demo-tag">基于本次答题证据</span></h2>
        <div className="diagnosis-list">{result.dimensions.map(d => {
          const expanded=ai.expanded.has(d.id);const report=ai.reports[d.id];
          return <article className="diagnosis-row diagnosis-card" key={d.id} data-dimension={d.id}>
            {report?.source==='fallback'&&<span className="basic-diagnosis-tag">(基础诊断)</span>}
            <div className="diagnosis-row-heading"><h3>{d.name}<b className="dimension-swatch" aria-hidden="true"/></h3><span className={'dimension-score '+scoreBand(d.score)}>{d.score === null ? '本次未测' : <>{d.score}<small> 分</small></>}</span></div>
            <div className="dimension-answer-count">答对 {d.correct} / {d.total} 题{d.skipped ? ' · 跳过 '+d.skipped+' 题' : ''}</div>
            <button type="button" className="diagnosis-toggle" aria-expanded={expanded} aria-controls={'dimension-diagnosis-'+d.id} onClick={()=>ai.toggle(d.id)}>{expanded?'收起诊断':'展开查看诊断'} <span aria-hidden="true">{expanded?'−':'+'}</span></button>
            {expanded&&<div id={'dimension-diagnosis-'+d.id}>
              {!hasEnoughEvidence(d)?<p className="insufficient-diagnosis">这个维度的答题数据不足以生成诊断，建议你做一次专项测评。</p>:
                ai.enabled&&!report?<DiagnosisLoading status={ai.loading[d.id]??'loading'}/>:<DiagnosisContent dimension={d} report={report}/>}
              <LearningResources dimension={d} state={state}/>
            </div>}
          </article>;
        })}</div>
      </section>
    </div>
    <div className="results-actions"><button type="button" className="primary-button">开始你的学习计划</button><a className="retake-link" href="#/assessment" onClick={startNewQuiz}>立即复测</a><a className="retake-link" href="#/">查看成长主页与复测对比</a></div>
    {state.answers.filter(a=>a.userAnswer!==null).length<10&&<p className="growth-method">完成测评且实际作答至少10题，才会保存成长快照；跳过不计入有效作答数。</p>}
  </main>;
}
