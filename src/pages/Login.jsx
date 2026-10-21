// src/pages/Login.jsx - lamp login: pull the lamp cord to light the room, then the form is usable. Also the account request form. Backend: quant-desk-backend/auth_api.py
// The cord is a damped pendulum (sways when the mouse touches it, hangs with a slow idle sway while the lamp is off) plus a pull spring; both are animated through refs (no React re-render per frame).
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useRenderApi } from '../hooks/useRenderApi';
import { useAuth } from '../auth';

const CSS = `
.lr { --lw: min(300px, 38vw); --lt: 9vh; position: fixed; inset: 0; z-index: 60; overflow: hidden auto; color: #eef2f7; background: radial-gradient(ellipse at 28% 35%, #0d0f16 0%, #06070b 70%); display: grid; grid-template-columns: 1fr 1fr; align-items: center; }
.lr::before { content: ""; position: fixed; inset: 0; background: radial-gradient(ellipse 60% 70% at 28% 40%, rgba(255,190,90,.22), transparent 70%); opacity: 0; transition: opacity .6s ease; pointer-events: none; }
.lr.on::before { opacity: 1; }
.lr-floor { position: fixed; left: 0; right: 0; bottom: 0; height: 16vh; background: linear-gradient(#0a0b10, #050507); border-top: 1px solid rgba(255,255,255,.04); pointer-events: none; }
.lr-floor::after { content: ""; position: absolute; left: 8%; width: 40%; top: 0; height: 100%; background: radial-gradient(ellipse at 50% 0, rgba(255,190,90,.22), transparent 70%); opacity: 0; transition: opacity .6s; }
.lr.on .lr-floor::after { opacity: 1; }
.lr-lampwrap { position: relative; height: 100vh; display: flex; justify-content: center; }
.lr-lamp { position: absolute; top: var(--lt); width: var(--lw); left: 50%; transform: translateX(-50%); }
.lr-lamp svg { width: 100%; height: auto; overflow: visible; display: block; }
.lr-cone { position: absolute; top: calc(var(--lt) + var(--lw) * .49); left: 50%; width: min(620px, 78vw); height: 70vh; transform: translateX(-50%); clip-path: polygon(40% 0, 60% 0, 100% 100%, 0 100%); background: linear-gradient(rgba(255,205,120,.5), rgba(255,190,90,.08) 70%, transparent); opacity: 0; transition: opacity .5s ease; filter: blur(6px); pointer-events: none; }
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
.lr-hint { position: absolute; left: 50%; transform: translateX(-50%); bottom: calc(16vh + 14px); font-size: 12px; letter-spacing: .18em; color: #8b94a6; transition: opacity .4s; white-space: nowrap; animation: lr-hint 2.4s ease-in-out infinite; }
.lr.on .lr-hint { opacity: 0; animation: none; }
@keyframes lr-hint { 50% { color: #ffd98a; } }
.lr-panel { position: relative; z-index: 2; padding: 4vh 8vw 4vh 2vw; display: flex; justify-content: flex-start; }
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
  .lr { --lw: min(190px, 48vw); --lt: 5vh; grid-template-columns: 1fr; grid-template-rows: auto auto; align-items: start; }
  .lr-lampwrap { height: 46vh; }
  .lr-cone { height: 60vh; width: 92vw; }
  .lr-panel { padding: 0 18px 40px; justify-content: center; }
  .lr-card { padding: 26px 22px 22px; }
  .lr-hint { bottom: 6px; }
  .lr-floor { display: none; }
}
@media (prefers-reduced-motion: reduce) { .lr-ff, .lr:not(.on) .lr-bead, .lr-hint { animation: none; } }
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

  const flies = useMemo(() => Array.from({ length: 18 }, () => {
    const s = rnd(3, 7);
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
      if (!reduce && !onRef.current && !p.drag) p.av += Math.sin(t / 1100) * 0.0006;     // slow idle sway while dark: the cord looks alive
      p.av += -p.a * 0.05; p.av *= 0.968; p.a = Math.max(-0.6, Math.min(0.6, p.a + p.av));
      if (!p.drag) { p.ov += -p.off * 0.18; p.ov *= 0.78; p.off += p.ov; if (Math.abs(p.off) < 0.05 && Math.abs(p.ov) < 0.05) p.off = 0; }
      const len = LEN + p.off, x2 = AX + Math.sin(p.a) * len, y2 = AY + Math.cos(p.a) * len;
      const bend = -p.av * 34;                                                               // the cord bows against its own motion
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
    if (!p.drag) { p.av += Math.max(-0.05, Math.min(0.05, e.movementX * 0.004)); return; }   // sweeping the mouse over the cord makes it swing
    p.off = Math.max(0, Math.min(46, svgY(e) - p.sy)); if (p.off > 26) p.pulled = true;
  };
  const up = () => {
    const p = phys.current;
    if (!p.drag) return;
    p.drag = false; p.ov = 0;
    if (p.pulled || p.off < 6) { toggle(); if (!p.pulled) p.off = 22; }
  };
  const enter = (e) => { const r = e.currentTarget.getBoundingClientRect(); phys.current.av += (e.clientX < r.left + r.width / 2 ? 1 : -1) * 0.07; };   // first touch: a visible swing says "grab me"
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
      <div className="lr-floor" />
      {flies.map((s, i) => <span key={i} className="lr-ff" style={s} aria-hidden="true" />)}

      <div className="lr-lampwrap">
        <div className="lr-cone" />
        <div className="lr-lamp">
          <svg ref={svgRef} viewBox="0 0 300 560">
            <defs>
              <linearGradient id="lr-shade" x1="0" x2="1"><stop offset="0" stopColor="#2a2d38" /><stop offset=".5" stopColor="#3a3e4c" /><stop offset="1" stopColor="#20232d" /></linearGradient>
              <linearGradient id="lr-pole" x1="0" x2="1"><stop offset="0" stopColor="#1c1f27" /><stop offset=".5" stopColor="#363a47" /><stop offset="1" stopColor="#171a21" /></linearGradient>
            </defs>
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
