import {diagnosisInput,generateDiagnosis} from './ai-diagnosis.js';
export const hasEnoughEvidence=d=>d?.diagnosis?.evidence.filter(q=>!q.skipped).length>=3;
export function weakestDimensionId(dimensions){return dimensions.filter(d=>Number.isFinite(d.score)).sort((a,b)=>a.score-b.score||a.id-b.id)[0]?.id??null;}
export function createDiagnosisLoader({dimensions,reports={},invoke,signal,onStatus=()=>{},onReport=()=>{}}){
  const pending=new Map();let queue=Promise.resolve();
  return function load(id){
    const d=dimensions.find(d=>d.id===id);if(!hasEnoughEvidence(d))return Promise.resolve(null);
    if(reports[id])return Promise.resolve(reports[id]);if(pending.has(id))return pending.get(id);
    onStatus(id,'queued');
    const task=queue.catch(()=>{}).then(async()=>{
      if(signal?.aborted)throw new DOMException('Aborted','AbortError');onStatus(id,'loading');
      try{const report=await generateDiagnosis(diagnosisInput(d),invoke,{signal});if(signal?.aborted)throw new DOMException('Aborted','AbortError');reports[id]=report;onReport(id,report);return report;}
      finally{if(!signal?.aborted)onStatus(id,null);}
    });pending.set(id,task);queue=task;return task;
  };
}
