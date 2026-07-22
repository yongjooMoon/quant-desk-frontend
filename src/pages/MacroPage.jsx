import React, { useMemo, useState, useEffect } from 'react';
import { Info, TrendingUp, TrendingDown, ShieldCheck, X, Loader2 } from 'lucide-react';
import {
  AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart,
} from 'recharts';

// 로컬 환경 적용 시 아래 import 주석을 해제하고 임시 mock 함수(useRenderApi)를 삭제하세요.
import { useRenderApi } from '../hooks/useRenderApi';

// =============================================================================
// Macro Dashboard (Frontend Logic Only)
// =============================================================================

const REGIME_CONFIG = {
  "Strong Bull": { color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/50", hex: "#10B981", desc: "강한 상승 추세\n공격적인 투자 가능\n무한매수 적극 운용 가능" },
  "Bull": { color: "text-[#00B464]", bg: "bg-[#00B464]/10", border: "border-[#00B464]/50", hex: "#00B464", desc: "상승 우세\n정상 투자 가능" },
  "Neutral": { color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/50", hex: "#EAB308", desc: "방향성 부족\nVR 또는 분할매수 고려" },
  "Bear": { color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/50", hex: "#F97316", desc: "방어 전략 권장\n현금 비중 확대 고려" },
  "Crash": { color: "text-[#FF4B4B]", bg: "bg-[#FF4B4B]/10", border: "border-[#FF4B4B]/50", hex: "#FF4B4B", desc: "극단적인 Risk-Off\n신규 공격적 매수 자제" }
};

const INDICATOR_META = {
  QQQ_PRICE: { display_name: 'QQQ', unit: 'USD' },
  QQQ_MA50: { display_name: '50일 이동평균', unit: 'USD' },
  QQQ_MA200: { display_name: '200일 이동평균', unit: 'USD' },
  QQQ_MA200_SLOPE: { display_name: '200MA Slope', unit: '%' },
  REAL_YIELD_10Y: { display_name: '미국 실질금리 (10Y TIPS)', unit: '%' },
  CREDIT_SPREAD: { display_name: 'Credit Spread', unit: '%' },
  VIX: { display_name: 'VIX', unit: 'index' },
  WTI: { display_name: 'WTI', unit: 'USD' },
  FEAR_GREED: { display_name: 'CNN Fear & Greed', unit: 'index' },
};

const SECTIONS = [
  { title: 'Trend', indicators: ['QQQ_PRICE', 'QQQ_MA50', 'QQQ_MA200', 'QQQ_MA200_SLOPE'] },
  { title: 'Liquidity', indicators: ['REAL_YIELD_10Y', 'CREDIT_SPREAD'] },
  { title: 'Risk', indicators: ['VIX', 'WTI'] },
  { title: 'Market Psychology', indicators: ['FEAR_GREED'] },
];

const MOCK_REGIME_SUMMARY = {
  regime: 'Bull',
  score: 87,
  confidence: 82,
  last_updated: new Date().toISOString().substring(0, 10),
  positive_factors: ['VIX 안정 하향 추세', 'Credit Spread 지속 축소', 'QQQ 강력한 상승 추세 유지'],
  negative_factors: ['DXY 단기 반등세', 'Real Yield (10Y TIPS) 상승 압력'],
};

const CHART_RED = '#FF4B4B'; // 모든 차트에 일괄 적용될 기본 빨간색 계열 테마

// ---------------------------------------------------------------------------
// 1. Status 계산 방식 변경 (React 내부 직접 계산 로직)
// ---------------------------------------------------------------------------
const getVixStatus = (value) => {
  if (value < 15) return 'Strong Bull';
  if (value < 20) return 'Bull';
  if (value < 30) return 'Neutral';
  if (value < 40) return 'Bear';
  return 'Crash';
};

const getRealYieldStatus = (value) => {
  if (value < 1.0) return 'Strong Bull';
  if (value < 1.5) return 'Bull';
  if (value < 2.0) return 'Neutral';
  if (value < 2.5) return 'Bear';
  return 'Crash';
};

const getCreditSpreadStatus = (value) => {
  if (value < 1.2) return 'Strong Bull';
  if (value < 1.8) return 'Bull';
  if (value < 2.5) return 'Neutral';
  if (value < 4.0) return 'Bear';
  return 'Crash';
};

const getWtiStatus = (value) => {
  if (value < 70) return 'Bull';
  if (value < 85) return 'Neutral';
  if (value < 100) return 'Bear';
  return 'Warning';
};

const getFearGreedStatus = (value) => {
  if (value <= 25) return 'Extreme Fear';
  if (value <= 45) return 'Fear';
  if (value <= 55) return 'Neutral';
  if (value <= 75) return 'Greed';
  return 'Extreme Greed';
};

const getSlopeStatus = (value) => {
  if (value > 0.01) return 'Bull';
  if (value < -0.01) return 'Bear';
  return 'Neutral'; // 0 부근 (Neutral 범위 지정)
};

const getQqqTrendStatus = (price, ma50, ma200) => {
  if (price > ma200 && ma50 > ma200) return 'Strong Bull';
  if (price > ma200) return 'Bull';
  if (price < ma200 && ma50 < ma200) return 'Crash';
  if (price < ma200) return 'Bear';
  return 'Neutral';
};

// 도출된 Status 값을 바탕으로 카드/뱃지의 시각적 스타일을 맵핑합니다.
const getStatusStyle = (status) => {
  switch (status) {
    case 'Strong Bull':
    case 'Extreme Greed':
      return { label: status, text: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', hex: '#10B981' };
    case 'Bull':
    case 'Greed':
      return { label: status, text: 'text-[#00B464]', bg: 'bg-[#00B464]/10', border: 'border-[#00B464]/30', hex: '#00B464' };
    case 'Neutral':
      return { label: status, text: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', hex: '#EAB308' };
    case 'Bear':
    case 'Fear':
      return { label: status, text: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30', hex: '#F97316' };
    case 'Crash':
    case 'Warning':
    case 'Extreme Fear':
      return { label: status, text: 'text-[#FF4B4B]', bg: 'bg-[#FF4B4B]/10', border: 'border-[#FF4B4B]/30', hex: '#FF4B4B' };
    default:
      return { label: status || 'Neutral', text: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/30', hex: '#94A3B8' };
  }
};

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------
const RegimePopover = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="absolute top-12 right-0 md:right-4 z-50 w-[280px] bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 dark:border-slate-700/50">
        <h4 className="font-black text-slate-900 dark:text-white text-[15px]">Market Regime 가이드</h4>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={16} /></button>
      </div>
      <div className="space-y-3">
        {Object.entries(REGIME_CONFIG).map(([key, conf]) => (
          <div key={key} className="flex flex-col gap-1">
            <span className={`font-black text-[13px] ${conf.color}`}>{key}</span>
            <span className="text-[12px] font-bold text-slate-500 whitespace-pre-line leading-snug">{conf.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const RegimeSummary = ({ summary }) => {
  const [infoOpen, setInfoOpen] = useState(false);
  const s = summary || MOCK_REGIME_SUMMARY;
  const conf = REGIME_CONFIG[s.regime] || REGIME_CONFIG.Neutral;

  return (
    <div className="w-full bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm mb-12 relative">
      <div className="flex flex-col md:flex-row justify-between md:items-center border-b border-slate-100 dark:border-slate-800/80 pb-6 mb-6">
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-[15px] font-black text-slate-500 dark:text-slate-400">Current Market Regime</h2>
            <button onClick={() => setInfoOpen(!infoOpen)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              <Info size={18} />
            </button>
            <RegimePopover isOpen={infoOpen} onClose={() => setInfoOpen(false)} />
          </div>
          <h1 className={`text-5xl md:text-6xl font-black tracking-tighter ${conf.color}`}>
            {s.regime}
          </h1>
          {s.last_updated && (
            <p className="text-[12px] font-extrabold text-slate-400 mt-2">Last Updated {s.last_updated}</p>
          )}
        </div>

        <div className="mt-6 md:mt-0 flex items-end gap-8">
          <div className="flex flex-col md:items-end">
            <p className="text-[13px] font-extrabold text-slate-500 mb-1">Regime Score</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl md:text-5xl font-black ${conf.color}`}>{s.score}</span>
              <span className="text-xl font-black text-slate-400">/ 100</span>
            </div>
          </div>
          <div className="flex flex-col md:items-end">
            <p className="text-[13px] font-extrabold text-slate-500 mb-1 flex items-center gap-1.5"><ShieldCheck size={14} className="text-slate-400" /> Confidence</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl md:text-5xl font-black text-slate-700 dark:text-slate-300">{s.confidence}</span>
              <span className="text-xl font-black text-slate-400">%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        <div className="p-4 bg-slate-50 dark:bg-[#1E293B]/50 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
          <h4 className="text-[13px] font-black text-[#FF4B4B] mb-3 flex items-center gap-2"><TrendingUp size={16} /> Positive Factors</h4>
          <ul className="space-y-2">
            {(s.positive_factors || []).map((f, i) => (
              <li key={i} className="text-[13px] font-extrabold text-slate-600 dark:text-slate-300 flex items-start gap-2">
                <span className="text-[#FF4B4B] mt-0.5">•</span> {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-[#1E293B]/50 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
          <h4 className="text-[13px] font-black text-[#3B82F6] mb-3 flex items-center gap-2"><TrendingDown size={16} /> Negative Factors</h4>
          <ul className="space-y-2">
            {(s.negative_factors || []).map((f, i) => (
              <li key={i} className="text-[13px] font-extrabold text-slate-600 dark:text-slate-300 flex items-start gap-2">
                <span className="text-[#3B82F6] mt-0.5">•</span> {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

const FEAR_GREED_STOPS = [
  { max: 25, label: 'Extreme Fear', hex: '#FF4B4B' }, // 극한 공포: 빨강
  { max: 45, label: 'Fear', hex: '#F97316' },        // 공포: 주황
  { max: 55, label: 'Neutral', hex: '#EAB308' },     // 중립: 노랑
  { max: 75, label: 'Greed', hex: '#00B464' },       // 탐욕: 초록
  { max: 100, label: 'Extreme Greed', hex: '#10B981' } // 극한 탐욕: 에메랄드
];

const getFearGreedStop = (value) => FEAR_GREED_STOPS.find(s => value <= s.max) || FEAR_GREED_STOPS[FEAR_GREED_STOPS.length - 1];

const FearGreedGauge = ({ value, size = 'sm' }) => {
  const stop = getFearGreedStop(value);
  const dims = size === 'lg'
    ? { viewBox: '0 0 200 110', w: 'w-56 md:w-64', h: 'h-32 md:h-36', valueClass: 'text-4xl md:text-5xl', strokeWidth: 18 }
    : { viewBox: '0 0 200 110', w: 'w-full', h: 'h-16', valueClass: 'text-lg', strokeWidth: 16 };
  const circumference = 251.2;

  return (
    <div className={`relative ${dims.w} ${dims.h} flex justify-center items-end`}>
      <svg viewBox={dims.viewBox} className="w-full h-full absolute bottom-0">
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth={dims.strokeWidth} strokeLinecap="round" />
        <path
          d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={stop.hex} strokeWidth={dims.strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (circumference * value / 100)}
          style={{ transition: 'stroke-dashoffset 1.2s ease-in-out' }}
        />
      </svg>
      <div className="absolute bottom-0 w-full flex flex-col items-center justify-end pb-1">
        <p className={`${dims.valueClass} font-black tracking-tighter`} style={{ color: stop.hex }}>{Math.round(value)}</p>
        {size === 'lg' && <p className="text-[13px] font-extrabold text-slate-500 mt-1">{stop.label}</p>}
      </div>
    </div>
  );
};

const MacroCard = ({ item, onClick }) => {
  const isGauge = item.indicator === 'FEAR_GREED';
  const isPos = item.change_percent >= 0;
  
  // API의 signal을 무시하고, React에서 직접 계산한 calcStatus 기반으로 스타일 적용
  const statusStyle = getStatusStyle(item.calcStatus);
  const chartData = (item.history || []).slice(-20).map((h, i) => ({ index: i, value: h.value }));

  return (
    <div
      onClick={() => onClick(item)}
      className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(255,255,255,0.03)] hover:border-slate-300 dark:hover:border-slate-600 transition-all cursor-pointer group flex flex-col justify-between h-40"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-[13px] md:text-[14px] font-extrabold text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors truncate pr-2">{item.display_name}</h3>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${statusStyle.text} ${statusStyle.bg} ${statusStyle.border} shrink-0`}>
          {statusStyle.label}
        </span>
      </div>

      {isGauge ? (
        <div className="flex items-end justify-between">
          <FearGreedGauge value={item.value} />
          <p className={`text-[12px] md:text-[13px] font-black shrink-0 ${isPos ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>{isPos ? '▲' : '▼'} {Math.abs(item.change_percent).toFixed(2)}%</p>
        </div>
      ) : (
        <div className="flex justify-between items-end">
          <div>
            <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter mb-1">{item.value.toLocaleString()}</p>
            <p className={`text-[12px] md:text-[13px] font-black ${isPos ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>{isPos ? '▲' : '▼'} {Math.abs(item.change_percent).toFixed(2)}%</p>
          </div>
          <div className="w-20 h-12">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                {/* 2. Chart 색상 변경: 모든 스파크라인을 빨간색 계열(CHART_RED)로 강제 지정 */}
                <Line type="monotone" dataKey="value" stroke={CHART_RED} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

const MacroSection = ({ title, items, onCardClick }) => (
  <div className="mb-10">
    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-4 pl-1">{title}</h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map(item => <MacroCard key={item.indicator} item={item} onClick={onCardClick} />)}
    </div>
  </div>
);

const RANGE_TRADING_DAYS = { '1M': 20, '3M': 60, '1Y': 252, '3Y': 756, '5Y': 1260 };

const MacroChartModal = ({ item, onClose }) => {
  const [range, setRange] = useState('1Y');
  const isGauge = item.indicator === 'FEAR_GREED';
  const statusStyle = getStatusStyle(item.calcStatus);

  // 3. 기간 버튼 동작 수정 (3Y/5Y 데이터 필터링 오류 픽스)
  const chartData = useMemo(() => {
    if (!item.history || item.history.length === 0) return [];
    
    // 원본 데이터의 정렬 상태와 무관하게, 항상 날짜 오름차순(과거->최신)으로 완벽하게 정렬된 새 배열을 만듭니다.
    const sortedHist = [...item.history].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const days = RANGE_TRADING_DAYS[range] || 252;
    // 오름차순 배열에서 뒤에서부터 N일(days)만큼을 잘라내어 가장 최신 기간의 데이터를 가져옵니다.
    return sortedHist.slice(-days);
  }, [item.history, range]);

  const isPos = item.change_percent >= 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-5 md:p-6 border-b border-slate-100 dark:border-slate-800/80">
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-1">{item.display_name}</h3>
            <p className="text-[13px] font-extrabold text-slate-500">{item.indicator} · {item.source}</p>
          </div>
          <button onClick={onClose} className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full transition-colors cursor-pointer"><X size={20} /></button>
        </div>

        <div className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
            <div className="flex items-center gap-6">
              {isGauge ? (
                <FearGreedGauge value={item.value} size="lg" />
              ) : (
                <div>
                  <p className="text-4xl font-black text-slate-900 dark:text-white mb-2">{item.value.toLocaleString()}{item.unit ? ` ${item.unit}` : ''}</p>
                  <span className={`text-[14px] font-black px-2.5 py-1 rounded-lg border ${isPos ? 'text-[#FF4B4B] bg-[#FF4B4B]/10 border-[#FF4B4B]/30' : 'text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/30'}`}>
                    {isPos ? '▲' : '▼'} {Math.abs(item.change_percent).toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {Object.keys(RANGE_TRADING_DAYS).map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`text-[12px] font-black px-3 py-1.5 rounded-lg transition-all cursor-pointer border shadow-sm ${range === r ? 'bg-slate-800 border-slate-800 text-white dark:bg-slate-200 dark:border-slate-200 dark:text-slate-900' : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full h-[300px] md:h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  {/* 2. Chart 색상 변경: 모든 Area Gradient 톤을 빨간색 계열(CHART_RED)로 강제 지정 */}
                  <linearGradient id="colorMacroInd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_RED} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_RED} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: '800' }} tickLine={false} axisLine={false} minTickGap={40} tickFormatter={(val) => val ? String(val).substring(5).replace('-', '.') : ''} />
                <YAxis domain={['auto', 'auto']} tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: '800' }} tickLine={false} axisLine={false} tickFormatter={(v) => v.toFixed(1)} />
                <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', color: 'white', fontWeight: '900' }} itemStyle={{ color: CHART_RED }} labelStyle={{ color: '#94A3B8', marginBottom: '4px' }} formatter={(value) => [value.toFixed(2), 'Value']} />
                {/* 2. Chart 색상 변경: Area 선 색상과 dot를 빨간색(CHART_RED)으로 강제 적용 */}
                <Area type="monotone" dataKey="value" stroke={CHART_RED} strokeWidth={2.5} fillOpacity={1} fill="url(#colorMacroInd)" activeDot={{ r: 6, fill: CHART_RED, strokeWidth: 0 }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// MacroPage — 메인 조립
// ---------------------------------------------------------------------------
const MacroPage = ({ regimeSummary }) => {
  const [selectedMacro, setSelectedMacro] = useState(null);
  const { callApi } = useRenderApi();
  
  const [macroData, setMacroData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMacroData = async () => {
      try {
        setLoading(true);
        const result = await callApi('/api/macro');
        
        if (result && result.status === 'success') {
          setMacroData(result.data);
        } else {
          setError(result?.message || '데이터를 불러오는 데 실패했습니다.');
        }
      } catch (err) {
        setError('서버 연결에 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchMacroData();
  }, [callApi]);

  const byIndicator = useMemo(() => {
    const map = {};
    macroData.forEach(item => { map[item.indicator] = item; });

    // 1. Status 계산을 React 내부에서 Value 기반으로 오버라이드하여 주입합니다.
    Object.keys(map).forEach(key => {
      const item = map[key];
      const val = item.value;
      let calcStatus = 'Neutral';

      switch (key) {
        case 'QQQ_PRICE':
          const ma50 = map['QQQ_MA50']?.value || val;
          const ma200 = map['QQQ_MA200']?.value || val;
          calcStatus = getQqqTrendStatus(val, ma50, ma200);
          break;
        case 'QQQ_MA200_SLOPE':
          calcStatus = getSlopeStatus(val);
          break;
        case 'VIX':
          calcStatus = getVixStatus(val);
          break;
        case 'REAL_YIELD_10Y':
          calcStatus = getRealYieldStatus(val);
          break;
        case 'CREDIT_SPREAD':
          calcStatus = getCreditSpreadStatus(val);
          break;
        case 'WTI':
          calcStatus = getWtiStatus(val);
          break;
        case 'FEAR_GREED':
          calcStatus = getFearGreedStatus(val);
          break;
        case 'QQQ_MA50':
        case 'QQQ_MA200':
          calcStatus = 'Neutral'; // 이 둘은 기준치가 없으므로 Neutral로 폴백
          break;
        default:
          calcStatus = 'Neutral';
      }
      
      // API에서 내려온 signal 컬럼을 무시하고 직접 계산한 값으로 덮어씁니다.
      item.calcStatus = calcStatus;
    });

    return map;
  }, [macroData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 w-full text-slate-500 animate-in fade-in">
        <Loader2 size={48} className="animate-spin text-slate-400 mb-4" />
        <p className="text-[14px] font-extrabold">매크로 데이터를 분석 중입니다...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 w-full animate-in fade-in">
        <div className="bg-red-50 dark:bg-red-500/10 text-red-500 border border-red-200 dark:border-red-500/30 p-6 rounded-2xl max-w-md text-center shadow-sm">
          <p className="font-black text-[15px] mb-2">데이터 연동 오류</p>
          <p className="text-[13px] font-bold opacity-80">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 w-full">
      <RegimeSummary summary={regimeSummary} />

      {SECTIONS.map(section => {
        const items = section.indicators.map(ind => byIndicator[ind]).filter(Boolean);
        if (items.length === 0) return null;
        return <MacroSection key={section.title} title={section.title} items={items} onCardClick={setSelectedMacro} />;
      })}

      {selectedMacro && <MacroChartModal item={selectedMacro} onClose={() => setSelectedMacro(null)} />}
    </div>
  );
};

export default MacroPage;
export { RegimeSummary, MacroSection, MacroCard, FearGreedGauge, MacroChartModal, RegimePopover };
