// src/pages/Admin.jsx - admin only: approve or reject account requests. Backend: quant-desk-backend/auth_api.py (/api/auth/admin/*)
import { useState, useEffect, useCallback } from 'react';
import { RefreshCcw } from 'lucide-react';
import { useRenderApi } from '../hooks/useRenderApi';
import { useAuth } from '../auth';
import { Card, Button, Badge } from '../components';

const TONE = { pending: 'warning', approved: 'success', rejected: 'negative' };
const LABEL = { pending: '승인 대기', approved: '승인됨', rejected: '거절됨' };
const ORDER = { pending: 0, approved: 1, rejected: 2 };

export default function Admin() {
  const { callApi, ServerWakeupOverlay } = useRenderApi();
  const { user, headers, logout } = useAuth();
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    callApi('/api/auth/admin/users', { headers })
      .then((r) => { setRows((r.data || []).sort((a, b) => ORDER[a.status] - ORDER[b.status])); setErr(''); })
      .catch((e) => { if (/API Error: 401/.test(e.message)) logout(); else setErr(e.message); });
  }, [callApi, headers, logout]);
  useEffect(load, [load]);

  const decide = async (u, decision) => {
    setBusy(u);
    try { await callApi(`/api/auth/admin/users/${u}/decision`, { method: 'POST', headers, body: JSON.stringify({ decision }) }); load(); }
    catch (e) { window.alert(`처리 실패: ${e.message}`); }
    setBusy('');
  };

  if (user?.role !== 'admin') return <Card className="text-center text-[13.5px] text-slate-500">관리자만 볼 수 있습니다.</Card>;
  return (
    <div className="space-y-4 min-w-0">
      <ServerWakeupOverlay />
      <div className="flex items-center justify-between">
        <h2 className="text-[20px] font-semibold text-slate-900 dark:text-white">계정 관리</h2>
        <Button size="sm" variant="ghost" onClick={load} aria-label="새로고침"><RefreshCcw size={13} /></Button>
      </div>
      {err && <p className="text-[12.5px] text-negative">{err}</p>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <Card key={r.username} className="space-y-2 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-[15px] text-slate-900 dark:text-white truncate">{r.name} <span className="text-slate-400 font-normal">({r.username})</span></span>
              <Badge tone={TONE[r.status]}>{r.role === 'admin' ? '관리자' : LABEL[r.status]}</Badge>
            </div>
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400 tabular-nums">{r.phone} · 신청 {String(r.created_at || '').slice(0, 10)}</p>
            {r.status === 'pending' && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="primary" disabled={busy === r.username} onClick={() => decide(r.username, 'approve')}>승인</Button>
                <Button size="sm" disabled={busy === r.username} onClick={() => decide(r.username, 'reject')}>거부</Button>
              </div>
            )}
          </Card>
        ))}
        {!rows.length && !err && <p className="text-[13px] text-slate-500">계정이 없습니다.</p>}
      </div>
    </div>
  );
}
