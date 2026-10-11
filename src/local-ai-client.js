let queue=Promise.resolve();
// Both features share one queue so native GPT requests never compete.
export function requestLocalAI(path,body,signal){
  const task=queue.catch(()=>{}).then(async()=>{
    if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    const session=await fetch('/api/ai-status',{signal});if(!session.ok)throw Error('Local AI session unavailable');
    const {token}=await session.json();const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-AI-Session':token},body:JSON.stringify(body),signal});
    if(!r.ok)throw Error('Local AI unavailable');return(await r.json()).text;
  });queue=task;return task;
}
