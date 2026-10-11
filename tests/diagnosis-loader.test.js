import test from 'node:test';
import assert from 'node:assert/strict';
import {hasEnoughEvidence,weakestDimensionId,createDiagnosisLoader} from '../src/diagnosis-loader.js';
import {parseDiagnosis,buildDiagnosisPrompt} from '../src/ai-diagnosis.js';
function dimension(id,total=3){return {id,score:50,diagnosis:{evidence:Array.from({length:total},(_,i)=>({questionId:String(id*10+i).padStart(3,'0'),sessionNumber:i+1,isCorrect:true,skipped:false,actualDifficulty:3}))}};}
const report=input=>'一句话总结：本次已测判断准确\n具体问题：已作答题没有错误。\n可能原因：没有已测错题，不推测原因。\n下一步行动：用15分钟写两套约束变化后的方案。完成标准：列出适用条件。\n正向鼓励：#'+input.questions[0].questionId+'答对，正确识别了题目约束。';
test('weakest dimension is deterministic; fewer than three non-skipped answers cannot trigger AI',async()=>{
  assert.equal(weakestDimensionId([{id:2,score:45},{id:1,score:45},{id:3,score:80}]),1);
  const d=dimension(1,2);let calls=0;
  const load=createDiagnosisLoader({dimensions:[d],invoke:async()=>{calls++;}});
  assert.equal(await load(1),null);assert.equal(calls,0);assert.equal(hasEnoughEvidence(d),false);
  const skipped=dimension(2);skipped.diagnosis.evidence[0].skipped=true;assert.equal(hasEnoughEvidence(skipped),false);
});
test('no eager six calls; expanded requests deduplicate, serialize and reuse cached reports',async()=>{
  const dimensions=[dimension(1),dimension(2),dimension(3)];let active=0,max=0;const ids=[];
  const load=createDiagnosisLoader({dimensions,invoke:async input=>{ids.push(input.dimensionId);max=Math.max(max,++active);await new Promise(r=>setTimeout(r,5));active--;return report(input);}});
  assert.deepEqual(ids,[]);const first=load(1);assert.equal(load(1),first);await first;assert.deepEqual(ids,[1]);
  await Promise.all([load(2),load(3)]);assert.equal(max,1);await load(1);assert.deepEqual(ids,[1,2,3]);
});
test('high scores request challenge directions and never require a weakness invented from a wrong answer',()=>{
  const input={dimensionId:1,score:95,questions:[{questionId:'010',outcome:'wrong'},{questionId:'011',outcome:'correct'}]};
  const text='一句话总结：已测判断扎实，挑战多约束决策\n具体问题：进阶挑战：同时改变成本、质量与交付约束。\n可能原因：本分数不推测薄弱原因。\n下一步行动：用20分钟写两套方案。完成标准：列出取舍条件。\n正向鼓励：#011答对，正确识别了决策条件。';
  assert.equal(parseDiagnosis(text,input).source,'ai');assert.ok(buildDiagnosisPrompt(input).includes('超过90'));
});
test('natural-language weakness blocks must cover actual wrong IDs once and provide an executable action',()=>{
  const input={score:45,questions:[{questionId:'003',outcome:'wrong'},{questionId:'005',outcome:'correct'}]};
  const text='一句话总结：未分清召回与生成的评估对象\n具体问题：考察点：评估归因\n证据：#003（本次第3题）把生成质量等同召回质量。\n原因：基于#003，可能混淆了两个评估对象。\n建议：写一张阶段指标对照表。完成标准：列出阶段输入输出。\n可能原因：基于#003，可能没有区分评估阶段，待验证：如何拆解？\n下一步行动：写一张评估表。完成标准：列出两个阶段。\n正向鼓励：#005答对，本题模型选择符合约束。';
  assert.equal(parseDiagnosis(text,input).weaknessBlocks.length,1);
  assert.throws(()=>parseDiagnosis(text.replace('证据：#003','证据：#005'),input));
});
