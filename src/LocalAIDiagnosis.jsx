import React, {useEffect,useRef,useState} from 'react';
import {REPORT_HEADINGS,parseDiagnosis,diagnosisInput} from './ai-diagnosis.js';
import {fallbackFor} from './diagnosis-fallbacks.js';
import {weakestDimensionId,hasEnoughEvidence,createDiagnosisLoader} from './diagnosis-loader.js';
import {requestLocalAI} from './local-ai-client.js';
const cacheKey=state=>`ai-pmcoach-ai-v2-${state.sessionId}`;
export function useLocalDiagnosis(state,result) {
  const enabled=Boolean(import.meta.env && import.meta.env.VITE_LOCAL_AI==='1');
  const weakest=weakestDimensionId(result?.dimensions??[]);
  const [expanded,setExpanded]=useState(()=>new Set(weakest?[weakest]:[]));
  const [reports,setReports]=useState({});const [loading,setLoading]=useState({});
  const [warnings,setWarnings]=useState({});
  const loader=useRef(null);
  useEffect(()=>{
    setExpanded(new Set(weakest?[weakest]:[]));setLoading({});setReports({});setWarnings({});
    if(!enabled||!result)return;
    const abort=new AbortController();let saved={};
    try {const cache=JSON.parse(window.localStorage.getItem(cacheKey(state)));if(cache&&JSON.stringify(cache.answers)===JSON.stringify(state.answers)){for(const d of result.dimensions){const r=cache.reports?.[d.id];if(!r||!hasEnoughEvidence(d))continue;try{saved[d.id]=r.source==='fallback'?fallbackFor(d.id,d.score):parseDiagnosis(REPORT_HEADINGS.map(h=>h+'：'+r.sections?.[h]).join('\n'),diagnosisInput(d));}catch{}}}}catch{}
    setReports(saved);
    const current={...saved};
    const load=createDiagnosisLoader({dimensions:result.dimensions,reports:current,signal:abort.signal,
      invoke:(input,signal)=>requestLocalAI('/api/diagnose',{state,dimensionId:input.dimensionId},signal),onStatus:(id,status)=>{if(!abort.signal.aborted)setLoading(old=>({...old,[id]:status}));},
      onInvalid:(id)=>{if(!abort.signal.aborted)setWarnings(old=>({...old,[id]:'诊断未引用具体题号，正在重新生成。'}));},
      onReport:(id,report)=>{if(abort.signal.aborted)return;current[id]=report;setReports({...current});setWarnings(old=>({...old,[id]:report.source==='fallback'&&old[id]?'未获得有题号依据的诊断，已展示基础诊断。':null}));try{window.localStorage.setItem(cacheKey(state),JSON.stringify({answers:state.answers,reports:current}));}catch{}},
    });
    loader.current=load;if(weakest)load(weakest).catch(()=>{});
    return()=>{abort.abort();if(loader.current===load)loader.current=null;};
  },[state?.sessionId,enabled]);
  function toggle(id){if(expanded.has(id)){setExpanded(old=>{const next=new Set(old);next.delete(id);return next;});return;}setExpanded(old=>new Set([...old,id]));if(enabled)loader.current?.(id).catch(()=>{});}
  return {enabled,reports,loading,expanded,toggle,warnings};
}
function matchingParagraph(text,id){return text.split(/\n+/).filter(p=>p.includes('#'+id)).join(' ')||text;}
export function DiagnosisContent({dimension:d,report}) {
  const s=report?.sections;const high=d.score>90;
  const summary=s?.['一句话总结']??(high?'本次判断扎实，下一步挑战复杂约束':d.diagnosis.summary);
  const weaknesses=report?.weaknessBlocks?.length?report.weaknessBlocks.map(b=>({...d.diagnosis.weaknesses.find(w=>w.questionId===b.questionIds[0]),aiBlock:b})):d.diagnosis.weaknesses;
  return <div className="personal-diagnosis">
    <p className="diagnosis-summary">{summary}</p>
    {report?.source==='fallback'?<div className="weakness-block"><h4>{high?'进阶挑战':'优先复核'}</h4><p>{s['具体问题']}</p><p>{s['可能原因']}</p><p className="diagnosis-action"><span aria-hidden="true">↗ </span>{s['下一步行动']}</p></div>:
      high?<div className="weakness-block"><h4>挑战更难的话题</h4><p>{s?.['具体问题']??'已测题表现良好；下一步检验目标冲突、资源约束与风险同时变化时的决策。'}</p><p className="diagnosis-action"><span aria-hidden="true">↗ </span>{s?.['下一步行动']??'用20分钟改变一道答对题的成本、质量和交付约束，写出两套备选方案与取舍。完成标准：明确哪些条件会改变你的决策。'}</p></div>:
      weaknesses.length?weaknesses.slice(0,3).map(w=>{
        const a=d.diagnosis.evidence.find(e=>e.questionId===w.questionId);
        const block=w.aiBlock;const evidence=block?d.diagnosis.evidence.filter(e=>block.questionIds.includes(e.questionId)):[a];
        return <section className="weakness-block" key={w.questionId}><h4>{block?.title??w.title}</h4>
          <div className="weakness-evidence"><strong>在{evidence.map(e=>'第'+e.sessionNumber+'题（题库 #'+e.questionId+'）').join('、')}</strong>{evidence.map(e=><p key={e.questionId}>{e.prompt.length>82?e.prompt.slice(0,82)+'…':e.prompt}</p>)}<p>{block?.evidence??(s?matchingParagraph(s['具体问题'],w.questionId):w.evidence)}</p></div>
          <p>{block?.cause??(s?matchingParagraph(s['可能原因'],w.questionId):w.hypothesis)}</p>
          <p className="diagnosis-action"><span aria-hidden="true">↗ </span>{block?.action??s?.['下一步行动']??(w.action+' '+w.doneWhen)}</p>
        </section>;
      }):<div className="weakness-block"><h4>{d.skipped?'先补充答题证据':'进一步验证判断'}</h4><p>{s?.['具体问题']??'本次已作答题未出现错误，暂不列出薄弱点。'}</p><p className="diagnosis-action"><span aria-hidden="true">↗ </span>{s?.['下一步行动']??(d.skipped?'先补答跳过的题目，写出选择依据，再核对解析。':'选一道答对题，改变一项业务约束，写出最佳方案变化的条件。完成标准：说明变化前后的判断依据。')}</p></div>}
    <details className="answer-evidence"><summary>查看答题依据</summary>{d.diagnosis.evidence.map(a=><div className="evidence-question" key={a.questionId}><strong>本次第{a.sessionNumber}题（题库 #{a.questionId}） · {a.skipped?'跳过':a.isCorrect?'答对':'答错'}</strong><p>{a.prompt}</p><p>考核点：{a.assessmentPoints.join(' ')} 最佳答案依据：{a.explanations[a.correctAnswer]}</p></div>)}</details>
    <div className="encouragement-box"><h4>正向鼓励</h4><p>{s?.['正向鼓励']??d.diagnosis.encouragement}</p></div>
  </div>;
}
export function DiagnosisLoading({status}){
  const [seconds,setSeconds]=useState(0);
  useEffect(()=>{const start=Date.now();const timer=setInterval(()=>setSeconds(Math.floor((Date.now()-start)/1000)),1000);return()=>clearInterval(timer);},[]);
  return <div className="diagnosis-loading" role="status" aria-live="polite"><span className="diagnosis-spinner" aria-hidden="true"/><p>{status==='queued'?'诊断已排队，即将开始':seconds<3?'AI正在为你生成针对性诊断(约3秒)':'AI仍在生成针对性诊断，请稍候'}</p></div>;
}
export {hasEnoughEvidence};
