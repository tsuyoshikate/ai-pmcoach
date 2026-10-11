import React,{useEffect,useRef} from 'react';
import {questionBank,readQuizState,TOTAL_QUESTIONS} from './quiz.js';
import {startNewQuiz} from './Assessment.jsx';
import {BANK_NOT_READY,checkQuestionBank,scoreBreakdown} from './hardening.js';
import {dimensions} from './dimensions.js';
export class ErrorBoundary extends React.Component{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error){console.warn('[AI PMCoach] 页面已安全降级',error.message);}
  render(){return this.state.failed?<main className="results-main empty-results"><h1>暂时无法展示这个页面</h1><p>你的浏览器答题记录不会因此被清除，请重新打开页面。</p><button className="primary-button" onClick={()=>window.location.reload()}>重新打开</button></main>:this.props.children;}
}
export function BankUnavailable(){return <main className="results-main empty-results"><h1>{BANK_NOT_READY}</h1><p>六个维度各需至少3道有效题目，补齐题库后才能开始测评。</p><a href="#/" className="back-link">返回首页</a></main>;}
export function ResumeNotice(){
  let pending;try{pending=readQuizState(window.localStorage);}catch{}
  if(!pending||pending.completedAt!==null)return null;
  return <aside className="resume-notice" aria-label="未完成的测评"><div><h2>你有一次未完成的测评，继续作答？</h2><p>已完成 {pending.index} / {TOTAL_QUESTIONS} 题，已选选项与用时会继续保留。</p></div><div><a href="#/assessment" className="primary-button">继续</a><a href="#/assessment" className="secondary-growth-link" onClick={event=>startNewQuiz(event,true)}>放弃重来</a></div></aside>;
}
export function ScoreModal({state,dimensionId,onClose}){
  const ref=useRef(null);const d=dimensions.find(d=>d.id===dimensionId),s=scoreBreakdown(state,dimensionId);
  useEffect(()=>{const previous=document.activeElement;ref.current?.showModal();return()=>{ref.current?.close();previous?.focus?.();};},[]);
  return <dialog ref={ref} className="score-modal" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===ref.current)onClose();}} aria-labelledby="score-modal-title"><div><button className="modal-close" type="button" aria-label="关闭分数说明" onClick={onClose}>×</button><h2 id="score-modal-title">{d?.name} · 分数构成</h2>{s?<><p>你在这个维度答了 {s.count} 道题，其中 {s.high} 道高难度题（4—5档）。</p><p>答对 {s.correct} 道 · 答错 {s.wrong} 道 · 跳过 {s.skipped} 道</p><h3>当前能力估计：{s.score} 分</h3><p>基础分50；每题按「旧分 × 0.7 + 本题贡献 × 0.3」更新。跳过按答错贡献计算，最终展示值四舍五入。正确率是另一项成绩。</p><div className="score-table-scroll"><table><thead><tr><th>题库题号</th><th>难度</th><th>结果</th><th>贡献</th><th>计算过程</th></tr></thead><tbody>{s.answers.map(a=><tr key={a.questionId}><td>#{a.questionId}</td><td>{a.actualDifficulty}</td><td>{a.skipped?'跳过':a.isCorrect?'答对':'答错'}</td><td>{a.contribution}</td><td>{a.scoreBefore.toFixed(2)} × 0.7 + {a.contribution} × 0.3 = {a.scoreAfter.toFixed(2)}</td></tr>)}</tbody></table></div><a className="primary-button" href={'#/practice/'+dimensionId} onClick={onClose}>重测这个维度</a><p className="growth-method">专项练习独立计分，不覆盖完整测评，也不生成成长快照。</p></>:<><p>缺少逐题记录，无法解释这个分数的构成。</p><a href="#/intro" className="primary-button" onClick={onClose}>开始测评</a></>}</div></dialog>;
}
