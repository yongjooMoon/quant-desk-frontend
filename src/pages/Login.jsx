// src/pages/Login.jsx - night-room login: the room is dark until the desk lamp is switched on (click / Enter on the lamp); the light spreads from the lamp, the trading laptop lights up and the form becomes usable.
// Also the account request form. Backend: quant-desk-backend/auth_api.py. Scene image: src/assets/room-night.webp (1449x1085, cover-fitted; hotspot coordinates are image pixels mapped with the same cover math).
import { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useRenderApi } from '../hooks/useRenderApi';
import { useAuth } from '../auth';
import roomImg from '../assets/room-night.webp';

// "아이디 저장": only the username is kept, in a browser cookie (1 year). The password is never stored.
const SAVED_ID_COOKIE = 'qd_saved_id';
const readSavedId = () => {
  try {
    const m = document.cookie.split('; ').find((c) => c.startsWith(SAVED_ID_COOKIE + '='));
    const v = m ? decodeURIComponent(m.slice(SAVED_ID_COOKIE.length + 1)) : '';
    return /^[A-Za-z0-9_]{3,20}$/.test(v) ? v : '';
  } catch { return ''; }
};
const writeSavedId = (id) => { try { document.cookie = `${SAVED_ID_COOKIE}=${encodeURIComponent(id)}; max-age=31536000; path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`; } catch { /* cookies blocked: login still works */ } };
const clearSavedId = () => { try { document.cookie = `${SAVED_ID_COOKIE}=; max-age=0; path=/; SameSite=Lax`; } catch { /* ignore */ } };

const IW = 1449, IH = 1085;          // scene image size
const FX = 0.45, FY = 0.5;           // which part of the image stays centered when the viewport crops it (lamp + laptop side)
const LAMP = { x: 518, y: 388 };     // lamp shade, image pixels
const SCREEN = { x: 746, y: 503 };   // laptop screen, image pixels

const coverGeo = () => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const sc = Math.max(vw / IW, vh / IH);
  return { sc, ox: -(IW * sc - vw) * FX, oy: -(IH * sc - vh) * FY };
};

const CSS = `
.lr { position: fixed; inset: 0; z-index: 60; overflow: hidden auto; color: #eef2f7; background: #04050a; }
.lr-bg { position: fixed; inset: 0; background-repeat: no-repeat; filter: brightness(.13) saturate(.5) contrast(1.05); transition: filter 1.5s ease .35s; }
.lr.on .lr-bg { filter: brightness(1) saturate(1.04) contrast(1); }
.lr-glow { position: fixed; width: 170vmax; height: 170vmax; border-radius: 50%; transform: translate(-50%, -50%) scale(0); transition: transform 1.7s cubic-bezier(.2,.7,.2,1), opacity 1s ease; opacity: 0; pointer-events: none; mix-blend-mode: screen;
  background: radial-gradient(circle, rgba(255,196,110,.50) 0, rgba(255,160,70,.16) 9%, rgba(255,140,60,.05) 20%, transparent 36%); }
.lr.on .lr-glow { transform: translate(-50%, -50%) scale(1); opacity: 1; }
.lr-screen { position: fixed; border-radius: 50%; transform: translate(-50%, -50%); pointer-events: none; mix-blend-mode: screen; opacity: 0; transition: opacity 1.4s ease .9s;
  background: radial-gradient(ellipse, rgba(120,200,255,.28) 0, rgba(80,160,255,.10) 45%, transparent 72%); animation: lr-pulse 5s ease-in-out infinite; }
.lr.on .lr-screen { opacity: 1; }
@keyframes lr-pulse { 50% { filter: brightness(1.35); } }
.lr-vig { position: fixed; inset: 0; pointer-events: none; background: radial-gradient(ellipse at 45% 50%, transparent 55%, rgba(2,3,8,.55) 100%); }
.lr-lamp { position: fixed; width: 78px; height: 78px; transform: translate(-50%, -50%); border-radius: 50%; border: 0; padding: 0; background: transparent; cursor: pointer; outline: none; z-index: 3; }
.lr-lamp::before { content: ""; position: absolute; inset: 14px; border-radius: 50%; border: 2px solid rgba(255,207,112,.9); box-shadow: 0 0 22px rgba(255,170,70,.65); opacity: .0; }
.lr:not(.on) .lr-lamp::before { animation: lr-ring 2.2s ease-in-out infinite; }
.lr-lamp:hover::before, .lr-lamp:focus-visible::before { opacity: 1; animation: none; }
@keyframes lr-ring { 0% { opacity: .15; transform: scale(.75); } 55% { opacity: .95; transform: scale(1.1); } 100% { opacity: .15; transform: scale(.75); } }
.lr-hint { position: fixed; left: 0; right: 0; bottom: 5vh; text-align: center; pointer-events: none; font-size: 12px; letter-spacing: .28em; color: #ffd98a; text-shadow: 0 0 14px rgba(255,170,70,.55); transition: opacity .5s; animation: lr-hint 2.6s ease-in-out infinite; }
.lr.on .lr-hint { opacity: 0; animation: none; }
@keyframes lr-hint { 50% { opacity: .45; } }
.lr-panel { position: relative; z-index: 2; pointer-events: none; min-height: 100vh; padding: 4vh 6vw; display: flex; justify-content: flex-end; align-items: center; }
.lr-card { width: min(380px, 100%); padding: 38px 34px 30px; border-radius: 22px; background: rgba(10,12,20,.62); border: 1px solid rgba(255,255,255,.07); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); box-shadow: 0 30px 70px rgba(0,0,0,.55); transition: opacity .8s ease .5s, filter .8s ease .5s, box-shadow .8s ease .5s, border-color .8s ease .5s; opacity: .0; filter: blur(4px); pointer-events: none; }
.lr.on .lr-card { opacity: 1; filter: none; pointer-events: auto; border-color: rgba(255,205,120,.24); box-shadow: 0 30px 70px rgba(0,0,0,.55), 0 0 80px rgba(255,170,70,.12); }
.lr-card fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
.lr-label { display: block; font-size: 11px; letter-spacing: .2em; color: #9aa3b5; font-weight: 700; margin: 16px 0 6px; text-transform: uppercase; }
.lr-input { width: 100%; padding: 13px 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,.12); background: rgba(0,0,0,.4); color: #fff; font-size: 14px; outline: 0; transition: border-color .2s, box-shadow .2s; }
.lr-input:focus { border-color: #ffcf70; box-shadow: 0 0 0 3px rgba(255,205,120,.14); }
.lr-check { display: flex; align-items: center; gap: 8px; margin-top: 14px; font-size: 12.5px; color: #9aa3b5; cursor: pointer; user-select: none; }
.lr-check input { width: 15px; height: 15px; margin: 0; accent-color: #ffcf70; cursor: pointer; }
.lr-go { margin-top: 26px; width: 100%; padding: 13px; border: 0; border-radius: 12px; font-weight: 800; letter-spacing: .25em; font-size: 13px; color: #1b1206; background: linear-gradient(135deg, #ffd98a, #ff9d3c); box-shadow: 0 10px 26px rgba(255,157,60,.3); cursor: pointer; }
.lr-go:disabled { opacity: .6; cursor: default; }
.lr-back { position: fixed; top: 16px; left: 16px; z-index: 5; display: flex; align-items: center; gap: 6px; font-size: 13px; color: #aab2c2; text-decoration: none; text-shadow: 0 1px 8px rgba(0,0,0,.8); }
.lr-back:hover { color: #fff; }
@media (max-width: 820px) {
  .lr-panel { justify-content: center; align-items: flex-end; padding: 0 16px 28px; }
  .lr-card { padding: 26px 22px 22px; }
  .lr-hint { bottom: 3vh; }
}
@media (prefers-reduced-motion: reduce) { .lr-bg, .lr-glow, .lr-screen, .lr-card { transition-duration: .01s; transition-delay: 0s; } .lr-screen, .lr:not(.on) .lr-lamp::before, .lr-hint { animation: none; } }
`;

const code = (e) => Number(/API Error: ([0-9]+)/.exec(e?.message || '')?.[1] || 0);

export default function Login() {
  const { callApi, ServerWakeupOverlay } = useRenderApi();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [on, setOn] = useState(false);
  const [mode, setMode] = useState('login');
  const [f, setF] = useState(() => ({ username: readSavedId(), password: '', name: '', phone: '' }));
  const [saveId, setSaveId] = useState(() => !!readSavedId());
  const [showPw, setShowPw] = useState(false);
  const [msg, setMsg] = useState({ tone: '', text: '' });
  const [busy, setBusy] = useState(false);
  const [geo, setGeo] = useState(coverGeo);
  const idRef = useRef(null);
  const pwRef = useRef(null);

  useEffect(() => {
    const h = () => setGeo(coverGeo());
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => { if (on) { const t = setTimeout(() => (readSavedId() ? pwRef : idRef).current?.focus(), 900); return () => clearTimeout(t); } }, [on]);   // a remembered id: start on the password

  if (user) return <Navigate to="/news" replace />;

  const px = (p) => ({ left: geo.ox + p.x * geo.sc, top: geo.oy + p.y * geo.sc });
  const lamp = px(LAMP), screen = px(SCREEN);

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
        if (saveId) writeSavedId(f.username); else clearSavedId();
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

      <div className="lr-bg" aria-hidden="true" style={{ backgroundImage: `url(${roomImg})`, backgroundSize: `${IW * geo.sc}px ${IH * geo.sc}px`, backgroundPosition: `${geo.ox}px ${geo.oy}px` }} />
      <div className="lr-glow" aria-hidden="true" style={lamp} />
      <div className="lr-screen" aria-hidden="true" style={{ ...screen, width: 300 * geo.sc, height: 190 * geo.sc }} />
      <div className="lr-vig" aria-hidden="true" />
      <button type="button" className="lr-lamp" style={lamp} role="switch" aria-checked={on} aria-label={on ? '램프 끄기' : '램프 켜기'} onClick={() => setOn((v) => !v)} />
      <div className="lr-hint">램프를 눌러 불을 켜세요</div>

      <div className="lr-panel">
        <form className="lr-card" onSubmit={submit} aria-hidden={!on}>
          <fieldset disabled={!on || busy}>
            <h1 style={{ margin: '0 0 4px', fontSize: 26, letterSpacing: '.14em', fontWeight: 900 }}>QUANT DESK</h1>
            <p style={{ margin: '0 0 26px', fontSize: 11, letterSpacing: '.3em', color: '#ffcf70', fontWeight: 700 }}>{mode === 'login' ? 'SECURE INVESTMENT PLATFORM' : 'REQUEST AN ACCOUNT'}</p>
            <label className="lr-label" htmlFor="lg-id">Username</label>
            <input id="lg-id" ref={idRef} className="lr-input" autoComplete="username" autoCapitalize="none" value={f.username} onChange={set('username')} />
            <label className="lr-label" htmlFor="lg-pw">Password</label>
            <div style={{ position: 'relative' }}>
              <input id="lg-pw" ref={pwRef} className="lr-input" style={{ paddingRight: 44 }} type={showPw ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={f.password} onChange={set('password')} />
              <button type="button" tabIndex={-1} aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'} onClick={() => setShowPw((v) => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, color: '#8b94a6', cursor: 'pointer' }}>
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {mode === 'login' && (
              <label className="lr-check" htmlFor="lg-save">
                <input id="lg-save" type="checkbox" checked={saveId} onChange={(e) => { setSaveId(e.target.checked); if (!e.target.checked) clearSavedId(); }} />
                아이디 저장
              </label>
            )}
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
            <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg({ tone: '', text: '' }); }} style={{ marginTop: 16, width: '100%', background: 'none', border: 0, textAlign: 'center', fontSize: 12.5, color: '#9aa3b5', cursor: 'pointer' }}>
              {mode === 'login' ? '계정이 없나요? 계정 신청' : '로그인으로 돌아가기'}
            </button>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
