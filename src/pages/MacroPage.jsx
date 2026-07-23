import React, { useMemo, useState } from 'react';
import { Info, Loader2, X } from 'lucide-react';
import {
  AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart,
} from 'recharts';

// =========================================================================

const REGIME_CONFIG = {
  "Strong Bull": { color: "text-emerald-500", hex: "#10B981", desc: "강한 상승 추세\n공격적인 투자 가능\n무한매수 적극 운용 가능" },
  "Bull": { color: "text-[#00B464]", hex: "#00B464", desc: "상승 우세\n정상 투자 가능" },
  "Neutral": { color: "text-yellow-500", hex: "#EAB308", desc: "방향성 부족\nVR 또는 분할매수 고려" },
  "Bear": { color: "text-orange-500", hex: "#F97316", desc: "방어 전략 권장\n현금 비중 확대 고려" },
  "Crash": { color: "text-[#FF4B4B]", hex: "#FF4B4B", desc: "극단적인 Risk-Off\n신규 공격적 매수 자제" }
};

// Regime Gauge 색상 구간 (0~100 점, Crash → Strong Bull)
const REGIME_ZONES = [
  { id: 'crash', label: 'CRASH', min: 0, max: 20, color: '#FF4B4B' },
  { id: 'bear', label: 'BEAR', min: 20, max: 40, color: '#F97316' },
  { id: 'neutral', label: 'NEUTRAL', min: 40, max: 60, color: '#EAB308' },
  { id: 'bull', label: 'BULL', min: 60, max: 85, color: '#00B464' },
  { id: 'strong-bull', label: 'STRONG BULL', min: 85, max: 100, color: '#10B981' },
];

// Fear & Greed 위치 최상단 이동
const SECTIONS = [
  { title: 'Market Psychology', indicators: ['FEAR_GREED'] },
  { title: 'Trend', indicators: ['QQQ_PRICE', 'QQQ_MA50', 'QQQ_MA200', 'QQQ_MA200_SLOPE'] },
  { title: 'Liquidity', indicators: ['REAL_YIELD_10Y', 'CREDIT_SPREAD'] },
  { title: 'Risk', indicators: ['VIX', 'WTI'] },
];

const CHART_RED = '#FF4B4B';
const CHART_BLUE = '#3B82F6';

// ---------------------------------------------------------------------------
// 1. Status 계산 유틸리티 함수 (프론트엔드에서 100% 자체 계산)
// ---------------------------------------------------------------------------
const getVixStatus = (value) => {
  if (value < 15) return 'Strong Bull';
  if (value <= 20) return 'Bull';
  if (value <= 30) return 'Neutral';
  if (value <= 40) return 'Bear';
  return 'Crash';
};

const getRealYieldStatus = (value) => {
  if (value < 1.0) return 'Strong Bull';
  if (value <= 1.5) return 'Bull';
  if (value <= 2.0) return 'Neutral';
  if (value <= 2.5) return 'Bear';
  return 'Crash';
};

const getCreditSpreadStatus = (value) => {
  if (value < 1.2) return 'Strong Bull';
  if (value <= 1.8) return 'Bull';
  if (value <= 2.5) return 'Neutral';
  if (value <= 4.0) return 'Bear';
  return 'Crash';
};

const getWtiStatus = (value) => {
  if (value < 70) return 'Bull';
  if (value <= 85) return 'Neutral';
  if (value <= 100) return 'Bear';
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
  return 'Neutral'; 
};

const getQqqTrendStatus = (price, ma50, ma200) => {
  if (price > ma200 && ma50 > ma200) return 'Strong Bull';
  if (price > ma200) return 'Bull';
  if (price < ma200 && ma50 < ma200) return 'Crash';
  if (price < ma200) return 'Bear';
  return 'Neutral';
};

const STATUS_POINTS = {
  'Strong Bull': 100, 'Extreme Greed': 100,
  'Bull': 80, 'Greed': 80,
  'Neutral': 60,
  'Bear': 30, 'Fear': 30,
  'Crash': 0, 'Extreme Fear': 0, 'Warning': 0
};

const calculateRegimeScore = (byIndicator) => {
  if (Object.keys(byIndicator).length === 0) return { score: 60, regime: 'Neutral' };

  const getPts = (indKey) => {
    const status = byIndicator[indKey]?.calcStatus || 'Neutral';
    return STATUS_POINTS[status] !== undefined ? STATUS_POINTS[status] : 60;
  };

  let score = 0;
  score += getPts('QQQ_PRICE') * 0.40;
  score += getPts('VIX') * 0.20;
  score += getPts('REAL_YIELD_10Y') * 0.15;
  score += getPts('CREDIT_SPREAD') * 0.15;
  score += getPts('WTI') * 0.05;
  score += getPts('FEAR_GREED') * 0.05;

  const finalScore = Math.round(score);

  let regime = 'Neutral';
  if (finalScore >= 85) regime = 'Strong Bull';
  else if (finalScore >= 70) regime = 'Bull';
  else if (finalScore >= 50) regime = 'Neutral';
  else if (finalScore >= 30) regime = 'Bear';
  else regime = 'Crash';

  return { score: finalScore, regime };
};

const getStatusStyle = (status) => {
  switch (status) {
    case 'Strong Bull':
    case 'Extreme Greed': return { label: status, text: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
    case 'Bull':
    case 'Greed': return { label: status, text: 'text-[#00B464]', bg: 'bg-[#00B464]/10', border: 'border-[#00B464]/30' };
    case 'Neutral': return { label: status, text: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' };
    case 'Bear':
    case 'Fear': return { label: status, text: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30' };
    case 'Crash':
    case 'Warning':
    case 'Extreme Fear': return { label: status, text: 'text-[#FF4B4B]', bg: 'bg-[#FF4B4B]/10', border: 'border-[#FF4B4B]/30' };
    default: return { label: status || 'Neutral', text: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/30' };
  }
};

// ---------------------------------------------------------------------------
// 2. Gauge 좌표 유틸 (Regime Gauge / Fear & Greed Gauge 공용, inline SVG에서 사용)
// ---------------------------------------------------------------------------
const getCartesian = (cx, cy, radius, angle) => {
  const rad = (180 - angle) * Math.PI / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy - radius * Math.sin(rad)
  };
};

const getDonutSlice = (cx, cy, innerRadius, outerRadius, startAngle, endAngle) => {
  const p1 = getCartesian(cx, cy, outerRadius, startAngle);
  const p2 = getCartesian(cx, cy, outerRadius, endAngle);
  const p3 = getCartesian(cx, cy, innerRadius, endAngle);
  const p4 = getCartesian(cx, cy, innerRadius, startAngle);
  return `M ${p1.x} ${p1.y} A ${outerRadius} ${outerRadius} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${innerRadius} ${innerRadius} 0 0 0 ${p4.x} ${p4.y} Z`;
};

const scoreToAngle = (score) => {
  return (score / 100) * 180;
};

// ---------------------------------------------------------------------------
// 3. CNN Style Fear & Greed Gauge (기존 구조 유지, defs만 소폭 개선)
// ---------------------------------------------------------------------------
const FEAR_GREED_ZONES = [
  { id: 'ext-fear', label: 'EXTREME\nFEAR', min: 0, max: 25, color: '#FF4B4B' },
  { id: 'fear', label: 'FEAR', min: 25, max: 45, color: '#F97316' },
  { id: 'neutral', label: 'NEUTRAL', min: 45, max: 55, color: '#EAB308' },
  { id: 'greed', label: 'GREED', min: 55, max: 75, color: '#84CC16' },
  { id: 'ext-greed', label: 'EXTREME\nGREED', min: 75, max: 100, color: '#10B981' }
];

const FearGreedGauge = ({ value }) => {
  const cx = 100;
  const cy = 100;
  const outerR = 95;
  const innerR = 55;
  
  const clampedValue = Math.max(0, Math.min(100, value));
  const needleAngle = scoreToAngle(clampedValue);
  
  const activeZone = FEAR_GREED_ZONES.find(z => clampedValue >= z.min && clampedValue <= z.max) || FEAR_GREED_ZONES[FEAR_GREED_ZONES.length-1];

  return (
    <div className="flex flex-col items-center justify-center w-full mt-4 md:mt-6">
      <div className="relative w-full max-w-[360px] md:max-w-[420px] aspect-[2/1] flex justify-center items-end overflow-visible select-none">
        <svg viewBox="0 0 200 110" className="w-full h-full absolute bottom-0 overflow-visible">
          <defs>
            <radialGradient id="fgActiveZoneGlow" cx="50%" cy="100%" r="100%">
              <stop offset="0%" stopColor={activeZone.color} stopOpacity="0.4" />
              <stop offset="100%" stopColor={activeZone.color} stopOpacity="0.1" />
            </radialGradient>
            <filter id="fgNeedleShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodOpacity="0.35" />
            </filter>
          </defs>

          {FEAR_GREED_ZONES.map((zone) => {
            const isActive = activeZone.id === zone.id;
            const startAngle = scoreToAngle(zone.min);
            const endAngle = scoreToAngle(zone.max);
            const slicePath = getDonutSlice(cx, cy, innerR, outerR, startAngle, endAngle);
            
            return (
              <g key={zone.id}>
                <path 
                  d={slicePath}
                  className={isActive ? '' : 'fill-slate-100 stroke-slate-200 dark:fill-[#1E293B] dark:stroke-[#0F172A]'}
                  style={isActive ? { fill: "url(#fgActiveZoneGlow)", stroke: zone.color, strokeWidth: "2" } : { strokeWidth: "1" }}
                />
              </g>
            );
          })}

          <path 
            d="M 30 100 A 70 70 0 0 1 170 100" 
            fill="none" 
            className="stroke-slate-300 dark:stroke-slate-700"
            strokeWidth="1.5" 
            strokeDasharray="2 8" 
            strokeLinecap="round"
          />

          {[0, 25, 50, 75, 100].map(tick => {
            const angle = (tick / 100) * 180;
            const pos = getCartesian(cx, cy, 38, angle);
            return (
              <text key={tick} x={pos.x} y={pos.y} className="fill-slate-400 dark:fill-slate-500" fontSize="7" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
                {tick}
              </text>
            );
          })}
          
          <g style={{ transformOrigin: '100px 100px', transform: `rotate(${needleAngle}deg)`, transition: 'transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)' }} filter="url(#fgNeedleShadow)">
            <polygon 
              points="100,96 100,104 30,100" 
              className="fill-slate-800 dark:fill-white"
            />
          </g>
          
          <circle cx="100" cy="100" r="10" className="fill-slate-800 dark:fill-white"/>
          <circle cx="100" cy="100" r="4" className="fill-white dark:fill-[#0B1120]"/>
        </svg>

        <div className="absolute -bottom-2 w-full flex flex-col items-center justify-end z-10 bg-white dark:bg-[#0B1120] px-6 rounded-t-full">
          <p className="text-5xl md:text-6xl font-black tracking-tighter" style={{ color: activeZone.color }}>
            {Math.round(value)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2.5 mt-8 md:mt-10 px-2 w-full max-w-[500px]">
        {FEAR_GREED_ZONES.map((zone) => {
          const isActive = activeZone.id === zone.id;
          return (
            <div key={zone.id} className={`flex items-center gap-1.5 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-40 grayscale-[50%]'}`}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: zone.color }}></span>
              <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 whitespace-nowrap">
                {zone.label.replace('\n', ' ')} <span className="font-bold text-slate-400 dark:text-slate-500">({zone.min}-{zone.max})</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 4. Fear & Greed 전용 카드 
// ---------------------------------------------------------------------------
const FearGreedCard = ({ item }) => {
  const history = item.history || [];
  
  const getHistoricalVal = (offset) => {
    if (history.length > offset) return history[history.length - 1 - offset].value;
    return null;
  };

  const currentVal = item.value;
  const prevClose = getHistoricalVal(1);
  const oneWeek = getHistoricalVal(5);
  const oneMonth = getHistoricalVal(21);

  const renderTimelineRow = (label, val) => {
    if (val === null) return null;
    const status = getFearGreedStatus(val);
    const style = getStatusStyle(status);
    const displayStatus = status.replace('\n', ' ');

    return (
      <div className="flex items-center justify-between py-3.5 border-b border-dashed border-slate-200 dark:border-slate-700/50 last:border-0">
        <div className="flex flex-col">
          <span className="text-[12px] font-extrabold text-slate-500 mb-1">{label}</span>
          <span className="text-[14px] font-black text-slate-900 dark:text-white">{displayStatus}</span>
        </div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 bg-slate-50 dark:bg-[#111827] font-black text-[12px] ${style.text} border-current opacity-80`}>
          {Math.round(val)}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-600 p-4 md:p-6 rounded-3xl shadow-sm mb-6 flex flex-col lg:flex-row gap-8">
      
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-full flex flex-col items-start mb-2">
          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">Fear & Greed Index</h2>
        </div>
        <div className="w-full mt-6 pb-6">
          <FearGreedGauge value={currentVal} />
        </div>
        <p className="text-[11px] font-bold text-slate-400 mt-4 w-full text-left">
          Last updated {item.recorded_at}
        </p>
      </div>

      <div className="w-full lg:w-[340px] flex flex-col justify-center bg-slate-50 dark:bg-[#111827]/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800/50 h-auto self-center">
        <div className="flex flex-col w-full">
          {renderTimelineRow('Previous close', prevClose)}
          {renderTimelineRow('1 week ago', oneWeek)}
          {renderTimelineRow('1 month ago', oneMonth)}
        </div>
      </div>

    </div>
  );
};

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------
const RegimePopover = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="absolute top-12 left-0 md:left-4 z-50 w-[280px] bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl p-4 animate-in fade-in zoom-in-95 duration-200">
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

// RegimeSummary 내부에서만 쓰는 반원형 Gauge — 별도 파일/컴포넌트로 분리하지 않고 inline SVG로 직접 렌더링
const RegimeSummary = ({ regimeData }) => {
  const [infoOpen, setInfoOpen] = useState(false);
  const { score, regime } = regimeData;
  const conf = REGIME_CONFIG[regime] || REGIME_CONFIG.Neutral;

  // Gauge 좌표 계산 (JSX 내부에서 바로 사용)
  const gaugeCx = 100, gaugeCy = 96, gaugeOuterR = 92, gaugeInnerR = 62;
  const needleAngle = scoreToAngle(score);
  const activeZone = REGIME_ZONES.find(z => score >= z.min && score <= z.max) || REGIME_ZONES[2];

  return (
    <div className="w-full bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm mb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">

        <div className="flex items-center gap-4 md:gap-6">
          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-[15px] font-black text-slate-500 dark:text-slate-400">Current Market Regime</h2>
              <button onClick={() => setInfoOpen(!infoOpen)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer">
                <Info size={18} />
              </button>
              <RegimePopover isOpen={infoOpen} onClose={() => setInfoOpen(false)} />
            </div>
            <h1 className={`text-5xl md:text-6xl font-black tracking-tighter ${conf.color}`}>
              {regime}
            </h1>
          </div>
        </div>

        <div className="mt-8 md:mt-0 flex items-end gap-10">
          <div className="flex flex-col items-start md:items-end">
            <p className="text-[13px] font-extrabold text-slate-500 mb-1">Regime Score</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl md:text-5xl font-black ${conf.color}`}>{score}</span>
              <span className="text-xl font-black text-slate-400">/ 100</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 카드 아이콘 — 별도 컴포넌트 파일 없이, 필요한 지표에만 최소한으로 inline SVG 추가
// (QQQ Trend / VIX / WTI 만 지원, 나머지는 기존처럼 아이콘 없이 텍스트만 표시)
// ---------------------------------------------------------------------------
const renderCardIcon = (indicator) => {
  switch (indicator) {
    case 'QQQ_PRICE':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 17L9 11L13 15L21 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 5H21V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'VIX':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 12H6L8 5L13 19L16 12L18 15L20 12H22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'WTI':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 3C12 3 6 12 6 16C6 19.3137 8.68629 22 12 22C15.3137 22 18 19.3137 18 16C18 12 12 3 12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
};

// ---------------------------------------------------------------------------
// MacroCard — 미니 차트 평행선 현상 해결 적용 + 카드 아이콘(있는 경우) + Sparkline 색상만 개선
// ---------------------------------------------------------------------------
const MacroCard = ({ item, onClick }) => {
  const isPos = item.change_percent >= 0;
  const statusStyle = getStatusStyle(item.calcStatus);
  const sparkColor = isPos ? CHART_RED : CHART_BLUE;
  const icon = renderCardIcon(item.indicator);
  
  // 날짜순 오름차순 정렬 후 최근 20일(1개월)만 슬라이싱
  const sortedHist = [...(item.history || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  const chartData = sortedHist.slice(-20).map((h, i) => ({ index: i, value: h.value }));

  return (
    <div
      onClick={() => onClick(item)}
      className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between h-40"
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-1.5 min-w-0 pr-2">
          {icon && <span className="shrink-0">{icon}</span>}
          <h3 className="text-[13px] md:text-[14px] font-extrabold text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors truncate">
            {item.display_name || item.indicator}
          </h3>
        </div>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${statusStyle.text} ${statusStyle.bg} ${statusStyle.border} shrink-0`}>
          {statusStyle.label}
        </span>
      </div>

      <div className="flex justify-between items-end">
        <div>
          <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter mb-1">
            {item.value.toLocaleString()}
          </p>
          <p className={`text-[12px] md:text-[13px] font-black ${isPos ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>
            {isPos ? '▲' : '▼'} {Math.abs(item.change_percent).toFixed(2)}%
          </p>
        </div>
        <div className="w-20 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 2, bottom: 2 }}>
              <YAxis domain={['dataMin', 'dataMax']} hide />
              <Line type="monotone" dataKey="value" stroke={sparkColor} strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const MacroSection = ({ title, items, onCardClick }) => {
  const isPsychology = items.some(item => item.indicator === 'FEAR_GREED');
  
  if (isPsychology) {
    return (
      <div className="mb-10 w-full">
        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-4 pl-1">{title}</h3>
        {items.map(item => <FearGreedCard key={item.indicator} item={item} />)}
      </div>
    );
  }

  return (
    <div className="mb-10">
      <h3 className="text-xl font-black text-slate-900 dark:text-white mb-4 pl-1">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map(item => <MacroCard key={item.indicator} item={item} onClick={onCardClick} />)}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// MacroChartModal
// ---------------------------------------------------------------------------
const RANGE_TRADING_DAYS = { '1M': 20, '3M': 60, '1Y': 252, '3Y': 756, '5Y': 1260 };

const MacroChartModal = ({ item, onClose }) => {
  const [range, setRange] = useState('1Y');
  const isPos = item.change_percent >= 0;

  const chartData = useMemo(() => {
    if (!item.history || item.history.length === 0) return [];
    const sortedHist = [...item.history].sort((a, b) => new Date(a.date) - new Date(b.date));
    const days = RANGE_TRADING_DAYS[range] || 252;
    return sortedHist.slice(-days);
  }, [item.history, range]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-5 md:p-6 border-b border-slate-100 dark:border-slate-800/80">
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-1">{item.display_name || item.indicator}</h3>
            <p className="text-[13px] font-extrabold text-slate-500">{item.indicator} · {item.source}</p>
          </div>
          <button onClick={onClose} className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-4xl font-black text-slate-900 dark:text-white mb-2">
                  {item.value.toLocaleString()}{item.unit ? ` ${item.unit}` : ''}
                </p>
                <span className={`text-[14px] font-black px-2.5 py-1 rounded-lg border ${isPos ? 'text-[#FF4B4B] bg-[#FF4B4B]/10 border-[#FF4B4B]/30' : 'text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/30'}`}>
                  {isPos ? '▲' : '▼'} {Math.abs(item.change_percent).toFixed(2)}%
                </span>
              </div>
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
            <ResponsiveContainer width="100%" height="100%" key={range}>
              <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMacroModal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_RED} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_RED} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: '800' }} tickLine={false} axisLine={false} minTickGap={40} tickFormatter={(val) => val ? String(val).substring(5).replace('-', '.') : ''} />
                <YAxis domain={['dataMin', 'dataMax']} tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: '800' }} tickLine={false} axisLine={false} tickFormatter={(v) => v.toFixed(1)} />
                <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', color: 'white', fontWeight: '900' }} itemStyle={{ color: CHART_RED }} labelStyle={{ color: '#94A3B8', marginBottom: '4px' }} formatter={(value) => [value.toFixed(2), 'Value']} />
                <Area type="monotone" dataKey="value" stroke={CHART_RED} strokeWidth={2.5} fillOpacity={1} fill="url(#colorMacroModal)" activeDot={{ r: 6, fill: CHART_RED, strokeWidth: 0 }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 부모로부터 macroData를 Props로 받아 매핑
// ---------------------------------------------------------------------------
const MacroPage = ({ macroData }) => {
  const [selectedMacro, setSelectedMacro] = useState(null);

  const { byIndicator, regimeData } = useMemo(() => {
    const map = {};
    const safeData = Array.isArray(macroData) ? macroData : [];

    safeData.forEach(item => { map[item.indicator] = item; });

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
          calcStatus = 'Neutral'; 
          break;
        default:
          calcStatus = 'Neutral';
        }
      item.calcStatus = calcStatus;
    });

    const computedRegime = calculateRegimeScore(map);

    return { byIndicator: map, regimeData: computedRegime };
  }, [macroData]);

  // 매크로 데이터가 아직 불러와지지 않았거나 비어있을 경우 안전 처리
  if (!macroData || macroData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 w-full text-slate-500 animate-in fade-in">
        <Loader2 size={48} className="animate-spin text-slate-400 mb-4" />
        <p className="text-[14px] font-extrabold">매크로 데이터를 분석 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 w-full">
      <RegimeSummary regimeData={regimeData} />

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
export { RegimeSummary, MacroSection, MacroCard, FearGreedCard, FearGreedGauge, MacroChartModal, RegimePopover };
