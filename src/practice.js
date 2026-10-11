import {questionBank,getQuestion,readSeenQuestionIds,SEEN_STORAGE_KEY} from './quiz.js';
import {initialAbilities,selectNextQuestion,updateAbility,difficultyLevel} from './cat.js';
import {dimensions} from './dimensions.js';
const key=id=>'ai-pmcoach-practice-v1-'+id;
export function practiceStats(s){
  let ability=initialAbilities()[s.dimensionId-1];
  for(const a of s.answers)ability=updateAbility(ability,difficultyLevel(getQuestion(a.questionId)),a.userAnswer===getQuestion(a.questionId).correctAnswer).ability;
  return ability;
}
function nextId(s,random){const abilities=initialAbilities().map(a=>a.dimensionId===s.dimensionId?practiceStats(s):{...a,count:3});return selectNextQuestion(questionBank,abilities,s.dimensionId-1,s.ids,random,s.seen).questionId;}
export function newPractice(id,seen=[],random=Math.random){
  if(!dimensions.some(d=>d.id===id))throw Error('Invalid dimension');
  const s={version:1,dimensionId:id,ids:[],answers:[],selected:null,seen:[...new Set(seen)].filter(q=>getQuestion(q)),questionStartedAt:Date.now()};s.ids.push(nextId(s,random));return s;
}
export function answerPractice(s,random=Math.random,now=Date.now()){
  if(s.answers.length>=3||!/^[ABCD]$/.test(s.selected))return s;
  const q=getQuestion(s.ids[s.answers.length]);const next={...s,selected:null,ids:[...s.ids],answers:[...s.answers,{questionId:q.id,userAnswer:s.selected,timeMs:Math.max(0,now-s.questionStartedAt)}],questionStartedAt:now};
  if(next.answers.length<3)next.ids.push(nextId(next,random));return next;
}
export function validPractice(s,id){
  try{
    if(s?.version!==1||s.dimensionId!==id||!Array.isArray(s.answers)||s.answers.length>3||!Array.isArray(s.ids)||s.ids.length!==Math.min(s.answers.length+1,3)||new Set(s.ids).size!==s.ids.length||!Array.isArray(s.seen)||s.seen.some(q=>!getQuestion(q))||(s.selected!==null&&!/^[ABCD]$/.test(s.selected))||!Number.isFinite(s.questionStartedAt))return false;
    return s.ids.every(q=>getQuestion(q)?.dimensionId===id)&&s.answers.every((a,i)=>a.questionId===s.ids[i]&&/^[ABCD]$/.test(a.userAnswer)&&Number.isFinite(a.timeMs)&&a.timeMs>=0);
  }catch{return false;}
}
export function readPractice(storage,id){try{const s=JSON.parse(storage.getItem(key(id)));return validPractice(s,id)?s:null;}catch{return null;}}
export function savePractice(storage,s){try{storage.setItem(key(s.dimensionId),JSON.stringify(s));storage.setItem(SEEN_STORAGE_KEY,JSON.stringify([...new Set([...readSeenQuestionIds(storage),...s.answers.map(a=>a.questionId)])].sort()));return true;}catch{return false;}}
