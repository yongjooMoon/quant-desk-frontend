// src/pages/StockMarket.jsx — "증시": 국내 종목 목록(거래량/시총/거래대금/등락률) + MTS형 차트(일/주/월/년, 이동평균) + 거래량 + 애널리스트 목표가 + 재무 + 관련 뉴스
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, ArrowLeft, RefreshCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, CrosshairMode } from 'lightweight-charts';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer } from 'recharts';
import { useRenderApi } from '../hooks/useRenderApi';
import { Modal } from '../components';

const UP = '#DC2626';    // 상승 = 빨강 (프로젝트 공통 축)
const DOWN = '#2563EB';  // 하락 = 파랑
const MA_DEF = [{ k: 'ma20', label: 'MA20', color: '#F59E0B' }, { k: 'ma60', label: 'MA60', color: '#3B82F6' }, { k: 'ma120', label: 'MA120', color: '#94A3B8' }];
const TFS = [['D', '일'], ['W', '주'], ['M', '월'], ['Y', '년']];
const RANGES = [['1M', '1개월', 1], ['6M', '6개월', 6], ['1Y', '1년', 12], ['3Y', '3년', 36], ['ALL', '전체', 0]];
const DEFAULT_RANGE = { D: '6M', W: '3Y', M: 'ALL', Y: 'ALL' };
const SORTS = [['volume', '거래량'], ['marcap', '시가총액'], ['amount', '거래대금'], ['chg', '등락률']];
const MARKETS = [['ALL', '전체'], ['KOSPI', '코스피'], ['KOSDAQ', '코스닥']];

const PANEL = 'rounded-lg border border-slate-200 dark:border-[#2C323A] bg-white dark:bg-[#1E2329]';
const fmt = (n) => (n == null || Number.isNaN(n) ? '-' : Math.round(n).toLocaleString());
const sign = (v) => (v > 0 ? '+' : '');
const tone = (v) => (v > 0 ? UP : v < 0 ? DOWN : undefined);
const fmtEok = (e) => { if (e == null) return '-'; const neg = e < 0, a = Math.abs(e), jo = Math.floor(a / 10000), eok = Math.round(a % 10000); const t = jo ? `${jo.toLocaleString()}조${eok ? ' ' + eok.toLocaleString() + '억' : ''}` : `${eok.toLocaleString()}억`; return neg ? '-' + t : t; };
const fmtVol = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(v ?? '-'));
const yoy = (cur, prev) => (cur != null && prev ? ((cur - prev) / Math.abs(prev)) * 100 : null);

function useIsDark() {
  const get = () => document.documentElement.classList.contains('dark');
  const [dark, setDark] = useState(get);
  useEffect(() => {
    const ob = new MutationObserver(() => setDark(get()));
    ob.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => ob.disconnect();
  }, []);
  return dark;
}

const SectionTitle = ({ title, sub, right }) => (
  <div className="flex items-baseline justify-between gap-3 mb-4">
    <div className="flex items-baseline gap-2 min-w-0">
      <h3 className="text-[17px] font-semibold text-slate-900 dark:text-white whitespace-nowrap">{title}</h3>
      {sub && <span className="text-[12px] text-slate-500 dark:text-slate-400 truncate">{sub}</span>}
    </div>
    {right}
  </div>
);

// ── MTS형 캔들 차트: 캔들 + 거래량 + 이동평균, 십자선 범례(OHLC / 등락 / 거래량 / MA 값)
function PriceChart({ candles, tf, range, maOn, dark }) {
  const boxRef = useRef(null);
  const [legend, setLegend] = useState(null);

  useEffect(() => {
    if (!boxRef.current || !candles.length) return;
    const text = dark ? '#9AA4B2' : '#64748B', grid = dark ? 'rgba(148,163,184,0.10)' : 'rgba(100,116,139,0.12)';
    const chart = createChart(boxRef.current, {
      autoSize: true,
      layout: { background: { color: 'transparent' }, textColor: text, fontFamily: 'inherit', fontSize: 12 },
      localization: { priceFormatter: (p) => Math.round(p).toLocaleString() },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { labelBackgroundColor: dark ? '#475569' : '#334155' }, horzLine: { labelBackgroundColor: dark ? '#475569' : '#334155' } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.07, bottom: 0.27 } },
      timeScale: { borderVisible: false, timeVisible: false, rightOffset: 4 },
    });
    const candle = chart.addSeries(CandlestickSeries, { upColor: UP, downColor: DOWN, borderVisible: false, wickUpColor: UP, wickDownColor: DOWN, priceFormat: { type: 'price', precision: 0, minMove: 1 } });
    candle.setData(candles.map(c => ({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c })));
    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol', lastValueVisible: false, priceLineVisible: false });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    vol.setData(candles.map(c => ({ time: c.t, value: c.v, color: c.c >= c.o ? 'rgba(220,38,38,0.5)' : 'rgba(37,99,235,0.5)' })));
    MA_DEF.forEach(m => {
      if (!maOn[m.k]) return;
      const s = chart.addSeries(LineSeries, { color: m.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      s.setData(candles.filter(c => c[m.k] != null).map(c => ({ time: c.t, value: c[m.k] })));
    });
    const byTime = new Map(candles.map(c => [c.t, c]));
    const lastC = candles[candles.length - 1];
    const prevOf = new Map(candles.map((c, i) => [c.t, i > 0 ? candles[i - 1].c : null]));
    const show = (c) => { const pc = c ? prevOf.get(c.t) : null; setLegend(c ? { ...c, chg: pc ? (c.c / pc - 1) * 100 : null } : null); };
    show(lastC);
    chart.subscribeCrosshairMove(p => { const c = p.time ? byTime.get(p.time) : null; show(c || lastC); });
    // 표시 구간
    const months = (RANGES.find(r => r[0] === range) || [])[2];
    if (!months) chart.timeScale().fitContent();
    else {
      const d = new Date(lastC.t); d.setMonth(d.getMonth() - months);
      const from = d.toISOString().slice(0, 10);
      const first = candles.find(c => c.t >= from) || candles[0];
      chart.timeScale().setVisibleRange({ from: first.t, to: lastC.t });
    }
    return () => chart.remove();
  }, [candles, tf, range, maOn, dark]);

  const up = legend && legend.c >= legend.o;
  return (
    <div className="relative">
      {legend && (
        <div className="absolute top-1 left-2 z-10 text-[12px] tabular-nums leading-relaxed pointer-events-none">
          <div className="flex flex-wrap gap-x-3 text-slate-500 dark:text-slate-400">
            <span>시 <b style={{ color: up ? UP : DOWN }}>{fmt(legend.o)}</b></span>
            <span>고 <b style={{ color: up ? UP : DOWN }}>{fmt(legend.h)}</b></span>
            <span>저 <b style={{ color: up ? UP : DOWN }}>{fmt(legend.l)}</b></span>
            <span>종 <b style={{ color: up ? UP : DOWN }}>{fmt(legend.c)}</b></span>
            {legend.chg != null && <b style={{ color: tone(legend.chg) }}>{sign(legend.chg)}{legend.chg.toFixed(2)}%</b>}
            <span>거래량 <b className="text-slate-800 dark:text-slate-100">{fmt(legend.v)}</b></span>
            <span className="text-slate-400">{legend.t}</span>
          </div>
          <div className="flex gap-x-3 font-medium">
            {MA_DEF.filter(m => maOn[m.k]).map(m => <span key={m.k} style={{ color: m.color }}>{m.label} {legend[m.k] != null ? fmt(legend[m.k]) : '-'}</span>)}
          </div>
        </div>
      )}
      <div ref={boxRef} className="w-full h-[380px] md:h-[460px]" />
    </div>
  );
}

// ── 거래량: 최근 60거래일 막대 + 20일 평균선 (툴팁은 테마에 맞춰 직접 스타일링)
function VolumePanel({ daily, dark }) {
  const data = useMemo(() => daily.map((c, i) => {
    const w = daily.slice(Math.max(0, i - 19), i + 1);
    return { t: c.t.slice(5), v: c.v, avg: w.length === 20 ? Math.round(w.reduce((a, b) => a + b.v, 0) / 20) : null };
  }).slice(-60), [daily]);
  if (!data.length) return <div className="h-[170px] flex items-center justify-center text-[13px] text-slate-500">거래량 불러오는 중…</div>;
  const last = data[data.length - 1];
  const ratio = last.avg ? (last.v / last.avg - 1) * 100 : null;
  const box = { background: dark ? '#0F1318' : '#FFFFFF', border: `1px solid ${dark ? '#2C323A' : '#E2E8F0'}`, borderRadius: 6, fontSize: 12, color: dark ? '#E2E8F0' : '#0F172A', boxShadow: '0 4px 14px rgba(0,0,0,0.25)' };
  return (
    <div>
      <SectionTitle title="거래량" sub="최근 60거래일" right={<span className="text-[12.5px] text-slate-500 dark:text-slate-400 tabular-nums">최근 {fmt(last.v)}주{ratio != null && <> · 20일 평균 대비 <b style={{ color: tone(ratio) }}>{sign(ratio)}{ratio.toFixed(0)}%</b></>}</span>} />
      <div className="h-[170px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="t" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval={11} />
            <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={44} tickFormatter={fmtVol} />
            <RTooltip cursor={{ fill: dark ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.10)' }} contentStyle={box} labelStyle={{ color: dark ? '#CBD5E1' : '#475569', marginBottom: 2 }}
              itemStyle={{ color: dark ? '#E2E8F0' : '#0F172A' }} formatter={(v, n) => [`${fmt(v)}주`, n === 'v' ? '거래량' : '20일 평균']} />
            <Bar dataKey="v" name="v" fill="#94A3B8" fillOpacity={0.6} isAnimationActive={false} />
            <Line dataKey="avg" name="avg" stroke="#F59E0B" dot={false} strokeWidth={2} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── 애널리스트 목표가: 의견 도넛 + 평균/현재가 + 범위 막대 + 증권사별 평가
const OPN = { 매수: { c: '#10B981', bg: 'rgba(16,185,129,0.16)' }, 중립: { c: '#F59E0B', bg: 'rgba(245,158,11,0.16)' }, 매도: { c: '#F43F5E', bg: 'rgba(244,63,94,0.16)' } };
function Donut({ counts, total }) {
  const R = 34, C = 2 * Math.PI * R;
  let off = 0;
  return (
    <svg viewBox="0 0 88 88" className="w-[88px] h-[88px] shrink-0 -rotate-90">
      <circle cx="44" cy="44" r={R} fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth="9" />
      {['매수', '중립', '매도'].map(k => {
        const n = counts[k]; if (!n) return null;
        const len = (n / total) * C, el = <circle key={k} cx="44" cy="44" r={R} fill="none" stroke={OPN[k].c} strokeWidth="9" strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-off} />;
        off += len; return el;
      })}
    </svg>
  );
}
function TargetPanel({ state, price }) {
  const [pg, setPg] = useState(0);
  useEffect(() => { setPg(0); }, [state.reports]);
  if (state.loading) return <div className={`${PANEL} p-5 text-[13px] text-slate-500`}>목표가 불러오는 중…</div>;
  if (state.error || state.status !== 'success') return <div className={`${PANEL} p-5`}><SectionTitle title="목표가" sub="애널리스트 컨센서스" /><p className="text-[13px] text-slate-500">{state.message || '애널리스트 목표가 데이터가 없습니다.'}</p></div>;
  const reps = state.reports || [];
  const PER = 5, pages = Math.max(1, Math.ceil(reps.length / PER)), cur = Math.min(pg, pages - 1), shown = reps.slice(cur * PER, cur * PER + PER);
  const counts = { 매수: 0, 중립: 0, 매도: 0 };
  reps.forEach(r => { if (counts[r.opinion] != null) counts[r.opinion] += 1; });
  const total = counts.매수 + counts.중립 + counts.매도;
  const verdict = total ? (counts.매수 / total >= 0.6 ? ['매수 우세', '매수'] : counts.매도 / total >= 0.6 ? ['매도 우세', '매도'] : ['의견 분분', '중립']) : null;
  const mean = state.consensus?.mean, med = state.median_recent;
  const goals = reps.map(r => r.goal).filter(Boolean);
  const lo = Math.min(...goals, price || Infinity), hi = Math.max(...goals, price || 0, mean || 0);
  const pos = (v) => (v && hi > lo ? Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100)) : 0);
  const upMean = mean && price ? (mean / price - 1) * 100 : null, upMed = med && price ? (med / price - 1) * 100 : null;
  return (
    <div className={`${PANEL} p-5`}>
      <SectionTitle title="목표가" sub="애널리스트 컨센서스" right={<span className="text-[12px] text-slate-500 dark:text-slate-400">최근 {reps.length}건</span>} />
      <div className="flex items-center gap-5 mb-5 pb-5 border-b border-slate-100 dark:border-[#2C323A]">
        <div className="relative">
          <Donut counts={counts} total={total || 1} />
          <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-[22px] font-bold text-slate-900 dark:text-white leading-none">{total}</span><span className="text-[10.5px] text-slate-500 mt-0.5">투자의견</span></div>
        </div>
        <div className="min-w-0">
          {verdict && <div className="flex items-center gap-2 mb-2"><span className="text-[12px] text-slate-500 dark:text-slate-400">전체 의견</span><span className="px-2 py-0.5 rounded text-[12px] font-semibold" style={{ color: OPN[verdict[1]].c, background: OPN[verdict[1]].bg }}>{verdict[0]}</span></div>}
          <div className="flex gap-3 text-[13px] text-slate-700 dark:text-slate-200">
            {['매수', '중립', '매도'].map(k => <span key={k} className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: OPN[k].c }} />{k === '중립' ? '보유' : k} <b>{counts[k]}</b></span>)}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <div className="text-[12px] text-slate-500 dark:text-slate-400 mb-0.5">{med ? '최근 중간 목표가' : '평균 목표가'}</div>
          <div className="text-[26px] font-bold tabular-nums text-slate-900 dark:text-white leading-tight">₩{fmt(med || mean)}</div>
          {(med ? upMed : upMean) != null && <div className="text-[13px] font-semibold tabular-nums" style={{ color: tone(med ? upMed : upMean) }}>{sign(med ? upMed : upMean)}{(med ? upMed : upMean).toFixed(1)}%</div>}
        </div>
        <div className="text-right">
          <div className="text-[12px] text-slate-500 dark:text-slate-400 mb-0.5">현재가</div>
          <div className="text-[26px] font-bold tabular-nums text-slate-900 dark:text-white leading-tight">₩{fmt(price)}</div>
          {mean && med && <div className="text-[12px] text-slate-500 tabular-nums">컨센서스 평균 ₩{fmt(mean)}</div>}
        </div>
      </div>
      {goals.length > 0 && (
        <div className="mb-5">
          <div className="relative h-2 rounded-full" style={{ background: 'linear-gradient(90deg, rgba(16,185,129,0.15), #10B981)' }}>
            {price && <span className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-slate-400 bg-white dark:bg-[#1E2329]" style={{ left: `calc(${pos(price)}% - 7px)` }} title="현재가" />}
            {(med || mean) && <span className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-emerald-500 bg-white dark:bg-[#1E2329]" style={{ left: `calc(${pos(med || mean)}% - 7px)` }} title="목표가" />}
          </div>
          <div className="flex justify-between mt-1.5 text-[11.5px] text-slate-500 tabular-nums"><span>최저 ₩{fmt(Math.min(...goals))}</span><span>최고 ₩{fmt(Math.max(...goals))}</span></div>
        </div>
      )}
      <div className="text-[14px] font-semibold text-slate-900 dark:text-white mb-1">최근 평가</div>
      <div className="divide-y divide-slate-100 dark:divide-[#2C323A]">
        {shown.map((r, i) => {
          const o = OPN[r.opinion] || { c: '#94A3B8', bg: 'rgba(148,163,184,0.18)' }, u = r.goal && price ? (r.goal / price - 1) * 100 : null;
          return (
            <div key={i} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[14.5px] font-semibold text-slate-900 dark:text-white">{r.broker}</div>
                <div className="flex items-center gap-2 mt-1 text-[12px] text-slate-500 dark:text-slate-400">
                  <span className="px-1.5 py-0.5 rounded font-semibold" style={{ color: o.c, background: o.bg }}>{r.opinion}</span><span>{r.date}</span>
                </div>
                <div className="text-[11.5px] text-slate-500 truncate mt-0.5">{r.title}</div>
              </div>
              <div className="text-right tabular-nums shrink-0">
                <div className="text-[15px] font-bold text-slate-900 dark:text-white">{r.goal ? `₩${fmt(r.goal)}` : '-'}</div>
                {u != null && <div className="text-[12.5px] font-semibold" style={{ color: tone(u) }}>{sign(u)}{u.toFixed(1)}%</div>}
              </div>
            </div>
          );
        })}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-3">
          <button type="button" disabled={cur === 0} onClick={() => setPg(cur - 1)} className="p-1.5 rounded-lg border border-slate-200 dark:border-[#2C323A] text-slate-600 dark:text-slate-300 disabled:opacity-30"><ChevronLeft size={16} /></button>
          <span className="text-[12.5px] tabular-nums text-slate-500 dark:text-slate-400">{cur + 1} / {pages}</span>
          <button type="button" disabled={cur >= pages - 1} onClick={() => setPg(cur + 1)} className="p-1.5 rounded-lg border border-slate-200 dark:border-[#2C323A] text-slate-600 dark:text-slate-300 disabled:opacity-30"><ChevronRight size={16} /></button>
        </div>
      )}
      <p className="mt-3 text-[11px] text-slate-400">{state.source === 'kis' ? `출처 한국투자증권 Open API · 증권사별 최신 의견 (최근 180일${state.consensus?.asof ? `, 최신 ${state.consensus.asof}` : ''})` : `출처 네이버 증권${state.consensus?.asof ? ` · 컨센서스 ${state.consensus.asof} 기준` : ''}. 리포트는 최근 5건만 제공되며, 컨센서스 평균은 더 많은 증권사를 반영해 다를 수 있습니다.`}</p>
    </div>
  );
}

// ── 재무: 연간 요약 타일 + 최근 8분기 표 (옵션 대신)
function FinancialPanel({ state }) {
  if (state.loading) return <div className={`${PANEL} p-5 text-[13px] text-slate-500`}>재무 불러오는 중…</div>;
  if (state.status !== 'success') return <div className={`${PANEL} p-5`}><SectionTitle title="재무" /><p className="text-[13px] text-slate-500">{state.message || '재무 데이터가 없습니다.'}</p></div>;
  const a = state.annual || {};
  const tiles = [
    ['매출액', fmtEok(a.revenue_cur), yoy(a.revenue_cur, a.revenue_prev)], ['영업이익', fmtEok(a.op_profit_cur), yoy(a.op_profit_cur, a.op_profit_prev)], ['순이익', fmtEok(a.net_income_cur), yoy(a.net_income_cur, a.net_income_prev)],
    ['영업이익률', a.op_margin != null ? `${a.op_margin.toFixed(1)}%` : '-'], ['순이익률', a.net_margin != null ? `${a.net_margin.toFixed(1)}%` : '-'], ['ROE', a.roe != null ? `${a.roe.toFixed(1)}%` : '-'],
    ['부채비율', a.debt_ratio != null ? `${a.debt_ratio.toFixed(1)}%` : '-'], ['PER', a.per != null ? `${a.per.toFixed(1)}배` : '-'], ['PBR', a.pbr != null ? `${a.pbr.toFixed(2)}배` : '-'],
    ['EPS', a.eps_cur != null ? `₩${fmt(a.eps_cur)}` : '-', yoy(a.eps_cur, a.eps_prev)], ['시가총액', fmtEok(a['marcap_억'])], ['배당수익률', a.dividend_yield != null ? `${a.dividend_yield.toFixed(2)}%` : '-'],
  ];
  return (
    <div className={`${PANEL} p-5`}>
      <SectionTitle title="재무" sub="DART 공시 기준 · 최근 사업연도 대비 증감" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px rounded-md overflow-hidden bg-slate-100 dark:bg-[#2C323A] mb-6">
        {tiles.map(([l, v, g]) => (
          <div key={l} className="bg-white dark:bg-[#1E2329] p-3.5">
            <div className="text-[12px] text-slate-500 dark:text-slate-400">{l}</div>
            <div className="text-[17px] font-semibold tabular-nums text-slate-900 dark:text-white mt-0.5">{v}</div>
            {g != null && <div className="text-[12px] font-medium tabular-nums" style={{ color: tone(g) }}>{sign(g)}{g.toFixed(1)}% YoY</div>}
          </div>
        ))}
      </div>
      <div className="text-[14px] font-semibold text-slate-900 dark:text-white mb-2">분기 실적 <span className="text-[12px] font-normal text-slate-500">(최근 {state.quarters.length}분기)</span></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px] tabular-nums">
          <thead><tr className="text-[11.5px] text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-[#2C323A]">
            <th className="text-left font-medium py-2">분기</th><th className="text-right font-medium">매출</th><th className="text-right font-medium">영업이익</th><th className="text-right font-medium">순이익</th><th className="text-right font-medium">EPS</th><th className="text-right font-medium">ROE</th></tr></thead>
          <tbody>
            {state.quarters.map(q => (
              <tr key={`${q.bsns_year}-${q.quarter}`} className="border-b border-slate-50 dark:border-[#2C323A]/60 text-slate-800 dark:text-slate-200">
                <td className="py-2 font-medium">{q.bsns_year} {q.quarter}Q</td><td className="text-right">{fmtEok(q.revenue_q)}</td>
                <td className="text-right" style={{ color: tone(q.op_profit_q) }}>{fmtEok(q.op_profit_q)}</td><td className="text-right" style={{ color: tone(q.net_income_q) }}>{fmtEok(q.net_income_q)}</td>
                <td className="text-right">{q.eps_q != null ? fmt(q.eps_q) : '-'}</td><td className="text-right">{q.roe != null ? `${q.roe.toFixed(1)}%` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 관련 뉴스: market_news 중 제목/관련 자산에 종목명이 들어간 기사 + 업종명 키워드가 들어간 기사(via='sector'). 5건씩 페이지, 클릭하면 뉴스탭과 같은 팝업
const NEWS_PAGE = 5;
const sentimentInfo = (score) => {
  if (score <= 2) return { text: 'Bearish', label: '부정적', cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20', bar: '#EF4444' };
  if (score === 3) return { text: 'Neutral', label: '중립', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20', bar: '#D97706' };
  return { text: 'Bullish', label: '긍정적', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20', bar: '#059669' };
};

function NewsModal({ item, idx, total, onClose, onMove }) {
  const sc = Number(item.score) || 0, sm = sentimentInfo(sc);
  const body = (item.summary || '').replace(/http[^\s]+/g, '').replace(/\n{3,}/g, '\n\n').trim();
  return (
    <Modal open onClose={onClose} size="xl" className="min-h-[60vh] md:min-h-[70vh]">
      <Modal.Header>
        <div className="flex items-center gap-2">
          {item.major && <span className="text-[12px] font-semibold text-orange-600 dark:text-orange-400">주요</span>}
          {item.region && <span className="text-[12px] md:text-[14px] font-medium text-slate-500 dark:text-slate-400">{item.region}</span>}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[13px] md:text-[14px] text-slate-400 dark:text-slate-500 tabular-nums">{item.time}</span>
          <button onClick={onClose} className="shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-[13px] md:text-[14px] font-medium">닫기</button>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="p-6 md:p-10 flex flex-col lg:flex-row gap-8 lg:gap-12">
          <div className="flex-1 min-w-0">
            {item.assets && item.assets.trim() && (
              <div className="mb-5"><span className="text-[12px] md:text-[13.5px] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1">#{item.assets}</span></div>
            )}
            <h2 className="text-[22px] md:text-[28px] font-semibold text-slate-900 dark:text-slate-100 mb-7 leading-[1.3]">{item.title}</h2>
            <div className="border-l-2 border-slate-200 dark:border-slate-700 pl-5 md:pl-6">
              <h4 className="text-slate-500 dark:text-slate-400 font-medium mb-3 text-[13px] md:text-[14.5px]">AI 핵심 요약</h4>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed md:leading-loose whitespace-pre-line text-[15.5px] md:text-[17px]">{body}</p>
            </div>
          </div>
          <div className="lg:w-[260px] shrink-0">
            <div className="rounded-lg border border-slate-200 dark:border-[#2C323A] bg-slate-50 dark:bg-[#16233A] p-5 lg:sticky lg:top-0">
              <span className="text-[12.5px] md:text-[13.5px] font-medium text-slate-500 dark:text-slate-400 block mb-4">AI Sentiment Score</span>
              <div className="flex items-center gap-1.5 mb-4">
                {[1, 2, 3, 4, 5].map(seg => <span key={seg} className="block flex-1 h-2.5 rounded-sm" style={{ background: seg <= sc ? sm.bar : 'rgba(148,163,184,0.25)' }} />)}
              </div>
              <span className={`inline-block font-medium px-3 py-1.5 rounded-md text-[13px] md:text-[14px] ${sm.cls}`}>{sc} / 5 · {sm.text} ({sm.label})</span>
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button onClick={() => onMove(-1)} disabled={idx <= 0} className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:text-slate-900 dark:hover:text-white"><ChevronLeft size={15} /> 이전 뉴스</button>
        <span className="text-[12px] text-slate-400 tabular-nums">{idx + 1} / {total}</span>
        <button onClick={() => onMove(1)} disabled={idx >= total - 1} className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:text-slate-900 dark:hover:text-white">다음 뉴스 <ChevronRight size={15} /></button>
      </Modal.Footer>
    </Modal>
  );
}

function NewsPanel({ state, name }) {
  const [page, setPage] = useState(0);
  const [openIdx, setOpenIdx] = useState(null);       // 전체 목록 기준 인덱스
  const data = state.data || [];
  const pages = Math.max(1, Math.ceil(data.length / NEWS_PAGE));
  useEffect(() => { setPage(0); setOpenIdx(null); }, [name]);
  const cur = Math.min(page, pages - 1);
  const slice = data.slice(cur * NEWS_PAGE, cur * NEWS_PAGE + NEWS_PAGE);
  const move = (d) => setOpenIdx(i => { const n = i + d; if (n < 0 || n >= data.length) return i; setPage(Math.floor(n / NEWS_PAGE)); return n; });
  const pg = (active) => `min-w-[30px] h-[30px] px-2 rounded-md text-[12.5px] font-medium tabular-nums transition-colors ${active ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700/50'}`;
  return (
    <div className={`${PANEL} p-5`}>
      <SectionTitle title="뉴스" sub={`${name} 관련${data.length ? ` · ${data.length}건` : ''}`} />
      {state.loading && <p className="text-[13px] text-slate-500">불러오는 중…</p>}
      {!state.loading && !data.length && <p className="text-[13px] text-slate-500">관련 뉴스가 없습니다.</p>}
      <div className="space-y-2.5">
        {slice.map((n, k) => (
          <button key={n.id} onClick={() => setOpenIdx(cur * NEWS_PAGE + k)} className="w-full text-left rounded-md border border-slate-200 dark:border-[#2C323A] p-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
            <div className="flex items-center justify-between gap-2 mb-1.5 text-[11.5px]">
              <div className="flex items-center gap-1.5 min-w-0">
                {n.major && <span className="px-1.5 py-0.5 rounded font-semibold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-500/15">주요</span>}
                {n.via === 'sector' && <span className="px-1.5 py-0.5 rounded font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">업종</span>}
                {n.region && <span className="px-1.5 py-0.5 rounded font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/60 truncate">{n.region}</span>}
              </div>
              <span className="text-slate-400 tabular-nums shrink-0">{n.time}</span>
            </div>
            <div className="text-[14.5px] font-semibold text-slate-900 dark:text-white leading-snug">{n.title}</div>
            {n.summary && <div className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{n.summary.replace(/\s+/g, ' ')}</div>}
          </button>
        ))}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-4">
          <button onClick={() => setPage(Math.max(0, cur - 1))} disabled={cur === 0} className={`${pg(false)} disabled:opacity-30`} aria-label="이전 페이지"><ChevronLeft size={15} className="mx-auto" /></button>
          {Array.from({ length: pages }, (_, i) => <button key={i} onClick={() => setPage(i)} className={pg(i === cur)}>{i + 1}</button>)}
          <button onClick={() => setPage(Math.min(pages - 1, cur + 1))} disabled={cur === pages - 1} className={`${pg(false)} disabled:opacity-30`} aria-label="다음 페이지"><ChevronRight size={15} className="mx-auto" /></button>
        </div>
      )}
      {openIdx != null && data[openIdx] && <NewsModal item={data[openIdx]} idx={openIdx} total={data.length} onClose={() => setOpenIdx(null)} onMove={move} />}
    </div>
  );
}

export default function StockMarket() {
  const { callApi, ServerWakeupOverlay } = useRenderApi();
  const dark = useIsDark();
  const [market, setMarket] = useState('ALL');
  const [sort, setSort] = useState('volume');
  const [list, setList] = useState({ loading: true, rows: [], asof: null, error: null });
  const [options, setOptions] = useState([]);
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(null);                 // { symbol, name, market }
  const [tf, setTf] = useState('D');
  const [range, setRange] = useState('6M');
  const [maOn, setMaOn] = useState({ ma20: true, ma60: true, ma120: false });
  const [chart, setChart] = useState({ loading: false, candles: [], last: null, error: null });
  const [daily, setDaily] = useState([]);
  const [chartDone, setChartDone] = useState(null);       // symbol whose chart request has settled
  const [target, setTarget] = useState({ loading: false });
  const [fin, setFin] = useState({ loading: false });
  const [news, setNews] = useState({ loading: false, data: [] });
  const boxRef = useRef(null);
  const symRef = useRef(null);

  useEffect(() => {      // deep link: /market?s=000660&n=SK하이닉스
    const q = new URLSearchParams(window.location.search), s0 = q.get('s');
    if (s0 && /^[0-9A-Z]{6}$/.test(s0)) setSel({ symbol: s0, name: q.get('n') || s0, market: q.get('m') || '' });
  }, []);

  useEffect(() => {
    setList(p => ({ ...p, loading: true }));
    callApi(`/api/market/list?market=${market}&sort=${sort}&limit=100`).then(r => {
      if (r.status === 'success') setList({ loading: false, rows: r.data, asof: r.asof, error: null });
      else setList({ loading: false, rows: [], asof: null, error: r.message || '목록을 불러오지 못했습니다.' });
    }).catch(() => setList({ loading: false, rows: [], asof: null, error: '목록을 불러오지 못했습니다.' }));
  }, [market, sort, callApi]);

  const optionsLoadedRef = useRef(false);
  const loadOptions = useCallback(() => {      // search list: fetched on the first use of the search box, not on every page visit
    if (optionsLoadedRef.current) return;
    optionsLoadedRef.current = true;
    const key = `sm_krx_${new Date().toISOString().slice(0, 10)}`;
    try { const c = window.sessionStorage.getItem(key); if (c) { setOptions(JSON.parse(c)); return; } } catch (e) { /* no cache */ }
    callApi('/api/krx-list').then(r => {
      if (r.status === 'success') { setOptions(r.data); try { window.sessionStorage.setItem(key, JSON.stringify(r.data)); } catch (e) { /* quota */ } }
      else optionsLoadedRef.current = false;
    }).catch(() => { optionsLoadedRef.current = false; });
  }, [callApi]);

  useEffect(() => {
    const h = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const loadChart = useCallback((symbol, tfv) => {
    const sameSym = symRef.current === symbol;     // a different symbol must not show the previous symbol's candles while loading
    symRef.current = symbol;
    setChart(p => sameSym ? { ...p, loading: true, error: null } : { loading: true, candles: [], last: null, error: null });
    callApi(`/api/market/chart/${symbol}?tf=${tfv}`).then(r => {
      if (symRef.current !== symbol) return;
      if (r.status === 'success') { setChart({ loading: false, candles: r.candles, last: r.last, error: null }); if (tfv === 'D') setDaily(r.candles); }
      else setChart({ loading: false, candles: [], last: null, error: r.message || '차트를 불러오지 못했습니다.' });
      setChartDone(symbol);
    }).catch(() => { setChart({ loading: false, candles: [], last: null, error: '차트를 불러오지 못했습니다.' }); if (symRef.current === symbol) setChartDone(symbol); });
  }, [callApi]);

  useEffect(() => { if (sel) loadChart(sel.symbol, tf); }, [sel, tf, loadChart]);
  useEffect(() => {      // 일봉은 거래량 패널용으로 종목당 한 번만
    if (!sel || tf === 'D') return;
    callApi(`/api/market/chart/${sel.symbol}?tf=D`).then(r => { if (r.status === 'success') setDaily(r.candles); }).catch(() => {});
  }, [sel, callApi]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {      // reset the side panels when a stock is opened; the fallback timer releases them if the chart is slow
    if (!sel) return undefined;
    setTarget({ loading: true }); setFin({ loading: true }); setNews({ loading: true, data: [] });
    const t = setTimeout(() => setChartDone(sel.symbol), 2500);
    return () => clearTimeout(t);
  }, [sel]);
  useEffect(() => {      // 목표가 / 재무 / 뉴스: after the chart settled (4 requests at once made the host answer [Errno 11]); 목표가는 서버가 24시간 캐시
    if (!sel || chartDone !== sel.symbol) return undefined;
    let alive = true;      // a slow answer of the previous symbol must not overwrite the current symbol's panels
    callApi(`/api/market/targets/${sel.symbol}`).then(r => { if (alive) setTarget({ loading: false, ...r }); }).catch(() => { if (alive) setTarget({ loading: false, error: true }); });
    callApi(`/api/market/financials/${sel.symbol}`).then(r => { if (alive) setFin({ loading: false, ...r }); }).catch(() => { if (alive) setFin({ loading: false, message: '재무를 불러오지 못했습니다.' }); });
    callApi(`/api/market/news/${sel.symbol}?name=${encodeURIComponent(sel.name)}`).then(r => { if (alive) setNews({ loading: false, data: r.data || [] }); }).catch(() => { if (alive) setNews({ loading: false, data: [] }); });
    return () => { alive = false; };
  }, [sel, chartDone, callApi]);

  const clearDetail = () => { symRef.current = null; setChart({ loading: false, candles: [], last: null, error: null }); setDaily([]); setTarget({ loading: false }); setFin({ loading: false }); setNews({ loading: false, data: [] }); };

  const choose = (symbol, name, mk) => { clearDetail(); setChart({ loading: true, candles: [], last: null, error: null }); setSel({ symbol, name, market: mk }); setTf('D'); setRange('6M'); setTerm(''); setOpen(false); window.scrollTo?.(0, 0); };      // clear the previous symbol's data first
  const changeTf = (k) => { setTf(k); setRange(DEFAULT_RANGE[k]); };
  const matches = term ? options.filter(o => o.SearchStr.toLowerCase().includes(term.toLowerCase())).slice(0, 8) : [];
  const price = chart.last?.close;

  const searchBox = (
    <div ref={boxRef} className="relative w-full md:w-[340px]">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input value={term} onChange={e => { setTerm(e.target.value); setOpen(true); loadOptions(); }} onFocus={() => { setOpen(true); loadOptions(); }} placeholder="종목명 또는 코드 검색"
        className="w-full pl-9 pr-3 py-2 text-[13.5px] rounded-md border border-slate-200 dark:border-[#2C323A] bg-white dark:bg-[#1E2329] text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400" />
      {open && matches.length > 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-md border border-slate-200 dark:border-[#2C323A] bg-white dark:bg-[#1E2329] shadow-lg overflow-hidden">
          {matches.map(o => (
            <button key={o.Symbol} onClick={() => choose(o.Symbol, o.Name, o.Market)} className="w-full text-left px-3 py-2 text-[13px] hover:bg-slate-50 dark:hover:bg-slate-700/40 flex justify-between">
              <span className="text-slate-900 dark:text-slate-100">{o.Name}</span><span className="text-slate-400 tabular-nums">{o.Symbol} · {o.Market}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const pill = (active) => `px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors ${active ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800/70'}`;
  const tab = (active) => `px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${active ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`;

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-6 pb-24">
      <ServerWakeupOverlay />
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          {sel && <button onClick={() => { clearDetail(); setSel(null); }} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" title="목록으로"><ArrowLeft size={18} /></button>}
          <h1 className="text-[20px] font-semibold text-slate-900 dark:text-white">증시</h1>
          <span className="text-[12px] text-slate-500">국내 (코스피 · 코스닥){list.asof && !sel ? ` · ${list.asof} 종가 기준` : ''}</span>
        </div>
        {searchBox}
      </div>

      {!sel && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex gap-1.5">{MARKETS.map(([k, l]) => <button key={k} onClick={() => setMarket(k)} className={pill(market === k)}>{l}</button>)}</div>
            <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
            <div className="flex gap-1.5">{SORTS.map(([k, l]) => <button key={k} onClick={() => setSort(k)} className={pill(sort === k)}>{l}</button>)}</div>
          </div>
          <div className={`${PANEL} overflow-hidden`}>
            <div className="grid grid-cols-[28px_1fr_90px_70px] md:grid-cols-[36px_1fr_110px_90px_120px_150px] gap-2 px-4 py-2.5 text-[11.5px] font-medium text-slate-500 border-b border-slate-100 dark:border-[#2C323A]">
              <div>#</div><div>종목</div><div className="text-right">현재가</div><div className="text-right">등락률</div>
              <div className="hidden md:block text-right">거래량</div><div className="hidden md:block text-right">시가총액</div>
            </div>
            {list.loading && <div className="p-8 text-center text-[13px] text-slate-500 flex items-center justify-center gap-2"><RefreshCcw size={14} className="animate-spin" />불러오는 중…</div>}
            {list.error && <div className="p-8 text-center text-[13px] text-slate-500">{list.error}</div>}
            {!list.loading && list.rows.map((r, i) => (
              <button key={r.symbol} onClick={() => choose(r.symbol, r.name, r.market)}
                className="w-full text-left grid grid-cols-[28px_1fr_90px_70px] md:grid-cols-[36px_1fr_110px_90px_120px_150px] gap-2 px-4 py-2.5 items-center border-b border-slate-50 dark:border-[#2C323A]/60 hover:bg-slate-50 dark:hover:bg-slate-700/30 text-[13px] tabular-nums">
                <div className="text-[11px] text-slate-400">{i + 1}</div>
                <div className="min-w-0"><div className="font-medium text-slate-900 dark:text-slate-100 truncate">{r.name}</div><div className="text-[11px] text-slate-400">{r.symbol} · {r.market}</div></div>
                <div className="text-right text-slate-900 dark:text-slate-100">{fmt(r.close)}</div>
                <div className="text-right font-medium" style={{ color: tone(r.chg_pct) }}>{r.chg_pct != null ? `${sign(r.chg_pct)}${r.chg_pct.toFixed(2)}%` : '-'}</div>
                <div className="hidden md:block text-right text-slate-600 dark:text-slate-300">{fmt(r.volume)}</div>
                <div className="hidden md:block text-right text-slate-600 dark:text-slate-300">{fmtEok(r.marcap_eok)}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {sel && (
        <div>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
            <div>
              <div className="text-[12px] text-slate-500 dark:text-slate-400 mb-0.5">{sel.market === 'KOSDAQ' ? 'KOSDAQ' : 'KOSPI'} · {sel.symbol}{fin.sector ? ` · ${fin.sector}` : ''}</div>
              <div className="text-[26px] font-bold text-slate-900 dark:text-white leading-tight">{sel.name}</div>
              {chart.last && (
                <div className="flex items-baseline gap-2 mt-1.5 tabular-nums">
                  <span className="text-[30px] font-bold text-slate-900 dark:text-white leading-none">₩{fmt(chart.last.close)}</span>
                  <span className="px-1.5 py-0.5 rounded text-[13px] font-semibold" style={{ color: tone(chart.last.chg_pct), background: chart.last.chg_pct > 0 ? 'rgba(220,38,38,0.14)' : chart.last.chg_pct < 0 ? 'rgba(37,99,235,0.16)' : 'transparent' }}>{sign(chart.last.chg_pct)}{chart.last.chg_pct?.toFixed(2)}%</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-5 items-start">
            <div className="space-y-5 min-w-0">
              <div className={`${PANEL} p-4 md:p-5`}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex gap-1">{TFS.map(([k, l]) => <button key={k} onClick={() => changeTf(k)} className={tab(tf === k)}>{l}</button>)}</div>
                  <div className="flex gap-1.5">
                    {MA_DEF.map(m => (
                      <button key={m.k} onClick={() => setMaOn(p => ({ ...p, [m.k]: !p[m.k] }))}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold transition-colors ${maOn[m.k] ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'}`}>
                        <span className="w-2 h-2 rounded-full" style={{ background: m.color }} />{m.label}
                      </button>
                    ))}
                  </div>
                </div>
                {chart.loading && !chart.candles.length && <div className="h-[380px] flex items-center justify-center text-[13px] text-slate-500">차트 불러오는 중…</div>}
                {chart.error && <div className="h-[200px] flex items-center justify-center text-[13px] text-slate-500">{chart.error}</div>}
                {chart.candles.length > 0 && <PriceChart candles={chart.candles} tf={tf} range={range} maOn={maOn} dark={dark} />}
                <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                  <div className="flex gap-1">{RANGES.map(([k, l]) => <button key={k} onClick={() => setRange(k)} className={tab(range === k)}>{l}</button>)}</div>
                  <p className="text-[11px] text-slate-400">일봉 약 3년(720일)에서 주·월·년 계산</p>
                </div>
              </div>
              <div className={`${PANEL} p-5`}><VolumePanel daily={daily} dark={dark} /></div>
            </div>
            <TargetPanel state={target} price={price} />
          </div>

          <div className="mt-5 space-y-5">
            <FinancialPanel state={fin} />
            <NewsPanel state={news} name={sel.name} />
          </div>
        </div>
      )}
    </div>
  );
}
