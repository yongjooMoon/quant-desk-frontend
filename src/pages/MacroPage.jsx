import React, { useMemo, useState, useEffect } from 'react';
import { Info, Loader2, X } from 'lucide-react';
import {
  AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart,
} from 'recharts';
import { useRenderApi } from '../hooks/useRenderApi';

// =========================================================================

const REGIME_CONFIG = {
  "Strong Bull": { color: "text-emerald-500", hex: "#10B981", desc: "강한 상승 추세\n공격적인 투자 가능\n무한매수 적극 운용 가능" },
  "Bull": { color: "text-[#00B464]", hex: "#00B464", desc: "상승 우세\n정상 투자 가능" },
  "Neutral": { color: "text-yellow-500", hex: "#EAB308", desc: "방향성 부족\nVR 또는 분할매수 고려" },
  "Bear": { color: "text-orange-500", hex: "#F97316", desc: "방어 전략 권장\n현금 비중 확대 고려" },
  "Crash": { color: "text-[#FF4B4B]", hex: "#FF4B4B", desc: "극단적인 Risk-Off\n신규 공격적 매수 자제" }
};

// Fear & Greed 위치 최상단 이동
const SECTIONS = [
  { title: 'Market Psychology', indicators: ['FEAR_GREED'] },
  { title: 'Trend', indicators: ['QQQ_PRICE', 'QQQ_MA50', 'QQQ_MA200', 'QQQ_MA200_SLOPE'] },
  { title: 'Liquidity', indicators: ['REAL_YIELD_10Y', 'CREDIT_SPREAD'] },
  { title: 'Risk', indicators: ['VIX', 'WTI'] },
];

const CHART_RED = '#FF4B4B';

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
// 3. CNN Style Fear & Greed Gauge (위치 및 테마 호환 완벽 구현)
// ---------------------------------------------------------------------------
const getCartesian = (cx, cy, radius, angle) => {
  // SVG 좌표계에서 0도는 9시(왼쪽), 180도는 3시(오른쪽)로 매핑합니다.
  const rad = (180 - angle) * Math.PI / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy - radius * Math.sin(rad) // SVG Y축은 아래로 증가하므로 마이너스 처리
  };
};

const getDonutSlice = (cx, cy, innerRadius, outerRadius, startAngle, endAngle) => {
  const p1 = getCartesian(cx, cy, outerRadius, startAngle);
  const p2 = getCartesian(cx, cy, outerRadius, endAngle);
  const p3 = getCartesian(cx, cy, innerRadius, endAngle);
  const p4 = getCartesian(cx, cy, innerRadius, startAngle);
  return `M ${p1.x} ${p1.y} A ${outerRadius} ${outerRadius} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${innerRadius} ${innerRadius} 0 0 0 ${p4.x} ${p4.y} Z`;
};

// 점수(0~100)를 각도(0~180도)로 변환하는 유틸리티 함수
const scoreToAngle = (score) => {
  return (score / 100) * 180;
};

// CNN 실제 구간 기준 설정 (하드코딩 각도 제거, 점수 기반 선형 계산용)
// 오직 min, max 점수 구간만 존재하며, 각도는 렌더링 시점에 자동 계산됨.
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
  // 바늘 각도 자동 계산 (0점 -> 0도, 50점 -> 90도, 100점 -> 180도)
  const needleAngle = scoreToAngle(clampedValue);
  
  const activeZone = FEAR_GREED_ZONES.find(z => clampedValue >= z.min && clampedValue <= z.max) || FEAR_GREED_ZONES[FEAR_GREED_ZONES.length-1];

  return (
    <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10 w-full mt-4 md:mt-6">
      {/* 1. 반원 게이지 영역 (글자 제거됨) */}
      <div className="relative w-full max-w-[280px] md:max-w-[320px] aspect-[2/1] flex justify-center items-end overflow-visible select-none">
        <svg viewBox="0 0 200 110" className="w-full h-full absolute bottom-0 overflow-visible">
          {/* 분할 도넛 세그먼트 그리기 */}
          {FEAR_GREED_ZONES.map((zone) => {
            const isActive = activeZone.id === zone.id;
            
            // 렌더링 시점에 점수를 기반으로 시작/종료 각도를 선형적으로 자동 계산
            const startAngle = scoreToAngle(zone.min);
            const endAngle = scoreToAngle(zone.max);
            
            const slicePath = getDonutSlice(cx, cy, innerR, outerR, startAngle, endAngle);
            
            return (
              <g key={zone.id}>
                {/* 배경/테두리 패스 */}
                <path 
                  d={slicePath}
                  className={isActive ? '' : 'fill-slate-100 stroke-slate-200 dark:fill-[#1E293B] dark:stroke-[#0F172A]'}
                  style={isActive ? { fill: `${zone.color}33`, stroke: zone.color, strokeWidth: "2" } : { strokeWidth: "1" }}
                />
              </g>
            );
          })}

          {/* 내부 점선 트랙 */}
          <path 
            d="M 30 100 A 70 70 0 0 1 170 100" 
            fill="none" 
            className="stroke-slate-300 dark:stroke-slate-700"
            strokeWidth="1.5" 
            strokeDasharray="2 8" 
            strokeLinecap="round"
          />

          {/* 눈금 숫자 (0, 25, 50, 75, 100) */}
          {[0, 25, 50, 75, 100].map(tick => {
            const angle = (tick / 100) * 180;
            const pos = getCartesian(cx, cy, 38, angle);
            return (
              <text key={tick} x={pos.x} y={pos.y} className="fill-slate-400 dark:fill-slate-500" fontSize="7" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
                {tick}
              </text>
            );
          })}
          
          {/* 바늘 (Needle) */}
          {/* 9시 방향(왼쪽)을 0도 기준으로 하여 회전하도록 기하학적 형태 교정 */}
          <g style={{ transformOrigin: '100px 100px', transform: `rotate(${needleAngle}deg)`, transition: 'transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
            {/* 바늘의 베이스는 100,100 중심부근, 팁은 30,100 (내부 점선을 넘어 게이지 컬러영역을 가리킴) */}
            <polygon 
              points="100,96 100,104 30,100" 
              className="fill-slate-800 dark:fill-white"
            />
          </g>
          
          {/* 바늘 중심축 원 */}
          <circle cx="100" cy="100" r="10" className="fill-slate-800 dark:fill-white"/>
          <circle cx="100" cy="100" r="4" className="fill-white dark:fill-[#0B1120]"/>
        </svg>

        {/* 중앙 하단 수치 */}
        <div className="absolute -bottom-2 w-full flex flex-col items-center justify-end z-10 bg-white dark:bg-[#0B1120] px-6 rounded-t-full">
          <p className="text-4xl md:text-5xl font-black tracking-tighter" style={{ color: activeZone.color }}>
            {Math.round(value)}
          </p>
        </div>
      </div>

      {/* 2. 우측 점수 기준 범례 (Legend) */}
      <div className="flex flex-col gap-2.5 bg-slate-50 dark:bg-[#1E293B]/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
        {FEAR_GREED_ZONES.map((zone) => {
          const isActive = activeZone.id === zone.id;
          return (
            <div key={zone.id} className={`flex items-center gap-3 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-40 grayscale-[50%]'}`}>
              <span className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: zone.color }}></span>
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">
                  {zone.label.replace('\n', ' ')}
                </span>
                <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500">
                  {zone.min} - {zone.max}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 4. Fear & Greed 전용 카드 (탭 기능 구현 포함)
// ---------------------------------------------------------------------------
const FearGreedCard = ({ item }) => {
  const [tab, setTab] = useState('overview'); // 'overview' | 'timeline'
  const history = item.history || [];
  
  // 과거 거래일 기준 데이터 추출
  const getHistoricalVal = (offset) => {
    if (history.length > offset) return history[history.length - 1 - offset].value;
    return null;
  };

  const currentVal = item.value;
  const prevClose = getHistoricalVal(1);
  const oneWeek = getHistoricalVal(5); // 영업일 5일
  const oneMonth = getHistoricalVal(21); // 영업일 21일
  const oneYear = getHistoricalVal(252); // 영업일 252일

  const renderTimelineRow = (label, val) => {
    if (val === null) return null;
    const status = getFearGreedStatus(val);
    const style = getStatusStyle(status);
    const displayStatus = status.replace('\n', ' ');

    return (
      <div className="flex items-center justify-between py-3 border-b border-dashed border-slate-200 dark:border-slate-700/50 last:border-0">
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

  // 타임라인 탭에서 보여줄 1년치 차트 데이터
  const chartData = useMemo(() => {
    const sorted = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
    return sorted.slice(-252);
  }, [history]);

  return (
    <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-3xl shadow-sm mb-6 flex flex-col lg:flex-row gap-10">
      
      {/* 왼쪽: 메인 게이지 영역 */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-full flex flex-col items-start mb-2">
          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">CNN Fear & Greed Index</h2>
          <p className="text-[13px] font-extrabold text-slate-500 mt-1">What emotion is driving the market now?</p>
        </div>
        <div className="w-full mt-6 pb-6">
          <FearGreedGauge value={currentVal} />
        </div>
        <p className="text-[11px] font-bold text-slate-400 mt-4 w-full text-left">
          Last updated {item.recorded_at}
        </p>
      </div>

      {/* 오른쪽: 작동하는 기능성 탭 패널 */}
      <div className="lg:w-80 flex flex-col justify-start bg-slate-50 dark:bg-[#111827]/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-800/50">
        {/* 탭 토글 버튼 */}
        <div className="flex bg-slate-200 dark:bg-[#1E293B] p-1 rounded-full mb-6 relative z-10 w-full max-w-[200px] mx-auto md:mx-0">
          <button 
            onClick={() => setTab('overview')} 
            className={`flex-1 px-4 py-1.5 rounded-full text-[12px] font-black transition-all ${tab === 'overview' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Overview
          </button>
          <button 
            onClick={() => setTab('timeline')} 
            className={`flex-1 px-4 py-1.5 rounded-full text-[12px] font-black transition-all ${tab === 'timeline' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Timeline
          </button>
        </div>
        
        {/* 내용 영역 */}
        <div className="flex flex-col flex-1 h-[250px] relative">
          {tab === 'overview' ? (
            <div className="flex flex-col animate-in fade-in duration-300 h-full justify-center">
              {renderTimelineRow('Previous close', prevClose)}
              {renderTimelineRow('1 week ago', oneWeek)}
              {renderTimelineRow('1 month ago', oneMonth)}
              {renderTimelineRow('1 year ago', oneYear)}
            </div>
          ) : (
            <div className="w-full h-full animate-in fade-in duration-300 flex flex-col justify-end">
              <span className="text-[11px] font-black text-slate-400 mb-2">1 Year Trend</span>
              <ResponsiveContainer width="100%" height="90%">
                <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fgGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis domain={[0, 100]} tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: '800' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', color: 'white', fontWeight: '900' }} itemStyle={{ color: '#8b5cf6' }} labelStyle={{ display: 'none' }} formatter={(value) => [Math.round(value), 'Index']} />
                  <Area type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#fgGradient)" />
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
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// MacroCard — 미니 차트 평행선 현상 해결 적용
// ---------------------------------------------------------------------------
const MacroCard = ({ item, onClick }) => {
  const isPos = item.change_percent >= 0;
  const statusStyle = getStatusStyle(item.calcStatus);
  
  // 날짜순 오름차순 정렬 후 최근 20일(1개월)만 슬라이싱
  const sortedHist = [...(item.history || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  const chartData = sortedHist.slice(-20).map((h, i) => ({ index: i, value: h.value }));

  return (
    <div
      onClick={() => onClick(item)}
      className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between h-40"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-[13px] md:text-[14px] font-extrabold text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors truncate pr-2">
          {item.display_name || item.indicator}
        </h3>
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
            {/* 💡 YAxis dataMin, dataMax 명시로 평행선 현상 완벽 해결 */}
            <LineChart data={chartData} margin={{ top: 2, bottom: 2 }}>
              <YAxis domain={['dataMin', 'dataMax']} hide />
              <Line type="monotone" dataKey="value" stroke={CHART_RED} strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const MacroSection = ({ title, items, onCardClick }) => {
  // Fear & Greed는 새로 구현한 전용 카드 사용
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
// MacroChartModal — 3Y, 5Y 차트 랜더링 버그(캐싱 현상) 완벽 해결
// ---------------------------------------------------------------------------
const RANGE_TRADING_DAYS = { '1M': 20, '3M': 60, '1Y': 252, '3Y': 756, '5Y': 1260 };

const MacroChartModal = ({ item, onClose }) => {
  const [range, setRange] = useState('1Y');
  const isPos = item.change_percent >= 0;

  const chartData = useMemo(() => {
    if (!item.history || item.history.length === 0) return [];
    // 날짜 오름차순으로 반드시 정렬해야 우측부터 데이터가 채워짐
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
            {/* 💡 핵심: key={range} 부여! React가 강제로 기존 컴포넌트를 파괴하고 
                새로 렌더링하게 만들어 Recharts의 도메인(축) 스케일링 버그를 원천 차단함 */}
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
                {/* 💡 핵심: YAxis에 dataMin, dataMax 도메인 지정 */}
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
export { RegimeSummary, MacroSection, MacroCard, FearGreedCard, FearGreedGauge, MacroChartModal, RegimePopover };
