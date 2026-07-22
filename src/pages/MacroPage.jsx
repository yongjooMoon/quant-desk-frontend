import React, { useMemo, useState, useEffect } from 'react';
import { Info, ShieldCheck, X, Loader2 } from 'lucide-react';
import {
  AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart,
} from 'recharts';

// 미리보기 환경 컴파일 에러 방지용 임시 Mock 훅입니다.
// 로컬 환경에 적용하실 때는 아래 Mock 코드를 지우고 주석 처리된 import 문을 사용해주세요.
import { useRenderApi } from '../hooks/useRenderApi';

// =============================================================================
// Macro Dashboard (Frontend Logic Only)
// =============================================================================

const REGIME_CONFIG = {
  "Strong Bull": { color: "text-emerald-500", hex: "#10B981", desc: "강한 상승 추세\n공격적인 투자 가능\n무한매수 적극 운용 가능" },
  "Bull": { color: "text-[#00B464]", hex: "#00B464", desc: "상승 우세\n정상 투자 가능" },
  "Neutral": { color: "text-yellow-500", hex: "#EAB308", desc: "방향성 부족\nVR 또는 분할매수 고려" },
  "Bear": { color: "text-orange-500", hex: "#F97316", desc: "방어 전략 권장\n현금 비중 확대 고려" },
  "Crash": { color: "text-[#FF4B4B]", hex: "#FF4B4B", desc: "극단적인 Risk-Off\n신규 공격적 매수 자제" }
};

// Fear & Greed 위치를 최상단(Trend 보다 위)으로 이동
const SECTIONS = [
  { title: 'Market Psychology', indicators: ['FEAR_GREED'] },
  { title: 'Trend', indicators: ['QQQ_PRICE', 'QQQ_MA50', 'QQQ_MA200', 'QQQ_MA200_SLOPE'] },
  { title: 'Liquidity', indicators: ['REAL_YIELD_10Y', 'CREDIT_SPREAD'] },
  { title: 'Risk', indicators: ['VIX', 'WTI'] },
];

const CHART_RED = '#FF4B4B'; 

// ---------------------------------------------------------------------------
// 1. Status 계산 유틸리티 함수
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

// ---------------------------------------------------------------------------
// 2. Regime Score 자동 계산 및 판정 유틸리티
// ---------------------------------------------------------------------------
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
// 3. CNN Style Fear & Greed Gauge (수학적 렌더링 완벽 구현)
// ---------------------------------------------------------------------------
const getCartesian = (cx, cy, radius, angle) => {
  // SVG 좌표계에서 0도는 9시 방향(Left), 180도는 3시 방향(Right)으로 매핑
  const rad = (180 - angle) * Math.PI / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy - radius * Math.sin(rad) // SVG는 Y축이 아래로 증가
  };
};

const getDonutSlice = (cx, cy, innerRadius, outerRadius, startAngle, endAngle) => {
  const p1 = getCartesian(cx, cy, outerRadius, startAngle);
  const p2 = getCartesian(cx, cy, outerRadius, endAngle);
  const p3 = getCartesian(cx, cy, innerRadius, endAngle);
  const p4 = getCartesian(cx, cy, innerRadius, startAngle);

  // 시계방향(1), 반시계방향(0)
  return `
    M ${p1.x} ${p1.y}
    A ${outerRadius} ${outerRadius} 0 0 1 ${p2.x} ${p2.y}
    L ${p3.x} ${p3.y}
    A ${innerRadius} ${innerRadius} 0 0 0 ${p4.x} ${p4.y}
    Z
  `;
};

const FEAR_GREED_ZONES = [
  { id: 'ext-fear', label: 'EXTREME FEAR', min: 0, max: 25, color: '#FF4B4B', start: 0, end: 36 },
  { id: 'fear', label: 'FEAR', min: 25, max: 45, color: '#F97316', start: 36, end: 72 },
  { id: 'neutral', label: 'NEUTRAL', min: 45, max: 55, color: '#EAB308', start: 72, end: 108 },
  { id: 'greed', label: 'GREED', min: 55, max: 75, color: '#00B464', start: 108, end: 144 },
  { id: 'ext-greed', label: 'EXTREME GREED', min: 75, max: 100, color: '#10B981', start: 144, end: 180 }
];

const FearGreedGauge = ({ value, size = 'sm', statusLabel }) => {
  const isLg = size === 'lg';
  const cx = 100;
  const cy = 100;
  const outerR = 90;
  const innerR = 50;
  
  const clampedValue = Math.max(0, Math.min(100, value));
  // 0~100 값을 0도~180도로 변환 (바늘 회전용)
  const needleAngle = (clampedValue / 100) * 180;
  
  // 현재 활성화된 구역 찾기
  const activeZone = FEAR_GREED_ZONES.find(z => clampedValue >= z.min && clampedValue <= z.max) || FEAR_GREED_ZONES[FEAR_GREED_ZONES.length-1];

  const dims = isLg 
    ? { w: 'w-72 md:w-96', h: 'h-40 md:h-52', valueClass: 'text-4xl md:text-5xl', labelClass: 'text-[14px]' } 
    : { w: 'w-full max-w-[280px]', h: 'h-28 md:h-32', valueClass: 'text-2xl', labelClass: 'text-[11px]' };

  return (
    <div className={`relative ${dims.w} ${dims.h} flex justify-center items-end mx-auto overflow-visible select-none`}>
      <svg viewBox="0 0 200 110" className="w-full h-full absolute bottom-0 overflow-visible">
        {/* 1. 5개 분할 도넛 세그먼트 그리기 */}
        {FEAR_GREED_ZONES.map((zone) => {
          const isActive = activeZone.id === zone.id;
          const slicePath = getDonutSlice(cx, cy, innerR, outerR, zone.start, zone.end);
          // 텍스트 회전 각도 (구간의 중간)
          const midAngle = (zone.start + zone.end) / 2;
          // SVG 텍스트 회전을 위해 중심점(100,100)을 기준으로 회전
          // 텍스트 위치 반경
          const textRadius = 70; 
          const textPos = getCartesian(cx, cy, textRadius, midAngle);
          
          return (
            <g key={zone.id}>
              {/* 배경/테두리 패스 */}
              <path 
                d={slicePath}
                fill={isActive ? `${zone.color}22` : '#F1F5F9'}
                stroke={isActive ? zone.color : 'white'}
                strokeWidth={isActive ? "2" : "1"}
                className={isActive ? '' : 'dark:fill-[#334155] dark:stroke-[#1E293B] transition-all duration-300'}
              />
              {/* 구간 라벨 텍스트 */}
              <text 
                x={textPos.x} 
                y={textPos.y}
                fill={isActive ? zone.color : '#94A3B8'}
                fontSize={isLg ? "6.5" : "7.5"}
                fontWeight="900"
                textAnchor="middle"
                dominantBaseline="middle"
                // 텍스트가 호(arc)를 따라 자연스럽게 기울어지도록 변환
                // 90도를 빼서 텍스트의 밑단이 중심을 향하도록 함
                transform={`rotate(${midAngle - 90}, ${textPos.x}, ${textPos.y})`}
                className={isActive ? '' : 'dark:fill-[#64748B]'}
                style={{ letterSpacing: '0.5px' }}
              >
                {zone.label}
              </text>
            </g>
          );
        })}

        {/* 2. 내부 점선 트랙 (Dotted Line) */}
        <path 
          d="M 30 100 A 70 70 0 0 1 170 100" 
          fill="none" 
          stroke="#CBD5E1" 
          strokeWidth="1.5" 
          strokeDasharray="2 8" 
          strokeLinecap="round"
          className="dark:stroke-[#475569]"
        />

        {/* 눈금 숫자 (0, 25, 50, 75, 100) */}
        {[0, 25, 50, 75, 100].map(tick => {
          const angle = (tick / 100) * 180;
          const pos = getCartesian(cx, cy, 38, angle);
          return (
            <text key={tick} x={pos.x} y={pos.y} fill="#94A3B8" fontSize="6" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" className="dark:fill-[#64748B]">
              {tick}
            </text>
          );
        })}
        
        {/* 3. 바늘 (Needle) */}
        {/* 기준점은 (100,100). 좌측(0도)을 기준으로 그림판자처럼 배치 후 rotate로 돌림 */}
        <g 
          style={{ transformOrigin: '100px 100px', transform: `rotate(${needleAngle}deg)`, transition: 'transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        >
          {/* 바늘 몸통 */}
          <polygon 
            points="96,100 104,100 100,30" 
            fill="#1E293B" 
            className="dark:fill-white"
          />
        </g>
        
        {/* 바늘 중심축 원 */}
        <circle cx="100" cy="100" r="10" fill="white" className="dark:fill-[#0B1120]"/>
        <circle cx="100" cy="100" r="8" fill="#1E293B" className="dark:fill-white"/>
      </svg>

      {/* 4. 중앙 하단 텍스트 영역 */}
      <div className="absolute -bottom-2 w-full flex flex-col items-center justify-end z-10 bg-white dark:bg-[#111827] px-6 rounded-t-full shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
        <p className={`${dims.valueClass} font-black tracking-tighter`} style={{ color: activeZone.color }}>
          {Math.round(value)}
        </p>
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

const RegimeSummary = ({ regimeData }) => {
  const [infoOpen, setInfoOpen] = useState(false);
  const { score, regime } = regimeData;
  const conf = REGIME_CONFIG[regime] || REGIME_CONFIG.Neutral;

  return (
    <div className="w-full bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm mb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
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

        <div className="mt-8 md:mt-0 flex items-end gap-10">
          <div className="flex flex-col items-start md:items-end">
            <p className="text-[13px] font-extrabold text-slate-500 mb-1">Regime Score</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl md:text-5xl font-black ${conf.color}`}>{score}</span>
              <span className="text-xl font-black text-slate-400">/ 100</span>
            </div>
          </div>
          <div className="flex flex-col items-start md:items-end">
            <p className="text-[13px] font-extrabold text-slate-500 mb-1 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-slate-400" /> Confidence
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl md:text-5xl font-black text-slate-700 dark:text-slate-300">100</span>
              <span className="text-xl font-black text-slate-400">%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// MacroCard — 미니 차트 (Sparkline) 1개월 데이터
// ---------------------------------------------------------------------------
const MacroCard = ({ item, onClick }) => {
  const isGauge = item.indicator === 'FEAR_GREED';
  const isPos = item.change_percent >= 0;
  const statusStyle = getStatusStyle(item.calcStatus);
  
  // 과거->최신 오름차순 정렬 후 최근 20일(1개월) 슬라이싱
  const sortedHist = [...(item.history || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  const chartData = sortedHist.slice(-20).map((h, i) => ({ index: i, value: h.value }));

  return (
    <div
      onClick={() => onClick(item)}
      className={`bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between ${isGauge ? 'col-span-1 sm:col-span-2 lg:col-span-4 h-auto py-8 mb-6' : 'h-40'}`}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-[13px] md:text-[14px] font-extrabold text-slate-500 dark:text-slate-400 truncate pr-2">
          {item.display_name || item.indicator}
        </h3>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${statusStyle.text} ${statusStyle.bg} ${statusStyle.border} shrink-0`}>
          {statusStyle.label}
        </span>
      </div>

      {isGauge ? (
        <div className="mt-4 pb-4">
          <FearGreedGauge value={item.value} size="lg" statusLabel={item.calcStatus} />
        </div>
      ) : (
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
                <Line type="monotone" dataKey="value" stroke={CHART_RED} strokeWidth={2.5} dot={false} isAnimationActive={false} />
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

// ---------------------------------------------------------------------------
// MacroChartModal — 3Y, 5Y 차트 랜더링 버그 완벽 해결
// ---------------------------------------------------------------------------
const RANGE_TRADING_DAYS = { '1M': 20, '3M': 60, '1Y': 252, '3Y': 756, '5Y': 1260 };

const MacroChartModal = ({ item, onClose }) => {
  const [range, setRange] = useState('1Y');
  const isGauge = item.indicator === 'FEAR_GREED';
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
              {isGauge ? (
                <div className="flex items-center justify-center w-full min-w-[300px]">
                  <FearGreedGauge value={item.value} size="lg" statusLabel={item.calcStatus} />
                </div>
              ) : (
                <div>
                  <p className="text-4xl font-black text-slate-900 dark:text-white mb-2">
                    {item.value.toLocaleString()}{item.unit ? ` ${item.unit}` : ''}
                  </p>
                  <span className={`text-[14px] font-black px-2.5 py-1 rounded-lg border ${isPos ? 'text-[#FF4B4B] bg-[#FF4B4B]/10 border-[#FF4B4B]/30' : 'text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/30'}`}>
                    {isPos ? '▲' : '▼'} {Math.abs(item.change_percent).toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
            {!isGauge && (
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
            )}
          </div>

          {!isGauge && (
            <div className="w-full h-[300px] md:h-[400px]">
              {/* 💡 Recharts 버그 해결의 핵심: key={range} 부여로 차트 강제 재생성 */}
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
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// MacroPage — 메인 로직 조립
// ---------------------------------------------------------------------------
const MacroPage = () => {
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

  const { byIndicator, regimeData } = useMemo(() => {
    const map = {};
    macroData.forEach(item => { map[item.indicator] = item; });

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
export { RegimeSummary, MacroSection, MacroCard, FearGreedGauge, MacroChartModal, RegimePopover };
