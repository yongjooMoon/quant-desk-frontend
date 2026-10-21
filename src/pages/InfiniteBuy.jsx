// src/pages/InfiniteBuy.jsx - "무한매수" manager (Laor Infinite Buying V2.2 / V4.0). Backend: quant-desk-backend/infinite_api.py
// Cycle based: every request carries X-Infinite-Password (kept in localStorage). No create endpoint: cycles come from a local setup script or the automatic next cycle. All figures come from the API; nothing is computed here
// except display helpers (distance to the star price, order amounts).
import { useState, useEffect, useCallback } from 'react';
import { Infinity as InfinityIcon, Lock, KeyRound, ChevronDown, Pencil, Trash2, Copy, Check, Calculator, RefreshCcw } from 'lucide-react';
import { useRenderApi } from '../hooks/useRenderApi';
import { Card, Panel, Button, Badge, Metric, Table, Modal, Tabs } from '../components';

const PW_KEY = 'infinite_password';
const VERSIONS = { 'V2.2': [10, 20, 30, 40], 'V4.0': [20, 40] };
const TICKERS = ['TQQQ', 'SOXL'];
const MODE_LABEL = { normal: '일반', reverse: '리버스', quarter_stop: '쿼터손절' };
const STATUS_LABEL = { active: '진행', paused: '중지', done: '종료' };
const STATUS_TONE = { active: 'success', paused: 'warning', done: 'neutral' };
const TAG_LABEL = {
  first_buy: '첫매수',
  avg_buy: '평단매수',
  star_buy: '별지점매수',
  quarter_sell: '쿼터매도',
  target_sell: '전량 지정가매도',
};
const INPUT = 'w-full min-w-0 px-2.5 py-2 rounded-md text-[13px] tabular-nums bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand';

const usd = (n, d = 2) => (n == null || Number.isNaN(Number(n)) ? '-' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`);
const num = (v) => (v === '' || v == null ? undefined : Number(v));
const tagLabel = (t) => TAG_LABEL[t] || (t && t.startsWith('reverse_') ? `리버스 ${t.slice(8)}` : t || '-');
const today = () => new Date().toISOString().slice(0, 10);
const ymd = (d) => (d ? String(d).slice(0, 10) : '-');
// callApi only exposes "API Error: <status> ..."; map the known statuses to Korean text.
const errMsg = (e) => {
  const m = /API Error: ([0-9]+)/.exec(e?.message || '');
  const c = m ? Number(m[1]) : 0;
  if (c === 429) return '시도 횟수 초과: 10분 후 다시 시도하세요 (too many attempts, wait 10 minutes).';
  if (c === 401) return '비밀번호가 올바르지 않습니다 (401).';
  if (c === 409) return '이미 종료된 사이클입니다 (409).';
  if (c === 422) return '입력값이 올바르지 않습니다 (422).';
  return e?.message || '요청 실패';
};

function Field({ label, children, hint }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[11.5px] text-slate-500 dark:text-slate-400 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[10.5px] text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

function Select({ value, onChange, options, disabled }) {
  return (
    <select className={INPUT} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

const opts = (arr) => arr.map((v) => ({ v, l: String(v) }));
const optsMap = (m) => Object.entries(m).map(([v, l]) => ({ v, l }));

// ── Unlock form ───────────────────────────────────────────────
function Unlock({ onUnlock, message }) {
  const [v, setV] = useState('');
  return (
    <Card className="max-w-sm mx-auto">
      <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) onUnlock(v.trim()); }} className="space-y-3">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-900 dark:text-white"><Lock size={15} />비밀번호</div>
        <input type="password" autoComplete="off" className={INPUT} value={v} onChange={(e) => setV(e.target.value)} placeholder="password" />
        {message && <p className="text-[12px] text-negative">{message}</p>}
        <Button type="submit" variant="primary" className="w-full">열기</Button>
      </form>
    </Card>
  );
}

// ── Order sheet ───────────────────────────────────────────────
function OrderSheet({ acc }) {
  const [copied, setCopied] = useState(false);
  const orders = acc.orders || [];
  const line = (o) => `${o.side === 'buy' ? '매수' : '매도'} ${acc.ticker} ${o.type} ${o.qty}주${o.price != null ? ` @ ${usd(o.price)}` : ''} (${tagLabel(o.tag)})`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`[${acc.name}] ${acc.version} ${acc.ticker} T=${acc.t_value}\n${orders.map(line).join('\n')}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error('clipboard failed', e);
    }
  };
  if (!orders.length) return <p className="text-[12.5px] text-slate-500 py-4">오늘 주문이 없습니다 (종가 또는 보유 정보 없음).</p>;
  return (
    <div>
      <Table>
        <Table.Head>
          <Table.HeadCell>구분</Table.HeadCell>
          <Table.HeadCell>유형</Table.HeadCell>
          <Table.HeadCell align="right">수량</Table.HeadCell>
          <Table.HeadCell align="right">가격</Table.HeadCell>
          <Table.HeadCell align="right">예상금액</Table.HeadCell>
          <Table.HeadCell className="pl-3">태그</Table.HeadCell>
        </Table.Head>
        <Table.Body>
          {orders.map((o, i) => (
            <Table.Row key={i}>
              <Table.Cell className={`font-medium ${o.side === 'buy' ? 'text-positive' : 'text-negative'}`}>{o.side === 'buy' ? '매수' : '매도'}</Table.Cell>
              <Table.Cell>{o.type}</Table.Cell>
              <Table.Cell align="right" numeric className="font-mono">{o.qty}</Table.Cell>
              <Table.Cell align="right" numeric className="font-mono">{o.price != null ? usd(o.price) : '-'}</Table.Cell>
              <Table.Cell align="right" numeric className="font-mono">{o.price != null ? usd(o.qty * o.price) : '-'}</Table.Cell>
              <Table.Cell className="pl-3 whitespace-nowrap">{tagLabel(o.tag)}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      <Button size="sm" className="mt-3" onClick={copy}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? '복사됨' : '주문표 복사'}</Button>
    </div>
  );
}

// ── Trades list + manual fill form ────────────────────────────
function Trades({ acc, api, onTrade, readOnly }) {
  const [state, setState] = useState({ loading: true, error: '', data: [] });
  const [f, setF] = useState({ trade_date: today(), side: 'buy', qty: '', price: '', tag: '', tstep: 'auto', tcustom: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    api(`/cycles/${acc.id}/trades?limit=200`)
      .then((r) => setState({ loading: false, error: '', data: r.data || [] }))
      .catch((e) => setState({ loading: false, error: errMsg(e), data: [] }));
  }, [api, acc.id]);
  useEffect(load, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const body = { trade_date: f.trade_date, side: f.side, qty: Number(f.qty), price: Number(f.price), tag: f.tag };
      const step = f.tstep === 'custom' ? f.tcustom : f.tstep;
      if (step !== 'auto' && step !== '') body.t_step = Number(step);
      const r = await api(`/cycles/${acc.id}/trades`, 'POST', body);
      onTrade(r);
      setF({ ...f, qty: '', price: '' });
      load();
    } catch (e2) { setErr(errMsg(e2)); }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      {!readOnly && <form onSubmit={submit} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
        <Field label="체결일"><input type="date" className={INPUT} required value={f.trade_date} onChange={(e) => setF({ ...f, trade_date: e.target.value })} /></Field>
        <Field label="구분"><Select value={f.side} onChange={(v) => setF({ ...f, side: v })} options={[{ v: 'buy', l: '매수' }, { v: 'sell', l: '매도' }]} /></Field>
        <Field label="수량"><input type="number" min="1" step="1" required className={INPUT} value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></Field>
        <Field label="체결가 ($)"><input type="number" min="0" step="0.01" required className={INPUT} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
        <Field label="태그"><Select value={f.tag} onChange={(v) => setF({ ...f, tag: v })} options={[{ v: '', l: '(없음)' }, ...Object.entries(TAG_LABEL).map(([v, l]) => ({ v, l }))]} /></Field>
        <div className="col-span-2 sm:col-span-1 min-w-0">
          <Field label="T 증가">
            <Select value={f.tstep} onChange={(v) => setF({ ...f, tstep: v })} options={[{ v: 'auto', l: '자동' }, { v: '0.5', l: '+0.5 (절반 매수)' }, { v: '1', l: '+1 (1회 매수)' }, { v: 'custom', l: '직접 입력' }]} />
          </Field>
          {f.tstep === 'custom' && <input type="number" min="0" max="2" step="0.25" className={`${INPUT} mt-1`} value={f.tcustom} onChange={(e) => setF({ ...f, tcustom: e.target.value })} />}
        </div>
        <p className="col-span-2 sm:col-span-6 text-[11px] text-slate-400 -mt-1">두 주문 중 하나만 체결되면 +0.5 (매도 시 T 증가는 무시됩니다)</p>
        <div className="col-span-2 sm:col-span-6 flex items-center gap-3">
          <Button type="submit" variant="primary" size="sm" disabled={busy}>수동 체결 반영</Button>
          <span className="text-[11px] text-slate-400">T/잔금/수량/평단이 규칙 엔진으로 갱신됩니다.</span>
        </div>
        {err && <p className="col-span-2 sm:col-span-6 text-[12px] text-negative">{err}</p>}
      </form>}
      {state.loading ? <p className="text-[12.5px] text-slate-500">불러오는 중...</p>
        : state.error ? <p className="text-[12.5px] text-negative">체결내역 오류: {state.error}</p>
        : !state.data.length ? <p className="text-[12.5px] text-slate-500">체결내역이 없습니다.</p>
        : (
          <Table>
            <Table.Head>
              <Table.HeadCell>일자</Table.HeadCell>
              <Table.HeadCell>구분</Table.HeadCell>
              <Table.HeadCell align="right">수량</Table.HeadCell>
              <Table.HeadCell align="right">가격</Table.HeadCell>
              <Table.HeadCell align="right">T</Table.HeadCell>
              <Table.HeadCell className="pl-3">태그</Table.HeadCell>
            </Table.Head>
            <Table.Body>
              {state.data.map((t, i) => (
                <Table.Row key={t.id ?? i}>
                  <Table.Cell numeric className="font-mono whitespace-nowrap">{String(t.trade_date).slice(0, 10)}</Table.Cell>
                  <Table.Cell className={t.side === 'buy' ? 'text-positive' : 'text-negative'}>{t.side === 'buy' ? '매수' : '매도'}</Table.Cell>
                  <Table.Cell align="right" numeric className="font-mono">{t.qty}</Table.Cell>
                  <Table.Cell align="right" numeric className="font-mono">{usd(t.price)}</Table.Cell>
                  <Table.Cell align="right" numeric className="font-mono">{t.t_after ?? '-'}</Table.Cell>
                  <Table.Cell className="pl-3 whitespace-nowrap">{tagLabel(t.tag)}{t.source && t.source !== 'manual' ? ` · ${t.source}` : ''}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
    </div>
  );
}

// ── Account card ──────────────────────────────────────────────
function CycleCard({ acc, api, onTrade, onEdit, onDelete, onBacksolve, onSaved }) {
  const [tab, setTab] = useState('orders');
  const [autoBusy, setAutoBusy] = useState(false);
  const toggleAuto = async () => {
    const on = !acc.auto_order;
    if (on && !window.confirm('실계좌로 매일 17:01에 LOC 매수·매도 주문이 자동 전송됩니다. 켜시겠습니까?')) return;
    setAutoBusy(true);
    try { onSaved((await api(`/cycles/${acc.id}`, 'PUT', { auto_order: on })).data); }
    catch (e) { window.alert(`변경 실패: ${errMsg(e)}`); }
    setAutoBusy(false);
  };
  const t = Number(acc.t_value) || 0;
  const pct = Math.min(100, Math.max(0, (t / acc.splits) * 100));
  const prog = Number(acc.progress_pct) || 0;
  const dist = acc.prev_close && acc.star_price ? (Number(acc.prev_close) / acc.star_price - 1) * 100 : null;
  return (
    <Card className="min-w-0 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white truncate">{acc.name}{acc.start_date && <span className="ml-2 text-[12px] font-normal text-slate-400 font-mono">{ymd(acc.start_date).replace(/-/g, '. ')} ~</span>}</h3>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <Badge tone="info" size="sm">{acc.version}</Badge>
            <Badge size="sm">{acc.ticker}</Badge>
            <Badge size="sm">{acc.splits}분할</Badge>
            <Badge size="sm" tone="info">{acc.cycle_no || 1}번째 사이클</Badge>
            <Badge size="sm" tone={acc.mode === 'normal' ? 'neutral' : 'warning'}>{MODE_LABEL[acc.mode] || acc.mode}</Badge>
            <Badge size="sm" tone={STATUS_TONE[acc.status] || 'neutral'} dot>{STATUS_LABEL[acc.status] || acc.status}</Badge>
            <Badge size="sm" tone={acc.auto_order ? 'warning' : 'neutral'}>{acc.auto_order ? '자동 ON' : '자동 OFF'}</Badge>
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-1 truncate">{acc.cycle_key}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => onBacksolve(acc)} title="현재 위치 역산" aria-label="역산"><Calculator size={14} /></Button>
          <Button variant="ghost" size="sm" onClick={() => onEdit(acc)} title="수정" aria-label="수정"><Pencil size={14} /></Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(acc)} title="삭제" aria-label="삭제"><Trash2 size={14} /></Button>
        </div>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 font-mono">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">진행도</p>
          <p className="text-[32px] md:text-[38px] font-semibold tracking-tight tabular-nums leading-tight text-slate-900 dark:text-white">{prog.toFixed(1)}%</p>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 tabular-nums">{t.toFixed(3)}T / {acc.splits}</p>
        </div>
        <Badge tone={acc.first_half ? 'info' : 'warning'} size="sm">{acc.first_half ? '전반전' : '후반전'}</Badge>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className="h-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, prog))}%` }} />
      </div>
      <div className="relative h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" title="T / 분할수 (중간선 = 전반/후반 경계)">
        <div className="h-full bg-slate-400/70" style={{ width: `${pct}%` }} />
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-500/60" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          ['기본 정보', [['시드', usd(acc.principal_usd)], ['사용한 시드', usd(acc.used_seed_usd)], ['1회 투자금', usd(acc.unit_usd)]]],
          ['매입 정보', [['평단가', usd(acc.avg_price)], ['보유 수량', acc.qty], ['매입 금액', usd(acc.invested_usd)]]],
          ['무매 공식', [['T', t.toFixed(3)], ['목표 수익률', acc.target_pct != null ? `${acc.target_pct}%` : '-'], ['Star 값', acc.star_pct != null ? `${Number(acc.star_pct).toFixed(2)}%` : '-']]],
        ].map(([title, rows]) => (
          <Panel key={title} level="inset" padding="sm" radius="lg" className="min-w-0">
            <p className="text-[12px] font-semibold text-slate-900 dark:text-white mb-2">{title}</p>
            <dl className="space-y-1.5">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-2 text-[12px]">
                  <dt className="text-slate-500 dark:text-slate-400 shrink-0">{k}</dt>
                  <dd className="font-mono tabular-nums text-slate-900 dark:text-slate-100 text-right truncate">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-x-3 gap-y-3 font-mono">
        <Metric label="별지점가" value={usd(acc.star_price)} />
        <Metric label="잔금" value={usd(acc.cash_usd)} />
        <Metric
          label="종가 / 별지점 대비"
          value={usd(acc.prev_close)}
          tone={dist == null ? 'default' : dist >= 0 ? 'positive' : 'negative'}
          sub={dist == null ? undefined : `${dist >= 0 ? '+' : ''}${dist.toFixed(2)}%`}
        />
      </div>

      <label className="flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-slate-300 cursor-pointer">
        <input type="checkbox" role="switch" checked={!!acc.auto_order} disabled={autoBusy} onChange={toggleAuto} />
        자동매매 (매일 17:01 LOC 주문)
      </label>

      <div className="min-w-0">
        <Tabs variant="static" value={tab} onChange={setTab} items={[{ key: 'orders', label: '오늘의 주문표' }, { key: 'trades', label: '체결내역' }]} className="mb-3" />
        {tab === 'orders' ? <OrderSheet acc={acc} /> : <Trades acc={acc} api={api} onTrade={onTrade} />}
      </div>
    </Card>
  );
}

// ── Edit modal (no create: cycles come from the setup script / automatic next cycle) ──
const EDIT_KEYS = ['name', 'principal_usd', 'compounding', 'mode', 'status', 'auto_order', 't_value', 'cash_usd', 'qty', 'avg_price'];

function EditModal({ open, onClose, api, editing, onSaved }) {
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open || !editing) return;
    setErr('');
    setF({ ...Object.fromEntries(EDIT_KEYS.map((k) => [k, editing[k] ?? ''])), start_date: ymd(editing.start_date) === '-' ? '' : ymd(editing.start_date) });
  }, [open, editing]);

  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    const body = { name: f.name, principal_usd: Number(f.principal_usd), compounding: !!f.compounding, mode: f.mode, status: f.status, auto_order: !!f.auto_order, t_value: Number(f.t_value), qty: Number(f.qty), avg_price: Number(f.avg_price) };
    if (f.start_date) body.start_date = f.start_date;
    if (f.cash_usd !== '' && f.cash_usd != null) body.cash_usd = Number(f.cash_usd);
    try {
      const r = await api(`/cycles/${editing.id}`, 'PUT', body);
      onSaved(r.data);
      onClose();
    } catch (e2) { setErr(errMsg(e2)); }
    setBusy(false);
  };

  return (
    <Modal open={open && !!editing} onClose={onClose} size="lg">
      <form onSubmit={submit} className="flex flex-col min-h-0">
        <Modal.Header><h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">사이클 수정{editing ? ` · ${editing.cycle_key}` : ''}</h3></Modal.Header>
        <Modal.Body className="px-5 md:px-8 py-4 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="이름"><input className={INPUT} required maxLength={60} value={f.name ?? ''} onChange={(e) => set('name')(e.target.value)} /></Field>
            <Field label="원금 ($)"><input type="number" min="0" step="0.01" required className={INPUT} value={f.principal_usd ?? ''} onChange={(e) => set('principal_usd')(e.target.value)} /></Field>
            <Field label="시작일"><input type="date" className={INPUT} value={f.start_date ?? ''} onChange={(e) => set('start_date')(e.target.value)} /></Field>
            <div />
            <Field label="모드"><Select value={f.mode || 'normal'} onChange={set('mode')} options={optsMap(MODE_LABEL)} /></Field>
            <Field label="상태"><Select value={f.status || 'active'} onChange={set('status')} options={optsMap(STATUS_LABEL)} /></Field>
            <label className="flex items-center gap-2 text-[12.5px] text-slate-600 dark:text-slate-300"><input type="checkbox" checked={!!f.compounding} onChange={(e) => set('compounding')(e.target.checked)} />복리 (원금 재투자)</label>
            <label className="flex items-center gap-2 text-[12.5px] text-slate-600 dark:text-slate-300"><input type="checkbox" checked={!!f.auto_order} onChange={(e) => set('auto_order')(e.target.checked)} />자동주문</label>
          </div>
          <Panel level="inset" padding="sm" radius="lg" className="space-y-3">
            <div>
              <p className="text-[13px] font-semibold text-slate-900 dark:text-white">수동 보정</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">현재 상태를 직접 입력합니다. 잔금을 비우면 변경하지 않습니다.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="T"><input type="number" min="0" step="0.01" className={INPUT} value={f.t_value ?? ''} onChange={(e) => set('t_value')(e.target.value)} /></Field>
              <Field label="잔금 ($)"><input type="number" min="0" step="0.01" className={INPUT} value={f.cash_usd ?? ''} onChange={(e) => set('cash_usd')(e.target.value)} /></Field>
              <Field label="수량"><input type="number" min="0" step="1" className={INPUT} value={f.qty ?? ''} onChange={(e) => set('qty')(e.target.value)} /></Field>
              <Field label="평단 ($)"><input type="number" min="0" step="0.01" className={INPUT} value={f.avg_price ?? ''} onChange={(e) => set('avg_price')(e.target.value)} /></Field>
            </div>
          </Panel>
          {err && <p className="text-[12px] text-negative break-words">{err}</p>}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="ghost" onClick={onClose}>취소</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? '저장 중...' : '저장'}</Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

// ── Back-solve modal ──────────────────────────────────────────
function BacksolveModal({ open, onClose, api, target, onApplied }) {
  const [f, setF] = useState({});
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setRes(null); setErr('');
    setF(target
      ? { version: target.version, ticker: target.ticker, splits: target.splits, principal_usd: target.principal_usd, qty: target.qty, avg_price: target.avg_price, invested_usd: '', cash_usd: '', quarter_sell_price: '' }
      : { version: 'V4.0', ticker: 'TQQQ', splits: 20, principal_usd: '', qty: '', avg_price: '', invested_usd: '', cash_usd: '', quarter_sell_price: '' });
  }, [open, target]);

  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const setVersion = (v) => setF((s) => ({ ...s, version: v, splits: VERSIONS[v].includes(Number(s.splits)) ? s.splits : VERSIONS[v][0] }));

  const solve = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(''); setRes(null);
    const body = { version: f.version, ticker: f.ticker, splits: Number(f.splits), principal_usd: Number(f.principal_usd), qty: Number(f.qty || 0), avg_price: Number(f.avg_price || 0) };
    for (const k of ['cash_usd', 'quarter_sell_price', 'invested_usd']) if (num(f[k]) !== undefined) body[k] = num(f[k]);
    try { setRes((await api('/backsolve', 'POST', body)).data); } catch (e2) { setErr(errMsg(e2)); }
    setBusy(false);
  };

  const apply = async () => {
    if (!target || !res || res.t_value == null) return;
    setBusy(true); setErr('');
    try {
      const r = await api(`/cycles/${target.id}`, 'PUT', { t_value: res.t_value, qty: Number(f.qty || 0), avg_price: Number(f.avg_price || 0), cash_usd: res.cash_usd });
      onApplied(r.data); onClose();
    } catch (e2) { setErr(errMsg(e2)); }
    setBusy(false);
  };

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <Modal.Header><h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">현재 위치 역산{target ? ` · ${target.name}` : ''}</h3></Modal.Header>
      <Modal.Body className="px-5 md:px-8 py-4 space-y-4">
        <form onSubmit={solve} className="grid grid-cols-2 gap-3">
          <Field label="버전"><Select value={f.version || 'V4.0'} onChange={setVersion} options={opts(Object.keys(VERSIONS))} /></Field>
          <Field label="종목"><Select value={f.ticker || 'TQQQ'} onChange={set('ticker')} options={opts(TICKERS)} /></Field>
          <Field label="분할수"><Select value={String(f.splits ?? 20)} onChange={set('splits')} options={opts(VERSIONS[f.version || 'V4.0'])} /></Field>
          <Field label="원금 ($)"><input type="number" min="0" step="0.01" required className={INPUT} value={f.principal_usd ?? ''} onChange={(e) => set('principal_usd')(e.target.value)} /></Field>
          <Field label="수량"><input type="number" min="0" step="1" required className={INPUT} value={f.qty ?? ''} onChange={(e) => set('qty')(e.target.value)} /></Field>
          <Field label="평단 ($)"><input type="number" min="0" step="0.01" required className={INPUT} value={f.avg_price ?? ''} onChange={(e) => set('avg_price')(e.target.value)} /></Field>
          <Field label="투입금 ($, 선택)" hint="비우면 수량 x 평단"><input type="number" min="0" step="0.01" className={INPUT} value={f.invested_usd ?? ''} onChange={(e) => set('invested_usd')(e.target.value)} /></Field>
          <Field label="잔금 ($, 선택)"><input type="number" min="0" step="0.01" className={INPUT} value={f.cash_usd ?? ''} onChange={(e) => set('cash_usd')(e.target.value)} /></Field>
          <div className="col-span-2"><Field label="쿼터매도 LOC 주문 가격 ($, 선택)" hint="V4.0에서 T를 정확히 구하려면 필요"><input type="number" min="0" step="0.01" className={INPUT} value={f.quarter_sell_price ?? ''} onChange={(e) => set('quarter_sell_price')(e.target.value)} /></Field></div>
          <div className="col-span-2"><Button type="submit" variant="secondary" disabled={busy}><Calculator size={14} />역산</Button></div>
        </form>
        {err && <p className="text-[12px] text-negative break-words">{err}</p>}
        {res && (
          <Panel level="inset" padding="sm" radius="lg" className="space-y-3">
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400">방식: {res.method}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono">
              {res.t_value != null
                ? <Metric label="T" value={res.t_value} size="md" />
                : <Metric label="T 범위" value={`${res.t_min} ~ ${res.t_max}`} size="md" />}
              <Metric label="별%" value={res.star_pct != null ? `${res.star_pct}%` : '-'} />
              <Metric label="별지점가" value={usd(res.star_price)} />
              <Metric label="구간" value={res.first_half == null ? '-' : res.first_half ? '전반전' : '후반전'} />
              <Metric label="투입금" value={usd(res.invested_usd)} />
              <Metric label="잔금" value={usd(res.cash_usd)} />
              <Metric label="1회매수액" value={usd(res.unit_usd)} />
            </div>
            {(res.notes || []).map((n, i) => <p key={i} className="text-[12px] text-warning">{n}</p>)}
          </Panel>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>닫기</Button>
        {target && <Button variant="primary" disabled={busy || !res || res.t_value == null} onClick={apply}>이 사이클에 적용</Button>}
      </Modal.Footer>
    </Modal>
  );
}

// ── Change password ───────────────────────────────────────────
function PasswordModal({ open, onClose, api, cycleId, onChanged }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setA(''); setB(''); setErr(''); } }, [open]);
  const submit = async (e) => {
    e.preventDefault();
    if (a.length < 8) { setErr('새 비밀번호는 8자 이상이어야 합니다.'); return; }
    if (a !== b) { setErr('비밀번호 확인이 일치하지 않습니다.'); return; }
    setBusy(true); setErr('');
    try { await api(`/cycles/${cycleId}/password`, 'POST', { new_password: a }); onChanged(a); onClose(); }
    catch (e2) { setErr(errMsg(e2)); }
    setBusy(false);
  };
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <form onSubmit={submit}>
        <Modal.Header><h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">비밀번호 변경</h3></Modal.Header>
        <Modal.Body className="px-5 py-4 space-y-3">
          <p className="text-[11.5px] text-slate-500 dark:text-slate-400">같은 비밀번호를 쓰는 모든 사이클에 적용됩니다.</p>
          <Field label="새 비밀번호 (8자 이상)"><input type="password" autoComplete="new-password" className={INPUT} value={a} onChange={(e) => setA(e.target.value)} /></Field>
          <Field label="확인"><input type="password" autoComplete="new-password" className={INPUT} value={b} onChange={(e) => setB(e.target.value)} /></Field>
          {err && <p className="text-[12px] text-negative">{err}</p>}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="ghost" onClick={onClose}>취소</Button>
          <Button type="submit" variant="primary" disabled={busy}>변경</Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

// ── Finished cycle row (collapsed list, expands to trades) ────
function PastCycle({ c, api, onDelete }) {
  const [open, setOpen] = useState(false);
  const r = Number(c.realized_usd);
  return (
    <div className="border-b border-slate-100 dark:border-slate-800/60 last:border-0 py-2.5">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 text-left cursor-pointer">
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        <span className="text-[13px] font-medium text-slate-900 dark:text-slate-100 shrink-0">{c.cycle_no || 1}번째</span>
        <span className="text-[11.5px] text-slate-400 font-mono truncate min-w-0 flex-1">{c.cycle_key}</span>
        <span className={`text-[12.5px] font-mono tabular-nums shrink-0 ${r > 0 ? 'text-positive' : r < 0 ? 'text-negative' : ''}`}>{c.realized_usd == null ? '-' : usd(r)}</span>
      </button>
      <p className="text-[11px] text-slate-500 font-mono mt-1 pl-6">{ymd(c.start_date)} ~ {ymd(c.end_date)} · 원금 {usd(c.principal_usd)} · {c.ticker} {c.version}</p>
      {open && (
        <div className="pl-6 mt-2 space-y-2">
          <Trades acc={c} api={api} onTrade={() => {}} readOnly />
          <Button size="sm" variant="ghost" onClick={() => onDelete(c)}><Trash2 size={13} />삭제</Button>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function InfiniteBuy() {
  const { callApi, ServerWakeupOverlay } = useRenderApi();
  const [pw, setPw] = useState(() => { try { return localStorage.getItem(PW_KEY) || ''; } catch { return ''; } });
  const [authMsg, setAuthMsg] = useState('');
  const [list, setList] = useState({ loading: false, error: '', data: [] });
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState({ open: false, editing: null });
  const [solver, setSolver] = useState({ open: false, target: null });
  const [pwOpen, setPwOpen] = useState(false);

  const lock = useCallback((msg = '') => {
    try { localStorage.removeItem(PW_KEY); } catch { /* storage unavailable */ }
    setPw(''); setAuthMsg(msg); setList({ loading: false, error: '', data: [] });
  }, []);
  const store = (p) => {
    try { localStorage.setItem(PW_KEY, p); } catch { /* storage unavailable: password lives in memory only */ }
    setPw(p);
  };
  const unlock = (p) => { setAuthMsg(''); store(p); };

  // Every call sends the password; a 401 clears it and returns to the unlock form, a 429 shows the wait message.
  const api = useCallback(async (path, method = 'GET', body) => {
    try {
      return await callApi(`/api/infinite${path}`, { method, headers: { 'X-Infinite-Password': pw }, body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      if (/API Error: 401/.test(e.message)) lock(errMsg(e));
      throw e;
    }
  }, [callApi, pw, lock]);

  const load = useCallback(() => {
    if (!pw) return;
    setList((l) => ({ ...l, loading: true, error: '' }));
    api('/cycles')
      .then((r) => setList({ loading: false, error: '', data: r.data || [] }))
      .catch((e) => { if (!/API Error: 401/.test(e.message)) setList({ loading: false, error: errMsg(e), data: [] }); });
  }, [api, pw]);
  useEffect(load, [load]);

  const upsert = (c) => setList((l) => ({ ...l, data: l.data.map((a) => (a.id === c.id ? c : a)) }));
  // A fill that emptied the position closes the cycle and the backend opens the next one: reload.
  const onTrade = (r) => {
    if (r.next) { setNotice('사이클 종료 - 다음 사이클 생성됨'); load(); } else if (r.data) upsert(r.data);
  };
  const remove = async (c) => {
    if (!window.confirm(`"${c.cycle_key}" 사이클을 삭제할까요? (체결내역 포함)`)) return;
    try { await api(`/cycles/${c.id}`, 'DELETE'); setList((l) => ({ ...l, data: l.data.filter((a) => a.id !== c.id) })); }
    catch (e) { window.alert(`삭제 실패: ${errMsg(e)}`); }
  };

  const live = list.data.filter((c) => c.status !== 'done');
  const past = list.data.filter((c) => c.status === 'done');

  return (
    <div className="space-y-4 min-w-0">
      <ServerWakeupOverlay />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-[20px] font-semibold text-slate-900 dark:text-white flex items-center gap-2"><InfinityIcon size={20} />무한매수 매니저</h2>
        {pw && (
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => setSolver({ open: true, target: null })}><Calculator size={13} />현재 위치 역산</Button>
            <Button size="sm" disabled={!list.data.length} onClick={() => setPwOpen(true)}><KeyRound size={13} />비밀번호 변경</Button>
            <Button size="sm" variant="ghost" onClick={load} aria-label="새로고침"><RefreshCcw size={13} /></Button>
            <Button size="sm" variant="ghost" onClick={() => lock()}><Lock size={13} />잠금</Button>
          </div>
        )}
      </div>

      {notice && (
        <Panel level="inset" padding="sm" radius="lg" className="flex items-center justify-between gap-3 text-[13px] text-slate-700 dark:text-slate-200">
          <span>{notice}</span>
          <Button size="sm" variant="ghost" onClick={() => setNotice('')}>닫기</Button>
        </Panel>
      )}

      {!pw ? <Unlock onUnlock={unlock} message={authMsg} />
        : list.loading && !list.data.length ? <p className="text-[13px] text-slate-500 py-8 text-center">불러오는 중...</p>
        : list.error ? (
          <Card className="text-center text-[13.5px] text-slate-500 dark:text-slate-400">
            <p className="mb-3">사이클을 불러오지 못했습니다. ({list.error})</p>
            <Button onClick={load}><RefreshCcw size={13} />다시 시도</Button>
          </Card>
        )
        : !list.data.length ? <Card className="text-center text-[13.5px] text-slate-500 dark:text-slate-400">이 비밀번호의 사이클이 없습니다. 사이클은 로컬 설정 스크립트로 만듭니다.</Card>
        : (
          <>
            {live.length ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                {live.map((c) => (
                  <CycleCard key={c.id} acc={c} api={api} onTrade={onTrade} onSaved={upsert}
                    onEdit={(x) => setEditor({ open: true, editing: x })}
                    onDelete={remove}
                    onBacksolve={(x) => setSolver({ open: true, target: x })} />
                ))}
              </div>
            ) : <Card className="text-center text-[13.5px] text-slate-500 dark:text-slate-400">진행 중인 사이클이 없습니다.</Card>}
            {past.length > 0 && (
              <details>
                <summary className="cursor-pointer text-[13.5px] font-medium text-slate-700 dark:text-slate-300 py-2 select-none">지난 사이클 ({past.length})</summary>
                <Card padding="sm" className="min-w-0">
                  {past.map((c) => <PastCycle key={c.id} c={c} api={api} onDelete={remove} />)}
                </Card>
              </details>
            )}
          </>
        )}

      <EditModal open={editor.open} onClose={() => setEditor((e) => ({ ...e, open: false }))} api={api} editing={editor.editing} onSaved={upsert} />
      <BacksolveModal open={solver.open} onClose={() => setSolver((s) => ({ ...s, open: false }))} api={api} target={solver.target} onApplied={upsert} />
      <PasswordModal open={pwOpen} onClose={() => setPwOpen(false)} api={api} cycleId={list.data[0]?.id} onChanged={store} />
    </div>
  );
}
