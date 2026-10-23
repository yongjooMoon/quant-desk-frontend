// src/pages/AccountModal.jsx - "my account" popup (every logged-in user): edit name / phone (the id is fixed) and change the password
// (current password + new password twice; the current one is checked against the server while typing). Backend: auth_api.py (/api/auth/me*).
import { useState, useEffect, useRef } from 'react';
import { Modal, Button } from '../components';
import { useRenderApi } from '../hooks/useRenderApi';
import { useAuth } from '../auth';

const INPUT = 'w-full min-w-0 px-2.5 py-2 rounded-md text-[13.5px] bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-400 disabled:opacity-60';

function Field({ label, children, hint, tone }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[11.5px] text-slate-500 dark:text-slate-400 mb-1">{label}</span>
      {children}
      {hint && <span className={`block text-[11.5px] mt-1 ${tone === 'ok' ? 'text-positive' : tone === 'bad' ? 'text-negative' : 'text-slate-400'}`}>{hint}</span>}
    </label>
  );
}

const status = (e) => { const m = /API Error: ([0-9]+)/.exec(e?.message || ''); return m ? Number(m[1]) : 0; };

export default function AccountModal({ open, onClose }) {
  const { callApi } = useRenderApi();
  const { token, user, login, logout, headers } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileMsg, setProfileMsg] = useState({ tone: '', text: '' });
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [curState, setCurState] = useState('idle');           // idle | checking | ok | bad | locked
  const [pwMsg, setPwMsg] = useState({ tone: '', text: '' });
  const [busy, setBusy] = useState('');
  const seq = useRef(0);

  useEffect(() => {      // load the account when the popup opens
    if (!open || !token) return;
    setCur(''); setNext(''); setAgain(''); setCurState('idle'); setPwMsg({ tone: '', text: '' }); setProfileMsg({ tone: '', text: '' });
    setName(user?.name || ''); setPhone(user?.phone || '');
    callApi('/api/auth/me', { headers })
      .then((r) => { setName(r.user.name || ''); setPhone(r.user.phone || ''); })
      .catch((e) => { if (status(e) === 401) logout(); });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {      // check the current password 0.7 s after the typing stops (only from 8 characters, the minimum length)
    if (!open) return undefined;
    if (cur.length < 8) { setCurState('idle'); return undefined; }
    setCurState('checking');
    const my = ++seq.current;
    const t = setTimeout(() => {
      callApi('/api/auth/me/verify-password', { method: 'POST', headers, body: JSON.stringify({ password: cur }), background: true })
        .then((r) => { if (my === seq.current) setCurState(r.ok ? 'ok' : 'bad'); })
        .catch((e) => { if (my !== seq.current) return; if (status(e) === 401) logout(); else setCurState(status(e) === 429 ? 'locked' : 'idle'); });
    }, 700);
    return () => clearTimeout(t);
  }, [cur, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy('profile'); setProfileMsg({ tone: '', text: '' });
    try {
      const r = await callApi('/api/auth/me', { method: 'PUT', headers, body: JSON.stringify({ name: name.trim(), phone: phone.trim() }) });
      login(token, { ...user, name: r.user.name, phone: r.user.phone });
      setProfileMsg({ tone: 'ok', text: '저장했습니다.' });
    } catch (e2) {
      const c = status(e2);
      setProfileMsg({ tone: 'bad', text: c === 422 ? '이름 또는 전화번호 형식이 올바르지 않습니다.' : c === 401 ? '로그인이 만료되었습니다.' : '저장하지 못했습니다.' });
      if (c === 401) logout();
    }
    setBusy('');
  };

  const nextTooShort = next.length > 0 && next.length < 8;
  const mismatch = again.length > 0 && next !== again;
  const sameAsCur = next.length > 0 && next === cur;
  const canChange = curState === 'ok' && next.length >= 8 && next === again && !sameAsCur && !busy;

  const changePw = async (e) => {
    e.preventDefault();
    if (!canChange) return;
    setBusy('pw'); setPwMsg({ tone: '', text: '' });
    try {
      await callApi('/api/auth/me/password', { method: 'POST', headers, body: JSON.stringify({ current_password: cur, new_password: next }) });
      setCur(''); setNext(''); setAgain(''); setCurState('idle');
      setPwMsg({ tone: 'ok', text: '비밀번호를 변경했습니다. 다음 로그인부터 새 비밀번호를 사용하세요.' });
    } catch (e2) {
      const c = status(e2);
      setPwMsg({ tone: 'bad', text: c === 401 ? '현재 비밀번호가 맞지 않습니다.' : c === 429 ? '시도 횟수를 넘었습니다. 15분 뒤에 다시 시도하세요.' : c === 422 ? '새 비밀번호가 너무 단순하거나 현재와 같습니다.' : '변경하지 못했습니다.' });
    }
    setBusy('');
  };

  const curHint = { idle: cur.length > 0 && cur.length < 8 ? '8자 이상 입력하면 자동으로 확인합니다.' : '', checking: '확인 중…', ok: '현재 비밀번호가 맞습니다.', bad: '현재 비밀번호와 일치하지 않습니다.', locked: '시도 횟수를 넘었습니다. 15분 뒤에 다시 시도하세요.' }[curState];

  return (
    <Modal open={open} onClose={onClose} size="md">
      <Modal.Header><h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">내 계정</h3></Modal.Header>
      <Modal.Body className="px-5 md:px-8 py-4 space-y-6">
        <form onSubmit={saveProfile} className="space-y-3">
          <Field label="아이디"><input className={INPUT} value={user?.username || ''} disabled readOnly /></Field>
          <Field label="이름"><input className={INPUT} required maxLength={30} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
          <Field label="전화번호"><input className={INPUT} required maxLength={20} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></Field>
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" variant="primary" disabled={busy === 'profile'}>{busy === 'profile' ? '저장 중…' : '정보 저장'}</Button>
            {profileMsg.text && <span className={`text-[12px] ${profileMsg.tone === 'ok' ? 'text-positive' : 'text-negative'}`}>{profileMsg.text}</span>}
          </div>
        </form>

        <form onSubmit={changePw} className="space-y-3 pt-5 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[13px] font-semibold text-slate-900 dark:text-white">비밀번호 변경</p>
          <input type="text" name="username" autoComplete="username" value={user?.username || ''} readOnly hidden />
          <Field label="현재 비밀번호" hint={curHint} tone={curState === 'ok' ? 'ok' : curState === 'bad' || curState === 'locked' ? 'bad' : ''}>
            <input type="password" className={INPUT} maxLength={100} value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
          </Field>
          <Field label="새 비밀번호" hint={nextTooShort ? '8자 이상이어야 합니다.' : sameAsCur ? '현재 비밀번호와 달라야 합니다.' : ''} tone="bad">
            <input type="password" className={INPUT} maxLength={100} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" disabled={curState !== 'ok'} />
          </Field>
          <Field label="새 비밀번호 확인" hint={mismatch ? '새 비밀번호가 서로 다릅니다.' : again && !mismatch && next.length >= 8 ? '일치합니다.' : ''} tone={mismatch ? 'bad' : 'ok'}>
            <input type="password" className={INPUT} maxLength={100} value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" disabled={curState !== 'ok'} />
          </Field>
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" variant="primary" disabled={!canChange}>{busy === 'pw' ? '변경 중…' : '비밀번호 변경'}</Button>
            {pwMsg.text && <span className={`text-[12px] ${pwMsg.tone === 'ok' ? 'text-positive' : 'text-negative'}`}>{pwMsg.text}</span>}
          </div>
        </form>
      </Modal.Body>
      <Modal.Footer>
        <Button type="button" variant="ghost" onClick={onClose}>닫기</Button>
      </Modal.Footer>
    </Modal>
  );
}
