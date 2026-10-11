import {mkdir,writeFile} from 'node:fs/promises';
import {initialQuizState,quizReducer,getQuestion,QUIZ_STORAGE_KEY,HISTORY_STORAGE_KEY} from '../src/quiz.js';
import {snapshotFromState,SNAPSHOT_STORAGE_KEY} from '../src/snapshots.js';
const now=Date.now();
function finish(mode,start){let s=initialQuizState(start,()=>.5);while(!s.completedAt){const q=getQuestion(s.questionIds[s.index]);const correct=mode==='correct'||mode==='breakthrough'&&q.dimensionId===1;s=quizReducer(s,{type:'select',option:correct?q.correctAnswer:'ABCD'.split('').find(a=>a!==q.correctAnswer),now:start+1000+s.index*2000});s=quizReducer(s,{type:'next',random:()=>.5,now:start+2000+s.index*2000});}return s;}
const prior=finish('wrong',now-7*86400000),current=finish('correct',now-60000),breakthrough=finish('breakthrough',now-60000),downPrior=finish('correct',now-7*86400000),down=finish('wrong',now-60000),flat=finish('wrong',now-60000);
function data(records){return {[QUIZ_STORAGE_KEY]:records.at(-1),[HISTORY_STORAGE_KEY]:records,[SNAPSHOT_STORAGE_KEY]:records.map(snapshotFromState)};}
let short=initialQuizState(now,()=>.5);for(let i=0;i<18;i++){const q=getQuestion(short.questionIds[short.index]);if(i===0)short=quizReducer(short,{type:'skip',now:now+2000+i*2000,random:()=>.5});else{short=quizReducer(short,{type:'select',option:q.correctAnswer,now:now+1000+i*2000});short=quizReducer(short,{type:'next',now:now+2000+i*2000,random:()=>.5});}}
const fixtures={one:data([current]),celebrate:data([prior,current]),breakthrough:data([prior,breakthrough]),decline:data([downPrior,down]),stable:data([prior,flat]),insufficient:data([short])};
await mkdir(new URL('../.sites-local/',import.meta.url),{recursive:true});await writeFile(new URL('../.sites-local/self-test-fixtures.json',import.meta.url),JSON.stringify(fixtures,null,2));
console.log('Self-test fixtures written only to ignored .sites-local. Use an isolated browser profile; never replace real user history.');
