import {dimensions} from './dimensions.js';
import {difficultyLevel} from './cat.js';
export const BANK_NOT_READY='题库未就绪，请联系管理员';
// Local preview only: exercise empty-bank UI without editing or deleting the real bank.
export function bankHealthForUI(bank){
  const fixture=import.meta.env?.DEV&&typeof window!=='undefined'?new URLSearchParams(window.location.search).get('qa-bank'):null;
  return checkQuestionBank(fixture==='empty'?[]:fixture==='missing-dimension'?bank.filter(q=>q.dimensionId!==1):bank);
}
export function checkQuestionBank(bank){
  if(!Array.isArray(bank)||!bank.length)return {ready:false,message:BANK_NOT_READY};
  const ids=new Set();
  const valid=bank.every(q=>q&&typeof q.id==='string'&&!ids.has(q.id)&&(ids.add(q.id),true)&&dimensions.some(d=>d.id===q.dimensionId)&&typeof q.prompt==='string'&&q.prompt.trim()&&Array.isArray(q.options)&&q.options.length===4&&q.options.every(o=>typeof o==='string'&&o.trim())&&/^[ABCD]$/.test(q.correctAnswer)&&Number.isInteger(difficultyLevel(q))&&difficultyLevel(q)>=1&&difficultyLevel(q)<=5);
  const detailValid=valid&&bank.every(q=>/^\d{3}$/.test(q.id)&&Number.isInteger(q.number)&&typeof q.dimension==='string'&&typeof q.focus==='string'&&q.focus.trim()&&Array.isArray(q.keywords)&&q.keywords.every(k=>typeof k==='string')&&Array.isArray(q.assessmentPoints)&&q.assessmentPoints.length&&q.assessmentPoints.every(p=>typeof p==='string')&&'ABCD'.split('').every(letter=>typeof q.explanations?.[letter]==='string'&&q.explanations[letter].trim()));
  const ready=detailValid&&dimensions.every(d=>bank.filter(q=>q.dimensionId===d.id).length>=3);
  return {ready:Boolean(ready),message:ready?'':BANK_NOT_READY};
}
export function retestFeedback(previous,current){
  if(!previous||!current)return null;
  const change=current.totalScore-previous.totalScore;
  const days=Math.max(0,Math.floor((current.completedAt-previous.completedAt)/86400000));
  const breakthroughs=current.dimensions.map((d,i)=>({...d,delta:d.score-previous.dimensions[i].score})).filter(d=>d.delta>=15).sort((a,b)=>b.delta-a.delta||a.id-b.id);
  const weakest=[...current.dimensions].sort((a,b)=>a.score-b.score||a.id-b.id)[0];
  const tone=change>=10?'celebrate':change<0?'constructive':Math.abs(change)<=5?'stable':'progress';
  const summary=change>=10?`你在${days}天里提升了${change}分！`:change<0?'今天的表现可能不在最佳状态。':Math.abs(change)<=5?'本次表现稳定。':`本次能力估计提升了${change}分。`;
  const detail=change<0?'我们一起回顾这次答错的题，看看是哪里出了问题。':Math.abs(change)<=5?`建议针对「${weakest.name}」做专项练习，用下一次测评验证判断是否更稳。`:'对照本次答题依据，看看哪些判断发生了变化。';
  return {tone,summary,detail,change,days,weakest,breakthroughs};
}
export function scoreBreakdown(state,id){
  const answers=state?.answers?.filter(a=>a.dimensionId===id)??[];
  if(!answers.length)return null;
  return {count:answers.length,high:answers.filter(a=>a.actualDifficulty>=4).length,correct:answers.filter(a=>a.isCorrect).length,wrong:answers.filter(a=>!a.isCorrect&&!a.skipped).length,skipped:answers.filter(a=>a.skipped).length,score:Math.round(answers.at(-1).scoreAfter),answers};
}
export function singleFlight(task){let busy=false;return async(...args)=>{if(busy)return false;busy=true;try{await task(...args);return true;}finally{busy=false;}};}
