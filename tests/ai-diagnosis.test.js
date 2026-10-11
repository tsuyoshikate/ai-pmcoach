import test from 'node:test';import assert from 'node:assert/strict';
import {fallbackReports,fallbackFor} from '../src/diagnosis-fallbacks.js';
import {DIAGNOSIS_INSTRUCTIONS,buildDiagnosisPrompt,parseDiagnosis,generateDiagnosis,REPORT_HEADINGS} from '../src/ai-diagnosis.js';
const input={dimensionId:1,dimensionName:'AI 基础认知',score:45,questions:[{questionId:'003',outcome:'wrong'},{questionId:'005',outcome:'correct'}]};
const good='一句话总结：本次未分清意图识别与语音识别\n具体问题：#003答错，语音转写与意图判断不同。\n可能原因：基于#003，可能将音频转写与文本意图判断混为一谈，待验证：请解释两者输入与输出。\n下一步行动：用10分钟画一个语音客服流程，标出语音转写和意图识别两步。完成标准：写出每步的输入输出。\n正向鼓励：#005答对，说明本题中你区分了过拟合与欠拟合。';
test('strict role, untrusted inputs and natural-language output are included in instructions',()=>{
  for(const term of ['8年','维度','难度','答错','不要输出JSON','30','建议多学习','项目经验'])assert.ok(DIAGNOSIS_INSTRUCTIONS.includes(term));
  assert.ok(buildDiagnosisPrompt(input).includes('<assessment_data>'));
});
test('all 24 fallback reports contain five nonempty sections and disjoint boundary bands',()=>{
  assert.equal(Object.values(fallbackReports).flat().length,24);
  for(let id=1;id<=6;id++)for(const [score,band]of[[0,0],[39.9,0],[40,1],[59.9,1],[60,2],[79.9,2],[80,3],[100,3]]){
    const r=fallbackFor(id,score);assert.equal(r.band,band);for(const h of REPORT_HEADINGS)assert.ok(r.sections[h].length);
  }
  assert.throws(()=>fallbackFor(7,50));assert.throws(()=>fallbackFor(1,NaN));
});
test('plain Chinese report is accepted; bad format and fabricated evidence are rejected',()=>{
  assert.equal(parseDiagnosis(good,input).source,'ai');
  for(const text of ['{}','```'+good,good.replace('#003','#099'),good.replace('#005','#003'),good.replace('本次未分清意图识别与语音识别','字'.repeat(31)),good.replace('可能将音频转写与文本意图判断混为一谈','可能没有做过RAG系统')])assert.throws(()=>parseDiagnosis(text,input));
});
test('exactly three attempts wait 1s then 3s and fall back on network or formatting failures',async()=>{
  const waits=[];let calls=0;
  const r=await generateDiagnosis(input,async()=>{calls++;throw Error('429');},{wait:async ms=>waits.push(ms)});
  assert.equal(calls,3);assert.deepEqual(waits,[1000,3000]);assert.equal(r.source,'fallback');
  const malformed=await generateDiagnosis(input,async()=>'{bad}',{wait:async()=>{}});assert.equal(malformed.source,'fallback');
});
test('retry can recover and cancellation does not produce a fake fallback',async()=>{
  let calls=0;const waits=[];
  const r=await generateDiagnosis(input,async()=>++calls===1?'bad':good,{wait:async ms=>waits.push(ms)});
  assert.equal(r.source,'ai');assert.equal(r.attempts,2);assert.deepEqual(waits,[1000]);
  const control=new AbortController();control.abort();await assert.rejects(generateDiagnosis(input,async()=>good,{signal:control.signal}),{name:'AbortError'});
});
