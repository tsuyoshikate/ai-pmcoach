import React,{useState} from 'react';
import {dimensions} from './dimensions.js';
import {radarPoint} from './results.js';
import {compareSnapshots,retestStatus} from './snapshots.js';
import {startNewQuiz} from './Assessment.jsx';
const date=s=>new Date(s.completedAt).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
const delta=n=>n>0?'+'+n:String(n);
const colors=['#7188ab','#6f9d9d','#819c81','#b59571','#9586ae','#b48f9e'];
export function ComparisonRadar({current,previous}){
  const polygon=scores=>scores.map((s,i)=>radarPoint(i,s).join(',')).join(' ');
  return <div className="comparison-chart">
    <svg className="results-radar comparison-radar" viewBox="0 0 520 480" role="img" aria-labelledby="comparison-title comparison-desc"><title id="comparison-title">{previous?'最近两次能力对比':'当前能力雷达图'}</title><desc id="comparison-desc">本次主色实线及半透明填充，上次浅灰虚线不填充。{current.dimensions.map((d,i)=>d.name+'本次'+d.score+'分'+(previous?'，上次'+previous.dimensions[i].score+'分':'')).join('；')}</desc>
      {[20,40,60,80,100].map(s=><polygon key={s} points={polygon(dimensions.map(()=>s))} className="results-radar-ring"/>)}
      {dimensions.map((d,i)=>{const [x,y]=radarPoint(i,100);const [lx,ly]=radarPoint(i,129);return <g key={d.id}><line x1="260" y1="240" x2={x} y2={y} className="results-radar-axis"/><text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="radar-axis-label">{d.axis}</text></g>;})}
      {previous&&<polygon points={polygon(previous.dimensions.map(d=>d.score))} className="comparison-previous"/>}
      <polygon points={polygon(current.dimensions.map(d=>d.score))} className="comparison-current"/>
      {current.dimensions.map((d,i)=>{const [x,y]=radarPoint(i,d.score);return <circle key={d.id} cx={x} cy={y} r="4" className="comparison-current-point"><title>{d.name+' '+d.score+'分'}</title></circle>;})}
      {[20,40,60,80,100].map(s=><text key={s} x="272" y={240-s*1.6} className="radar-tick">{s}</text>)}<text x="260" y="248" textAnchor="middle" className="radar-tick">0</text>
    </svg>
    <div className="comparison-legend"><span><i className="current-key"/>本次 · {date(current)}</span>{previous&&<span><i className="previous-key"/>上次 · {date(previous)}</span>}</div>
  </div>;
}
export default function GrowthDashboard({snapshots,onViewLatest}){
  const current=snapshots.at(-1),previous=snapshots.at(-2);const status=retestStatus(current.completedAt);const comparison=previous?compareSnapshots(previous,current):null;
  return <main className="growth-main">
    <header className="growth-heading"><div><span className="section-label">你的成长主页</span><h1>{previous?'看见每一次判断的变化':'从这一次，记录你的成长'}</h1><p>已完成 {snapshots.length} 次有效测评 · 最近一次 {date(current)}</p></div><div className="retest-entry"><a className={'primary-button retest-button '+status.tone} href="#/assessment" onClick={startNewQuiz}>立即复测 ↗</a><p>{status.message}</p></div></header>
    <div className="growth-accuracy"><span>最近一次正确率</span><strong>{current.accuracy.toFixed(1)}<small>%</small></strong><p>答对 {current.correctCount} / {current.questionCount} 题{comparison?' · 比上次 '+delta(comparison.accuracyDelta)+' 个百分点':''}</p></div>
    <section className="growth-radar-panel"><h2>{previous?'本次与上次的能力轮廓':'你当前的能力轮廓'}</h2><ComparisonRadar current={current} previous={previous}/><p className="growth-method">雷达图与下方分数为六维度CAT能力估计；总分是六个维度估计分的平均值。正确率继续作为主要成绩。</p></section>
    {comparison?<section className="growth-stat-grid" aria-label="复测变化摘要">
      <article><span>能力估计总分变化</span><h3>{previous.totalScore}分 → {current.totalScore}分 <b className={comparison.totalDelta>0?'change-up':comparison.totalDelta<0?'change-down':'change-flat'}>({delta(comparison.totalDelta)})</b></h3></article>
      <article><span>提升最大的维度</span><h3>{comparison.mostImproved?comparison.mostImproved.name+'提升了'+comparison.mostImproved.delta+'分':'本次没有分数提升的维度'}</h3></article>
      <article><span>仍需加强的维度</span><h3>{comparison.needsWork?comparison.needsWork.name+(comparison.needsWork.delta<0?'比上次低'+Math.abs(comparison.needsWork.delta)+'分':'与上次持平'):'六个维度均有提升'}</h3><p>{comparison.needsWork?'对照这个维度的答题依据与学习资源，复核关键判断。':'可以选择一个维度挑战更复杂的场景。'}</p></article>
    </section>:<div className="first-snapshot-hint"><p>完成下一次测评后，你可以看到自己的进步对比。</p><a href="#/assessment" className="secondary-growth-link" onClick={startNewQuiz}>立即复测 ↗</a></div>}
    {comparison&&<div className="dimension-change-list">{comparison.changes.map(d=><span key={d.id}><b>{d.name}</b><i className={d.delta>0?'change-up':d.delta<0?'change-down':'change-flat'}>{d.previousScore} → {d.score} ({delta(d.delta)})</i></span>)}</div>}
    <nav className="growth-links"><a href="#/results" onClick={()=>onViewLatest?.(current.sessionId)}>查看本次诊断与学习资源 ↗</a>{snapshots.length>=3&&<a href="#/growth">查看完整成长曲线 ↗</a>}</nav>
  </main>;
}
export function GrowthTimeline({snapshots}){
  const [visible,setVisible]=useState(new Set(dimensions.map(d=>d.id)));
  if(!snapshots.length)return <main className="growth-main"><h1>完成测评后开始记录成长</h1><a href="#/intro" className="primary-button">开始测评</a></main>;
  const start=snapshots[0].completedAt,end=snapshots.at(-1).completedAt;
  const x=(s,i)=>60+(end>start?(s.completedAt-start)/(end-start):i/Math.max(1,snapshots.length-1))*680;
  const y=score=>220-score*1.8;
  return <main className="growth-main"><a className="back-link" href="#/">← 返回成长主页</a><header className="growth-heading"><div><span className="section-label">完整成长记录</span><h1>每一次复测，都留下一个坐标</h1><p>共 {snapshots.length} 次测评；点击维度名称，可单独查看它的趋势。</p></div></header>
    <section className="growth-trend-panel"><div className="trend-selectors">{dimensions.map((d,i)=><button key={d.id} type="button" aria-pressed={visible.has(d.id)} style={{'--trend-color':colors[i]}} onClick={()=>setVisible(old=>{const next=new Set(old);next.has(d.id)?next.delete(d.id):next.add(d.id);return next;})}>{d.name}</button>)}</div>
      <svg viewBox="0 0 800 270" className="growth-trend" role="img" aria-label="六维度能力估计随测评时间变化，纵轴0至100分，横轴按日期排列">
        {[0,20,40,60,80,100].map(s=><g key={s}><line x1="60" y1={y(s)} x2="740" y2={y(s)} className="trend-grid"/><text x="42" y={y(s)+4} textAnchor="end">{s}</text></g>)}
        {dimensions.map((d,i)=>visible.has(d.id)&&<g key={d.id}><polyline points={snapshots.map((s,j)=>x(s,j)+','+y(s.dimensions[i].score)).join(' ')} fill="none" stroke={colors[i]} strokeWidth="2"/>{snapshots.map((s,j)=><circle key={s.sessionId} cx={x(s,j)} cy={y(s.dimensions[i].score)} r="3" fill={colors[i]}><title>{date(s)+' '+d.name+' '+s.dimensions[i].score+'分'}</title></circle>)}</g>)}
        <text x="60" y="250">{date(snapshots[0])}</text><text x="740" y="250" textAnchor="end">{date(snapshots.at(-1))}</text>
      </svg>
      <p className="growth-method">趋势展示CAT估计分，详细数值和正确率见下方时间轴。</p>
    </section>
    <ol className="growth-timeline">{snapshots.map((s,i)=><li key={s.sessionId}><div className="timeline-node"/><article><header><strong>第{i+1}次测评</strong><time dateTime={s.date}>{date(s)}</time></header><p>正确率 <b>{s.accuracy.toFixed(1)}%</b> · 答对 {s.correctCount}/{s.questionCount} 题 · 能力估计总分 {s.totalScore}</p><div className="timeline-dimensions">{s.dimensions.map((d,j)=>{const change=i?d.score-snapshots[i-1].dimensions[j].score:null;return <span key={d.id}><b>{d.name}</b><strong>{d.score}</strong>{change!==null&&<small className={change>0?'change-up':change<0?'change-down':'change-flat'}>{delta(change)}</small>}</span>;})}</div></article></li>)}</ol>
  </main>;
}
