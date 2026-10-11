import test from 'node:test';import assert from 'node:assert/strict';
import {snapshotFromState,saveSnapshot,readSnapshots,syncSnapshots,compareSnapshots,retestStatus,SNAPSHOT_STORAGE_KEY} from '../src/snapshots.js';
import {initialQuizState,quizReducer,getQuestion,isValidQuizState,readQuizState,saveQuizState,readSeenQuestionIds,questionBank} from '../src/quiz.js';
import {selectNextQuestion,initialAbilities} from '../src/cat.js';
import {calculateResult} from '../src/results.js';
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
function finish(state,mode='correct'){while(!state.completedAt){const q=getQuestion(state.questionIds[state.index]);const skip=typeof mode==='number'&&state.index>=mode;state=quizReducer(state,{type:'select',option:mode==='wrong'?'ABCD'.split('').find(x=>x!==q.correctAnswer):q.correctAnswer,now:state.startedAt+1000+state.index*2000});state=quizReducer(state,{type:skip?'skip':'next',now:state.startedAt+2000+state.index*2000,random:()=>.5});}return state;}
test('only complete assessments with ten actual answers snapshot; counts and scores match live results',()=>{
  const initial=initialQuizState(1000,()=>.5);assert.equal(snapshotFromState(initial),null);const complete=finish(initial);const s=snapshotFromState(complete),r=calculateResult(complete);
  assert.equal(s.totalScore,r.total);assert.equal(s.accuracy,r.accuracy);assert.deepEqual(s.dimensions.map(d=>d.score),r.dimensions.map(d=>d.score));assert.equal(s.questionCount,18);assert.equal(s.correctCount,18);
  assert.equal(snapshotFromState(finish(initialQuizState(1000,()=>.5),9)),null);assert.ok(snapshotFromState(finish(initialQuizState(1000,()=>.5),10)));assert.equal(snapshotFromState({...complete,completedAt:1e30}),null);
});
test('snapshots deduplicate session IDs, survive refresh, sort by completion time and ignore invalid data',()=>{
  const store=storage();const earlier=finish(initialQuizState(1000,()=>.5));const later=finish(initialQuizState(86400000,()=>.5));
  assert.ok(saveSnapshot(store,later));assert.ok(saveSnapshot(store,earlier));assert.ok(saveSnapshot(store,earlier));assert.deepEqual(readSnapshots(store).map(s=>s.sessionId),[earlier.sessionId,later.sessionId]);
  const saved=JSON.parse(store.getItem(SNAPSHOT_STORAGE_KEY));store.setItem(SNAPSHOT_STORAGE_KEY,JSON.stringify([...saved,{...saved[0],sessionId:'bad',dimensions:[]}]));
  assert.equal(readSnapshots(store).length,2);assert.equal(syncSnapshots(store,[earlier,later]).length,2);
});
test('all-flat and all-regressing comparisons never invent an improvement; ties and smallest weak score are deterministic',()=>{
  const prev=snapshotFromState(finish(initialQuizState(1000,()=>.5)));const current={...prev,dimensions:prev.dimensions.map(d=>({...d,score:d.score-5})),totalScore:prev.totalScore-5};
  const c=compareSnapshots(prev,current);assert.equal(c.totalDelta,-5);assert.equal(c.mostImproved,null);assert.equal(c.needsWork.id,1);
  assert.equal(compareSnapshots(prev,prev).mostImproved,null);
  const raised={...prev,dimensions:prev.dimensions.map(d=>({...d,score:d.score+5})),totalScore:prev.totalScore+5};assert.equal(compareSnapshots(prev,raised).needsWork,null);assert.equal(compareSnapshots(prev,raised).mostImproved.id,1);
});
test('retest reminders cover less than three, three to seven, eight to fourteen and over fourteen days without blocking retakes',()=>{
  const at=1000,day=86400000;
  assert.equal(retestStatus(at,at+2*day).tone,'quiet');assert.equal(retestStatus(at,at+3*day).tone,'normal');assert.equal(retestStatus(at,at+7*day).tone,'normal');assert.equal(retestStatus(at,at+10*day).tone,'normal');assert.equal(retestStatus(at,at+14*day).tone,'normal');assert.equal(retestStatus(at,at+15*day).tone,'highlight');assert.equal(retestStatus(at,at-100).days,0);
});
test('historical unseen questions beat a seen exact tier; old questions return only after that dimension exhausts fresh questions',()=>{
  const bank=[{id:'old',dimensionId:1,difficultyLevel:3},{id:'new',dimensionId:1,difficultyLevel:2}];const a=initialAbilities();
  const first=selectNextQuestion(bank,a,0,[],()=>0,['old']);assert.equal(first.questionId,'new');assert.equal(first.actualDifficulty,2);assert.equal(first.historyPreference.seenBefore,false);
  const second=selectNextQuestion(bank,a,0,['new'],()=>0,['old']);assert.equal(second.questionId,'old');assert.ok(second.historyPreference.reuseReason);assert.throws(()=>selectNextQuestion(bank,a,0,['new','old'],()=>0,['old']));
});
test('history-aware CAT survives saved state refresh and repeated attempts, including exhausted historical pools',()=>{
  const store=storage();const first=finish(initialQuizState(1000,()=>.5));saveQuizState(store,first);assert.equal(readSnapshots(store).length,1);
  const seen=readSeenQuestionIds(store);assert.equal(seen.length,18);let next=initialQuizState(90000,()=>.5,seen);saveQuizState(store,next);next=readQuizState(store,91000);assert.ok(isValidQuizState(next));next=finish(next);assert.ok(isValidQuizState(next));
  for(const decision of next.decisions){if(decision.historyPreference.seenBefore)assert.equal(decision.historyPreference.unseenAvailable,0);}
  saveQuizState(store,next);assert.equal(readSnapshots(store).length,2);
  const exhausted=finish(initialQuizState(190000,()=>.5,questionBank.map(q=>q.id)));assert.ok(isValidQuizState(exhausted));assert.ok(exhausted.decisions.every(d=>d.historyPreference.seenBefore));
});
test('answers from an abandoned partial attempt remain in seen history; storage failure does not crash',()=>{
  const store=storage();let s=initialQuizState(1000,()=>.5);s=quizReducer(s,{type:'skip',now:2000,random:()=>.5});saveQuizState(store,s);saveQuizState(store,initialQuizState(3000,()=>.5,readSeenQuestionIds(store)));assert.ok(readSeenQuestionIds(store).includes(s.answers[0].questionId));
  const broken={getItem(){throw Error('blocked');},setItem(){throw Error('full');}};assert.deepEqual(readSnapshots(broken),[]);assert.equal(saveSnapshot(broken,finish(initialQuizState(1000,()=>.5))),false);
});
