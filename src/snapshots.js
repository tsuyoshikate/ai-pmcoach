import {dimensions} from './dimensions.js';
export const SNAPSHOT_STORAGE_KEY='ai-pmcoach-snapshots-v1';
export const SCORE_METHOD='cat-ema-v1';
export function snapshotFromState(state){
  if(!state||state.version!==4||!Number.isFinite(state.completedAt)||state.completedAt<0||state.completedAt>8640000000000000||!Array.isArray(state.answers)||state.index!==state.answers.length||state.answers.length<10||state.answers.filter(a=>a.userAnswer!==null).length<10||!Array.isArray(state.abilities)||state.abilities.length!==6||state.abilities.some(a=>a.count<3)||state.abilities.reduce((sum,a)=>sum+a.count,0)!==state.answers.length)return null;
  const correctCount=state.answers.filter(a=>a.isCorrect).length;
  const scores=dimensions.map(d=>({id:d.id,name:d.name,score:Math.round(state.abilities[d.id-1].score)}));
  const snapshot={sessionId:state.sessionId,completedAt:state.completedAt,date:new Date(state.completedAt).toISOString(),scoreMethod:SCORE_METHOD,dimensions:scores,totalScore:Math.round(state.abilities.reduce((sum,a)=>sum+a.score,0)/6),questionCount:state.answers.length,answeredCount:state.answers.filter(a=>a.userAnswer!==null).length,correctCount,accuracy:Math.round(correctCount/state.answers.length*1000)/10};
  return validSnapshot(snapshot)?snapshot:null;
}
export function validSnapshot(s){
  return !!s&&typeof s.sessionId==='string'&&s.sessionId.length>0&&s.sessionId.length<200&&s.scoreMethod===SCORE_METHOD&&Number.isFinite(s.completedAt)&&s.completedAt>=0&&s.completedAt<=8640000000000000&&s.date===new Date(s.completedAt).toISOString()
    &&Number.isInteger(s.questionCount)&&s.questionCount>=10&&s.questionCount<=100&&Number.isInteger(s.answeredCount)&&s.answeredCount>=10&&s.answeredCount<=s.questionCount&&Number.isInteger(s.correctCount)&&s.correctCount>=0&&s.correctCount<=s.answeredCount
    &&s.accuracy===Math.round(s.correctCount/s.questionCount*1000)/10&&Number.isInteger(s.totalScore)&&s.totalScore>=0&&s.totalScore<=100&&Array.isArray(s.dimensions)&&s.dimensions.length===6&&s.dimensions.every((d,i)=>d.id===dimensions[i].id&&d.name===dimensions[i].name&&Number.isInteger(d.score)&&d.score>=0&&d.score<=100);
}
export function readSnapshots(storage){
  try{const raw=JSON.parse(storage.getItem(SNAPSHOT_STORAGE_KEY));if(!Array.isArray(raw))return [];const seen=new Set();return raw.filter(s=>{if(!validSnapshot(s)||seen.has(s.sessionId))return false;seen.add(s.sessionId);return true;}).sort((a,b)=>a.completedAt-b.completedAt||a.sessionId.localeCompare(b.sessionId));}catch{return [];}
}
export function saveSnapshot(storage,state){
  const snapshot=snapshotFromState(state);if(!snapshot)return false;const list=readSnapshots(storage);if(list.some(s=>s.sessionId===snapshot.sessionId))return true;
  try{storage.setItem(SNAPSHOT_STORAGE_KEY,JSON.stringify([...list,snapshot].sort((a,b)=>a.completedAt-b.completedAt||a.sessionId.localeCompare(b.sessionId))));return true;}catch{return false;}
}
export function syncSnapshots(storage,states){for(const state of states)if(state)saveSnapshot(storage,state);return readSnapshots(storage);}
export function compareSnapshots(previous,current){
  const changes=current.dimensions.map((d,i)=>({...d,previousScore:previous.dimensions[i].score,delta:d.score-previous.dimensions[i].score}));
  const improved=changes.filter(d=>d.delta>0).sort((a,b)=>b.delta-a.delta||a.id-b.id);
  const needsWork=changes.filter(d=>d.delta<=0).sort((a,b)=>a.score-b.score||a.delta-b.delta||a.id-b.id);
  return {totalDelta:current.totalScore-previous.totalScore,accuracyDelta:Math.round((current.accuracy-previous.accuracy)*10)/10,changes,mostImproved:improved[0]??null,needsWork:needsWork[0]??null};
}
export function retestStatus(completedAt,now=Date.now()){
  const elapsed=Math.max(0,now-completedAt)/86400000;const days=Math.floor(elapsed);
  if(elapsed<3)return {tone:'quiet',days,message:'建议再过几天复测，让学习有时间发挥作用。'};
  if(elapsed>14)return {tone:'highlight',days,message:'已经'+days+'天没测评了，回来看看自己的水平吧。'};
  return {tone:'normal',days,message:'距离上次测评'+days+'天，来复测一次看看进步。'};
}
