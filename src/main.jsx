import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import Assessment, { startOrResumeQuiz } from './Assessment.jsx';
import { dimensions as bankDimensions } from './dimensions.js';
import Results from './Results.jsx';

const dimensions = bankDimensions.map(d => [d.name, d.description, d.icon]);
function Icon({ type = 'arrow', size = 20 }) {
  const paths = { arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>, back: <path d="M19 12H5m6-6-6 6 6 6"/>, clock: <><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></>, spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></>, search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>, layout: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M10 10v10"/></>, chart: <><path d="M4 4v16h16M8 15v-4m5 4V7m5 8v-5"/></>, code: <><path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16"/></>, growth: <><path d="m4 17 6-6 4 3 6-9m-6 0h6v6"/></>, check: <path d="m5 12 4 4L19 6"/> };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type]}</svg>;
}
function Compass() {
  const points = [[60,24,'strength'],[94,40,'strength'],[86,79,'neutral'],[60,77,'growth'],[40,71,'growth'],[37,47,'neutral']];
  return <figure className="radar-preview"><div className="compass" role="img" aria-label="能力雷达示意图，绿色代表强项，橙色代表待提升"><svg viewBox="0 0 120 120"><path d="M60 10 103.3 35v50L60 110 16.7 85V35Z" className="radar-ring"/><path d="m60 28 27.7 16v32L60 92 32.3 76V44Z" className="radar-ring"/><path d="m60 44 13.9 8v16L60 76 46.1 68V52Z" className="radar-ring"/><path d="M60 10v100M16.7 35l86.6 50M16.7 85l86.6-50" className="radar-axis"/><path d="M60 24 94 40 86 79 60 77 40 71 37 47Z" className="radar-area"/>{points.map(([x,y,state],index)=><circle key={index} cx={x} cy={y} r="3.2" className={`radar-point ${state}`}/>)}</svg></div><figcaption className="radar-legend"><span>能力示意</span><span><b className="strength"/>强项</span><span><b className="growth"/>待提升</span></figcaption></figure>;
}
function App() {
  const getPage = () => window.location.hash === '#/results' ? 'results' : window.location.hash === '#/assessment' ? 'assessment' : window.location.hash === '#/intro' ? 'intro' : 'home';
  const [page, setPage] = useState(getPage);
  const [completedState, setCompletedState] = useState(null);
  const mainRef = useRef(null);
  useEffect(() => { const change = () => { const nextPage = getPage(); if (nextPage === 'assessment') setCompletedState(null); setPage(nextPage); window.scrollTo(0,0); }; window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change); }, []);
  useEffect(() => { document.title = page === 'results' ? '能力诊断报告 · AI PMCoach' : page === 'intro' ? '测评介绍 · AI PMCoach' : page === 'assessment' ? '答题 · AI PMCoach' : 'AI PMCoach · 找到你的成长方向'; mainRef.current?.focus({preventScroll:true}); }, [page]);
  return <div className="app-shell min-h-screen flex flex-col">
    <header className="site-header flex items-center justify-between">
      <a className="brand flex items-center" href="#/" aria-label="AI PMCoach 首页"><span className="brand-mark"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 18V8l7-4 7 4v10l-7 4-7-4Z" stroke="currentColor" strokeWidth="1.5"/><path d="m8 15 4-7 4 7m-6.5-2h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg></span><span>AI <strong>PMCoach</strong></span></a>
      <span className="header-note">你的 AI 产品经理成长起点</span>
    </header>
    {page === 'results' ? <Results completedState={completedState}/> : page === 'assessment' ? <Assessment onComplete={setCompletedState}/> : page === 'home' ? <main ref={mainRef} tabIndex="-1" className="home-main flex flex-col items-center">
      <span className="eyebrow"><span className="status-dot"/> 写给下一位 AI 产品经理</span>
      <Compass/>
      <h1>测出你的<span>AI PM</span>能力短板</h1>
      <p className="hero-subtitle">15分钟，6个维度，告诉你该补什么</p>
      <p className="hero-description">转型不必从零开始，先看清自己的下一步。</p>
      <a href="#/intro" className="primary-button inline-flex items-center justify-center">开始测评 <Icon/></a>
      <div className="button-note"><span><Icon type="clock" size={14}/> 约 15 分钟</span><i/><span>无需注册</span></div>
      <div className="dimension-overview"><span className="overview-label">从 6 个维度，认识你的能力</span><div className="dimension-names flex flex-wrap justify-center">{dimensions.map(([name],index)=><span key={name} data-dimension={index+1}><b className="dimension-dot"/>{name}</span>)}</div></div>
      <div className="social-proof flex items-center"><span className="avatars" aria-hidden="true"><b>林</b><b>陈</b><b>周</b></span><p>已有 <strong>1234</strong> 人完成测评</p></div>
    </main> : <main ref={mainRef} tabIndex="-1" className="intro-main">
      <a className="back-link inline-flex items-center" href="#/"><Icon type="back" size={16}/> 返回首页</a>
      <div className="intro-heading"><span className="section-label">开始之前</span><h1>先认识一下这次测评</h1><p>六个维度，帮你找到 AI 产品经理的能力补齐方向。</p></div>
      <div className="assessment-meta flex items-center"><span><Icon type="clock" size={18}/>预计用时 <strong>15 分钟</strong></span><i/><span>覆盖 <strong>6 个能力维度</strong></span></div>
      <div className="dimension-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">{dimensions.map(([name,desc,icon],index)=><article key={name} className="dimension-card" data-dimension={index+1}><div className="card-top flex justify-between items-center"><span className="dimension-icon"><Icon type={icon} size={23}/></span><span className="card-number">0{index+1}</span></div><h2>{name}</h2><p>{desc}</p></article>)}</div>
      <div className="intro-bottom"><p><Icon type="check" size={16}/> 共 18 题，每个维度至少 3 题；难度随作答调整，刷新后可以继续。</p><a href="#/assessment" onClick={startOrResumeQuiz} className="primary-button inline-flex items-center justify-center">开始 <Icon/></a></div>
    </main>}
    <footer className="site-footer flex items-center justify-between"><span>AI PMCoach</span><span>让每一步成长，更有方向。</span><span>© 2026</span></footer>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
