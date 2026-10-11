import React, {useEffect,useRef,useState} from 'react';
import {diagnosisInput,generateDiagnosis,REPORT_HEADINGS} from './ai-diagnosis.js';
const cacheKey=state=>`ai-pmcoach-ai-v1-${state.sessionId}`;
export function useLocalDiagnosis(state,result) {
  const [reports,setReports]=useState({}); const [busy,setBusy]=useState(false); const [progress,setProgress]=useState('');
  const controller=useRef(null); const enabled=Boolean(import.meta.env && import.meta.env.VITE_LOCAL_AI==='1');
  useEffect(()=>{setReports({}); if(enabled&&result)try{const saved=JSON.parse(window.localStorage.getItem(cacheKey(state)));if(saved&&JSON.stringify(saved.answers)===JSON.stringify(state.answers)&&Object.values(saved.reports??{}).every(r=>['ai','fallback'].includes(r.source)&&REPORT_HEADINGS.every(h=>typeof r.sections?.[h]==='string'&&r.sections[h].length<7000)))setReports(saved.reports??{});}catch{} return()=>controller.current?.abort();},[state?.sessionId]);
  async function generate() {
    if(busy||!result)return;
    const abort=new AbortController();controller.current=abort;setBusy(true);
    let token=null;
    try {const r=await fetch('/api/ai-status',{signal:abort.signal});if(r.ok)token=(await r.json()).token;}catch(error){if(error.name==='AbortError'){setBusy(false);return;}}
    const next={};
    try{
      for(const d of result.dimensions){
        const report=await generateDiagnosis(diagnosisInput(d),async(input,signal)=>{
          const r=await fetch('/api/diagnose',{method:'POST',headers:{'Content-Type':'application/json','X-AI-Session':token??''},body:JSON.stringify({state,dimensionId:input.dimensionId}),signal});
          if(!r.ok)throw Error(`Diagnosis request failed ${r.status}`);
          const body=await r.json();return body.text;
        },{signal:abort.signal,onAttempt:n=>setProgress(`${d.name} · 第${n}/3次尝试`)});
        next[d.id]=report;setReports({...next});
        try{window.localStorage.setItem(cacheKey(state),JSON.stringify({answers:state.answers,reports:next}));}catch{}
      }
      setProgress('六维度诊断已完成');
    }catch(error){if(error.name!=='AbortError')setProgress('生成暂未完成，可以重新尝试；答题记录不受影响。');}
    finally{setBusy(false);}
  }
  return {enabled,reports,busy,progress,generate};
}
export function GeneratedDiagnosis({report}) {
  return <div className="personal-diagnosis"><p className="ai-report-source">{report.source==='ai'?'GPT个人诊断':'通用诊断 · AI暂不可用（非个人错题判断）'}</p>
    {REPORT_HEADINGS.map(heading=><section key={heading}><h4>{heading}</h4>{report.sections[heading].split(/\n+/).filter(Boolean).map((p,i)=><p key={i}>{p}</p>)}</section>)}
  </div>;
}
