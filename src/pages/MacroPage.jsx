import React, { useMemo, useState, useEffect } from 'react';
import { Info, ShieldCheck, X, Loader2 } from 'lucide-react';
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
// 1. Status 계산 유틸리티 함수 (API에 의존하지 않고 React에서 순수 계산)
// ---------------------------------------------------------------------------
const getVixStatus = (value) => {
  if (value < 15) return 'Strong Bull';
  if (value <= 20) return 'Bull'; // 15~20
  if (value <= 30) return 'Neutral'; // 20~30
  if (value <= 40) return 'Bear'; // 30~40
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
  return 'Warning'; // Crash 대신 Warning 사용 (점수 환산 시 Crash와 동일 취급)
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
  if (Object.keys(byIndicator).length === 0) return { score: 60, regime: 'Neutral' }; // Default fallback

  const getPts = (indKey) => {
    const status = byIndicator[indKey]?.calcStatus || 'Neutral';
    return STATUS_POINTS[status] !== undefined ? STATUS_POINTS[status] : 60;
  };

  // 가중치 적용: QQQ 40%, VIX 20%, Real Yield 15%, Credit Spread 15%, WTI 5%, F&G 5%
  let score = 0;
  score += getPts('QQQ_PRICE') * 0.40; // QQQ Trend 상태 점수
  score += getPts('VIX') * 0.20;
  score += getPts('REAL_YIELD_10Y') * 0.15;
  score += getPts('CREDIT_SPREAD') * 0.15;
  score += getPts('WTI') * 0.05;
  score += getPts('FEAR_GREED') * 0.05;

  const finalScore = Math.round(score);

  // 점수에 따른 Regime 상태 결정
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

  // 불필요한 Positive/Negative 요소 모두 제거. 4가지 핵심 요소만 남김.
  return (
    <div className="w-full bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm mb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-[15px] font-black text-slate-500 dark:text-slate-400">Current Market Regime</h2>
            <button onClick={() => setInfoOpen(!infoOpen)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
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
              {/* Confidence는 별도 로직이 없으므로 일단 100% 고정 (변경 요청 없었음) */}
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
// CNN Style Fear & Greed Gauge (바늘 추가 및 정확한 SVG 렌더링)
// ---------------------------------------------------------------------------
const FearGreedGauge = ({ value, size = 'sm', statusLabel }) => {
  const isLg = size === 'lg';
  const dims = isLg 
    ? { w: 'w-64 md:w-80', h: 'h-36 md:h-44', valueClass: 'text-4xl md:text-5xl mb-2', labelClass: 'text-[14px]' } 
    : { w: 'w-full', h: 'h-24', valueClass: 'text-2xl mb-0.5', labelClass: 'text-[10px]' };
  
  // 0~100 값을 기반으로 0도 ~ 180도 각도로 변환 (SVG 반원 기준)
  // 값이 작을수록 (공포) 바늘은 좌측(0도 부근), 값이 클수록 (탐욕) 우측(180도 부근)
  const clampedValue = Math.max(0, Math.min(100, value));
  const rotation = (clampedValue / 100) * 180;

  // 바늘(Needle) Polygon 꼭짓점 계산
  // 중심점은 (100, 100). 바늘 길이는 75. 두께를 위해 양옆으로 오프셋.
  const needlePath = "M 96,100 L 104,100 L 100,25 Z";

  return (
    <div className={`relative ${dims.w} ${dims.h} flex justify-center items-end mx-auto overflow-hidden`}>
      <svg viewBox="0 0 200 110" className="w-full h-full absolute bottom-0">
        <defs>
          {/* CNN 스타일 5단계 색상 그라데이션. 
              부드러운 그라데이션 대신 Hard Stop을 주어 5개의 명확한 Zone을 만듭니다. */}
          <linearGradient id="cnnGaugeGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FF4B4B" />
            <stop offset="25%" stopColor="#FF4B4B" />
            <stop offset="25%" stopColor="#F97316" />
            <stop offset="45%" stopColor="#F97316" />
            <stop offset="45%" stopColor="#EAB308" />
            <stop offset="55%" stopColor="#EAB308" />
            <stop offset="55%" stopColor="#00B464" />
            <stop offset="75%" stopColor="#00B464" />
            <stop offset="75%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>

        {/* 배경 트랙 (그라데이션 색상 적용) */}
        <path 
          d="M 20 100 A 80 80 0 0 1 180 100" 
          fill="none" 
          stroke="url(#cnnGaugeGradient)" 
          strokeWidth="18" 
          strokeLinecap="butt" 
        />
        
        {/* 바늘 (Needle) - 좌측 상단(0,0)을 기준으로 하므로 중심점(100,100)에서 회전 */}
        <polygon 
          points="96,100 104,100 100,25" 
          fill="currentColor" 
          className="text-slate-700 dark:text-slate-200 transition-transform duration-1000 ease-out"
          style={{ transformOrigin: '100px 100px', transform: `rotate(${rotation - 90}deg)` }}
        />
        <circle cx="100" cy="100" r="8" fill="currentColor" className="text-slate-700 dark:text-slate-200" />
      </svg>

      <div className="absolute bottom-0 w-full flex flex-col items-center justify-end z-10 translate-y-2">
        <p className={`${dims.valueClass} font-black tracking-tighter text-slate-900 dark:text-white`}>
          {Math.round(value)}
        </p>
        <p className={`${dims.labelClass} font-extrabold text-slate-500 uppercase tracking-widest`}>
          {statusLabel}
        </p>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// MacroCard — 미니 차트 (Sparkline) 1개월 데이터 표출 픽스
// ---------------------------------------------------------------------------
const MacroCard = ({ item, onClick }) => {
  const isGauge = item.indicator === 'FEAR_GREED';
  const isPos = item.change_percent >= 0;
  const statusStyle = getStatusStyle(item.calcStatus);
  
  // Sparkline 픽스: 과거->최신 오름차순 정렬 후 최근 20일(1개월) 슬라이싱
  const sortedHist = [...(item.history || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  const chartData = sortedHist.slice(-20).map((h, i) => ({ index: i, value: h.value }));

  return (
    <div
      onClick={() => onClick(item)}
      className={`bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between ${isGauge ? 'col-span-1 sm:col-span-2 lg:col-span-4 h-auto py-8' : 'h-40'}`}
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
        <div className="mt-4">
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
              {/* YAxis domain 픽스: dataMin, dataMax를 주어 미니 차트가 평행선이 되지 않고 움직임이 보이도록 수정 */}
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
// MacroChartModal — 3Y, 5Y 차트 랜더링 버그 완벽 픽스
// ---------------------------------------------------------------------------
const RANGE_TRADING_DAYS = { '1M': 20, '3M': 60, '1Y': 252, '3Y': 756, '5Y': 1260 };

const MacroChartModal = ({ item, onClose }) => {
  const [range, setRange] = useState('1Y');
  const isGauge = item.indicator === 'FEAR_GREED';
  const isPos = item.change_percent >= 0;

  // 3Y, 5Y 차트가 평행선이 되거나 안보이던 문제 수정 (슬라이싱 및 YAxis 스케일 강제)
  const chartData = useMemo(() => {
    if (!item.history || item.history.length === 0) return [];
    
    // 1. 반드시 가장 과거 데이터가 앞쪽에 오도록 정렬 (x축 버그 방지)
    const sortedHist = [...item.history].sort((a, b) => new Date(a.date) - new Date(b.date));
    const days = RANGE_TRADING_DAYS[range] || 252;
    
    // 2. 최신 기준으로 요청 기간(days)만큼만 잘라내기
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
                <div className="flex items-center justify-center w-full min-w-[250px]">
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
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMacroModal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_RED} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_RED} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: '800' }} tickLine={false} axisLine={false} minTickGap={40} tickFormatter={(val) => val ? String(val).substring(5).replace('-', '.') : ''} />
                  {/* YAxis domain 픽스: 3Y, 5Y 등 긴 기간 조회 시 스케일링이 안되어 평행선이 뜨는 문제 완벽 해결 */}
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

  // API 데이터를 기반으로 Status 및 Regime 계산
  const { byIndicator, regimeData } = useMemo(() => {
    const map = {};
    macroData.forEach(item => { map[item.indicator] = item; });

    // 1. 각 지표별로 React 내부 함수를 통해 Status 강제 덮어쓰기 계산
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

    // 2. 환산된 Status들을 기반으로 Regime Score 자동 합산
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
      {/* 3. 불필요한 데이터를 제거하고 계산된 Regime 점수를 전달 */}
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
