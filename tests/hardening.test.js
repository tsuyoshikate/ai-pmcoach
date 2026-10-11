import test from 'node:test';import assert from 'node:assert/strict';
import {questionBank,initialQuizState,quizReducer,getQuestion,isValidQuizState,readQuizState,saveQuizState} from '../src/quiz.js';
import {checkQuestionBank,retestFeedback,scoreBreakdown,singleFlight} from '../src/hardening.js';
import {snapshotFromState} from '../src/snapshots.js';
import {parseDiagnosis,generateDiagnosis} from '../src/ai-diagnosis.js';
import {scenarioInput,normalizeScenarioText,parseScenarioGrade,gradeScenario,fallbackScenarioGrade,saveAppeal,APPEAL_STORAGE_KEY,RUBRIC} from '../src/scenario.js';
import {newPractice,answerPractice,practiceStats,readPractice,savePractice,validPractice} from '../src/practice.js';
const store=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
function finish(){let s=initialQuizState(1000,()=>.5);while(!s.completedAt){s=quizReducer(s,{type:'select',option:getQuestion(s.questionIds[s.index]).correctAnswer,now:2000+s.index*2000});s=quizReducer(s,{type:'next',random:()=>.5,now:3000+s.index*2000});}return s;}
const snap=snapshotFromState(finish());
test('empty, incomplete, malformed and duplicated banks never qualify to start',()=>{
 assert.ok(checkQuestionBank(questionBank).ready);for(const bank of [[],null,questionBank.filter(q=>q.dimensionId!==4),[...questionBank,questionBank[0]],questionBank.map((q,i)=>i? q:{...q,options:[]})])assert.equal(checkQuestionBank(bank).ready,false);
});
test('feedback covers 10 point total improvement, 15 point dimension breakthrough, every decline and stable boundaries',()=>{
 const current={...snap,completedAt:snap.completedAt+7*86400000,dimensions:snap.dimensions.map((d,i)=>({...d,score:d.score+(i===0?15:0)}))};
 let r=retestFeedback(snap,{...current,totalScore:snap.totalScore+10});assert.equal(r.tone,'celebrate');assert.equal(r.days,7);assert.equal(r.breakthroughs[0].delta,15);
 assert.equal(retestFeedback(snap,{...current,totalScore:snap.totalScore+5}).tone,'stable');assert.equal(retestFeedback(snap,{...current,totalScore:snap.totalScore-1}).tone,'constructive');assert.equal(retestFeedback(snap,{...current,totalScore:snap.totalScore+6}).tone,'progress');assert.equal(retestFeedback(null,snap),null);
});
test('score explanation replays actual contribution records with high-tier count and does not substitute an invented formula',()=>{
 const s=finish();const b=scoreBreakdown(s,1);assert.equal(b.count,3);assert.equal(b.correct,3);assert.equal(b.score,Math.round(s.abilities[0].score));for(const a of b.answers)assert.equal(a.scoreAfter,a.scoreBefore*.7+a.contribution*.3);assert.equal(scoreBreakdown(null,1),null);
});
test('submission lock prevents repeated concurrent commit and releases on success or rejection',async()=>{
 let calls=0,release;const run=singleFlight(async()=>{calls++;await new Promise(r=>release=r);});const first=run();assert.equal(await run(),false);assert.equal(calls,1);release();assert.equal(await first,true);
 const bad=singleFlight(async()=>{throw Error('network');});await assert.rejects(bad());await assert.rejects(bad());
});
test('null and damaged nested saved state cannot throw or create a result; valid selection refreshes',()=>{
 const initial=initialQuizState(1000,()=>.5);for(const s of [null,{...initial,decisions:[null]},{...initial,answers:[null],index:1},{...initial,questionIds:null}])assert.equal(isValidQuizState(s),false);
 const memory=store();let s=quizReducer(initial,{type:'select',option:'B',now:2000});saveQuizState(memory,s);assert.equal(readQuizState(memory,5000).selected,'B');assert.equal(readQuizState(memory,5000).timerStartedAt,5000);
});
test('missing references emit visible-warning callback then retry twice and use basic diagnosis',async()=>{
 const input={dimensionId:1,dimensionName:'AI基础认知',score:45,questions:[{questionId:'001',outcome:'wrong'}]};const noRefs='一句话总结：本次判断有误\n具体问题：判断不符合当前目标\n可能原因：可能遗漏约束，请核验\n下一步行动：写出方案对照表，完成标准：每项对应约束\n正向鼓励：没有答对题，暂不判断优势';
 assert.throws(()=>parseDiagnosis(noRefs,input),e=>e.code==='MISSING_REFERENCES');const warnings=[],waits=[];const report=await generateDiagnosis(input,async()=>noRefs,{onInvalid:code=>warnings.push(code),wait:async ms=>waits.push(ms)});assert.equal(report.source,'fallback');assert.equal(warnings.length,3);assert.deepEqual(waits,[1000,3000]);
});
test('scenario Unicode cap truncates pasted 2001 characters, validates 20 character minimum and preserves counter boundaries',()=>{
 assert.equal(normalizeScenarioText('字'.repeat(2001)).count,2000);assert.ok(normalizeScenarioText('字'.repeat(2001)).truncated);assert.equal([...normalizeScenarioText('😀'.repeat(2001)).text].length,2000);for(const text of ['',' '.repeat(20),'字'.repeat(19),'字'.repeat(2001)])assert.throws(()=>scenarioInput(1,text));assert.ok(scenarioInput(1,'字'.repeat(20)));assert.ok(scenarioInput(1,'字'.repeat(2000)));assert.equal(2000-normalizeScenarioText('字'.repeat(1800)).count,200);
});
test('scenario scoring requires all four bounded criteria, exact quotations and code-computed sum',()=>{
 const input=scenarioInput(1,'首先明确用户目标，然后设计样本验证，保留人工回退和上线监控。');const good=RUBRIC.map((r,i)=>r+'：'+(20-i)+'/25｜依据：“用户目标”表述需要补充执行约束。').join('\n')+'\n下一步：建立五条样本并验证回退流程，完成标准：每条样本记录决策结果。';
 assert.equal(parseScenarioGrade(good,input).total,74);assert.throws(()=>parseScenarioGrade(good.replace('用户目标','我做过项目'),input));assert.throws(()=>parseScenarioGrade(good.replace('20/25','26/25'),input));assert.throws(()=>parseScenarioGrade(good.split('\n').slice(1).join('\n'),input));
});
test('failed scenario grading retries 1s and 3s and shows clearly distinguished rule-based rubric',async()=>{
 const input=scenarioInput(1,'首先明确用户目标，然后设计样本验证，保留人工回退和上线监控。');const waits=[];let attempts=0;const grade=await gradeScenario(input,async()=>{attempts++;throw Error('429');},{wait:async ms=>waits.push(ms)});assert.equal(attempts,3);assert.deepEqual(waits,[1000,3000]);assert.equal(grade.source,'fallback');assert.equal(grade.criteria.length,4);assert.equal(grade.total,grade.criteria.reduce((s,c)=>s+c.score,0));assert.equal(fallbackScenarioGrade(input).source,'fallback');
});
test('appeals survive refresh, are idempotent, reject blank reasons and report storage failures',()=>{
 const memory=store(),record={id:'one',date:'2026-10-11',reason:'第三项已有明确执行步骤，请复核。'};assert.ok(saveAppeal(memory,record));assert.ok(saveAppeal(memory,record));assert.equal(JSON.parse(memory.getItem(APPEAL_STORAGE_KEY)).length,1);assert.equal(saveAppeal(memory,{id:'two',reason:' '}),false);assert.equal(saveAppeal({getItem(){throw Error();},setItem(){throw Error();}},record),false);
});
test('dimension retest stays in dimension, has no duplicate questions, recalculates its own score and resumes',()=>{
 const memory=store();let p=newPractice(2,[],()=>.5);for(let i=0;i<3;i++){p={...p,selected:getQuestion(p.ids[i]).correctAnswer};p=answerPractice(p,()=>.5,p.questionStartedAt+1000);assert.ok(savePractice(memory,p));assert.ok(validPractice(readPractice(memory,2),2));}
 assert.equal(p.answers.length,3);assert.equal(new Set(p.ids).size,3);assert.ok(p.ids.every(id=>getQuestion(id).dimensionId===2));assert.ok(practiceStats(p).score>50);assert.equal(memory.getItem('ai-pmcoach-snapshots-v1'),null);assert.equal(readPractice(memory,1),null);
});
