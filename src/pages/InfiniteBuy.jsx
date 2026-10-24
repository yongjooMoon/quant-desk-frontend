// src/pages/InfiniteBuy.jsx - "무한매수" manager (Laor Infinite Buying V2.2 / V4.0). Backend: quant-desk-backend/infinite_api.py
// Cycle based and per account: the logged-in user (src/auth.jsx, route guard in App.jsx) sees only his own cycles; every request carries the login token. All figures come from the API; nothing is computed here
// except display helpers (distance to the star price, order amounts).
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Infinity as InfinityIcon, ChevronDown, ChevronLeft, ChevronRight, ArrowLeft, Plus, RotateCw, Pencil, Trash2, Copy, Check, Calculator, RefreshCcw } from 'lucide-react';
import { useRenderApi } from '../hooks/useRenderApi';
import { useAuth } from '../auth';
import { Card, Panel, Button, Badge, Metric, Table, Modal, Tabs } from '../components';

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
  ladder_x: '추가 매수',
  ladder: '폭락대비 매수',
  limit_buy: '지정가 매수',
};
const INPUT = 'w-full min-w-0 px-2.5 py-2 rounded-md text-[13px] tabular-nums bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand';

const usd = (n, d = 2) => (n == null || Number.isNaN(Number(n)) ? '-' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`);
const num = (v) => (v === '' || v == null ? undefined : Number(v));
const tagLabel = (t) => TAG_LABEL[t] || (t && t.startsWith('reverse_') ? `리버스 ${t.slice(8)}` : t || '-');
const today = () => new Date().toISOString().slice(0, 10);
// One row per day and side: shares added up, volume-weighted price, T after the day, tags with their share counts (the broker lists every 1-share crash-prep fill separately).
function groupTrades(rows) {
  const m = new Map();
  for (const t of rows) {
    const k = `${String(t.trade_date).slice(0, 10)}|${t.side}`;
    const g = m.get(k) || { id: k, trade_date: t.trade_date, side: t.side, qty: 0, amt: 0, t_after: null, tags: {}, source: t.source };
    g.qty += Number(t.qty);
    g.amt += Number(t.qty) * Number(t.price);
    if (t.t_after != null) g.t_after = g.t_after == null ? Number(t.t_after) : Math.max(g.t_after, Number(t.t_after));
    const tg = t.tag || '-';
    g.tags[tg] = (g.tags[tg] || 0) + Number(t.qty);
    m.set(k, g);
  }
  return [...m.values()].map((g) => ({ ...g, price: g.amt / g.qty, tagText: Object.entries(g.tags).map(([tg, q]) => `${tagLabel(tg)} ${q}`).join(' + ') }));
}
const ymd = (d) => (d ? String(d).slice(0, 10) : '-');
// callApi only exposes "API Error: <status> ..."; map the known statuses to Korean text.
const errMsg = (e) => {
  const m = /API Error: ([0-9]+)/.exec(e?.message || '');
  const c = m ? Number(m[1]) : 0;
  if (c === 429) return '시도 횟수 초과: 10분 후 다시 시도하세요 (too many attempts, wait 10 minutes).';
  if (c === 401) return '로그인이 만료되었습니다. 다시 로그인하세요 (401).';
  if (c === 409) return '충돌: 이미 존재하거나 종료된 사이클입니다 (409).';
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

// ── Order helpers (shared by the detail order sheet, the card back and the guide sheet) ──
const isLadder = (o) => o.tag === 'ladder_x';
const typeLabel = (t) => (t === 'LIMIT' ? '지정가' : t);
// Percent shown next to an order: target sell = cycle target %, first buy = none, else price vs average price.
function orderPct(acc, o) {
  if (o.tag === 'target_sell' && acc.target_pct != null) return `${acc.target_pct}%`;
  const avg = Number(acc.avg_price);
  if (o.tag === 'first_buy' || !o.price || !(avg > 0)) return '';
  const v = (o.price / avg - 1) * 100;
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}
const orderLine = (acc, o) => `${o.side === 'buy' ? '매수' : '매도'} ${[typeLabel(o.type), orderPct(acc, o), o.price != null ? usd(o.price) : ''].filter(Boolean).join(' ')} × ${o.qty}주 (${tagLabel(o.tag)})`;
const sheetText = (acc) => `[${acc.name}] ${acc.version} ${acc.ticker} T=${acc.t_value}\n${(acc.orders || []).map((o) => orderLine(acc, o)).join('\n')}`;

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error('clipboard failed', e);
    }
  };
  return [copied, copy];
}

function CopyButton({ text, label = '주문표 복사', ...rest }) {
  const [copied, copy] = useCopy();
  return <Button size="sm" onClick={(e) => { e.stopPropagation(); copy(text); }} {...rest}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? '복사됨' : label}</Button>;
}

// Guide layout like the owner's app: 매수 (red) with the ladder sub-list, 매도 (blue).
function GuideRow({ acc, o }) {
  const pct = orderPct(acc, o);
  return (
    <div className="flex items-baseline justify-between gap-2 text-[13px] py-1">
      <span className="text-slate-600 dark:text-slate-300 shrink-0">{typeLabel(o.type)}{pct && <span className="ml-2 tabular-nums">{pct}</span>}</span>
      <span className="font-mono tabular-nums text-slate-900 dark:text-white text-right">{o.price != null ? `${usd(o.price)} ` : ''}× {o.qty}주</span>
    </div>
  );
}

function GuideBody({ acc }) {
  const orders = acc.orders || [];
  const buys = orders.filter((o) => o.side === 'buy' && !isLadder(o));
  const ladder = orders.filter(isLadder);
  const sells = orders.filter((o) => o.side === 'sell');
  if (!orders.length) return <p className="text-[12.5px] text-slate-500 py-3">오늘 주문이 없습니다.</p>;
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[12px] font-semibold text-positive mb-1">매수</p>
        {buys.map((o, i) => <GuideRow key={i} acc={acc} o={o} />)}
        {!buys.length && <p className="text-[12px] text-slate-400">없음</p>}
        {ladder.length > 0 && (
          <div className="mt-2 pl-3 border-l border-slate-200 dark:border-slate-700">
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mb-0.5">+@ 폭락장 대비 추가 매수</p>
            {ladder.map((o, i) => <GuideRow key={i} acc={acc} o={o} />)}
          </div>
        )}
      </div>
      <div>
        <p className="text-[12px] font-semibold text-negative mb-1">매도</p>
        {sells.map((o, i) => <GuideRow key={i} acc={acc} o={o} />)}
        {!sells.length && <p className="text-[12px] text-slate-400">없음</p>}
      </div>
    </div>
  );
}

// ── Order sheet (detail view) ─────────────────────────────────
function OrderTable({ acc, rows }) {
  return (
    <Table>
      <Table.Head>
        <Table.HeadCell className="whitespace-nowrap">구분</Table.HeadCell>
        <Table.HeadCell className="whitespace-nowrap">유형</Table.HeadCell>
        <Table.HeadCell align="right" className="whitespace-nowrap">수량</Table.HeadCell>
        <Table.HeadCell align="right">가격</Table.HeadCell>
        <Table.HeadCell align="right">예상금액</Table.HeadCell>
        <Table.HeadCell className="pl-3">태그</Table.HeadCell>
      </Table.Head>
      <Table.Body>
        {rows.map((o, i) => (
          <Table.Row key={i}>
            <Table.Cell className={`font-medium whitespace-nowrap ${o.side === 'buy' ? 'text-positive' : 'text-negative'}`}>{o.side === 'buy' ? '매수' : '매도'}</Table.Cell>
            <Table.Cell className="whitespace-nowrap">{o.type}</Table.Cell>
            <Table.Cell align="right" numeric className="font-mono">{o.qty}</Table.Cell>
            <Table.Cell align="right" numeric className="font-mono">{o.price != null ? usd(o.price) : '-'}</Table.Cell>
            <Table.Cell align="right" numeric className="font-mono">{o.price != null ? usd(o.qty * o.price) : '-'}</Table.Cell>
            <Table.Cell className="pl-3 whitespace-nowrap">{tagLabel(o.tag)} {orderPct(acc, o)}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

function OrderSheet({ acc }) {
  const orders = acc.orders || [];
  const main = orders.filter((o) => !isLadder(o));
  const ladder = orders.filter(isLadder);
  if (!orders.length) return <p className="text-[12.5px] text-slate-500 py-4">오늘 주문이 없습니다 (종가 또는 보유 정보 없음).</p>;
  return (
    <div className="space-y-3">
      <OrderTable acc={acc} rows={main} />
      {ladder.length > 0 && (
        <details>
          <summary className="cursor-pointer text-[12.5px] text-slate-600 dark:text-slate-300 select-none">폭락장 대비 추가 매수 ({ladder.length})</summary>
          <div className="mt-2"><OrderTable acc={acc} rows={ladder} /></div>
        </details>
      )}
      <CopyButton text={sheetText(acc)} />
    </div>
  );
}

// ── Trades list + manual fill form ────────────────────────────
function Trades({ acc, api, onTrade, readOnly }) {
  const [state, setState] = useState({ loading: true, error: '', data: [] });
  const [f, setF] = useState({ trade_date: today(), side: 'buy', qty: '', price: '', tag: '', tstep: 'auto', tcustom: '' });
  const [busy, setBusy] = useState(false);
  const [rawRows, setRawRows] = useState(false);
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
        <p className="col-span-2 sm:col-span-6 text-[11px] text-slate-400 -mt-1">전반전: 평단·별지점 주문이 각각 체결되면 +0.5씩 / 후반전: 별지점 매수만 +1 · 폭락대비(추가) 매수는 T에 넣지 않습니다 (매도 시 T 증가는 무시됩니다)</p>
        <div className="col-span-2 sm:col-span-6 flex items-center gap-3">
          <Button type="submit" variant="primary" size="sm" disabled={busy}>수동 체결 반영</Button>
          <span className="text-[11px] text-slate-400">T/잔금/수량/평단이 규칙 엔진으로 갱신됩니다.</span>
        </div>
        {err && <p className="col-span-2 sm:col-span-6 text-[12px] text-negative">{err}</p>}
      </form>}
      <label className="inline-flex items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400 cursor-pointer"><input type="checkbox" checked={rawRows} onChange={(e) => setRawRows(e.target.checked)} />체결 낱개로 보기 (기본: 하루 한 줄로 합쳐서 표시)</label>
      {state.loading ? <p className="text-[12.5px] text-slate-500">불러오는 중...</p>
        : state.error ? <p className="text-[12.5px] text-negative">체결내역 오류: {state.error}</p>
        : !state.data.length ? <p className="text-[12.5px] text-slate-500">체결내역이 없습니다.</p>
        : (
          <Table>
            <Table.Head>
              <Table.HeadCell className="pr-3">일자</Table.HeadCell>
              <Table.HeadCell className="pr-3">구분</Table.HeadCell>
              <Table.HeadCell align="right" className="pr-3">수량</Table.HeadCell>
              <Table.HeadCell align="right" className="pr-4">가격</Table.HeadCell>
              <Table.HeadCell align="right" className="pl-4">T</Table.HeadCell>
              <Table.HeadCell className="pl-4">태그</Table.HeadCell>
            </Table.Head>
            <Table.Body>
              {(rawRows ? state.data.map((t) => ({ ...t, tagText: tagLabel(t.tag) })) : groupTrades(state.data)).map((t, i) => (
                <Table.Row key={t.id ?? i}>
                  <Table.Cell numeric className="font-mono whitespace-nowrap pr-3">{String(t.trade_date).slice(0, 10)}</Table.Cell>
                  <Table.Cell className={`pr-3 whitespace-nowrap ${t.side === 'buy' ? 'text-positive' : 'text-negative'}`}>{t.side === 'buy' ? '매수' : '매도'}</Table.Cell>
                  <Table.Cell align="right" numeric className="font-mono pr-3">{t.qty}</Table.Cell>
                  <Table.Cell align="right" numeric className="font-mono pr-4 whitespace-nowrap">{usd(t.price)}</Table.Cell>
                  <Table.Cell align="right" numeric className="font-mono pl-4">{t.t_after ?? '-'}</Table.Cell>
                  <Table.Cell className="pl-4 whitespace-nowrap">{t.tagText}{t.source && t.source !== 'manual' ? ` · ${t.source}` : ''}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
    </div>
  );
}

// ── Detail view (one cycle) ──────────────────────────────────────────────
function CycleDetail({ acc, api, onTrade, onBack, onEdit, onDelete, onBacksolve }) {
  const [tab, setTab] = useState('orders');
  const t = Number(acc.t_value) || 0;
  const pct = Math.min(100, Math.max(0, (t / acc.splits) * 100));
  const prog = Number(acc.progress_pct) || 0;
  const dist = acc.prev_close && acc.star_price ? (Number(acc.prev_close) / acc.star_price - 1) * 100 : null;
  return (
    <Card className="min-w-0 space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] text-slate-500 dark:text-slate-400 hover:text-brand cursor-pointer"><ArrowLeft size={14} />목록</button>
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
            {acc.extras?.ladder && <Badge size="sm" tone="warning">사다리 ON</Badge>}
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-1 truncate">{acc.cycle_key}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => onBacksolve(acc)} title="현재 위치 역산" aria-label="역산"><Calculator size={14} /></Button>
          <Button variant="ghost" size="sm" onClick={() => onEdit(acc)} title="수정" aria-label="수정"><Pencil size={14} /><span className="hidden sm:inline">수정</span></Button>
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

      <div className="min-w-0">
        <Tabs variant="static" value={tab} onChange={setTab} items={[{ key: 'orders', label: '오늘의 주문표' }, { key: 'trades', label: '체결내역' }]} className="mb-3" />
        {tab === 'orders' ? <OrderSheet acc={acc} /> : <Trades acc={acc} api={api} onTrade={onTrade} />}
      </div>
    </Card>
  );
}

// ── List view: carousel, overall card, flip cards, guide sheet, create modal, FAB ──
const CARD = 'relative h-full rounded-[24px] border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-[#111827] p-5 flex flex-col overflow-hidden shadow-[0_2px_4px_rgba(15,23,42,0.06),0_16px_32px_-12px_rgba(15,23,42,0.18)] dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),0_20px_40px_-12px_rgba(0,0,0,0.65)]';

function ProgressBar({ pct }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700/60 overflow-hidden"><div className="h-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} /></div>
      <span className="text-[13px] font-mono tabular-nums text-slate-900 dark:text-white">{pct.toFixed(1)}%</span>
    </div>
  );
}

function InfoRows({ rows }) {
  return (
    <dl className="space-y-1.5">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-3 text-[13px]">
          <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
          <dd className="font-mono tabular-nums text-slate-900 dark:text-white text-right">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function OverallCard({ live, onGuide }) {
  const act = live.filter((c) => c.status === 'active');
  const sum = (k) => act.reduce((a, c) => a + (Number(c[k]) || 0), 0);
  const seed = sum('principal_usd');
  const used = sum('used_seed_usd');
  return (
    <div className={`${CARD} bg-gradient-to-br from-brand/15 via-white to-white dark:from-brand/15 dark:via-[#111827] dark:to-[#111827]`}>
      <h3 className="text-[20px] font-semibold text-slate-900 dark:text-white">전체 진행 상황</h3>
      <div className="mt-auto space-y-3">
        <div className="ml-auto w-[88%] rounded-2xl border border-slate-300/60 dark:border-white/15 bg-white/50 dark:bg-white/[0.06] p-4">
          <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-300 mb-2">USD</p>
          <InfoRows rows={[['전체 시드', usd(seed)], ['매입 금액', usd(used)], ['1회 투자금', usd(sum('unit_usd'))], ['포트폴리오 수', act.length]]} />
        </div>
        <ProgressBar pct={seed > 0 ? (used / seed) * 100 : 0} />
        <div className="flex justify-center pt-2">
          <Button variant="pill" size="md" onClick={onGuide}>간편 매매 가이드</Button>
        </div>
      </div>
    </div>
  );
}

function CardHead({ acc, right }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge tone="info" variant="solid" size="sm" className="rounded-full">Ver {acc.version.replace('V', '')}</Badge>
          <Badge size="sm" tone={acc.auto_order ? 'warning' : 'neutral'}>{acc.auto_order ? '자동 ON' : '자동 OFF'}</Badge>
            {acc.extras?.ladder && <Badge size="sm" tone="warning">사다리 ON</Badge>}
        </div>
        <p className="text-[32px] font-bold tracking-tight leading-tight text-slate-900 dark:text-white mt-1.5">{acc.ticker}</p>
        <p className="text-[12.5px] text-slate-500 dark:text-slate-400 truncate">{acc.name}</p>
      </div>
      <div className="flex gap-1.5 shrink-0">{right}</div>
    </div>
  );
}

const roundBtn = 'w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-brand hover:border-brand/40 transition-colors cursor-pointer';

// Front: summary, tap opens the detail view. Back: order guide. 3D flip via CSS transform (instant under prefers-reduced-motion).
function CycleFlipCard({ acc, onOpen, onEdit }) {
  const [flipped, setFlipped] = useState(false);
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  const prog = Number(acc.progress_pct) || 0;
  const face = 'absolute inset-0 [backface-visibility:hidden]';
  return (
    <div className="[perspective:1400px] h-full">
      <div className={`relative w-full h-full [transform-style:preserve-3d] transition-transform duration-500 ease-out motion-reduce:transition-none ${flipped ? '[transform:rotateY(180deg)]' : ''}`}>
        <div role="button" tabIndex={flipped ? -1 : 0} onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
          className={`${face} ${CARD} cursor-pointer ${flipped ? 'pointer-events-none' : ''}`}>
          <CardHead acc={acc} right={<button className={roundBtn} onClick={stop(onEdit)} aria-label="수정"><Pencil size={15} /></button>} />
          <div className="mt-auto space-y-3">
            <div className="ml-auto w-[88%] rounded-2xl border border-slate-300/60 dark:border-white/15 p-4">
              <InfoRows rows={[['평단가', usd(acc.avg_price)], ['보유 수량', `${acc.qty}주`], ['매입 금액', usd(acc.invested_usd)]]} />
            </div>
            <ProgressBar pct={prog} />
            <button onClick={stop(() => setFlipped(true))} className="mx-auto flex items-center gap-1.5 text-[12.5px] text-slate-500 dark:text-slate-400 hover:text-brand cursor-pointer pt-1"><RotateCw size={13} />주문 가이드 보기</button>
          </div>
        </div>
        <div className={`${face} ${CARD} [transform:rotateY(180deg)] ${flipped ? '' : 'pointer-events-none'}`} aria-hidden={!flipped}>
          <CardHead acc={acc} right={<>
            <button className={roundBtn} onClick={stop(() => setFlipped(false))} aria-label="뒤집기"><RotateCw size={15} /></button>
            <button className={roundBtn} onClick={stop(onEdit)} aria-label="수정"><Pencil size={15} /></button>
          </>} />
          <div className="flex-1 min-h-0 overflow-y-auto mt-3 pr-1"><GuideBody acc={acc} /></div>
          <div className="flex gap-2 pt-3">
            <Button size="sm" onClick={onOpen}>상세 보기</Button>
            <CopyButton text={sheetText(acc)} label="복사" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Horizontal scroll-snap track + arrows, dots and keyboard arrows.
function Carousel({ items }) {
  const ref = useRef(null);
  const [idx, setIdx] = useState(0);
  const step = () => { const el = ref.current; return el && el.children[0] ? el.children[0].offsetWidth + 16 : 1; };
  const go = (i) => ref.current?.scrollTo({ left: Math.max(0, Math.min(items.length - 1, i)) * step(), behavior: 'smooth' });
  const onScroll = () => setIdx(Math.round(ref.current.scrollLeft / step()));
  return (
    <div className="md:max-w-[792px] md:mx-auto min-w-0">
      <div ref={ref} tabIndex={0} onScroll={onScroll} aria-label="사이클 카드"
        onKeyDown={(e) => { if (e.key === 'ArrowRight') go(idx + 1); else if (e.key === 'ArrowLeft') go(idx - 1); }}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory hide-scrollbar focus:outline-none py-3">
        {items.map((it, i) => <div key={i} className="shrink-0 snap-start w-[85%] md:w-[380px] h-[60dvh] min-h-[460px]">{it}</div>)}
      </div>
      <div className="flex items-center justify-center gap-3 mt-1">
        <button className={`${roundBtn} hidden md:flex`} onClick={() => go(idx - 1)} aria-label="이전"><ChevronLeft size={16} /></button>
        <div className="flex gap-1.5">{items.map((_, i) => <button key={i} onClick={() => go(i)} aria-label={`${i + 1}번째 카드`} className={`w-1.5 h-1.5 rounded-full ${i === idx ? 'bg-brand' : 'bg-slate-300 dark:bg-slate-600'}`} />)}</div>
        <button className={`${roundBtn} hidden md:flex`} onClick={() => go(idx + 1)} aria-label="다음"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

function GuideModal({ open, onClose, live }) {
  const act = live.filter((c) => c.status === 'active');
  return (
    <Modal open={open} onClose={onClose} size="md">
      <Modal.Header><h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">간편 매매 가이드</h3></Modal.Header>
      <Modal.Body className="px-5 md:px-8 py-4 space-y-5">
        {!act.length && <p className="text-[13px] text-slate-500">진행 중인 사이클이 없습니다.</p>}
        {act.map((c) => (
          <div key={c.id}>
            <p className="text-[14px] font-semibold text-slate-900 dark:text-white">{c.ticker} <span className="text-[12px] font-normal text-slate-500">{c.name} · {c.version}</span></p>
            <GuideBody acc={c} />
          </div>
        ))}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>닫기</Button>
        <CopyButton text={act.map(sheetText).join('\n\n')} label="전체 복사" />
      </Modal.Footer>
    </Modal>
  );
}

function CreateModal({ open, onClose, api, onCreated }) {
  const blank = { name: '', version: 'V4.0', ticker: 'TQQQ', splits: 20, principal_usd: '', compounding: true, start_date: today(), t_value: '0', cash_usd: '', qty: '0', avg_price: '0' };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setF(blank); setErr(''); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const setVersion = (v) => setF((s) => ({ ...s, version: v, splits: VERSIONS[v].includes(Number(s.splits)) ? s.splits : VERSIONS[v][0] }));
  const submit = async (e) => {
    e.preventDefault();
    if (!VERSIONS[f.version].includes(Number(f.splits))) { setErr(`${f.version} 분할수는 ${VERSIONS[f.version].join('/')} 중 하나여야 합니다.`); return; }
    setBusy(true); setErr('');
    const body = { name: f.name, version: f.version, ticker: f.ticker, splits: Number(f.splits), principal_usd: Number(f.principal_usd), compounding: !!f.compounding, start_date: f.start_date || null, t_value: Number(f.t_value), qty: Number(f.qty), avg_price: Number(f.avg_price) };
    if (f.cash_usd !== '') body.cash_usd = Number(f.cash_usd);
    try { const r = await api('/cycles', 'POST', body); onCreated(r.data); onClose(); }
    catch (e2) { setErr(errMsg(e2)); }
    setBusy(false);
  };
  return (
    <Modal open={open} onClose={onClose} size="lg">
      <form onSubmit={submit} className="flex flex-col min-h-0">
        <Modal.Header><h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">새 사이클</h3></Modal.Header>
        <Modal.Body className="px-5 md:px-8 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Field label="사이클 이름 / 메모"><input className={INPUT} required maxLength={60} value={f.name} onChange={(e) => set('name')(e.target.value)} /></Field></div>
            <Field label="버전"><Select value={f.version} onChange={setVersion} options={opts(Object.keys(VERSIONS))} /></Field>
            <Field label="종목"><Select value={f.ticker} onChange={set('ticker')} options={opts(TICKERS)} /></Field>
            <Field label="분할수" hint={`${f.version}: ${VERSIONS[f.version].join(' / ')}`}><Select value={String(f.splits)} onChange={set('splits')} options={opts(VERSIONS[f.version])} /></Field>
            <Field label="시드 ($)"><input type="number" min="0" step="0.01" required className={INPUT} value={f.principal_usd} onChange={(e) => set('principal_usd')(e.target.value)} /></Field>
            <Field label="시작일"><input type="date" className={INPUT} value={f.start_date} onChange={(e) => set('start_date')(e.target.value)} /></Field>
            <label className="flex items-center gap-2 text-[12.5px] text-slate-600 dark:text-slate-300 self-end pb-2"><input type="checkbox" checked={f.compounding} onChange={(e) => set('compounding')(e.target.checked)} />복리 (원금 재투자)</label>
            <Field label="현재 T"><input type="number" min="0" step="any" className={INPUT} value={f.t_value} onChange={(e) => set('t_value')(e.target.value)} /></Field>
            <Field label="잔금 ($, 선택)"><input type="number" min="0" step="any" className={INPUT} value={f.cash_usd} onChange={(e) => set('cash_usd')(e.target.value)} /></Field>
            <Field label="수량"><input type="number" min="0" step="1" className={INPUT} value={f.qty} onChange={(e) => set('qty')(e.target.value)} /></Field>
            <Field label="평단 ($)"><input type="number" min="0" step="any" className={INPUT} value={f.avg_price} onChange={(e) => set('avg_price')(e.target.value)} /></Field>
          </div>
          <p className="text-[11px] text-slate-400">증권사 API 키 연결은 추후 지원 - 지금은 수동 입력</p>
          {err && <p className="text-[12px] text-negative break-words">{err}</p>}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="ghost" onClick={onClose}>취소</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? '만드는 중...' : '만들기'}</Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

// Portal to body: the page wrapper animates with transform, which would otherwise turn position:fixed into position:absolute.
// Sits above the existing back-to-top button (App.jsx: bottom-20 on phones, bottom-6 on desktop) and the mobile nav (4rem + safe area).
function Fab({ onClick }) {
  return createPortal(
    <button onClick={onClick} aria-label="새 사이클" title="새 사이클"
      className="fixed z-40 right-4 md:right-6 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] md:bottom-20 w-12 h-12 rounded-full bg-brand text-white dark:text-slate-900 shadow-lg flex items-center justify-center cursor-pointer hover:opacity-90">
      <Plus size={22} />
    </button>,
    document.body
  );
}

// ── Edit modal (no create: cycles come from the setup script / automatic next cycle) ──
const EDIT_KEYS = ['name', 'principal_usd', 'compounding', 'mode', 'status', 'auto_order', 'ladder', 't_value', 'cash_usd', 'qty', 'avg_price'];

function EditModal({ open, onClose, api, editing, onSaved }) {
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open || !editing) return;
    setErr('');
    setF({ ...Object.fromEntries(EDIT_KEYS.map((k) => [k, k === 'ladder' ? !!editing.extras?.ladder : editing[k] ?? ''])), start_date: ymd(editing.start_date) === '-' ? '' : ymd(editing.start_date) });
  }, [open, editing]);

  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    const body = { name: f.name, principal_usd: Number(f.principal_usd), compounding: !!f.compounding, mode: f.mode, status: f.status, auto_order: !!f.auto_order, extras: { ...(editing.extras || {}), ladder: !!f.ladder }, t_value: Number(f.t_value), qty: Number(f.qty), avg_price: Number(f.avg_price) };
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
            <Field label="이름 / 메모"><input className={INPUT} required maxLength={60} value={f.name ?? ''} onChange={(e) => set('name')(e.target.value)} /></Field>
            <Field label="원금 ($)"><input type="number" min="0" step="0.01" required className={INPUT} value={f.principal_usd ?? ''} onChange={(e) => set('principal_usd')(e.target.value)} /></Field>
            <Field label="시작일"><input type="date" className={INPUT} value={f.start_date ?? ''} onChange={(e) => set('start_date')(e.target.value)} /></Field>
            <div />
            <Field label="모드"><Select value={f.mode || 'normal'} onChange={set('mode')} options={optsMap(MODE_LABEL)} /></Field>
            <Field label="상태"><Select value={f.status || 'active'} onChange={set('status')} options={optsMap(STATUS_LABEL)} /></Field>
            <label className="flex items-center gap-2 text-[12.5px] text-slate-600 dark:text-slate-300"><input type="checkbox" checked={!!f.compounding} onChange={(e) => set('compounding')(e.target.checked)} />복리 (원금 재투자)</label>
            <label className="col-span-2 flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-slate-200"><input type="checkbox" role="switch" checked={!!f.auto_order} onChange={(e) => { if (e.target.checked && !window.confirm('실계좌로 매일 17:01에 LOC 매수·매도 주문이 자동 전송됩니다. 켜시겠습니까?')) return; set('auto_order')(e.target.checked); }} />자동매매 (매일 17:01 LOC 주문)</label>
            <label className="col-span-2 flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-slate-200"><input type="checkbox" role="switch" checked={!!f.ladder} onChange={(e) => { if (e.target.checked && !window.confirm('폭락장 대비 추가 매수(1주 LOC 6건)가 매일 함께 전송됩니다. 켜시겠습니까?')) return; set('ladder')(e.target.checked); }} />사다리 (폭락장 대비 추가 매수 6건)</label>
          </div>
          <Panel level="inset" padding="sm" radius="lg" className="space-y-3">
            <div>
              <p className="text-[13px] font-semibold text-slate-900 dark:text-white">수동 보정</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">현재 상태를 직접 입력합니다. 잔금을 비우면 변경하지 않습니다.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="T"><input type="number" min="0" step="any" className={INPUT} value={f.t_value ?? ''} onChange={(e) => set('t_value')(e.target.value)} /></Field>
              <Field label="잔금 ($)"><input type="number" min="0" step="any" className={INPUT} value={f.cash_usd ?? ''} onChange={(e) => set('cash_usd')(e.target.value)} /></Field>
              <Field label="수량"><input type="number" min="0" step="1" className={INPUT} value={f.qty ?? ''} onChange={(e) => set('qty')(e.target.value)} /></Field>
              <Field label="평단 ($)"><input type="number" min="0" step="any" className={INPUT} value={f.avg_price ?? ''} onChange={(e) => set('avg_price')(e.target.value)} /></Field>
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
          <Field label="평단 ($)"><input type="number" min="0" step="any" required className={INPUT} value={f.avg_price ?? ''} onChange={(e) => set('avg_price')(e.target.value)} /></Field>
          <Field label="투입금 ($, 선택)" hint="비우면 수량 x 평단"><input type="number" min="0" step="any" className={INPUT} value={f.invested_usd ?? ''} onChange={(e) => set('invested_usd')(e.target.value)} /></Field>
          <Field label="잔금 ($, 선택)"><input type="number" min="0" step="any" className={INPUT} value={f.cash_usd ?? ''} onChange={(e) => set('cash_usd')(e.target.value)} /></Field>
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
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, headers, logout } = useAuth();
  const [list, setList] = useState({ loading: false, error: '', data: [] });
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState({ open: false, editing: null });
  const [solver, setSolver] = useState({ open: false, target: null });
  const [guideOpen, setGuideOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // Every call sends the login token; a 401 (expired token) logs out, which sends the visitor to /login.
  const api = useCallback(async (path, method = 'GET', body) => {
    try {
      return await callApi(`/api/infinite${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      if (/API Error: 401/.test(e.message)) logout();
      throw e;
    }
  }, [callApi, headers, logout]);

  const load = useCallback(() => {
    if (!token) return;
    setList((l) => ({ ...l, loading: true, error: '' }));
    api('/cycles')
      .then((r) => setList({ loading: false, error: '', data: r.data || [] }))
      .catch((e) => { if (!/API Error: 401/.test(e.message)) setList({ loading: false, error: errMsg(e), data: [] }); });
  }, [api, token]);
  useEffect(load, [load]);

  const upsert = (c) => setList((l) => ({ ...l, data: l.data.map((a) => (a.id === c.id ? c : a)) }));
  // A fill that emptied the position closes the cycle and the backend opens the next one: reload.
  const onTrade = (r) => {
    if (r.next) { setNotice('사이클 종료 - 다음 사이클 생성됨'); load(); } else if (r.data) upsert(r.data);
  };
  const remove = async (c) => {
    if (!window.confirm(`"${c.cycle_key}" 사이클을 삭제할까요? (체결내역 포함)`)) return;
    try {
      await api(`/cycles/${c.id}`, 'DELETE');
      setList((l) => ({ ...l, data: l.data.filter((a) => a.id !== c.id) }));
      if (params.get('c') === c.id) setParams({}, { replace: true });
    } catch (e) { window.alert(`삭제 실패: ${errMsg(e)}`); }
  };

  // Detail view is selected by ?c=<id>, so the browser back button returns to the list.
  const detailId = params.get('c');
  const detail = detailId ? list.data.find((c) => c.id === detailId) : null;
  const openDetail = (c) => setParams({ c: c.id }, { state: { fromList: true } });
  const back = () => (location.state?.fromList ? navigate(-1) : setParams({}, { replace: true }));

  const live = list.data.filter((c) => c.status !== 'done');
  const past = list.data.filter((c) => c.status === 'done');
  const ready = token && !list.error && !(list.loading && !list.data.length);

  return (
    <div className="space-y-4 min-w-0">
      <ServerWakeupOverlay />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-[20px] font-semibold text-slate-900 dark:text-white flex items-center gap-2"><InfinityIcon size={20} />무한매수 매니저</h2>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => setSolver({ open: true, target: null })}><Calculator size={13} />현재 위치 역산</Button>
          <Button size="sm" variant="ghost" onClick={load} aria-label="새로고침"><RefreshCcw size={13} /></Button>
        </div>
      </div>

      {notice && (
        <Panel level="inset" padding="sm" radius="lg" className="flex items-center justify-between gap-3 text-[13px] text-slate-700 dark:text-slate-200">
          <span>{notice}</span>
          <Button size="sm" variant="ghost" onClick={() => setNotice('')}>닫기</Button>
        </Panel>
      )}

      {list.loading && !list.data.length ? <p className="text-[13px] text-slate-500 py-8 text-center">불러오는 중...</p>
        : list.error ? (
          <Card className="text-center text-[13.5px] text-slate-500 dark:text-slate-400">
            <p className="mb-3">사이클을 불러오지 못했습니다. ({list.error})</p>
            <Button onClick={load}><RefreshCcw size={13} />다시 시도</Button>
          </Card>
        )
        : detailId ? (
          detail ? (
            <CycleDetail acc={detail} api={api} onTrade={onTrade} onBack={back}
              onEdit={(x) => setEditor({ open: true, editing: x })} onDelete={remove}
              onBacksolve={(x) => setSolver({ open: true, target: x })} />
          ) : (
            <Card className="text-center text-[13.5px] text-slate-500 dark:text-slate-400">
              <p className="mb-3">사이클을 찾을 수 없습니다.</p>
              <Button onClick={back}><ArrowLeft size={13} />목록</Button>
            </Card>
          )
        ) : (
          <>
            {live.length ? (
              <Carousel items={[
                <OverallCard key="all" live={live} onGuide={() => setGuideOpen(true)} />,
                ...live.map((c) => <CycleFlipCard key={c.id} acc={c} onOpen={() => openDetail(c)} onEdit={() => setEditor({ open: true, editing: c })} />),
              ]} />
            ) : <Card className="text-center text-[13.5px] text-slate-500 dark:text-slate-400">진행 중인 사이클이 없습니다. 오른쪽 아래 + 버튼으로 새 사이클을 만드세요.</Card>}
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

      {ready && !detailId && <Fab onClick={() => setCreateOpen(true)} />}

      <EditModal open={editor.open} onClose={() => setEditor((e) => ({ ...e, open: false }))} api={api} editing={editor.editing} onSaved={upsert} />
      <BacksolveModal open={solver.open} onClose={() => setSolver((s) => ({ ...s, open: false }))} api={api} target={solver.target} onApplied={upsert} />
      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} live={live} />
      <CreateModal open={createOpen} onClose={() => setCreateOpen(false)} api={api} onCreated={() => load()} />
    </div>
  );
}
