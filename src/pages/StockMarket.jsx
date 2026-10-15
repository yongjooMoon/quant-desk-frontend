// src/pages/StockMarket.jsx — "증시": 국내 종목 목록(거래량/시총/거래대금/등락률) + MTS형 차트(일/주/월/년, 이동평균) + 애널리스트 목표가
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, ArrowLeft, RefreshCcw } from 'lucide-react';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, CrosshairMode } from 'lightweight-charts';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer } from 'recharts';
import { useRenderApi } from '../hooks/useRenderApi';

const UP = '#DC2626';    // 상승 = 빨강 (프로젝트 공통 축)
const DOWN = '#2563EB';  // 하락 = 파랑
const MA_DEF = [{ k: 'ma20', label: 'MA20', color: '#F59E0B' }, { k: 'ma60', label: 'MA60', color: '#3B82F6' }, { k: 'ma120', label: 'MA120', color: '#94A3B8' }];
const TFS = [['D', '일'], ['W', '주'], ['M', '월'], ['Y', '년']];
const SORTS = [['volume', '거래량'], ['marcap', '시가총액'], ['amount', '거래대금'], ['chg', '등락률']];
const MARKETS = [['ALL', '전체'], ['KOSPI', '코스피'], ['KOSDAQ', '코스닥']];

const fmt = (n) => (n == null || Number.isNaN(n) ? '-' : Math.round(n).toLocaleString());
const sign = (v) => (v > 0 ? '+' : '');
const tone = (v) => (v > 0 ? UP : v < 0 ? DOWN : undefined);
const fmtEok = (e) => { if (e == null) return '-'; const jo = Math.floor(e / 10000), eok = Math.round(e % 10000); return jo ? `${jo.toLocaleString()}조 ${eok ? eok.toLocaleString() + '억' : ''}` : `${eok.toLocaleString()}억`; };
const fmtVol = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(v ?? '-'));

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

// ── MTS형 캔들 차트: 캔들 + 거래량 + 이동평균, 십자선 범례(OHLC / 거래량 / MA 값)
function PriceChart({ candles, tf, maOn, dark }) {
  const boxRef = useRef(null);
  const [legend, setLegend] = useState(null);

  useEffect(() => {
    if (!boxRef.current || !candles.length) return;
    const text = dark ? '#94A3B8' : '#64748B', grid = dark ? 'rgba(148,163,184,0.08)' : 'rgba(100,116,139,0.10)';
    const chart = createChart(boxRef.current, {
      autoSize: true,
      layout: { background: { color: 'transparent' }, textColor: text, fontFamily: 'inherit', fontSize: 11 },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.06, bottom: 0.26 } },
      timeScale: { borderVisible: false, timeVisible: false, rightOffset: 4 },
    });
    const candle = chart.addSeries(CandlestickSeries, { upColor: UP, downColor: DOWN, borderVisible: false, wickUpColor: UP, wickDownColor: DOWN, priceFormat: { type: 'price', precision: 0, minMove: 1 } });
    candle.setData(candles.map(c => ({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c })));
    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol', lastValueVisible: false, priceLineVisible: false });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
    vol.setData(candles.map(c => ({ time: c.t, value: c.v, color: c.c >= c.o ? 'rgba(220,38,38,0.45)' : 'rgba(37,99,235,0.45)' })));
    const lines = {};
    MA_DEF.forEach(m => {
      if (!maOn[m.k]) return;
      const s = chart.addSeries(LineSeries, { color: m.color, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      s.setData(candles.filter(c => c[m.k] != null).map(c => ({ time: c.t, value: c[m.k] })));
      lines[m.k] = s;
    });
    const byTime = new Map(candles.map(c => [c.t, c]));
    const show = (c) => setLegend(c ? { t: c.t, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v, chg: c.o ? (c.c / c.o - 1) * 100 : null, ma20: c.ma20, ma60: c.ma60, ma120: c.ma120 } : null);
    const lastC = candles[candles.length - 1];
    show(lastC);
    chart.subscribeCrosshairMove(p => { const c = p.time ? byTime.get(p.time) : null; show(c || lastC); });
    // 기본 표시 구간: 일봉 약 6개월, 주봉 약 2년, 월봉/년봉은 전체
    const n = candles.length, shown = tf === 'D' ? 130 : tf === 'W' ? 104 : n;
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - shown), to: n + 3 });
    return () => chart.remove();
  }, [candles, tf, maOn, dark]);

  return (
    <div className="relative">
      {legend && (
        <div className="absolute top-1 left-2 z-10 text-[11px] tabular-nums leading-relaxed pointer-events-none">
          <div className="flex flex-wrap gap-x-3 text-slate-500 dark:text-slate-400">
            <span>{legend.t}</span>
            <span>시 <b style={{ color: tone(legend.c - legend.o) }}>{fmt(legend.o)}</b></span>
            <span>고 <b style={{ color: tone(legend.c - legend.o) }}>{fmt(legend.h)}</b></span>
            <span>저 <b style={{ color: tone(legend.c - legend.o) }}>{fmt(legend.l)}</b></span>
            <span>종 <b style={{ color: tone(legend.c - legend.o) }}>{fmt(legend.c)}</b></span>
            <span>거래량 <b className="text-slate-700 dark:text-slate-200">{fmt(legend.v)}</b></span>
          </div>
          <div className="flex gap-x-3">
            {MA_DEF.filter(m => maOn[m.k]).map(m => <span key={m.k} style={{ color: m.color }}>{m.label} {legend[m.k] != null ? fmt(legend[m.k]) : '-'}</span>)}
          </div>
        </div>
      )}
      <div ref={boxRef} className="w-full h-[360px] md:h-[440px]" />
    </div>
  );
}

// ── 거래량 분석: 최근 60거래일 거래량 + 20일 평균, 오늘 거래량 / 평균
function VolumePanel({ daily }) {
  const data = useMemo(() => {
    const out = daily.map((c, i) => {
      const w = daily.slice(Math.max(0, i - 19), i + 1);
      return { t: c.t.slice(5), v: c.v, avg: w.length === 20 ? w.reduce((a, b) => a + b.v, 0) / 20 : null, up: c.c >= c.o };
    });
    return out.slice(-60);
  }, [daily]);
  if (!data.length) return null;
  const last = data[data.length - 1];
  const ratio = last.avg ? (last.v / last.avg - 1) * 100 : null;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-[14px] font-semibold text-slate-900 dark:text-white">거래량</h4>
        <span className="text-[12px] text-slate-500 tabular-nums">최근 거래일 {fmt(last.v)}주{ratio != null && <> · 20일 평균 대비 <b style={{ color: tone(ratio) }}>{sign(ratio)}{ratio.toFixed(0)}%</b></>}</span>
      </div>
      <div className="h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval={11} />
            <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={42} tickFormatter={fmtVol} />
            <RTooltip formatter={(v, n) => [fmt(v), n === 'v' ? '거래량' : '20일 평균']} labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 11 }} />
            <Bar dataKey="v" fill="#94A3B8" fillOpacity={0.55} isAnimationActive={false} />
            <Line dataKey="avg" stroke="#F59E0B" dot={false} strokeWidth={1.5} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── 애널리스트 목표가: 상단 중간값(최근 리포트) + 네이버 컨센서스 평균, 증권사별 목록
function TargetPanel({ state, price }) {
  const cls = 'border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-[#111827] p-4';
  if (state.loading) return <div className={cls + ' text-[13px] text-slate-500'}>목표가 불러오는 중…</div>;
  if (state.error || state.status !== 'success') return <div className={cls + ' text-[13px] text-slate-500'}>{state.message || '애널리스트 목표가 데이터가 없습니다.'}</div>;
  const up = (g) => (price && g ? (g / price - 1) * 100 : null);
  const upMed = up(state.median_recent), upMean = up(state.consensus?.mean);
  return (
    <div className={cls}>
      <div className="flex items-baseline justify-between mb-3">
        <h4 className="text-[14px] font-semibold text-slate-900 dark:text-white">애널리스트 목표가</h4>
        <span className="text-[11px] text-slate-500">출처 네이버 증권 · {state.consensus?.asof || '-'} 기준</span>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-[11.5px] text-slate-500">최근 리포트 {state.n_recent}건 중간값</div>
          <div className="text-[22px] font-semibold tabular-nums text-slate-900 dark:text-white">{state.median_recent ? `₩${fmt(state.median_recent)}` : '-'}</div>
          {upMed != null && <div className="text-[12px] tabular-nums" style={{ color: tone(upMed) }}>현재가 대비 {sign(upMed)}{upMed.toFixed(1)}%</div>}
        </div>
        <div>
          <div className="text-[11.5px] text-slate-500">컨센서스 평균{state.consensus?.recomm ? ` (의견 ${state.consensus.recomm}/5)` : ''}</div>
          <div className="text-[22px] font-semibold tabular-nums text-slate-900 dark:text-white">{state.consensus?.mean ? `₩${fmt(state.consensus.mean)}` : '-'}</div>
          {upMean != null && <div className="text-[12px] tabular-nums" style={{ color: tone(upMean) }}>현재가 대비 {sign(upMean)}{upMean.toFixed(1)}%</div>}
        </div>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {state.reports.map((r, i) => (
          <div key={i} className="flex items-center justify-between py-2 text-[12.5px]">
            <div className="min-w-0">
              <div className="font-medium text-slate-800 dark:text-slate-200">{r.broker}</div>
              <div className="text-[11px] text-slate-500 truncate">{r.date} · {r.title}</div>
            </div>
            <div className="text-right tabular-nums shrink-0 ml-3">
              <div className="font-semibold text-slate-900 dark:text-white">{r.goal ? `₩${fmt(r.goal)}` : '-'}</div>
              <div className="text-[11px] text-slate-500">{r.opinion}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-slate-400">최근 5건만 제공됩니다. 컨센서스 평균은 더 많은 증권사와 기간을 반영하므로 중간값과 다를 수 있습니다.</p>
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
  const [maOn, setMaOn] = useState({ ma20: true, ma60: true, ma120: false });
  const [chart, setChart] = useState({ loading: false, candles: [], last: null, error: null });
  const [daily, setDaily] = useState([]);
  const [target, setTarget] = useState({ loading: false });
  const boxRef = useRef(null);
  const symRef = useRef(null);

  useEffect(() => {
    setList(p => ({ ...p, loading: true }));
    callApi(`/api/market/list?market=${market}&sort=${sort}&limit=100`).then(r => {
      if (r.status === 'success') setList({ loading: false, rows: r.data, asof: r.asof, error: null });
      else setList({ loading: false, rows: [], asof: null, error: r.message || '목록을 불러오지 못했습니다.' });
    }).catch(() => setList({ loading: false, rows: [], asof: null, error: '목록을 불러오지 못했습니다.' }));
  }, [market, sort, callApi]);

  useEffect(() => {
    callApi('/api/krx-list').then(r => { if (r.status === 'success') setOptions(r.data); }).catch(() => {});
  }, [callApi]);

  useEffect(() => {
    const h = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const loadChart = useCallback((symbol, tfv) => {
    symRef.current = symbol;
    setChart(p => ({ ...p, loading: true, error: null }));
    callApi(`/api/market/chart/${symbol}?tf=${tfv}`).then(r => {
      if (symRef.current !== symbol) return;
      if (r.status === 'success') { setChart({ loading: false, candles: r.candles, last: r.last, error: null }); if (tfv === 'D') setDaily(r.candles); }
      else setChart({ loading: false, candles: [], last: null, error: r.message || '차트를 불러오지 못했습니다.' });
    }).catch(() => setChart({ loading: false, candles: [], last: null, error: '차트를 불러오지 못했습니다.' }));
  }, [callApi]);

  useEffect(() => { if (sel) loadChart(sel.symbol, tf); }, [sel, tf, loadChart]);
  useEffect(() => {      // 일봉은 거래량 패널용으로 종목당 한 번만
    if (!sel || tf === 'D') return;
    callApi(`/api/market/chart/${sel.symbol}?tf=D`).then(r => { if (r.status === 'success') setDaily(r.candles); }).catch(() => {});
  }, [sel, callApi]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {      // 목표가: 종목을 열 때 한 번 (서버가 24시간 캐시)
    if (!sel) return;
    setTarget({ loading: true });
    callApi(`/api/market/targets/${sel.symbol}`).then(r => setTarget({ loading: false, ...r })).catch(() => setTarget({ loading: false, error: true }));
  }, [sel, callApi]);

  const choose = (symbol, name, mk) => { setSel({ symbol, name, market: mk }); setTf('D'); setDaily([]); setTerm(''); setOpen(false); window.scrollTo?.(0, 0); };
  const matches = term ? options.filter(o => o.SearchStr.toLowerCase().includes(term.toLowerCase())).slice(0, 8) : [];
  const price = chart.last?.close;

  const searchBox = (
    <div ref={boxRef} className="relative w-full md:w-[340px]">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input value={term} onChange={e => { setTerm(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="종목명 또는 코드 검색"
        className="w-full pl-9 pr-3 py-2 text-[13.5px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400" />
      {open && matches.length > 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] shadow-lg overflow-hidden">
          {matches.map(o => (
            <button key={o.Symbol} onClick={() => choose(o.Symbol, o.Name, o.Market)} className="w-full text-left px-3 py-2 text-[13px] hover:bg-slate-50 dark:hover:bg-slate-800/60 flex justify-between">
              <span className="text-slate-900 dark:text-slate-100">{o.Name}</span><span className="text-slate-400 tabular-nums">{o.Symbol} · {o.Market}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const pill = (active) => `px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors ${active ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800/70'}`;

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6 pb-24">
      <ServerWakeupOverlay />
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          {sel && <button onClick={() => setSel(null)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" title="목록으로"><ArrowLeft size={18} /></button>}
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
          <div className="border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-[#111827] overflow-hidden">
            <div className="grid grid-cols-[28px_1fr_90px_70px] md:grid-cols-[36px_1fr_110px_90px_120px_150px] gap-2 px-4 py-2.5 text-[11.5px] font-medium text-slate-500 border-b border-slate-100 dark:border-slate-800">
              <div>#</div><div>종목</div><div className="text-right">현재가</div><div className="text-right">등락률</div>
              <div className="hidden md:block text-right">거래량</div><div className="hidden md:block text-right">시가총액</div>
            </div>
            {list.loading && <div className="p-8 text-center text-[13px] text-slate-500 flex items-center justify-center gap-2"><RefreshCcw size={14} className="animate-spin" />불러오는 중…</div>}
            {list.error && <div className="p-8 text-center text-[13px] text-slate-500">{list.error}</div>}
            {!list.loading && list.rows.map((r, i) => (
              <button key={r.symbol} onClick={() => choose(r.symbol, r.name, r.market)}
                className="w-full text-left grid grid-cols-[28px_1fr_90px_70px] md:grid-cols-[36px_1fr_110px_90px_120px_150px] gap-2 px-4 py-2.5 items-center border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-[13px] tabular-nums">
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
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <div className="text-[12px] text-slate-500">{sel.market} · {sel.symbol}</div>
              <div className="text-[22px] font-semibold text-slate-900 dark:text-white">{sel.name}</div>
            </div>
            {chart.last && (
              <div className="text-right tabular-nums">
                <div className="text-[26px] font-semibold text-slate-900 dark:text-white">₩{fmt(chart.last.close)}</div>
                <div className="text-[13px] font-medium" style={{ color: tone(chart.last.chg_pct) }}>전일대비 {sign(chart.last.chg_pct)}{chart.last.chg_pct?.toFixed(2)}%</div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
            <div className="space-y-5 min-w-0">
              <div className="border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-[#111827] p-3 md:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex gap-1.5">{TFS.map(([k, l]) => <button key={k} onClick={() => setTf(k)} className={pill(tf === k)}>{l}</button>)}</div>
                  <div className="flex gap-1.5">
                    {MA_DEF.map(m => (
                      <button key={m.k} onClick={() => setMaOn(p => ({ ...p, [m.k]: !p[m.k] }))} className={`px-2.5 py-1 rounded-full text-[11.5px] font-medium border transition-colors ${maOn[m.k] ? 'text-white border-transparent' : 'text-slate-400 border-slate-200 dark:border-slate-700 bg-transparent'}`} style={maOn[m.k] ? { background: m.color } : undefined}>{m.label}</button>
                    ))}
                  </div>
                </div>
                {chart.loading && !chart.candles.length && <div className="h-[360px] flex items-center justify-center text-[13px] text-slate-500">차트 불러오는 중…</div>}
                {chart.error && <div className="h-[200px] flex items-center justify-center text-[13px] text-slate-500">{chart.error}</div>}
                {chart.candles.length > 0 && <PriceChart candles={chart.candles} tf={tf} maOn={maOn} dark={dark} />}
                <p className="text-[11px] text-slate-400 mt-1">일봉 최근 약 3년(720일) 데이터에서 주·월·년을 계산합니다. 년봉은 보유 기간만큼만 표시됩니다.</p>
              </div>
              <div className="border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-[#111827] p-4"><VolumePanel daily={daily} /></div>
            </div>
            <TargetPanel state={target} price={price} />
          </div>
        </div>
      )}
    </div>
  );
}
