import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getQuestion, initialQuizState, quizReducer, readQuizState, saveQuizState, readSeenQuestionIds, TOTAL_QUESTIONS } from './quiz.js';
import { isComplete, logQuestionDecision, logScoreChange } from './cat.js';

export function startNewQuiz() {
  let seen=[];try{seen=readSeenQuestionIds(window.localStorage);}catch{}
  const state = initialQuizState(Date.now(),Math.random,seen);
  try { saveQuizState(window.localStorage, state); } catch { /* Assessment still works in memory. */ }
  return state;
}
export function startOrResumeQuiz() {
  try {
    const state = readQuizState(window.localStorage);
    if (state && state.index < TOTAL_QUESTIONS) return state;
  } catch { /* Continue without storage. */ }
  return startNewQuiz();
}
export default function Assessment({ onComplete }) {
  const [state, setState] = useState(() => {
    try { return readQuizState(window.localStorage) ?? initialQuizState(Date.now(),Math.random,readSeenQuestionIds(window.localStorage)); } catch { return initialQuizState(); }
  });
  const stateRef = useRef(state);
  const [storageError, setStorageError] = useState(false);
  const headingRef = useRef(null);
  const commit = useCallback((action, render = true) => {
    const previous = stateRef.current;
    const next = quizReducer(previous, action);
    stateRef.current = next;
    if (next.index > previous.index) {
      logScoreChange(next, next.answers.at(-1));
      logQuestionDecision(next);
    }
    let saved = false;
    try { saved = saveQuizState(window.localStorage, next); } catch { /* Browser storage may be blocked. */ }
    if (render) { setState(next); setStorageError(!saved); }
  }, []);
  useEffect(() => {
    logQuestionDecision(stateRef.current, stateRef.current.index > 0);
    commit({ type: document.hidden ? 'pause' : 'resume' });
    const visibility = () => commit({ type: document.hidden ? 'pause' : 'resume' });
    const leave = () => commit({ type: 'pause' }, false);
    const restore = () => commit({ type: document.hidden ? 'pause' : 'resume' });
    const timer = window.setInterval(() => { if (!document.hidden) commit({ type: 'tick' }); }, 1000);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', leave);
    window.addEventListener('beforeunload', leave);
    window.addEventListener('pageshow', restore);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('beforeunload', leave);
      window.removeEventListener('pageshow', restore);
      leave();
    };
  }, [commit]);
  const complete = isComplete(state.index, state.abilities);
  const current = Math.min(state.index + 1, TOTAL_QUESTIONS);
  const question = getQuestion(state.questionIds[state.index]);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [state.index]);
  useEffect(() => { if (complete) { onComplete?.(state); window.location.hash = '/results'; } }, [complete, onComplete, state]);
  return <main className="assessment-main">
    <div className="quiz-progress-heading"><span>第 <strong>{current}</strong> 题 / 共 {TOTAL_QUESTIONS} 题</span><span className="quiz-demo-label">自适应测评 · 单选题</span></div>
    <div className="quiz-progress-track" role="progressbar" aria-label="测评进度" aria-valuemin={0} aria-valuemax={TOTAL_QUESTIONS} aria-valuenow={state.index} aria-valuetext={`已完成${state.index}题，共${TOTAL_QUESTIONS}题`}><div style={{ width: `${state.index / TOTAL_QUESTIONS * 100}%` }}/></div>
    {storageError && <p className="storage-warning" role="alert">浏览器未能保存记录。你可以继续作答，但刷新可能丢失进度。</p>}
    {complete ? <section className="quiz-complete"><h1 ref={headingRef} tabIndex={-1}>正在打开你的答题报告</h1><a className="back-link" href="#/results">查看结果</a></section> : <>
      <form onSubmit={event => { event.preventDefault(); commit({ type: 'next' }); }}>
        <div className="question-card">
          <div className="question-meta" data-dimension={question.dimensionId}><span className="question-tag"><span className="question-number">#{current} · </span><span className="question-dimension">{question.dimension}</span></span><span>题库 #{question.id}</span></div>
          <h1 ref={headingRef} tabIndex={-1} className="question-title">{question.prompt}</h1>
        </div>
        <fieldset className="question-fieldset" key={question.id}>
          <legend className="sr-only">{question.prompt}（请选择一个选项）</legend>
          <div className="question-options">{question.options.map((option, index) => {
            const letter = 'ABCD'[index];
            return <label key={letter} className={`option-card${state.selected === letter ? ' is-selected' : ''}`}>
              <input type="radio" name={`question-${question.id}`} value={letter} checked={state.selected === letter} onChange={() => commit({ type: 'select', option: letter })}/>
              <span className="option-letter" aria-hidden="true">{letter}</span><span className="option-text">{option}</span><span className="option-indicator" aria-hidden="true"/>
            </label>;
          })}</div>
        </fieldset>
        <div className="quiz-actions"><button className="primary-button" type="submit" disabled={state.selected === null}>{current === TOTAL_QUESTIONS ? '提交并查看结果' : '下一题'} <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></button><button className="skip-question" type="button" onClick={() => commit({ type: 'skip' })}>跳过本题</button></div>
        <p className="quiz-reassurance">答题过程中不显示对错。跳过计为未答对，进度自动保存在当前浏览器。</p>
      </form>
    </>}
  </main>;
}
