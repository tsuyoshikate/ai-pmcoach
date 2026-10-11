import React,{useRef,useState} from 'react';
import {dimensions} from './dimensions.js';
import {questionBank,getQuestion,readSeenQuestionIds} from './quiz.js';
import {bankHealthForUI,singleFlight} from './hardening.js';
import {BankUnavailable} from './SafetyUI.jsx';
import {newPractice,readPractice,savePractice,answerPractice,practiceStats} from './practice.js';
export default function Practice({dimensionId}){
  if(!bankHealthForUI(questionBank).ready)return <BankUnavailable/>;
  const d=dimensions.find(d=>d.id===dimensionId);return d?<PracticeReady key={d.id} dimension={d}/>:<main className="results-main empty-results"><h1>未找到这个练习维度</h1><a href="#/">返回首页</a></main>;
}
function PracticeReady({dimension:d}){
  const fresh=()=>{let seen=[];try{seen=readSeenQuestionIds(window.localStorage);}catch{}return newPractice(d.id,seen);};
  const [state,setState]=useState(()=>{try{return readPractice(window.localStorage,d.id)??fresh();}catch{return fresh();}});const latest=useRef(state);
  const [busy,setBusy]=useState(false),[warning,setWarning]=useState(false);
  function commit(s){latest.current=s;setState(s);try{setWarning(!savePractice(window.localStorage,s));}catch{setWarning(true);}}
  const submit=useRef(null);if(!submit.current)submit.current=singleFlight(async()=>{setBusy(true);try{commit(answerPractice(latest.current));await new Promise(r=>setTimeout(r,0));}finally{setBusy(false);}});
  const completed=state.answers.length>=3;const q=getQuestion(state.ids[state.answers.length]);const score=practiceStats(state);
  return <main className="assessment-main"><a href="#/results" className="back-link">← 返回测评结果</a><h1>{d.name} · 专项练习</h1><p>独立练习3题，不覆盖完整测评与成长快照。</p>{warning&&<p className="storage-warning" role="alert">浏览器未能保存专项进度，刷新可能丢失记录。</p>}{completed?<section className="practice-result"><h2>本次专项能力估计 {Math.round(score.score)} 分</h2><p>答对 {state.answers.filter(a=>a.userAnswer===getQuestion(a.questionId).correctAnswer).length} / 3 题。初始50分，逐题按旧分×0.7 + 贡献×0.3计算。</p>{state.answers.map(a=>{const question=getQuestion(a.questionId);return <article key={a.questionId}><h3>题库 #{question.id} · {a.userAnswer===question.correctAnswer?'答对':'答错'}</h3><p>{question.prompt}</p><p>你的答案：{a.userAnswer} · 最佳答案：{question.correctAnswer}</p><p>{question.explanations[question.correctAnswer]}</p></article>;})}<button className="primary-button" onClick={()=>commit(fresh())}>再练一次</button><a className="secondary-growth-link" href={'#/scenario/'+d.id}>练一道情景题 ↗</a></section>:<form onSubmit={e=>{e.preventDefault();submit.current();}}><p>第 {state.answers.length+1} / 3 题</p><div className="question-card"><p>题库 #{q.id} · {d.name}</p><h2 className="question-title">{q.prompt}</h2></div><fieldset className="question-fieldset"><legend className="sr-only">选择最佳答案</legend><div className="question-options">{q.options.map((text,i)=><label className={'option-card'+(state.selected==='ABCD'[i]?' is-selected':'')} key={i}><input type="radio" disabled={busy} name="practice" checked={state.selected==='ABCD'[i]} onChange={()=>commit({...state,selected:'ABCD'[i]})}/><span className="option-letter">{'ABCD'[i]}</span><span>{text}</span></label>)}</div></fieldset><button className="primary-button" disabled={busy||!state.selected}>{busy?'提交中...':state.answers.length===2?'查看练习结果':'下一题'}</button></form>}</main>;
}
