import { useEffect, useState, useMemo, useRef } from 'react';
import {
  RefreshCcw, X,
  TrendingUp, ShieldCheck, Droplets, Activity, Rocket, Zap,
  Crosshair, TrendingDown, Flag, BookOpen, ShieldAlert, Target, ChevronRight, ChevronDown, Info,
  Trophy, Skull, Repeat, CalendarRange
} from 'lucide-react';
import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, LineChart, BarChart, Bar, ScatterChart, Scatter, Cell } from 'recharts';
import { useRenderApi } from '../hooks/useRenderApi';
import MacroPage from './MacroPage';
import QuantScreener from './QuantScreener';
// =========================================================================

// 🌟 숫자 카운트업 애니메이션 훅 (ease-out cubic)
function useCountUp(target, duration = 1100) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);
  const fromRef = useRef(0);
  const targetRef = useRef(0);

  useEffect(() => {
    const safeTarget = Number.isFinite(target) ? target : 0;
    const from = fromRef.current;
    const start = performance.now();
    cancelAnimationFrame(rafRef.current);

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (safeTarget - from) * eased;
      setValue(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = safeTarget;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    targetRef.current = safeTarget;
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}

// 🌟 카운트업 숫자를 그리는 얇은 래퍼 (formatter 커스텀 가능)
function CountUp({ value, duration = 1100, decimals = 2, formatter }) {
  const animated = useCountUp(value, duration);
  if (formatter) return <>{formatter(animated)}</>;
  return <>{animated.toFixed(decimals)}</>;
}

// 🌟 반원 게이지(score gauge) 위의 특정 percent 지점 좌표 계산 (M 20 100 A 80 80 0 0 1 180 100 기준)
function getGaugePoint(percent) {
  const clamped = Math.max(0, Math.min(100, percent || 0));
  const t = (180 - 1.8 * clamped) * (Math.PI / 180);
  const x = 100 + 80 * Math.cos(t);
  const y = 100 - 80 * Math.sin(t);
  return { x, y };
}

// 🌟 Dock 스타일 근접도 기반 스케일 계산 (리스트 hover 확대 효과)
function getDockScale(index, hoverIndex) {
  if (hoverIndex === null || hoverIndex === undefined) return { scale: 1, lift: 0 };
  const diff = Math.abs(index - hoverIndex);
  if (diff === 0) return { scale: 1.035, lift: -4 };
  if (diff === 1) return { scale: 1.015, lift: -1 };
  return { scale: 1, lift: 0 };
}

// 🌟 매크로 지표 값 포맷 (unit이 통화기호면 접두어, 의미 없는 unit 텍스트는 생략)
function formatMacroValue(item) {
  const val = item?.value;
  if (val === null || val === undefined || isNaN(val)) return "N/A";
  const unit = item.unit || "";
  const formatted = Math.abs(val) >= 1000
    ? val.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : val.toFixed(2);

  if (["$", "₩", "£", "€"].includes(unit)) return `${unit}${formatted}`;

  const hiddenUnits = ["usd", "krw", "index", "slope", "pt", "point"];
  if (!unit || hiddenUnits.includes(unit.toLowerCase())) return formatted;

  return `${formatted}${unit}`;
}

// 🌟 매크로 티커 한 칸(항목)
function MacroTickerItem({ item, onClick }) {
  const change = item?.change_percent || 0;
  const isUp = change > 0;
  const isDown = change < 0;
  const color = isUp ? "text-[#FF4B4B]" : isDown ? "text-[#3B82F6]" : "text-slate-400";
  const arrow = isUp ? "▲" : isDown ? "▼" : "─";
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-5 py-2.5 shrink-0 whitespace-nowrap cursor-pointer hover:opacity-70 transition-opacity"
    >
      <span className="text-[13px] font-extrabold text-slate-500 dark:text-slate-400">{item.display_name}</span>
      <span className="text-[13px] font-black text-slate-900 dark:text-white">{formatMacroValue(item)}</span>
      <span className={`text-[12px] font-black ${color}`}>
        {arrow} {change > 0 ? "+" : ""}{change.toFixed(2)}%
      </span>
    </button>
  );
}

// 🌟 매크로 지표 티커 바 (상단에서 계속 흐르는 marquee, hover 시 정지, 클릭 시 탭 이동)
function MacroTicker({ macroData, onNavigate }) {
  if (!macroData || macroData.length === 0) return null;

  const items = [...macroData, ...macroData];
  const duration = Math.max(30, macroData.length * 4);

  return (
    <div className="macro-ticker-wrap bg-white dark:bg-[#0B1120] border-y border-slate-200 dark:border-slate-800/80 mb-8 rounded-xl">
      <div
        className="macro-ticker-track"
        style={{ "--macro-duration": `${duration}s` }}
      >
        {items.map((item, idx) => (
          <MacroTickerItem key={`${item.indicator}-${idx}`} item={item} onClick={onNavigate} />
        ))}
      </div>
    </div>
  );
}

// 🌟 레짐(시장 국면) 색상/라벨 매핑 — 전략 신뢰도 바 & 백테스팅 탭에서 공용으로 사용
const REGIME_META = {
  BULL:    { label: 'BULL', color: '#FF4B4B', bg: 'bg-red-50 dark:bg-red-950/20', border: 'border-red-200 dark:border-red-900/50' },
  BEAR:    { label: 'BEAR', color: '#3B82F6', bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-200 dark:border-blue-900/50' },
  NEUTRAL: { label: 'NEUTRAL', color: '#94A3B8', bg: 'bg-slate-100 dark:bg-slate-800/40', border: 'border-slate-300 dark:border-slate-700' },
};
const getRegimeMeta = (r) => REGIME_META[r] || REGIME_META.NEUTRAL;

const CONFIDENCE_LABEL = {
  insufficient: { text: '표본 부족', color: '#94A3B8', bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-300 dark:border-slate-700' },
  reference: { text: '참고 가능', color: '#3B82F6', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-300 dark:border-blue-800' },
  reliable: { text: '신뢰 가능', color: '#00B464', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-300 dark:border-emerald-800' },
};
const getConfidenceMeta = (level) => CONFIDENCE_LABEL[level] || CONFIDENCE_LABEL.insufficient;

const EXIT_TYPE_META = {
  SIGNAL: { label: '전략 신호 청산', color: '#3B82F6' },
  DELISTING: { label: '상장폐지 강제청산', color: '#EF4444' },
  BACKTEST_END: { label: '백테스트 종료 강제청산', color: '#94A3B8' },
};
const getExitTypeMeta = (t) => EXIT_TYPE_META[t] || { label: t || '-', color: '#94A3B8' };

// 🌟 전역 마이크로 인터랙션 스타일 (스포트라이트 호버, 글로우, 배경 텍스처, 매크로 티커)
const MICRO_INTERACTION_STYLES = `
  .gate-spotlight { position: relative; overflow: hidden; }
  .gate-spotlight::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at var(--mx, 50%) var(--my, 50%), var(--spotlight-color, rgba(255,75,75,0.14)), transparent 42%);
    opacity: 0;
    transition: opacity 0.35s ease;
    pointer-events: none;
    z-index: 0;
  }
  .gate-spotlight:hover::before { opacity: 1; }
  .gate-spotlight > * { position: relative; z-index: 1; }

  .qd-dock-row { transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.28s ease; will-change: transform; }

  .qd-gauge-glow { filter: drop-shadow(0 0 6px currentColor); animation: qdGaugePulse 1.8s ease-in-out infinite; }
  @keyframes qdGaugePulse {
    0%, 100% { opacity: 0.85; r: 5; }
    50% { opacity: 1; r: 6.5; }
  }

  .qd-bar-fill { transition: width 1s cubic-bezier(0.22, 1, 0.36, 1); }

  .qd-bg-texture { position: absolute; inset: 0; pointer-events: none; opacity: 0.55; z-index: -1; }
  .dark .qd-bg-texture { opacity: 0.35; }

  /* 🌟 매크로 티커(marquee) 스타일 */
  .macro-ticker-wrap {
    position: relative;
    width: 100%;
    overflow: hidden;
    -webkit-mask-image: linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%);
    mask-image: linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%);
  }
  .macro-ticker-track {
    display: flex;
    align-items: center;
    width: max-content;
    animation: macroTickerScroll var(--macro-duration, 40s) linear infinite;
  }
  .macro-ticker-wrap:hover .macro-ticker-track {
    animation-play-state: paused;
  }
  @keyframes macroTickerScroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }

  /* 🌟 전략 신뢰도 바의 레짐 펄스 점 */
  @keyframes qdRegimePing {
    75%, 100% { transform: scale(2.2); opacity: 0; }
  }
  .qd-regime-ping { animation: qdRegimePing 1.8s cubic-bezier(0, 0, 0.2, 1) infinite; }

  /* 🌟 수량 칩 — 클릭 가능한 종목 상세 트리거 */
  .qd-qty-chip { transition: all 0.15s ease; }
  .qd-qty-chip:hover { transform: translateY(-1px); }
`;

// =========================================================================
// 🌟 Quant / Macro 데이터 로컬 캐시 (Local Storage) 관련 상수 및 헬퍼 함수
//    - 배치가 매일 14:30 시작, 약 10~20분 내 완료되므로 15:10을 만료 시각으로 사용
//    - 새로고침 버튼은 이 캐시를 거치지 않고 항상 API를 호출합니다 (fetchQuantData(true))
// =========================================================================
const QUANT_CACHE_KEY = 'qd_quant_macro_cache_v3'; // ★ 12y 백테스트 데이터 구조가 바뀌어서 캐시 키 버전업
const CACHE_EXPIRE_HOUR = 15;
const CACHE_EXPIRE_MINUTE = 10;

function getNextExpireAt() {
  const now = new Date();
  const expire = new Date(now);
  expire.setHours(CACHE_EXPIRE_HOUR, CACHE_EXPIRE_MINUTE, 0, 0);
  if (now.getTime() >= expire.getTime()) {
    expire.setDate(expire.getDate() + 1);
  }
  return expire.toISOString();
}

function readQuantMacroCache() {
  try {
    const raw = window.localStorage.getItem(QUANT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.expireAt || !parsed.data) return null;
    const expireAt = new Date(parsed.expireAt);
    if (Number.isNaN(expireAt.getTime())) return null;
    if (new Date().getTime() < expireAt.getTime()) {
      return parsed.data;
    }
    return null;
  } catch (e) {
    return null;
  }
}

function writeQuantMacroCache(payload) {
  try {
    const expireAt = getNextExpireAt();
    window.localStorage.setItem(QUANT_CACHE_KEY, JSON.stringify({ data: payload, expireAt }));
  } catch (e) {
    // localStorage 접근 실패(비공개 모드 등) 시 캐시 없이 정상 동작하도록 무시합니다.
  }
}

const EMPTY_QUANT_DATA = { holdings: [], trades: [], history: [], confirmed: [], watchlist: [], backtest: null, macro: [], screener: [], backtest12y: null };

export default function QuantDesk() {
  const [activeTab, setActiveTab] = useState("Macro");
  const [data, setData] = useState(EMPTY_QUANT_DATA);
  const [kospiData, setKospiData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [selectedStock, setSelectedStock] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [riskStock, setRiskStock] = useState(null);

  // 🌟 [변경] 종목별 상세 팝업 — 이제 켈리 사이징이 아니라
  //    data.backtest12y.trades를 이 종목 코드로 필터링한 "과거 신호 이력"만 보여준다.
  const [backtestStock, setBacktestStock] = useState(null);

  const [timeRange, setTimeRange] = useState("All");

  const [indices, setIndices] = useState({ kospi: null, kosdaq: null, nasdaq: null, sp500: null });
  const [isIndexModalOpen, setIsIndexModalOpen] = useState(false);

  const [isEntryOpen, setIsEntryOpen] = useState(true);
  const [isExitOpen, setIsExitOpen] = useState(true);

  const [hoverHoldingIdx, setHoverHoldingIdx] = useState(null);
  const [hoverWatchIdx, setHoverWatchIdx] = useState(null);
  const [hoverHistoryIdx, setHoverHistoryIdx] = useState(null);
  const [hoverBtTradeIdx, setHoverBtTradeIdx] = useState(null);

  // 🌟 [신규] 백테스팅 탭 — 거래내역 필터/페이지네이션 + Equity Curve 구간
  const [btEquityRange, setBtEquityRange] = useState("All"); // '1Y' | '3Y' | '5Y' | 'All'
  const [btYearFilter, setBtYearFilter] = useState("All");
  const [btExitTypeFilter, setBtExitTypeFilter] = useState("All");
  const [btResultFilter, setBtResultFilter] = useState("All"); // 'All' | 'WIN' | 'LOSS'
  const [btPage, setBtPage] = useState(1);
  const BT_PAGE_SIZE = 20;

  const { callApi, ServerWakeupOverlay } = useRenderApi();

  const initialLoadRef = useRef({ kr: false, us: false });

  const animatedScore = useCountUp(selectedStock ? (selectedStock.score || 0) : 0, 1300);

  useEffect(() => {
    let intervalId;

    const getMarketStatus = () => {
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const kst = new Date(utc + (9 * 3600000));
      const day = kst.getDay();
      const hour = kst.getHours();
      const minute = kst.getMinutes();
      const timeNum = hour * 100 + minute;

      const isWeekendKR = day === 0 || day === 6;
      const isKoreaOpen = !isWeekendKR && (timeNum >= 900 && timeNum < 1530);

      let isUSOpen = false;
      if (day >= 1 && day <= 5 && hour >= 22) {
          isUSOpen = true;
      } else if (day >= 2 && day <= 6 && hour < 7) {
          isUSOpen = true;
      }

      return { isKoreaOpen, isUSOpen };
    };

    const fetchIndices = () => {
      if (document.hidden) return;

      const t = Date.now();
      const { isKoreaOpen, isUSOpen } = getMarketStatus();
      const promises = [];

      if (isKoreaOpen || !initialLoadRef.current.kr) {
        promises.push(callApi(`/api/search/KS11?t=${t}`, { background: true }).then(res => ({ key: 'kospi', res })));
        promises.push(callApi(`/api/search/KQ11?t=${t}`, { background: true }).then(res => ({ key: 'kosdaq', res })));
      }

      if (isUSOpen || !initialLoadRef.current.us) {
        promises.push(callApi(`/api/search/US500?t=${t}`, { background: true }).then(res => ({ key: 'sp500', res })));
        promises.push(callApi(`/api/search/IXIC?t=${t}`, { background: true }).then(res => ({ key: 'nasdaq', res })));
      }

      if (promises.length > 0) {
        Promise.allSettled(promises).then((results) => {
          setIndices(prev => {
            const next = { ...prev };
            results.forEach(result => {
              if (result.status === 'fulfilled' && result.value.res?.status === 'success') {
                next[result.value.key] = result.value.res.data;
              }
            });
            return next;
          });
          initialLoadRef.current = { kr: true, us: true };
        });
      }
    };

    fetchIndices();
    intervalId = setInterval(fetchIndices, 60000);

    const handleVisibilityChange = () => {
      if (!document.hidden) fetchIndices();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [callApi]);

  // 🌟 forceRefresh = true 인 경우(새로고침 버튼)는 캐시를 무시하고 항상 API를 호출합니다.
  const fetchQuantData = (forceRefresh = false) => {
    setLoading(true);

    if (!forceRefresh) {
      const cached = readQuantMacroCache();
      if (cached) {
        setData({ ...EMPTY_QUANT_DATA, ...cached });
        setKospiData(cached.kospiData || []);
        setLoading(false);
        return;
      }
    }

    // 🌟 [변경] /api/backtesting/result(250일치) 대신 /api/backtesting/12y-result(12년치)를 호출
    Promise.allSettled([
      callApi("/api/quant-dashboard"),
      callApi("/api/search/KS11"),
      callApi("/api/macro"),
      callApi("/api/screener"),
      callApi("/api/backtesting/12y-result"),
    ])
    .then((results) => {
      const quantResult = results[0].status === 'fulfilled' ? results[0].value : null;
      const kospiResult = results[1].status === 'fulfilled' ? results[1].value : null;
      const macroResult = results[2].status === 'fulfilled' ? results[2].value : null;
      const screenerResult = results[3].status === 'fulfilled' ? results[3].value : null;
      const backtest12yResult = results[4].status === 'fulfilled' ? results[4].value : null;

      let mergedDataForCache = null;
      let processedKospiForCache = [];

      if (quantResult && quantResult.status === "success" && quantResult.data) {
        const mergedData = { ...quantResult.data };

        mergedData.macro = (macroResult && macroResult.status === "success" && macroResult.data) ? macroResult.data : [];
        mergedData.screener = (screenerResult && screenerResult.status === "success" && screenerResult.data) ? screenerResult.data : [];
        mergedData.backtest12y = (backtest12yResult && backtest12yResult.status === "success" && backtest12yResult.data) ? backtest12yResult.data : null;

        setData(mergedData);
        mergedDataForCache = mergedData;
      }

      if (kospiResult && kospiResult.status === "success" && kospiResult.data && Array.isArray(kospiResult.data.chart_data)) {
        const rawChart = kospiResult.data.chart_data;
        const processedKospi = [];
        for (let i = 0; i < rawChart.length; i++) {
            let pct = 0;
            if (i > 0 && rawChart[i-1].price) {
                pct = ((rawChart[i].price - rawChart[i-1].price) / rawChart[i-1].price) * 100;
            }
            processedKospi.push({
                date: rawChart[i].date,
                pct_change: pct
            });
        }
        setKospiData(processedKospi);
        processedKospiForCache = processedKospi;
      } else {
        setKospiData([]);
        processedKospiForCache = [];
      }

      if (mergedDataForCache) {
        writeQuantMacroCache({
          ...mergedDataForCache,
          kospiData: processedKospiForCache
        });
      }

      setLoading(false);
    });
  };

  useEffect(() => { fetchQuantData(); }, []);

  const handleRefresh = () => {
    setSyncing(true);
    setTimeout(() => {
        fetchQuantData(true);
        setSyncing(false);
    }, 1500);
  };

  const handleStockClick = (symbol, basicData) => {
    setReportLoading(true);

    let mappedGates = null;
    if (basicData.filter_details) {
        mappedGates = Object.fromEntries(
            Object.entries(basicData.filter_details).map(([k, v]) => [k, { ...v, name: k }])
        );
    }

    setSelectedStock({
        ...basicData,
        score: basicData.factor_score !== undefined ? basicData.factor_score : basicData.score,
        gates: mappedGates || basicData.gates,
        isLoading: true
    });

    callApi(`/api/search/${symbol}`)
      .then(result => {
        if (result.status === "success") {
            const fetchedData = result.data;
            const finalScore = basicData.factor_score !== undefined ? basicData.factor_score : fetchedData.score;
            const finalGates = mappedGates || fetchedData.gates;
            const finalPass = basicData.total_pass !== undefined ? basicData.total_pass : (fetchedData.gates ? Object.values(fetchedData.gates).filter(g => g.pass).length : 0);

            setSelectedStock({
              ...basicData,
              ...fetchedData,
              name: fetchedData.name || basicData.name,
              score: finalScore,
              gates: finalGates,
              total_pass: finalPass,
              isLoading: false
            });
        } else {
            setSelectedStock(prev => ({ ...prev, isLoading: false, fetchError: true }));
        }
        setReportLoading(false);
      })
      .catch(() => {
          setSelectedStock(prev => ({ ...prev, isLoading: false, fetchError: true }));
          setReportLoading(false);
      });
  };

  // 🌟 [변경] 켈리 사이징 대신, 이 종목의 12년치 과거 신호 이력만 로컬에서 필터링해 보여준다.
  const handlePositionSizingClick = (symbol, basicData) => {
    setBacktestStock({ symbol, name: basicData.name });
  };

  const holdings = data.holdings || [];
  const trades = data.trades || [];
  const watchlist = data.watchlist || [];

  const holdingSyms = holdings.map(h => h.symbol);
  const filWatchlist = watchlist.filter(w => !holdingSyms.includes(w.symbol)).slice(0, 20);

  const sellTrades = trades.filter(t => t.type === 'SELL').reverse();
  const wins = sellTrades.filter(t => t.return_rate > 0);
  const losses = sellTrades.filter(t => t.return_rate <= 0);
  const winRate = sellTrades.length > 0 ? (wins.length / sellTrades.length) * 100 : 0;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.return_rate, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.return_rate, 0) / losses.length : 0;

  const totalProfitAmt = sellTrades.reduce((sum, t) => {
      const entry = t.trade_price / (1 + ((t.return_rate || 0) / 100));
      return sum + (t.trade_price - entry);
  }, 0);

  const chartData = useMemo(() => {
    let backboneDates = [];
    const kospiMap = {};

    if (kospiData && kospiData.length > 0) {
        backboneDates = kospiData.map(k => {
            kospiMap[k.date] = k.pct_change || 0;
            return k.date;
        });
    } else {
        for (let i = 90; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const localDateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().substring(0, 10);
            backboneDates.push(localDateStr);
        }
    }

    const dailySellTrades = {};
    sellTrades.forEach(t => {
      if (!t.trade_date) return;
      const dDate = t.trade_date.substring(0, 10);
      if (!dailySellTrades[dDate]) {
        dailySellTrades[dDate] = { sum: 0, count: 0 };
      }
      dailySellTrades[dDate].sum += (t.return_rate || 0);
      dailySellTrades[dDate].count += 1;
    });

    let kospiCum = 0;
    let portCum = 0;

    return backboneDates.map(dateStr => {
        if (kospiMap[dateStr]) {
            kospiCum += kospiMap[dateStr];
        }

        const sellMatch = dailySellTrades[dateStr];
        let todayPortRet = 0;
        if (sellMatch) {
            todayPortRet = sellMatch.sum / sellMatch.count;
            portCum += todayPortRet;
        }

        return {
            date: dateStr,
            kospi_cum: kospiCum,
            cum: portCum,
            return: todayPortRet,
            alpha: portCum - kospiCum
        };
    });
  }, [sellTrades, kospiData]);

  const lastChartData = chartData.length > 0 ? chartData[chartData.length - 1] : { cum: 0, kospi_cum: 0, alpha: 0 };
  const lastDayRet = chartData.length > 0 ? chartData[chartData.length - 1].return : 0;

  const isPositive = lastChartData.cum >= 0;
  const mainColor = isPositive ? '#FF4B4B' : '#3B82F6';

  const displayChartData = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    let days = chartData.length;
    if (timeRange === '1W') days = 7;
    if (timeRange === '1M') days = 30;
    return chartData.slice(Math.max(chartData.length - days, 0));
  }, [chartData, timeRange]);

  // =========================================================================
  // 🌟 [신규] 백테스팅 탭 파생 데이터 — 전부 data.backtest12y.trades 하나에서 가공
  // =========================================================================
  const bt = data.backtest12y; // { track_record, track_record_by_regime, yearly_stats, walk_forward, trades, known_limitations, ... }
  const btTrades = bt?.trades || [];
  const btTrackRecord = bt?.track_record || null;

  // 이 종목 상세 팝업(backtestStock)이 참조할 "이 종목만의" 과거 신호 이력
  const backtestSymbol = backtestStock?.symbol;
  const backtestDisplayName = backtestStock?.name;
  const backtestOwnTrades = useMemo(() => {
    if (!backtestSymbol) return [];
    return btTrades.filter(t => t.symbol === backtestSymbol)
      .sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date));
  }, [btTrades, backtestSymbol]);

  const btEquityChartData = useMemo(() => {
    if (!btTrackRecord?.equity_curve) return [];
    return btTrackRecord.equity_curve.map(pt => ({
      date: pt.date,
      strategy: (pt.value - 1) * 100,
    }));
  }, [btTrackRecord]);

  const btEquityDisplayData = useMemo(() => {
    if (btEquityChartData.length === 0 || btEquityRange === 'All') return btEquityChartData;
    const yearsBack = btEquityRange === '1Y' ? 1 : btEquityRange === '3Y' ? 3 : 5;
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - yearsBack);
    const cutoffStr = cutoff.toISOString().substring(0, 10);
    return btEquityChartData.filter(pt => pt.date >= cutoffStr);
  }, [btEquityChartData, btEquityRange]);

  const btConfidenceMeta = getConfidenceMeta(btTrackRecord?.confidence_level);

  const btHeadlineMetrics = btTrackRecord ? [
    { label: '표본(트레이드) 수', value: `${btTrackRecord.trade_count}건` },
    { label: '승률', value: `${btTrackRecord.win_rate?.toFixed(1)}%`, sub: `95% CI ${btTrackRecord.win_rate_ci95?.[0]?.toFixed(1)}~${btTrackRecord.win_rate_ci95?.[1]?.toFixed(1)}%` },
    { label: '기대값 (Expectancy)', value: `${btTrackRecord.expectancy_pct > 0 ? '+' : ''}${btTrackRecord.expectancy_pct?.toFixed(2)}%`, sub: `95% CI ${btTrackRecord.expectancy_ci95?.[0]?.toFixed(2)}~${btTrackRecord.expectancy_ci95?.[1]?.toFixed(2)}%` },
    { label: 'Profit Factor', value: btTrackRecord.profit_factor?.toFixed(2) },
    { label: '손익비 (Payoff)', value: btTrackRecord.payoff_ratio?.toFixed(2) },
    { label: 'CAGR', value: `${btTrackRecord.cagr_pct > 0 ? '+' : ''}${btTrackRecord.cagr_pct?.toFixed(2)}%` },
    { label: 'MDD', value: `${btTrackRecord.mdd_pct?.toFixed(1)}%` },
    { label: '일별 샤프', value: btTrackRecord.daily_sharpe?.toFixed(2) },
    { label: '평균 보유일', value: `${btTrackRecord.avg_hold_days?.toFixed(1)}일` },
    { label: '최대 연속손실', value: `${btTrackRecord.max_consecutive_losses ?? '-'}회` },
    { label: '누적수익률', value: `${btTrackRecord.cum_return_pct > 0 ? '+' : ''}${btTrackRecord.cum_return_pct?.toFixed(1)}%` },
    { label: '벤치마크 대비 초과수익', value: `${btTrackRecord.excess_return_pct > 0 ? '+' : ''}${btTrackRecord.excess_return_pct?.toFixed(1)}%` },
  ] : [];

  // 연도별 성과 (yearly_stats)
  const btYearlyChartData = useMemo(() => {
    return (bt?.yearly_stats || []).map(y => ({ year: String(y.year), return_pct: y.return_pct, trade_count: y.trade_count, win_rate: y.win_rate, mdd_pct: y.mdd_pct }));
  }, [bt]);

  // 레짐별 성과
  const btRegimeStats = bt?.track_record_by_regime || {};

  // exit_type별 분포/성과
  const btExitTypeStats = useMemo(() => {
    const map = {};
    btTrades.forEach(t => {
      const key = t.exit_type || 'UNKNOWN';
      if (!map[key]) map[key] = { count: 0, sumRet: 0 };
      map[key].count += 1;
      map[key].sumRet += (t.return_pct || 0);
    });
    return Object.entries(map).map(([type, v]) => ({
      type, count: v.count, avgRet: v.count ? v.sumRet / v.count : 0,
    })).sort((a, b) => b.count - a.count);
  }, [btTrades]);

  // Best / Worst 트레이드
  const btBestTrades = useMemo(() =>
    [...btTrades].sort((a, b) => (b.return_pct || 0) - (a.return_pct || 0)).slice(0, 5)
  , [btTrades]);
  const btWorstTrades = useMemo(() =>
    [...btTrades].sort((a, b) => (a.return_pct || 0) - (b.return_pct || 0)).slice(0, 5)
  , [btTrades]);

  // 종목 중복(반복 진입) 분석
  const btDuplicateSymbols = useMemo(() => {
    const map = {};
    btTrades.forEach(t => {
      if (!map[t.symbol]) map[t.symbol] = { symbol: t.symbol, name: t.name, count: 0, sumRet: 0, wins: 0 };
      map[t.symbol].count += 1;
      map[t.symbol].sumRet += (t.return_pct || 0);
      if ((t.return_pct || 0) > 0) map[t.symbol].wins += 1;
    });
    return Object.values(map)
      .filter(v => v.count >= 2)
      .map(v => ({ ...v, avgRet: v.sumRet / v.count, winRate: (v.wins / v.count) * 100 }))
      .sort((a, b) => b.count - a.count);
  }, [btTrades]);

  // 보유기간 분포 히스토그램 (버킷: 0-5,6-10,11-20,21-40,41-80,80+)
  const btHoldDaysHistogram = useMemo(() => {
    const buckets = [
      { label: '0-5일', min: 0, max: 5, count: 0 },
      { label: '6-10일', min: 6, max: 10, count: 0 },
      { label: '11-20일', min: 11, max: 20, count: 0 },
      { label: '21-40일', min: 21, max: 40, count: 0 },
      { label: '41-80일', min: 41, max: 80, count: 0 },
      { label: '81일+', min: 81, max: Infinity, count: 0 },
    ];
    btTrades.forEach(t => {
      const d = t.hold_days || 0;
      const b = buckets.find(b => d >= b.min && d <= b.max);
      if (b) b.count += 1;
    });
    return buckets;
  }, [btTrades]);

  // MFE vs 실제수익률 산점도
  const btMfeScatterData = useMemo(() => {
    return btTrades.map(t => ({ x: t.mfe_pct || 0, y: t.return_pct || 0, symbol: t.symbol }));
  }, [btTrades]);

  // 거래내역 필터 + 페이지네이션
  const btAvailableYears = useMemo(() => {
    const set = new Set(btTrades.map(t => (t.exit_date || '').substring(0, 4)).filter(Boolean));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [btTrades]);

  const btFilteredTrades = useMemo(() => {
    return [...btTrades]
      .filter(t => btYearFilter === 'All' || (t.exit_date || '').startsWith(btYearFilter))
      .filter(t => btExitTypeFilter === 'All' || t.exit_type === btExitTypeFilter)
      .filter(t => btResultFilter === 'All' || (btResultFilter === 'WIN' ? (t.return_pct || 0) > 0 : (t.return_pct || 0) <= 0))
      .sort((a, b) => new Date(b.exit_date) - new Date(a.exit_date));
  }, [btTrades, btYearFilter, btExitTypeFilter, btResultFilter]);

  const btTotalPages = Math.max(1, Math.ceil(btFilteredTrades.length / BT_PAGE_SIZE));
  const btPagedTrades = btFilteredTrades.slice((btPage - 1) * BT_PAGE_SIZE, btPage * BT_PAGE_SIZE);

  useEffect(() => { setBtPage(1); }, [btYearFilter, btExitTypeFilter, btResultFilter]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      if (!data) return null;
      const tooltipColor = (data.cum || 0) >= 0 ? '#FF4B4B' : '#3B82F6';

      return (
        <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700/80 p-5 rounded-2xl shadow-xl min-w-[220px]">
          <p className="text-slate-500 dark:text-slate-400 font-extrabold mb-4 text-[13px] tracking-wide">{label}</p>
          <div className="flex justify-between items-center mb-3">
             <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tooltipColor }}></span>
                <span className="text-slate-900 dark:text-slate-200
