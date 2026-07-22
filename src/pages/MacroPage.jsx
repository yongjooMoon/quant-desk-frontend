import React, { useMemo, useState, useEffect } from 'react';
import { Info, X, Loader2 } from 'lucide-react';
import {
  AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart,
} from 'recharts';

// 💡 알림: 미리보기(Preview) 환경에서 외부 파일을 찾지 못해 발생하는 컴파일 에러를 방지하기 위해 
// 임시로 import 문을 주석 처리하고 Mock 함수를 넣었습니다.
// 실제 프로젝트 환경에 복사하실 때는 아래 주석을 풀고, Mock 함수 블록을 삭제해 주세요!
import { useRenderApi } from '../hooks/useRenderApi';

const REGIME_CONFIG = {
  "Strong Bull": { color: "text-emerald-500", hex: "#10B981", desc: "강한 상승 추세\n공격적인 투자 가능\n무한매수 적극 운용 가능" },
  "Bull": { color: "text-[#00B464]", hex: "#00B464", desc: "상승 우세\n정상 투자 가능" },
  "Neutral": { color: "text-yellow-500", hex: "#EAB308", desc: "방향성 부족\nVR 또는 분할매수 고려" },
  "Bear": { color: "text-orange-500", hex: "#F97316", desc: "방어 전략 권장\n현금 비중 확대 고려" },
  "Crash": { color: "text-[#FF4B4B]", hex: "#FF4B4B", desc: "극단적인 Risk-Off\n신규 공격적 매수 자제" }
};

// Fear & Greed 위치를 최상단으로 분리
const SECTIONS = [
  { title: 'Market Psychology', indicators: ['FEAR_GREED'] },
  { title: 'Trend', indicators: ['QQQ_PRICE', 'QQQ_MA50', 'QQQ_MA200', 'QQQ_MA200_SLOPE'] },
  { title: 'Liquidity', indicators: ['REAL_YIELD_10Y', 'CREDIT_SPREAD'] },
  { title: 'Risk', indicators: ['VIX', 'WTI'] },
];

const CHART_RED = '#FF4B4B';

// ---------------------------------------------------------------------------
// 1. Status 계산 유틸리티 함수 (프론트엔드에서 자체 계산)
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
// 3. CNN Style Fear & Greed Gauge (수학적 렌더링 완벽 구현)
// ---------------------------------------------------------------------------
const getCartesian = (cx, cy, radius, angle) => {
  // SVG 좌표계: 0도 = 9시 방향(Left), 180도 = 3시 방향(Right)
  const rad = (180 - angle) * Math.PI / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy - radius * Math.sin(rad) // SVG Y축 아래로 증가
  };
};

const getDonutSlice = (cx, cy, innerRadius, outerRadius, startAngle, endAngle) => {
  const p1 = getCartesian(cx, cy, outerRadius, startAngle);
  const p2 = getCartesian(cx, cy, outerRadius, endAngle);
  const p3 = getCartesian(cx, cy, innerRadius, endAngle);
  const p4 = getCartesian(cx, cy, innerRadius, startAngle);
  return `M ${p1.x} ${p1.y} A ${outerRadius} ${outerRadius} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${innerRadius} ${innerRadius} 0 0 0 ${p4.x} ${p4.y} Z`;
};

// CNN 실제 구간 기준 (각도를 정확하게 매핑)
const FEAR_GREED_ZONES = [
  { id: 'ext-fear', label: 'EXTREME\nFEAR', min: 0, max: 25, color: '#FF4B4B', start: 0, end: 45 },
  { id: 'fear', label: 'FEAR', min: 25, max: 45, color: '#F97316', start: 45, end: 81 },
  { id: 'neutral', label: 'NEUTRAL', min: 45, max: 55, color: '#EAB308', start: 81, end: 99 },
  { id: 'greed', label: 'GREED', min: 55, max: 75, color: '#84CC16', start: 99, end: 135 },
  { id: 'ext-greed', label: 'EXTREME\nGREED', min: 75, max: 100, color: '#10B981', start: 135, end: 180 }
];

const FearGreedGauge = ({ value }) => {
  const cx = 100;
  const cy = 100;
  const outerR = 95;
  const innerR = 55;
  
  const clampedValue = Math.max(0, Math.min(100, value));
  // 바늘 각도 (0: 왼쪽 끝, 180: 오른쪽 끝)
  const needleAngle = (clampedValue / 100) * 180;
  
  const activeZone = FEAR_GREED_ZONES.find(z => clampedValue >= z.min && clampedValue <= z.max) || FEAR_GREED_ZONES[FEAR_GREED_ZONES.length-1];

  return (
    <div className="relative w-full max-w-[340px] md:max-w-[400px] aspect-[2/1] flex justify-center items-end mx-auto overflow-visible select-none mt-6">
      <svg viewBox="0 0 200 110" className="w-full h-full absolute bottom-0 overflow-visible">
        {/* 1. 5개 분할 도넛 세그먼트 그리기 */}
        {FEAR_GREED_ZONES.map((zone) => {
          const isActive = activeZone.id === zone.id;
          const slicePath = getDonutSlice(cx, cy, innerR, outerR, zone.start, zone.end);
          
          const midAngle = (zone.start + zone.end) / 2;
          const textRadius = 75; 
          const textPos = getCartesian(cx, cy, textRadius, midAngle);
          const labelLines = zone.label.split('\n');
          
          // 활성화된 텍스트 색상은 각 구역 색상, 비활성화는 짙은 회색
          const textColor = isActive ? zone.color : '#64748B'; 
          
          return (
            <g key={zone.id}>
              {/* 배경/테두리 패스 */}
              <path 
                d={slicePath}
                fill={isActive ? `${zone.color}33` : '#1E293B'}
                stroke={isActive ? zone.color : '#0F172A'}
                strokeWidth={isActive ? "2" : "1"}
                className="transition-all duration-300"
              />
              {/* 구간 라벨 텍스트 */}
              <text 
                fill={textColor}
                fontSize="9"
                fontWeight="900"
                textAnchor="middle"
                dominantBaseline="middle"
                // 90 - midAngle 공식을 통해 텍스트 하단이 항상 중심(원점)을 향하도록 회전
                transform={`rotate(${90 - midAngle}, ${textPos.x}, ${textPos.y})`}
                style={{ letterSpacing: '0.5px' }}
              >
                {labelLines.map((line, i) => (
                  <tspan key={i} x={textPos.x} dy={i === 0 ? (labelLines.length > 1 ? '-0.4em' : '0') : '1.1em'}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}

        {/* 2. 내부 점선 트랙 (Dotted Line) */}
        <path 
          d="M 30 100 A 70 70 0 0 1 170 100" 
          fill="none" 
          stroke="#334155" 
          strokeWidth="1.5" 
          strokeDasharray="2 8" 
          strokeLinecap="round"
        />

        {/* 눈금 숫자 (0, 25, 50, 75, 100) */}
        {[0, 25, 50, 75, 100].map(tick => {
          const angle = (tick / 100) * 180;
          const pos = getCartesian(cx, cy, 38, angle);
          return (
            <text key={tick} x={pos.x} y={pos.y} fill="#64748B" fontSize="7" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
              {tick}
            </text>
          );
        })}
        
        {/* 3. 바늘 (Needle) */}
        {/* 기준점 (100,100). 초기(0도)에 바늘이 정확히 9시(왼쪽)를 향하게 그림 */}
        <g style={{ transformOrigin: '100px 100px', transform: `rotate(${needleAngle}deg)`, transition: 'transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
          {/* 바늘 몸통: base가 (100, 97~103), tip이 (20, 100) -> 정확한 왼쪽 방향 */}
          <polygon 
            points="100,97 100,103 20,100" 
            fill="#FFFFFF" 
          />
        </g>
        
        {/* 바늘 중심축 원 */}
        <circle cx="100" cy="100" r="10" fill="#0B1120"/>
        <circle cx="100" cy="100" r="6" fill="#FFFFFF"/>
      </svg>

      {/* 4. 중앙 하단 텍스트 영역 */}
      <div className="absolute -bottom-2 w-full flex flex-col items-center justify-end z-10 bg-white dark:bg-[#0B1120] px-6 rounded-t-full">
        <p className="text-5xl md:text-6xl font-black tracking-tighter" style={{ color: activeZone.color }}>
          {Math.round(value)}
        </p>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 4. Fear & Greed 전용 메인 카드 (클릭 불가, 과거 타임라인 패널 포함)
// ---------------------------------------------------------------------------
const FearGreedCard = ({ item }) => {
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
    // 상태 라벨에서 'Extreme ' 등의 줄바꿈을 띄어쓰기로 변환 (타임라인 표기용)
    const displayStatus = status.replace('\n', ' ');

    return (
      <div className="flex items-center justify-between py-3 border-b border-dashed border-slate-700/50 last:border-0">
        <div className="flex flex-col">
          <span className="text-[12px] font-extrabold text-slate-500 mb-1">{label}</span>
          <span className="text-[14px] font-black text-white">{displayStatus}</span>
        </div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 border-[#1E293B] font-black text-[12px] bg-[#111827]`} style={{ color: style.text.replace('text-', '') }}>
          {Math.round(val)}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-3xl shadow-sm mb-6 flex flex-col lg:flex-row gap-10">
      
      {/* 왼쪽: 메인 게이지 영역 */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-full flex justify-between items-start mb-2">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-white">CNN Fear & Greed Index</h2>
            <p className="text-[13px] font-extrabold text-slate-400 mt-1">What emotion is driving the market now?</p>
          </div>
        </div>
        <div className="w-full mt-6 pb-6">
          <FearGreedGauge value={currentVal} />
        </div>
        <p className="text-[11px] font-bold text-slate-500 mt-4 w-full text-left">
          Last updated {item.recorded_at}
        </p>
      </div>

      {/* 오른쪽: 타임라인 데이터 패널 */}
      <div className="lg:w-72 flex flex-col justify-center bg-[#111827]/50 rounded-2xl p-5 border border-slate-800/50">
        <div className="flex gap-2 mb-4">
          <span className="px-3 py-1 bg-[#1E293B] text-white text-[11px] font-black rounded-full">Overview</span>
          <span className="px-3 py-1 text-slate-400 text-[11px] font-black rounded-full">Timeline</span>
        </div>
        
        <div className="flex flex-col">
          {renderTimelineRow('Previous close', prevClose)}
          {renderTimelineRow('1 week ago', oneWeek)}
          {renderTimelineRow('1 month ago', oneMonth)}
          {renderTimelineRow('1 year ago', oneYear)}
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
// MacroCard — 미니 차트 (Sparkline) 1개월 데이터 (Fear & Greed 제외)
// ---------------------------------------------------------------------------
const MacroCard = ({ item, onClick }) => {
  const isPos = item.change_percent >= 0;
  const statusStyle = getStatusStyle(item.calcStatus);
  
  // 과거->최신 오름차순 정렬 후 최근 20일(1개월) 슬라이싱
  const sortedHist = [...(item.history || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  const chartData = sortedHist.slice(-20).map((h, i) => ({ index: i, value: h.value }));

  return (
    <div
      onClick={() => onClick(item)}
      className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between h-40"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-[13px] md:text-[14px] font-extrabold text-slate-500 dark:text-slate-400 group-hover:text-white transition-colors truncate pr-2">
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
            {/* 💡 YAxis dataMin 설정으로 미니 차트 평행선 현상 완벽 해결 */}
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
  // Fear & Greed는 전용 카드 사용
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
// MacroChartModal — 3Y, 5Y 차트 랜더링 버그 완벽 해결
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
            {/* 💡 key={range}로 재랜더링 강제 및 YAxis에 dataMin, dataMax 적용으로 평행선 현상 해결 */}
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
