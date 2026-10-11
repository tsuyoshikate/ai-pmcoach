import test from 'node:test';import assert from 'node:assert/strict';
import {RESOURCE_CATALOG,RESOURCE_FIELDS,RESOURCE_INSTRUCTIONS,resourceInput,fallbackResources,parseResources,containsURL,googleSearchURL,recommendResources,buildResourcePrompt} from '../src/learning-resources.js';
import {requestLocalAI} from '../src/local-ai-client.js';
const input={dimensionId:1,dimensionName:'AI 基础认知',mode:'补强',assessmentPoints:['技术里程碑与商业价值的区别']};
const textFor=items=>items.map(r=>[r.title,r.platform,r.type,r.minutes+'分钟',r.reason,r.query].map((v,i)=>RESOURCE_FIELDS[i]+'：'+v).join('\n')).join('\n\n');
const good=textFor(fallbackResources(input).items);
test('every dimension has three verified stable resources; all fallback fields and queries are valid',()=>{
  for(let id=1;id<=6;id++){const i={...input,dimensionId:id};const list=fallbackResources(i);assert.equal(list.items.length,3);assert.equal(parseResources(textFor(list.items),i).length,3);for(const r of list.items)assert.ok(!containsURL(JSON.stringify(r)));}
  assert.ok(RESOURCE_CATALOG.every(r=>['文章','视频','书','课程'].includes(r.type)));assert.ok(RESOURCE_INSTRUCTIONS.includes('绝对不许输出任何URL'));assert.ok(!containsURL(buildResourcePrompt(input).replace(/<\/?learning_data>/g,'')));
});
test('resource focus uses actual wrong assessment points; high-score input uses challenge mode',()=>{
  const d={id:1,name:'AI 基础认知',score:45,diagnosis:{evidence:[{isCorrect:false,skipped:false,assessmentPoints:['RAG选型']},{isCorrect:true,skipped:false,assessmentPoints:['评估']},{isCorrect:false,skipped:true,assessmentPoints:['不能断言']}]}};assert.deepEqual(resourceInput(d).assessmentPoints,['RAG选型']);
  assert.equal(resourceInput({...d,score:95}).mode,'进阶挑战');assert.ok(!resourceInput({...d,score:95}).assessmentPoints.includes('不能断言'));
});
test('reject URLs in any field, unverified titles, duplicate resources and vague search terms',()=>{
  for(const url of ['https://example.com/a','www.example.com','example.com/path','example.xyz/page','127.0.0.1:8080','example[.]com','javascript:alert(1)','[文章](foo)','ｈｔｔｐｓ：／／example.com'])assert.throws(()=>parseResources(good.replace('围绕',url+'围绕'),input));
  assert.throws(()=>parseResources(good.replace(fallbackResources(input).items[0].title,'昨日新课程'),input));
  assert.throws(()=>parseResources(good.replace(fallbackResources(input).items[0].query,'AI 怎么 学'),input));
  assert.throws(()=>parseResources(good+'\n\n'+good.split('\n\n')[0],input));
  assert.throws(()=>parseResources('{}',input));assert.throws(()=>parseResources(String.fromCharCode(96).repeat(3)+good,input));
});
test('Google destination is fixed and query encoding round-trips without adding parameters',()=>{
  const query='Chip Huyen AI Engineering & book';const url=new URL(googleSearchURL(query));assert.equal(url.origin,'https://www.google.com');assert.equal(url.pathname,'/search');assert.equal(url.searchParams.get('q'),query);assert.deepEqual([...url.searchParams.keys()],['q']);
  assert.throws(()=>googleSearchURL('https://malicious.example.com'));
});
test('failed recommendations retry at 1s and 3s then use curated resources; a valid report succeeds',async()=>{
  let calls=0;const waits=[];const result=await recommendResources(input,async()=>{calls++;return 'https://example.com';},{wait:async ms=>waits.push(ms)});assert.equal(calls,3);assert.deepEqual(waits,[1000,3000]);assert.equal(result.source,'curated');
  assert.equal((await recommendResources(input,async()=>good)).source,'ai');
});
test('diagnosis and resource model requests share a serial queue; aborted queued requests never call the backend',async()=>{
  const original=global.fetch;let active=0,max=0;const routes=[];
  global.fetch=async path=>{if(path==='/api/ai-status')return {ok:true,json:async()=>({token:'local-test'})};routes.push(path);max=Math.max(max,++active);await new Promise(r=>setTimeout(r,5));active--;return {ok:true,json:async()=>({text:'validated text'})};};
  try{const abort=new AbortController();const first=requestLocalAI('/api/diagnose',{});const second=requestLocalAI('/api/resources',{});const third=requestLocalAI('/api/resources',{},abort.signal);abort.abort();const outcomes=await Promise.allSettled([first,second,third]);assert.equal(max,1);assert.deepEqual(routes,['/api/diagnose','/api/resources']);assert.equal(outcomes[2].reason.name,'AbortError');}finally{global.fetch=original;}
});
