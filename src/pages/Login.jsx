// src/pages/Login.jsx - login / account request page (aurora glass style and yeti mascot of the old Streamlit dashboard). Backend: quant-desk-backend/auth_api.py
import { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useRenderApi } from '../hooks/useRenderApi';
import { useAuth } from '../auth';
import YetiSvg from '../components/YetiSvg';

const CSS = `
#yeti-wrap .armL, #yeti-wrap .armR { transition: transform .45s cubic-bezier(.25,.46,.45,.94); transform-box: fill-box; }
#yeti-wrap .armL { transform-origin: top left; transform: translate(-93px,180px) rotate(105deg); }
#yeti-wrap .armR { transform-origin: top right; transform: translate(-93px,180px) rotate(-105deg); }
#yeti-wrap.yeti-hide .armL { transform: translate(-93px,10px) rotate(0deg); }
#yeti-wrap.yeti-hide .armR { transform: translate(-93px,10px) rotate(0deg); transition-delay: .05s; }
#yeti-wrap .twoFingers { transform-origin: bottom left; transform-box: fill-box; transition: transform .3s ease-in-out; }
#yeti-wrap.yeti-peek .twoFingers { transform: translate(-16px,-12px) rotate(42deg); }
`;
// Falling snow on a canvas (fits the yeti): ~110 flakes with their own size, speed and sway; static when the visitor prefers reduced motion.
function Snow() {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv.getContext('2d');
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, raf = 0;
    const flakes = Array.from({ length: 110 }, () => ({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 3.2, v: 0.25 + Math.random() * 0.9, p: Math.random() * 6.28, s: 0.4 + Math.random() * 0.8 }));
    const size = () => { const d = window.devicePixelRatio || 1; w = cv.clientWidth; h = cv.clientHeight; cv.width = w * d; cv.height = h * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    const draw = (t) => {
      ctx.clearRect(0, 0, w, h);
      for (const f of flakes) {
        if (!still) { f.y += (f.v * 0.0016) * (f.r / 2 + 0.6); if (f.y > 1.02) { f.y = -0.02; f.x = Math.random(); } }
        const x = f.x * w + Math.sin(t / 1000 * f.s + f.p) * 18 * f.s;
        ctx.beginPath(); ctx.arc(x, f.y * h, f.r, 0, 6.283);
        ctx.fillStyle = `rgba(255,255,255,${0.55 + f.r / 8})`; ctx.shadowColor = 'rgba(120,170,220,.55)'; ctx.shadowBlur = 4; ctx.fill();
      }
      if (!still) raf = requestAnimationFrame(draw);
    };
    size(); window.addEventListener('resize', size); raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />;
}

const FIELD = 'w-full rounded-xl px-4 py-3 text-[14px] text-slate-900 dark:text-white bg-white/80 dark:bg-black/25 border border-slate-300 dark:border-white/10 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#20C997] transition-colors';
const LABEL = 'block text-[11px] font-bold tracking-[2px] uppercase text-slate-500 dark:text-slate-400 mb-1.5';

const code = (e) => Number(/API Error: ([0-9]+)/.exec(e?.message || '')?.[1] || 0);

export default function Login() {
  const { callApi, ServerWakeupOverlay } = useRenderApi();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ username: '', password: '', name: '', phone: '' });
  const [focus, setFocus] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [peek, setPeek] = useState(false);
  const [msg, setMsg] = useState({ tone: '', text: '' });
  const [busy, setBusy] = useState(false);
  const peekTimer = useRef(null);
  useEffect(() => () => clearTimeout(peekTimer.current), []);

  if (user) return <Navigate to="/news" replace />;

  const set = (k) => (e) => {
    const v = e.target.value;
    if (k === 'password' && v.length < f.password.length && !showPw) {      // deleting while the eyes are covered: peek through the fingers
      setPeek(true); clearTimeout(peekTimer.current); peekTimer.current = setTimeout(() => setPeek(false), 1200);
    } else if (k === 'password') setPeek(false);
    setF((s) => ({ ...s, [k]: v }));
  };
  const tracked = focus === 'username' ? f.username : focus === 'password' && showPw ? f.password : '';
  const eyesX = (Math.min(tracked.length, 25) / 25) * 18 - 9 || 0;
  const hide = focus === 'password' && !showPw;

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
    <div className="fixed inset-0 z-[60] overflow-y-auto overflow-x-hidden bg-gradient-to-b from-[#c9e2f3] to-[#eef7fd] dark:from-[#06101f] dark:to-[#17324f] flex items-center justify-center p-4 transition-colors duration-300">
      <style>{CSS}</style>
      <ServerWakeupOverlay />
      <Link to="/news" className="absolute top-4 left-4 z-20 flex items-center gap-1.5 text-[13px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"><ArrowLeft size={15} />돌아가기</Link>
      <Snow />
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -bottom-24 -left-16 w-[70%] h-48 rounded-[50%] bg-[#eaf3fa] blur-[2px]" />
        <div className="absolute -bottom-28 -right-20 w-[75%] h-52 rounded-[50%] bg-[#f6fbff] blur-[2px]" />
      </div>

      <form onSubmit={submit} className="relative z-10 w-[360px] max-w-full rounded-3xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-slate-900/40 backdrop-blur-2xl px-7 sm:px-10 pt-8 pb-7 shadow-[0_30px_60px_rgba(15,23,42,.15)] dark:shadow-[0_30px_60px_rgba(0,0,0,.5)]">
        <div id="yeti-wrap" className={`text-center mb-6 ${hide ? 'yeti-hide' : ''} ${peek ? 'yeti-peek' : ''}`}>
          <div className="flex justify-center"><YetiSvg eyesX={eyesX} /></div>
          <h2 className="mt-5 mb-1 text-[28px] font-black tracking-[5px] text-slate-900 dark:text-white">QUANT DESK</h2>
          <p className="text-[11px] font-bold tracking-[4px] text-[#20C997]">{mode === 'login' ? 'SECURE INVESTMENT PLATFORM' : 'REQUEST AN ACCOUNT'}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className={LABEL} htmlFor="lg-id">Username</label>
            <input id="lg-id" className={FIELD} autoComplete="username" autoCapitalize="none" value={f.username} onChange={set('username')} onFocus={() => setFocus('username')} onBlur={() => setFocus('')} />
          </div>
          <div>
            <label className={LABEL} htmlFor="lg-pw">Password</label>
            <div className="relative">
              <input id="lg-pw" className={`${FIELD} pr-11`} type={showPw ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={f.password} onChange={set('password')} onFocus={() => setFocus('password')} onBlur={() => setFocus('')} />
              <button type="button" tabIndex={-1} aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'} onMouseDown={(e) => e.preventDefault()} onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer">
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>
          {mode === 'signup' && (
            <>
              <div><label className={LABEL} htmlFor="lg-name">Name</label><input id="lg-name" className={FIELD} autoComplete="name" value={f.name} onChange={set('name')} /></div>
              <div><label className={LABEL} htmlFor="lg-phone">Phone</label><input id="lg-phone" className={FIELD} inputMode="tel" autoComplete="tel" placeholder="010-0000-0000" value={f.phone} onChange={set('phone')} /></div>
            </>
          )}
        </div>

        {msg.text && <p className={`mt-4 rounded-xl px-3 py-2 text-[12.5px] font-semibold border ${msg.tone === 'ok' ? 'text-emerald-700 dark:text-emerald-200 bg-emerald-500/10 border-emerald-500/40' : 'text-red-700 dark:text-red-200 bg-red-500/10 border-red-500/40'}`}>{msg.text}</p>}

        <button type="submit" disabled={busy} className="mt-6 w-full rounded-xl py-3 text-[14px] font-extrabold tracking-[3px] text-white cursor-pointer disabled:opacity-60 transition-transform hover:-translate-y-0.5" style={{ background: 'linear-gradient(135deg,#20C997 0%,#007BFF 100%)', boxShadow: '0 10px 20px rgba(32,201,151,.25)' }}>
          {busy ? '...' : mode === 'login' ? 'ENTER SYSTEM' : '계정 신청'}
        </button>
        <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg({ tone: '', text: '' }); }} className="mt-4 w-full text-center text-[12.5px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer">
          {mode === 'login' ? '계정이 없나요? 계정 신청' : '로그인으로 돌아가기'}
        </button>
      </form>
    </div>
  );
}
