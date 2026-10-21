// src/pages/Login.jsx - lamp login: pull the lamp cord to light the room, then the form is usable. Also the account request form. Backend: quant-desk-backend/auth_api.py
// The cord is a damped pendulum (sways when the mouse touches it, hangs with a slow idle sway while the lamp is off) plus a pull spring; both are animated through refs (no React re-render per frame).
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useRenderApi } from '../hooks/useRenderApi';
import { useAuth } from '../auth';
import bedImg from '../assets/room-bed.png';   // Kenney Furniture Kit (CC0, kenney.nl): bedSingle + cabinetBed, rendered to a transparent isometric PNG

const CSS = `
.lr { --pr: 8vw; --lx: calc(100vw - var(--pr) - 380px - 12vw); --bw: min(27vw, 470px); --fh: 22vh; --lw: min(360px, 38vw, 44vh); --lb: calc(var(--fh) - 6vh - var(--lw) * .087); --lt: 9vh; position: fixed; inset: 0; z-index: 60; overflow: hidden auto; color: #eef2f7; background: radial-gradient(ellipse at 28% 35%, #0d0f16 0%, #06070b 70%); display: grid; grid-template-columns: 1fr; align-items: center; align-content: center; }
.lr::before { content: ""; position: fixed; inset: 0; background: radial-gradient(ellipse 60% 70% at 28% 40%, rgba(255,190,90,.22), transparent 70%); opacity: 0; transition: opacity .6s ease; pointer-events: none; }
.lr.on::before { opacity: 1; }
.lr-wall { position: fixed; left: 0; right: 0; bottom: var(--fh); height: 2.6vh; background: linear-gradient(#0b0d13, #10131b); border-top: 1px solid rgba(255,255,255,.05); pointer-events: none; }
.lr-floor { position: fixed; left: 0; right: 0; bottom: 0; height: var(--fh); background: repeating-linear-gradient(90deg, rgba(255,255,255,.018) 0 1px, transparent 1px 120px), linear-gradient(#0e1017, #050507); border-top: 1px solid rgba(255,255,255,.06); pointer-events: none; }
.lr-floor::before { content: ""; position: absolute; inset: 0; background: linear-gradient(rgba(120,72,38,.26), rgba(50,28,14,.1)); opacity: 0; transition: opacity .8s; }
.lr.on .lr-floor::before { opacity: 1; }
.lr-pool { position: absolute; left: var(--lx); bottom: calc(var(--fh) - 9vh); width: calc(var(--lw) * 1.7); height: 11vh; transform: translateX(-50%); background: radial-gradient(ellipse at 50% 50%, rgba(255,200,110,.55), rgba(255,170,70,.16) 55%, transparent 72%); opacity: 0; transition: opacity .6s; filter: blur(4px); pointer-events: none; }
.lr.on .lr-pool { opacity: 1; }
.lr-lampwrap { position: absolute; inset: 0; }
.lr-lamp { position: absolute; bottom: var(--lb); width: var(--lw); left: var(--lx); transform: translateX(-50%); }
.lr-lamp svg { width: 100%; height: auto; overflow: visible; display: block; }
.lr-cone { position: absolute; top: calc(100vh - var(--lb) - var(--lw) * 1.867 + var(--lw) * .49); bottom: calc(var(--fh) - 7vh); left: var(--lx); width: calc(var(--lw) * 2.1); transform: translateX(-50%); clip-path: polygon(40% 0, 60% 0, 100% 100%, 0 100%); background: linear-gradient(rgba(255,205,120,.5), rgba(255,190,90,.08) 70%, transparent); opacity: 0; transition: opacity .5s ease; filter: blur(6px); pointer-events: none; }
.lr.on .lr-cone { opacity: 1; }
.lr-bulb { transition: opacity .4s, filter .4s; opacity: .15; }
.lr.on .lr-bulb { opacity: 1; filter: drop-shadow(0 0 14px #ffd27a) drop-shadow(0 0 34px #ff9d3c); }
.lr-cord { cursor: grab; touch-action: none; outline: none; }
.lr-cord:active { cursor: grabbing; }
.lr-cord:focus-visible .lr-bead { stroke: #fff; stroke-width: 2; }
.lr-bead { transition: filter .25s; }
.lr:not(.on) .lr-bead { animation: lr-bead 2.4s ease-in-out infinite; }
.lr-cord:hover .lr-bead { animation: none; filter: drop-shadow(0 0 10px #ffcf70); }
@keyframes lr-bead { 50% { filter: drop-shadow(0 0 9px rgba(255,207,112,.85)); } }
.lr-scene > * { position: absolute; opacity: 0; transition: opacity .9s ease .15s; pointer-events: none; }
.lr.on .lr-scene > * { opacity: 1; }
.lr-win { left: calc(var(--lx) - var(--lw) * .35 - 1.5vw - var(--bw) * .98); bottom: calc(var(--fh) - 6vh + var(--bw) * .66); width: calc(var(--bw) * .46); aspect-ratio: 200 / 280; height: auto; }
.lr-bed { left: calc(var(--lx) - var(--lw) * .35 - 1.5vw - var(--bw)); bottom: calc(var(--fh) - 8vh); width: var(--bw); filter: drop-shadow(0 0 26px rgba(255,160,70,.16)); }
.lr-rug { left: var(--lx); bottom: calc(var(--fh) - 10vh); width: calc(var(--lw) * 2.3); height: 12vh; transform: translateX(-50%); border-radius: 50%; background: radial-gradient(ellipse, rgba(176,92,52,.5), rgba(128,64,38,.32) 60%, transparent 72%); border: 1px solid rgba(240,170,110,.14); }
.lr-star { animation: lr-star 3.2s ease-in-out infinite; animation-delay: var(--sd); }
@keyframes lr-star { 50% { opacity: .25; } }
.lr-hint { position: absolute; left: var(--lx); transform: translateX(-50%); bottom: calc(var(--fh) * .32); font-size: 12px; letter-spacing: .18em; color: #8b94a6; transition: opacity .4s; white-space: nowrap; animation: lr-hint 2.4s ease-in-out infinite; }
.lr.on .lr-hint { opacity: 0; animation: none; }
@keyframes lr-hint { 50% { color: #ffd98a; } }
.lr-panel { position: relative; z-index: 2; pointer-events: none; padding: 4vh var(--pr) 4vh 2vw; display: flex; justify-content: flex-end; }
.lr-card { width: min(380px, 100%); padding: 38px 34px 30px; border-radius: 22px; background: rgba(18,20,28,.55); border: 1px solid rgba(255,255,255,.06); backdrop-filter: blur(14px); box-shadow: 0 30px 70px rgba(0,0,0,.55); transition: opacity .6s ease, filter .6s ease, box-shadow .6s ease, border-color .6s; opacity: .18; filter: blur(3px); pointer-events: none; }
.lr.on .lr-card { opacity: 1; filter: none; pointer-events: auto; border-color: rgba(255,205,120,.22); box-shadow: 0 30px 70px rgba(0,0,0,.55), 0 0 80px rgba(255,170,70,.12); }
.lr-card fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
.lr-label { display: block; font-size: 11px; letter-spacing: .2em; color: #8b94a6; font-weight: 700; margin: 16px 0 6px; text-transform: uppercase; }
.lr-input { width: 100%; padding: 13px 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,.1); background: rgba(0,0,0,.35); color: #fff; font-size: 14px; outline: 0; transition: border-color .2s, box-shadow .2s; }
.lr-input:focus { border-color: #ffcf70; box-shadow: 0 0 0 3px rgba(255,205,120,.14); }
.lr-go { margin-top: 26px; width: 100%; padding: 13px; border: 0; border-radius: 12px; font-weight: 800; letter-spacing: .25em; font-size: 13px; color: #1b1206; background: linear-gradient(135deg, #ffd98a, #ff9d3c); box-shadow: 0 10px 26px rgba(255,157,60,.3); cursor: pointer; }
.lr-go:disabled { opacity: .6; cursor: default; }
.lr-ff { position: fixed; left: 0; top: 0; border-radius: 50%; background: radial-gradient(circle, #fff6c9 0, #ffd36a 40%, transparent 70%); opacity: .35; transition: opacity .6s; pointer-events: none; animation: lr-ffmove var(--d) linear var(--delay) infinite, lr-twinkle 3s ease-in-out infinite; }
.lr.on .lr-ff { opacity: .9; }
@keyframes lr-ffmove { 0% { transform: translate(var(--x1), var(--y1)); } 25% { transform: translate(var(--x2), var(--y2)); } 50% { transform: translate(var(--x3), var(--y3)); } 75% { transform: translate(var(--x4), var(--y4)); } 100% { transform: translate(var(--x1), var(--y1)); } }
@keyframes lr-twinkle { 50% { filter: brightness(1.6); } }
.lr-back { position: fixed; top: 16px; left: 16px; z-index: 5; display: flex; align-items: center; gap: 6px; font-size: 13px; color: #8b94a6; text-decoration: none; }
.lr-back:hover { color: #fff; }
@media (max-width: 820px) {
  .lr { --lx: 50vw; --lw: min(190px, 48vw); --lt: 5vh; --fh: 0px; grid-template-columns: 1fr; grid-template-rows: auto auto; align-items: start; align-content: start; }
  .lr-lampwrap { position: relative; inset: auto; height: 46vh; }
  .lr-scene { display: none; }
  .lr-lamp { bottom: auto; top: var(--lt); }
  .lr-cone { top: calc(var(--lt) + var(--lw) * .49); bottom: auto; height: 60vh; width: 92vw; }
  .lr-pool, .lr-wall { display: none; }
  .lr-panel { justify-content: center; }
  .lr-panel { padding: 0 18px 40px; justify-content: center; }
  .lr-card { padding: 26px 22px 22px; }
  .lr-hint { bottom: 6px; }
  .lr-floor { display: none; }
}
@media (max-width: 1100px) and (min-width: 821px) { .lr-scene { display: none; } .lr { --lx: 38vw; } }
@media (prefers-reduced-motion: reduce) { .lr-star, .lr-ff, .lr:not(.on) .lr-bead, .lr-hint { animation: none; } }
`;

const rnd = (a, b) => a + Math.random() * (b - a);
const code = (e) => Number(/API Error: ([0-9]+)/.exec(e?.message || '')?.[1] || 0);
const AX = 196;   // cord anchor (svg units) and rest length
const AY = 140;
const LEN = 160;

export default function Login() {
  const { callApi, ServerWakeupOverlay } = useRenderApi();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [on, setOn] = useState(false);
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ username: '', password: '', name: '', phone: '' });
  const [showPw, setShowPw] = useState(false);
  const [msg, setMsg] = useState({ tone: '', text: '' });
  const [busy, setBusy] = useState(false);
  const idRef = useRef(null);
  const svgRef = useRef(null);
  const cordRef = useRef(null);
  const beadRef = useRef(null);
  const phys = useRef({ a: 0, av: 0, off: 0, ov: 0, drag: false, sy: 0, pulled: false });
  const onRef = useRef(false);
  onRef.current = on;

  const flies = useMemo(() => Array.from({ length: 21 }, () => {
    const s = rnd(4, 9);
    const v = { width: s, height: s, '--d': `${rnd(35, 65)}s`, '--delay': `-${rnd(0, 40)}s` };
    for (let n = 1; n <= 4; n++) { v[`--x${n}`] = `${rnd(0, 100)}vw`; v[`--y${n}`] = `${rnd(0, 100)}vh`; }
    return v;
  }), []);

  // cord physics loop
  useEffect(() => {
    let raf = 0;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const loop = (t) => {
      const p = phys.current;
      if (!reduce && !onRef.current && !p.drag) p.av += Math.sin(t / 1100) * 0.00022;     // slow idle sway while dark: the cord looks alive
      p.av += -p.a * 0.05; p.av *= 0.955; p.a = Math.max(-0.3, Math.min(0.3, p.a + p.av));
      if (!p.drag) { p.ov += -p.off * 0.18; p.ov *= 0.78; p.off += p.ov; if (Math.abs(p.off) < 0.05 && Math.abs(p.ov) < 0.05) p.off = 0; }
      const len = LEN + p.off, x2 = AX + Math.sin(p.a) * len, y2 = AY + Math.cos(p.a) * len;
      const bend = -p.av * 18;                                                               // the cord bows against its own motion
      cordRef.current?.setAttribute('d', `M${AX} ${AY} Q${AX + Math.sin(p.a) * len * 0.5 + bend} ${AY + len * 0.5} ${x2} ${y2}`);
      beadRef.current?.setAttribute('transform', `translate(${x2 - AX} ${y2 - AY - LEN})`);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => { if (on) { const t = setTimeout(() => idRef.current?.focus(), 450); return () => clearTimeout(t); } }, [on]);

  if (user) return <Navigate to="/news" replace />;

  const toggle = () => setOn((v) => !v);
  const svgY = (e) => { const r = svgRef.current.getBoundingClientRect(); return (e.clientY - r.top) * (560 / r.height); };
  const down = (e) => { const p = phys.current; p.drag = true; p.pulled = false; p.sy = svgY(e); e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e) => {
    const p = phys.current;
    if (!p.drag) { p.av += Math.max(-0.014, Math.min(0.014, e.movementX * 0.0012)); return; }   // sweeping the mouse over the cord makes it swing
    p.off = Math.max(0, Math.min(46, svgY(e) - p.sy)); if (p.off > 26) p.pulled = true;
  };
  const up = () => {
    const p = phys.current;
    if (!p.drag) return;
    p.drag = false; p.ov = 0;
    if (p.pulled || p.off < 6) { toggle(); if (!p.pulled) p.off = 22; }
  };
  const enter = (e) => { const r = e.currentTarget.getBoundingClientRect(); phys.current.av += (e.clientX < r.left + r.width / 2 ? 1 : -1) * 0.025; };   // first touch: a visible swing says "grab me"
  const key = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); phys.current.off = 30; toggle(); } };

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(f.username)) return setMsg({ tone: 'err', text: '아이디는 영문/숫자/밑줄 3~20자입니다.' });
    if (mode === 'signup') {
      if (f.password.length < 8) return setMsg({ tone: 'err', text: `비밀번호(PASSWORD 칸)는 8자 이상이어야 합니다. 지금 ${f.password.length}자입니다.` });
      if (!f.name.trim()) return setMsg({ tone: 'err', text: '이름을 입력하세요.' });
      if (!/^[0-9+\- ]{8,20}$/.test(f.phone.trim())) return setMsg({ tone: 'err', text: '연락처는 숫자(-, 공백, + 가능) 8자 이상으로 입력하세요.' });
    } else if (!f.password) return setMsg({ tone: 'err', text: '비밀번호를 입력하세요.' });
    setBusy(true); setMsg({ tone: '', text: '' });
    try {
      if (mode === 'signup') {
        await callApi('/api/auth/signup', { method: 'POST', body: JSON.stringify(f) });
        setMode('login'); setF({ ...f, password: '', name: '', phone: '' });
        setMsg({ tone: 'ok', text: '계정 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.' });
      } else {
        const r = await callApi('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: f.username, password: f.password }) });
        login(r.token, r.user);
        navigate('/news', { replace: true });
      }
    } catch (err) {
      const c = code(err);
      setMsg({ tone: 'err', text: c === 401 ? '아이디 또는 비밀번호가 올바르지 않습니다.' : c === 403 ? '승인 대기 중이거나 거절된 계정입니다.' : c === 409 ? '이미 사용 중인 아이디입니다.' : c === 422 ? '입력값을 확인하세요.' : c === 429 ? '시도 횟수 초과: 10분 후 다시 시도하세요.' : (err?.message || '요청 실패') });
    }
    setBusy(false);
  };

  return (
    <div className={`lr ${on ? 'on' : ''}`}>
      <style>{CSS}</style>
      <ServerWakeupOverlay />
      <Link to="/news" className="lr-back"><ArrowLeft size={15} />돌아가기</Link>
      <div className="lr-wall" />
      <div className="lr-floor" />
      {flies.map((s, i) => <span key={i} className="lr-ff" style={s} aria-hidden="true" />)}

      <div className="lr-scene" aria-hidden="true">
        <div className="lr-rug" />
        <svg className="lr-win" viewBox="0 0 200 280">
          <defs>
            <linearGradient id="lr-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#070d22" /><stop offset=".6" stopColor="#14254f" /><stop offset="1" stopColor="#25407a" /></linearGradient>
            <radialGradient id="lr-moonglow"><stop offset="0" stopColor="#fff6cf" stopOpacity=".55" /><stop offset="1" stopColor="#fff6cf" stopOpacity="0" /></radialGradient>
          </defs>
          <rect x="14" y="10" width="172" height="236" fill="url(#lr-sky)" />
          <circle className="lr-star" style={{ "--sd": "0.0s" }} cx="22" cy="30" r="1.7" fill="#fff" /><circle className="lr-star" style={{ "--sd": "0.7s" }} cx="50" cy="70" r="1.1" fill="#fff" /><circle className="lr-star" style={{ "--sd": "1.4s" }} cx="78" cy="24" r="1.1" fill="#fff" /><circle className="lr-star" style={{ "--sd": "2.1s" }} cx="30" cy="118" r="1.7" fill="#fff" /><circle className="lr-star" style={{ "--sd": "2.8s" }} cx="92" cy="96" r="1.1" fill="#fff" /><circle className="lr-star" style={{ "--sd": "0.5s" }} cx="66" cy="140" r="1.1" fill="#fff" /><circle className="lr-star" style={{ "--sd": "1.2s" }} cx="118" cy="34" r="1.7" fill="#fff" /><circle className="lr-star" style={{ "--sd": "1.9s" }} cx="160" cy="80" r="1.1" fill="#fff" /><circle className="lr-star" style={{ "--sd": "2.6s" }} cx="176" cy="128" r="1.1" fill="#fff" /><circle className="lr-star" style={{ "--sd": "0.3s" }} cx="144" cy="150" r="1.7" fill="#fff" /><circle className="lr-star" style={{ "--sd": "1.0s" }} cx="40" cy="170" r="1.1" fill="#fff" /><circle className="lr-star" style={{ "--sd": "1.7s" }} cx="104" cy="176" r="1.1" fill="#fff" />
          <circle cx="138" cy="62" r="46" fill="url(#lr-moonglow)" />
          <circle cx="138" cy="62" r="19" fill="#fff6cf" /><circle cx="147" cy="55" r="17" fill="#17295a" />
          <path d="M14 214 Q56 176 98 204 T186 190 V246 H14 Z" fill="#050914" />
          <path d="M14 232 Q70 208 120 226 T186 218 V246 H14 Z" fill="#0b1226" />
          <rect x="10" y="6" width="180" height="244" fill="none" stroke="#8a5632" strokeWidth="9" rx="3" />
          <rect x="96" y="10" width="8" height="236" fill="#8a5632" /><rect x="14" y="120" width="172" height="8" fill="#8a5632" />
          <rect x="2" y="248" width="196" height="12" rx="3" fill="#a8693a" />
          <path d="M14 10 Q40 90 22 246 H14 Z" fill="#f0a35e" opacity=".92" /><path d="M186 10 Q160 90 178 246 H186 Z" fill="#f0a35e" opacity=".92" />
        </svg>
        <img className="lr-bed" src={bedImg} alt="" draggable="false" />
      </div>
      <div className="lr-lampwrap">
        <div className="lr-cone" />
        <div className="lr-pool" />
        <div className="lr-lamp">
          <svg ref={svgRef} viewBox="0 0 300 560">
            <defs>
              <linearGradient id="lr-shade" x1="0" x2="1"><stop offset="0" stopColor="#2a2d38" /><stop offset=".5" stopColor="#3a3e4c" /><stop offset="1" stopColor="#20232d" /></linearGradient>
              <linearGradient id="lr-pole" x1="0" x2="1"><stop offset="0" stopColor="#1c1f27" /><stop offset=".5" stopColor="#363a47" /><stop offset="1" stopColor="#171a21" /></linearGradient>
            </defs>
            <ellipse cx="150" cy="536" rx="92" ry="10" fill="rgba(0,0,0,.65)" style={{ filter: 'blur(5px)' }} />
            <rect x="146" y="150" width="8" height="368" rx="4" fill="url(#lr-pole)" />
            <ellipse cx="150" cy="528" rx="62" ry="12" fill="#14161c" /><ellipse cx="150" cy="522" rx="62" ry="12" fill="#262a35" />
            <path d="M78 140 Q150 40 222 140 Z" fill="url(#lr-shade)" />
            <ellipse cx="150" cy="140" rx="72" ry="10" fill="#171a21" />
            <g className="lr-bulb"><ellipse cx="150" cy="150" rx="13" ry="17" fill="#ffe3a0" /><ellipse cx="150" cy="146" rx="6" ry="8" fill="#fff8e0" /></g>
            <g className="lr-cord" tabIndex={0} role="switch" aria-checked={on} aria-label="램프 줄 당기기"
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerEnter={enter} onKeyDown={key}>
              <rect x="150" y="150" width="90" height="360" fill="transparent" />
              <path ref={cordRef} d={`M${AX} ${AY} L${AX} ${AY + LEN}`} stroke="#8a8f9d" strokeWidth="3" strokeLinecap="round" fill="none" />
              <ellipse ref={beadRef} className="lr-bead" cx={AX} cy={AY + LEN + 6} rx="7" ry="11" fill="#ffcf70" />
            </g>
          </svg>
        </div>
        <div className="lr-hint">줄을 당겨 불을 켜세요</div>
      </div>

      <div className="lr-panel">
        <form className="lr-card" onSubmit={submit} aria-hidden={!on}>
          <fieldset disabled={!on || busy}>
            <h1 style={{ margin: '0 0 4px', fontSize: 26, letterSpacing: '.14em', fontWeight: 900 }}>QUANT DESK</h1>
            <p style={{ margin: '0 0 26px', fontSize: 11, letterSpacing: '.3em', color: '#ffcf70', fontWeight: 700 }}>{mode === 'login' ? 'SECURE INVESTMENT PLATFORM' : 'REQUEST AN ACCOUNT'}</p>
            <label className="lr-label" htmlFor="lg-id">Username</label>
            <input id="lg-id" ref={idRef} className="lr-input" autoComplete="username" autoCapitalize="none" value={f.username} onChange={set('username')} />
            <label className="lr-label" htmlFor="lg-pw">Password</label>
            <div style={{ position: 'relative' }}>
              <input id="lg-pw" className="lr-input" style={{ paddingRight: 44 }} type={showPw ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={f.password} onChange={set('password')} />
              <button type="button" tabIndex={-1} aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'} onClick={() => setShowPw((v) => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, color: '#8b94a6', cursor: 'pointer' }}>
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {mode === 'signup' && (
              <>
                <label className="lr-label" htmlFor="lg-name">Name</label>
                <input id="lg-name" className="lr-input" autoComplete="name" value={f.name} onChange={set('name')} />
                <label className="lr-label" htmlFor="lg-phone">Phone</label>
                <input id="lg-phone" className="lr-input" inputMode="tel" autoComplete="tel" placeholder="010-0000-0000" value={f.phone} onChange={set('phone')} />
              </>
            )}
            {msg.text && <p style={{ margin: '16px 0 0', padding: '8px 12px', borderRadius: 12, fontSize: 12.5, fontWeight: 600, border: '1px solid', color: msg.tone === 'ok' ? '#a7f3d0' : '#fecaca', background: msg.tone === 'ok' ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)', borderColor: msg.tone === 'ok' ? 'rgba(52,211,153,.4)' : 'rgba(248,113,113,.4)' }}>{msg.text}</p>}
            <button type="submit" className="lr-go">{busy ? '...' : mode === 'login' ? 'ENTER SYSTEM' : '계정 신청'}</button>
            <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg({ tone: '', text: '' }); }} style={{ marginTop: 16, width: '100%', background: 'none', border: 0, textAlign: 'center', fontSize: 12.5, color: '#8b94a6', cursor: 'pointer' }}>
              {mode === 'login' ? '계정이 없나요? 계정 신청' : '로그인으로 돌아가기'}
            </button>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
