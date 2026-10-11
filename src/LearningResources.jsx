import React,{useEffect,useRef,useState} from 'react';
import {resourceInput,fallbackResources,recommendResources,parseResources,googleSearchURL,RESOURCE_FIELDS} from './learning-resources.js';
import {requestLocalAI} from './local-ai-client.js';
export default function LearningResources({dimension,state}){
  const [open,setOpen]=useState(false);const [result,setResult]=useState(null);const [busy,setBusy]=useState(false);
  const control=useRef(null);const active=useRef(false);
  const input=resourceInput(dimension);const signature=JSON.stringify(input);
  const key='ai-pmcoach-resources-v1-'+state.sessionId+'-'+dimension.id;
  const enabled=Boolean(import.meta.env&&import.meta.env.VITE_LOCAL_AI==='1');
  useEffect(()=>{
    active.current=true;setOpen(false);setResult(null);setBusy(false);
    try{const cache=JSON.parse(window.localStorage.getItem(key));if(cache?.signature===signature&&['ai','curated'].includes(cache.result?.source)){
      const text=cache.result.items.map(r=>[r.title,r.platform,r.type,r.minutes+'分钟',r.reason,r.query].map((v,i)=>RESOURCE_FIELDS[i]+'：'+v).join('\n')).join('\n\n');
      setResult({...cache.result,items:parseResources(text,input)});
    }}catch{}
    return()=>{active.current=false;control.current?.abort();};
  },[key,signature]);
  async function toggle(){
    if(open){setOpen(false);return;}setOpen(true);if(result||busy)return;
    const abort=new AbortController();control.current=abort;setBusy(true);
    try{
      const next=enabled?await recommendResources(input,(_,signal)=>requestLocalAI('/api/resources',{state,dimensionId:dimension.id},signal),{signal:abort.signal}):fallbackResources(input);
      if(!active.current||abort.signal.aborted)return;setResult(next);
      try{window.localStorage.setItem(key,JSON.stringify({signature,result:next}));}catch{}
    }catch(error){if(error.name!=='AbortError'&&active.current)setResult(fallbackResources(input));}
    finally{if(active.current&&!abort.signal.aborted)setBusy(false);}
  }
  return <div className="learning-resources">
    <button className="resource-toggle" type="button" onClick={toggle} aria-expanded={open} aria-controls={'learning-resources-'+dimension.id}>{open?'收起推荐资源':'查看推荐资源'} <span aria-hidden="true">{open?'−':'+'}</span></button>
    {open&&<div id={'learning-resources-'+dimension.id} className="resource-list">
      {busy?<div className="diagnosis-loading" role="status" aria-live="polite"><span className="diagnosis-spinner" aria-hidden="true"/><p>正在根据考察点整理推荐资源…</p></div>:result&&<>
        <p className="resource-context">{result.source==='ai'?'按当前考察点推荐':'基础资源清单'} · 搜索后请核对作者与来源，时长为本次选读或节选的预计投入。</p>
        {result.items.map(r=><article className="resource-item" key={r.title}>
          <div className="resource-title"><h4>{r.title}</h4><span className="resource-type">{r.type}</span></div>
          <p className="resource-meta">{r.platform} · 预计学习 {r.minutes} 分钟（选读／节选）</p>
          <p className="resource-reason">{r.reason}</p>
          <a className="resource-search" href={googleSearchURL(r.query)} target="_blank" rel="noopener noreferrer" aria-label={'用这个关键词搜索：'+r.query+'（新标签页）'}><span>用这个关键词搜索 ↗</span><strong>{r.query}</strong></a>
        </article>)}
      </>}
    </div>}
  </div>;
}
