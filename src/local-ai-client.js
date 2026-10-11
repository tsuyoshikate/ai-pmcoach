let queue=Promise.resolve();
// Both features share one queue so native GPT requests never compete.
export function requestLocalAI(path,body,signal){
  const task=queue.catch(()=>{}).then(async()=>{
    if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    const timeout=new AbortController();const timer=setTimeout(()=>timeout.abort(),100000);
    const combined=signal?AbortSignal.any([signal,timeout.signal]):timeout.signal;
    try{
      const session=await fetch('/api/ai-status',{signal:combined});if(!session.ok)throw Error('Local AI session unavailable');
      const {token}=await session.json();if(typeof token!=='string'||!token)throw Error('Invalid local session');
      const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-AI-Session':token},body:JSON.stringify(body),signal:combined});
      if(!r.ok)throw Error('Local AI unavailable');const {text}=await r.json();if(typeof text!=='string'||text.length>7000)throw Error('Invalid model response');return text;
    }catch(error){if(signal?.aborted)throw new DOMException('Aborted','AbortError');if(timeout.signal.aborted)throw Error('Local AI timeout');throw error;}finally{clearTimeout(timer);}
  });queue=task;return task;
}
