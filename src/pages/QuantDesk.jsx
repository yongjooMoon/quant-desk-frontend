import { useEffect, useState, useMemo, useRef } from 'react';
import {
  RefreshCcw, X,
  Activity, Rocket,
  ChevronRight, ChevronDown, Info,
  Trophy, Skull, Repeat, CalendarRange, ShieldAlert, BarChart3
} from 'lucide-react';
import { Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, LineChart, BarChart, Bar, ScatterChart, Scatter, Cell } from 'recharts';
import { useRenderApi } from '../hooks/useRenderApi';
import MacroPage from './MacroPage';
import QuantScreener from './QuantScreener';
// Phase 2 공통 UI 컴포넌트 — 이 파일이 가장 크고(1875줄) 중복도 가장 심해서
// Card/Panel/Metric/Button/Modal/Tabs를 전부 사용한다.
import { Panel, Card, Button, Modal, Tabs, Metric } from '../components';
// =========================================================================
// 색상 토큰 — 국내 주식 관례(상승=빨강/하락=파랑)는 유지하되, 채도를 낮춰 절제된 톤으로 통일
const POS = '#DC2626';   // 상승/양수
const NEG = '#2563EB';   // 하락/음수
const GOOD = '#059669';  // 신뢰/통과
const WARN = '#D97706';  // 주의
const NEUTRAL = '#64748B';

// 숫자 카운트업 애니메이션 훅 (ease-out cubic)
function useCountUp(target, duration = 900) {
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

// 카운트업 숫자를 그리는 얇은 래퍼 (formatter 커스텀 가능)
function CountUp({ value, duration = 900, decimals = 2, formatter }) {
  const animated = useCountUp(value, duration);
  if (formatter) return <>{formatter(animated)}</>;
  return <>{animated.toFixed(decimals)}</>;
}

// 반원 게이지(score gauge) 위의 특정 percent 지점 좌표 계산 (M 20 100 A 80 80 0 0 1 180 100 기준)
function getGaugePoint(percent) {
  const clamped = Math.max(0, Math.min(100, percent || 0));
  const t = (180 - 1.8 * clamped) * (Math.PI / 180);
  const x = 100 + 80 * Math.cos(t);
  const y = 100 - 80 * Math.sin(t);
  return { x, y };
}

// 매크로 지표 값 포맷 (unit이 통화기호면 접두어, 의미 없는 unit 텍스트는 생략)
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

// 매크로 티커 한 칸(항목)
function MacroTickerItem({ item, onClick }) {
  const change = item?.change_percent || 0;
  const isUp = change > 0;
  const isDown = change < 0;
  const color = isUp ? "" : isDown ? "" : "text-slate-400";
  const colorStyle = isUp ? { color: POS } : isDown ? { color: NEG } : undefined;
  const arrow = isUp ? "▲" : isDown ? "▼" : "─";
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-5 py-2.5 shrink-0 whitespace-nowrap cursor-pointer hover:opacity-70 transition-opacity"
    >
      <span className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">{item.display_name}</span>
      <span className="text-[12.5px] font-semibold text-slate-900 dark:text-white tabular-nums">{formatMacroValue(item)}</span>
      <span className={`text-[12px] font-medium tabular-nums ${color}`} style={colorStyle}>
        {arrow} {change > 0 ? "+" : ""}{change.toFixed(2)}%
      </span>
    </button>
  );
}

// 매크로 지표 티커 바 (상단에서 계속 흐르는 marquee, hover 시 정지, 클릭 시 탭 이동)
function MacroTicker({ macroData, onNavigate }) {
  if (!macroData || macroData.length === 0) return null;

  const items = [...macroData, ...macroData];
  const duration = Math.max(30, macroData.length * 4);

  return (
    <div className="macro-ticker-wrap bg-white dark:bg-[#0B1120] border-y border-slate-200 dark:border-slate-800/80 mb-8 rounded-md">
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

// 레짐(시장 국면) 색상/라벨 매핑 — 전략 신뢰도 바 & 백테스팅 탭에서 공용으로 사용
const REGIME_META = {
  BULL:    { label: 'BULL', color: POS, bg: 'bg-red-50 dark:bg-red-950/20', border: 'border-red-200 dark:border-red-900/50' },
  BEAR:    { label: 'BEAR', color: NEG, bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-200 dark:border-blue-900/50' },
  NEUTRAL: { label: 'NEUTRAL', color: NEUTRAL, bg: 'bg-slate-100 dark:bg-slate-800/40', border: 'border-slate-300 dark:border-slate-700' },
};
const getRegimeMeta = (r) => REGIME_META[r] || REGIME_META.NEUTRAL;

const CONFIDENCE_LABEL = {
  insufficient: { text: '표본 부족', color: NEUTRAL, bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-300 dark:border-slate-700' },
  reference: { text: '참고 가능', color: NEG, bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-300 dark:border-blue-800' },
  reliable: { text: '신뢰 가능', color: GOOD, bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-300 dark:border-emerald-800' },
};
const getConfidenceMeta = (level) => CONFIDENCE_LABEL[level] || CONFIDENCE_LABEL.insufficient;

const EXIT_TYPE_META = {
  SIGNAL: { label: '전략 신호 청산', color: NEG },
  DELISTING: { label: '상장폐지 강제청산', color: '#EF4444' },
  BACKTEST_END: { label: '백테스트 종료 강제청산', color: NEUTRAL },
};
const getExitTypeMeta = (t) => EXIT_TYPE_META[t] || { label: t || '-', color: NEUTRAL };

// 전역 마이크로 인터랙션 스타일 — 실제 기능(티커 스크롤, 바 채우기)에 필요한 것만 남김
const MICRO_INTERACTION_STYLES = `
  .qd-bar-fill { transition: width 1s cubic-bezier(0.22, 1, 0.36, 1); }

  .qd-bg-texture { position: absolute; inset: 0; pointer-events: none; opacity: 0.4; z-index: -1; }
  .dark .qd-bg-texture { opacity: 0.22; }

  /* Whitepaper 탭 게이트 카드 — Card 기본 dark:bg-panel(#111827)보다 한 단 밝은 표면.
     NewsDesk의 news-hero-card와 동일한 이유로 유틸리티가 아닌 전용 클래스로 오버라이드. */
  .dark .qd-gate-card { background-color: #131E30; }

  /* 매크로 티커(marquee) 스타일 */
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

  /* 모달 진입 애니메이션 — package.json에 tailwindcss-animate가 없어 기존 animate-in 클래스는
     실제로는 아무 효과가 없었다. 순수 CSS keyframe으로 대체. */
  @keyframes qdModalIn {
    from { opacity: 0; transform: translateY(16px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .qd-modal-panel { animation: qdModalIn 0.28s cubic-bezier(0.22, 1, 0.36, 1) both; }

  @keyframes qdFadeIn { from { opacity: 0; } to { opacity: 1; } }
  .qd-fade-in { animation: qdFadeIn 0.2s ease-out both; }

  @media (prefers-reduced-motion: reduce) {
    .qd-modal-panel, .qd-fade-in { animation: none !important; }
  }
`;

// =========================================================================
// Quant / Macro 데이터 로컬 캐시 (Local Storage) 관련 상수 및 헬퍼 함수
//    - 배치가 매일 14:30 시작, 약 10~20분 내 완료되므로 15:10을 만료 시각으로 사용
//    - 새로고침 버튼은 이 캐시를 거치지 않고 항상 API를 호출합니다 (fetchQuantData(true))
// =========================================================================
const QUANT_CACHE_KEY = 'qd_quant_macro_cache_v3'; // 12y 백테스트 데이터 구조가 바뀌어서 캐시 키 버전업
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

  // 종목별 상세 팝업 — data.backtest12y.trades를 이 종목 코드로 필터링한 "과거 신호 이력"만 보여준다.
  const [backtestStock, setBacktestStock] = useState(null);

  const [timeRange, setTimeRange] = useState("All");

  const [indices, setIndices] = useState({ kospi: null, kosdaq: null, nasdaq: null, sp500: null });
  const [isIndexModalOpen, setIsIndexModalOpen] = useState(false);

  const [isEntryOpen, setIsEntryOpen] = useState(true);
  const [isExitOpen, setIsExitOpen] = useState(true);

  // 백테스팅 탭 — 거래내역 필터/페이지네이션 + Equity Curve 구간
  const [btSubTab, setBtSubTab] = useState("summary"); // 'summary' | 'detail' | 'trades' — 한눈에 안 들어오는 문제 해결용 서브탭
  const [btEquityRange, setBtEquityRange] = useState("All"); // '1Y' | '3Y' | '5Y' | 'All'
  const [btYearFilter, setBtYearFilter] = useState("All");
  const [btExitTypeFilter, setBtExitTypeFilter] = useState("All");
  const [btResultFilter, setBtResultFilter] = useState("All"); // 'All' | 'WIN' | 'LOSS'
  const [btPage, setBtPage] = useState(1);
  const [btShowAllDuplicates, setBtShowAllDuplicates] = useState(false);
  const BT_PAGE_SIZE = 20;
  const BT_DUPLICATE_PREVIEW_COUNT = 10;

  const { callApi, ServerWakeupOverlay } = useRenderApi();

  const initialLoadRef = useRef({ kr: false, us: false });

  const animatedScore = useCountUp(selectedStock ? (selectedStock.score || 0) : 0, 900);

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

  // forceRefresh = true 인 경우(새로고침 버튼)는 캐시를 무시하고 항상 API를 호출합니다.
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

    // /api/backtesting/result(250일치) 대신 /api/backtesting/12y-result(12년치)를 호출
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

      // macro/screener/backtest12y 중 하나만 일시적으로 실패해도 캐시에 빈 값으로
      // 저장되면 다음 방문 때도 재시도 없이 그 빈 값을 계속 재사용하게 된다
      // (최대 다음날 15:10까지). 실패한 항목은 [] 로 덮어쓰지 말고 직전 캐시 값을 유지한다.
      const prevCache = readQuantMacroCache();

      let mergedDataForCache = null;
      let processedKospiForCache = [];

      if (quantResult && quantResult.status === "success" && quantResult.data) {
        const mergedData = { ...quantResult.data };

        mergedData.macro = (macroResult && macroResult.status === "success" && macroResult.data) ? macroResult.data : (prevCache?.macro || []);
        mergedData.screener = (screenerResult && screenerResult.status === "success" && screenerResult.data) ? screenerResult.data : (prevCache?.screener || []);
        mergedData.backtest12y = (backtest12yResult && backtest12yResult.status === "success" && backtest12yResult.data) ? backtest12yResult.data : (prevCache?.backtest12y || null);

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

  // 켈리 사이징 대신, 이 종목의 12년치 과거 신호 이력만 로컬에서 필터링해 보여준다.
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
  const mainColor = isPositive ? POS : NEG;

  const displayChartData = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    let days = chartData.length;
    if (timeRange === '1W') days = 7;
    if (timeRange === '1M') days = 30;
    return chartData.slice(Math.max(chartData.length - days, 0));
  }, [chartData, timeRange]);

  // =========================================================================
  // 백테스팅 탭 파생 데이터 — 전부 data.backtest12y.trades 하나에서 가공
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
      const tooltipColor = (data.cum || 0) >= 0 ? POS : NEG;

      return (
        <div className="bg-white dark:bg-[#0F1B2E] border border-slate-200 dark:border-slate-700/60 p-4 rounded-md shadow-md min-w-[200px]">
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-3 text-[12px] tracking-wide">{label}</p>
          <div className="flex justify-between items-center mb-2.5">
             <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tooltipColor }}></span>
                <span className="text-slate-900 dark:text-slate-200 font-medium text-[13.5px]">Portfolio</span>
             </div>
             <span className="font-semibold text-[13.5px] tabular-nums" style={{ color: tooltipColor }}>
                {(data.cum || 0) > 0 ? '+' : ''}{(data.cum || 0).toFixed(2)}%
             </span>
          </div>
          <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-100 dark:border-slate-700/60">
             <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-400"></span><span className="text-slate-500 dark:text-slate-400 font-medium text-[13px]">KOSPI</span></div>
             <span className="text-slate-500 dark:text-slate-400 font-medium text-[13px] tabular-nums">{(data.kospi_cum || 0) > 0 ? '+' : ''}{(data.kospi_cum || 0).toFixed(2)}%</span>
          </div>
          <div className="flex justify-between items-center">
             <span className="text-slate-600 dark:text-slate-400 font-medium text-[13px]">Alpha (α)</span>
             <span className="font-semibold text-[13.5px] tabular-nums" style={{ color: (data.alpha || 0) >= 0 ? POS : NEG }}>{(data.alpha || 0) > 0 ? '+' : ''}{(data.alpha || 0).toFixed(2)}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const formatMarcap = (val) => {
    if (val === null || val === undefined || isNaN(val)) return "N/A";
    const num = Number(val);
    if (num === 0) return "0억";
    if (Math.abs(num) >= 10000) {
        const jo = Math.floor(Math.abs(num) / 10000);
        const eok = Math.floor(Math.abs(num) % 10000);
        const sign = num < 0 ? "-" : "";
        return eok > 0 ? `${sign}${jo}조 ${eok.toLocaleString()}억` : `${sign}${jo}조`;
    }
    return `${num.toLocaleString()}억`;
  };
  const formatNumber = (val) => (val === null || val === undefined || isNaN(val)) ? "N/A" : Number(val).toLocaleString();
  const formatPct = (val) => (val === null || val === undefined || isNaN(val)) ? "N/A" : `${Number(val).toFixed(2)}%`;

  // 공통 스타일 조각 — 반복되는 카드/행 패턴 (Bloomberg류 밀도 + Linear류 절제된 상호작용)
  const cardCls = "bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-md";
  const rowHoverCls = "hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors";

  return (
    <div className="relative w-full transition-colors duration-300 pb-20">

      <style>{MICRO_INTERACTION_STYLES}</style>

      <svg className="qd-bg-texture" width="100%" height="100%" aria-hidden="true">
        <defs>
          <pattern id="qdDotGrid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.5" className="fill-slate-400/30 dark:fill-slate-600/30" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#qdDotGrid)" />
      </svg>

      <ServerWakeupOverlay />

      {syncing && (
        <div className="qd-fade-in fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/70 backdrop-blur-[2px]">
           <RefreshCcw className="animate-spin text-slate-300 mb-4" size={28} strokeWidth={1.75} />
           <p className="text-slate-200 font-medium text-[14px] tracking-tight">데이터 동기화 중</p>
           <p className="text-slate-500 text-[12.5px] mt-1">최신 시장 데이터를 퀀트 엔진에 반영하고 있습니다</p>
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h2 className="text-[17px] font-semibold text-slate-900 dark:text-white tracking-tight">
          퀀트투자
        </h2>
        <button onClick={handleRefresh} className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-md flex items-center justify-center gap-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer bg-white dark:bg-transparent">
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} strokeWidth={1.75} /> 데이터 동기화
        </button>
      </div>

      <Tabs
        variant="static"
        className="mb-8"
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { key: "Macro", label: "Macro" },
          { key: "Backtest", label: "BackTesting" },
          { key: "Portfolio", label: `Portfolio (${holdings.length})` },
          { key: "Watchlist", label: `Watchlist (${filWatchlist.length})` },
          { key: "Screener", label: "Screener" },
          { key: "History", label: "History" },
          { key: "Whitepaper", label: "Explain" },
        ]}
      />

      <MacroTicker macroData={data.macro} onNavigate={() => setActiveTab("Macro")} />

      {loading && !syncing ? (
        <div className="flex justify-center p-20 w-full"><RefreshCcw className="animate-spin text-slate-400" size={28} strokeWidth={1.75} /></div>
      ) : (
        <div className="w-full">

          {/* ===================== MACRO TAB ===================== */}
          {activeTab === "Macro" && (
            <MacroPage macroData={data.macro} />
          )}

          {/* ===================== PORTFOLIO TAB ===================== */}
          {activeTab === "Portfolio" && (
            <div className="qd-fade-in w-full">

                {/* 세그먼트 2 클릭 시 팝업 대신 "백테스팅" 탭으로 이동.
                    레짐 정보는 12y 데이터에 없어 배지는 신뢰도만 표시. */}
                {(indices.kospi || btTrackRecord) && (
                  <div className={`mb-8 ${cardCls} overflow-hidden`}>
                    <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800/70">

                      {/* 세그먼트 1: KOSPI */}
                      {indices.kospi && (
                        <button
                          onClick={() => setIsIndexModalOpen(true)}
                          className={`flex-1 flex items-center justify-between gap-2 sm:gap-3 p-3.5 sm:p-4 md:p-5 text-left cursor-pointer ${rowHoverCls} group min-w-0`}
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                              <img src="/태극기.png" alt="KR" className="w-full h-full object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                <span className="text-[14px] sm:text-[15px] font-medium text-slate-900 dark:text-white whitespace-nowrap">KOSPI</span>
                                {indices.kospi.market_status === "장중" ? (
                                  <span className="text-[9.5px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/50 whitespace-nowrap">● 장중</span>
                                ) : (
                                  <span className="text-[9.5px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 whitespace-nowrap">장마감</span>
                                )}
                              </div>
                              <div className="text-[11px] font-medium text-slate-500 truncate">
                                전일대비 <span style={{ color: (indices.kospi.ret_1d || 0) > 0 ? POS : NEG }}>{(indices.kospi.ret_1d > 0 ? '+' : '')}{indices.kospi.ret_1d?.toFixed(2)}%</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                            <span className="text-[16px] sm:text-[19px] font-semibold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                              {indices.kospi.current_price?.toLocaleString()}
                            </span>
                            <ChevronRight className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors shrink-0 w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                          </div>
                        </button>
                      )}

                      {/* 세그먼트 2: 12년치 전략 신뢰도 — 클릭하면 백테스팅 탭으로 이동 */}
                      {btTrackRecord && (() => {
                        const cMeta = btConfidenceMeta;
                        const previewColor = btTrackRecord.expectancy_pct >= 0 ? POS : NEG;
                        return (
                          <button
                            onClick={() => setActiveTab("Backtest")}
                            className={`flex-1 flex items-center justify-between gap-2 sm:gap-3 p-3.5 sm:p-4 md:p-5 text-left cursor-pointer ${rowHoverCls} group min-w-0`}
                          >
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                  <span className="text-[14px] sm:text-[15px] font-medium text-slate-900 dark:text-white whitespace-nowrap">
                                    12년 백테스팅
                                  </span>
                                  <span className="text-[9.5px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap" style={{ color: cMeta.color, borderColor: 'currentColor' }}>
                                    {cMeta.text}
                                  </span>
                                </div>
                                <div className="text-[11px] font-medium text-slate-500 truncate">전략 신뢰도 · 표본 {btTrackRecord.trade_count}건</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                              <div className="text-right hidden sm:block">
                                <div className="text-[10.5px] font-medium text-slate-500 whitespace-nowrap">승률</div>
                                <div className="text-[16px] font-semibold tabular-nums" style={{ color: previewColor }}>{btTrackRecord.win_rate?.toFixed(1)}%</div>
                              </div>
                              <ChevronRight className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors shrink-0 w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                            </div>
                          </button>
                        );
                      })()}

                    </div>
                  </div>
                )}

                <div className={`w-full bg-white dark:bg-transparent md:border border-slate-200 dark:border-slate-800 md:rounded-md overflow-hidden mb-10`}>
                    <div className="w-full">
                        <div className="hidden md:flex px-4 md:px-5 py-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-transparent w-full">
                            <div className="w-[18%] text-[12.5px] font-medium text-slate-500">종목명</div>
                            <div className="w-[12%] text-[12.5px] font-medium text-slate-500 text-right">진입가</div>
                            <div className="w-[12%] text-[12.5px] font-medium text-slate-500 text-right">현재가</div>
                            <div className="w-[10%] text-[12.5px] font-medium text-slate-500 text-right">수량</div>
                            <div className="w-[13%] text-[12.5px] font-medium text-slate-500 text-right">수익률(P&L)</div>
                            <div className="w-[15%] text-[12.5px] font-medium text-slate-500 text-center">Exit Risk</div>
                            <div className="w-[20%] text-[12.5px] font-medium text-slate-500 text-center">상세 액션</div>
                        </div>

                        {holdings.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-[13.5px]">현재 보유 중인 종목이 없습니다.</div>
                        ) : holdings.map((h, i) => {
                            const ret = h.return_rate || 0.0;
                            const pnlColor = ret > 0 ? POS : (ret < 0 ? NEG : NEUTRAL);
                            const dummyRisk = Math.min(100, Math.max(0, 100 - (ret * 2 + 50)));

                            return (
                            <div
                                key={i}
                                className={`flex flex-col md:flex-row md:items-center px-4 md:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#111827] md:bg-transparent rounded-md md:rounded-none mb-2.5 md:mb-0 md:shadow-none ${rowHoverCls} w-full gap-3 md:gap-0`}>
                                <div className="flex justify-between items-center w-full md:w-[18%] pr-0 md:pr-4">
                                    <div className="text-[15px] font-medium text-slate-900 dark:text-white truncate">{h.name}</div>
                                    <div className="md:hidden text-[15px] font-semibold tabular-nums" style={{ color: pnlColor }}>{ret > 0 ? "+" : ""}{ret.toFixed(2)}%</div>
                                </div>
                                <div className="flex justify-between items-center w-full md:w-[34%]">
                                    <div className="flex flex-col md:w-1/3 text-left md:text-right">
                                        <span className="text-[10.5px] font-medium text-slate-400 md:hidden mb-0.5">진입가</span>
                                        <span className="text-[13.5px] font-medium text-slate-600 dark:text-slate-400 tabular-nums">₩{Math.round(h.entry_price || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex flex-col md:w-1/3 text-right">
                                        <span className="text-[10.5px] font-medium text-slate-400 md:hidden mb-0.5">현재가</span>
                                        <span className="text-[13.5px] font-medium text-slate-900 dark:text-white tabular-nums">₩{Math.round(h.current_price || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex flex-col md:w-1/3 items-end">
                                        <span className="text-[10.5px] font-medium text-slate-400 md:hidden mb-0.5">수량</span>
                                        <button
                                            onClick={() => handlePositionSizingClick(h.symbol, h)}
                                            title={`${h.name} 과거 신호 이력 보기`}
                                            className="qd-qty-chip inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-[13px] font-medium text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors"
                                        >
                                            {formatNumber(h.quantity)}주
                                        </button>
                                    </div>
                                </div>
                                <div className="hidden md:block w-[13%] text-[15px] font-semibold text-right tabular-nums" style={{ color: pnlColor }}>{ret > 0 ? "+" : ""}{ret.toFixed(2)}%</div>
                                <div className="flex justify-between items-center w-full md:w-[35%] mt-1 md:mt-0 pt-3 md:pt-0 border-t border-slate-100 dark:border-slate-800/80 md:border-0">
                                    <div className="flex items-center md:w-[28%] md:justify-center gap-2">
                                        <span className="text-[10.5px] font-medium text-slate-400 md:hidden">Exit Risk</span>
                                        <span className="text-[13.5px] font-semibold tabular-nums" style={{ color: WARN }}>{(h.exit_risk || dummyRisk).toFixed(2)}%</span>
                                    </div>
                                    <div className="flex justify-end md:w-[72%] md:justify-center gap-2 flex-wrap">
                                        <button onClick={() => setRiskStock({...h, exit_risk: (h.exit_risk || dummyRisk)})} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[12.5px] font-medium rounded border border-slate-200 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"><ShieldAlert size={13} strokeWidth={1.75}/> Risk</button>
                                        <button onClick={() => handleStockClick(h.symbol, h)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[12.5px] font-medium rounded border border-slate-200 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"><BarChart3 size={13} strokeWidth={1.75}/> 리포트</button>
                                    </div>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                </div>

                <h2 className="text-[16px] font-semibold text-slate-900 dark:text-white mb-1.5 tracking-tight">KOSPI 대비 포트폴리오 성과 (Alpha)</h2>
                <p className="text-[12.5px] text-slate-500 mb-5">매도(Exit)가 완료된 종목의 실현 수익률을 바탕으로 KOSPI 지수와 비교합니다.</p>

                <Card padding="none" className="p-5 w-full mb-10 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row justify-between md:items-end mb-4 relative z-10 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                        <div>
                            <div className="flex items-baseline gap-4 mt-1">
                                <h1 className="text-[32px] md:text-[38px] font-semibold tracking-tight tabular-nums" style={{ color: mainColor }}>
                                    {lastChartData.cum > 0 ? '+' : ''}<CountUp value={lastChartData.cum} decimals={2} duration={900} />%
                                </h1>
                                <span className="text-[13.5px] font-medium tabular-nums" style={{ color: lastChartData.alpha >= 0 ? POS : NEG }}>
                                    Alpha {lastChartData.alpha > 0 ? '+' : ''}<CountUp value={lastChartData.alpha} decimals={2} duration={900} />%
                                </span>
                            </div>
                        </div>
                        <div className="text-left md:text-right flex flex-col md:items-end gap-1 mt-4 md:mt-0">
                            <div className="flex gap-1.5">
                                {['1W', '1M', 'All'].map(range => (
                                    <Button key={range} variant="pill" size="sm" active={timeRange === range} onClick={() => setTimeRange(range)}>
                                        {range}
                                    </Button>
                                ))}
                            </div>
                            <div className="text-[12px] text-slate-400 mt-2 tabular-nums">
                                Day <span style={{ color: mainColor }}>{lastDayRet > 0 ? '+' : ''}<CountUp value={lastDayRet} decimals={2} /></span>%&nbsp;&nbsp;
                                KOSPI <span className="text-slate-500">{lastChartData.kospi_cum > 0 ? '+' : ''}<CountUp value={lastChartData.kospi_cum} decimals={2} /></span>%
                            </div>
                        </div>
                    </div>

                    <div className="w-full h-[280px] md:h-[360px] relative z-10">
                        {displayChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={displayChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorCum" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={mainColor} stopOpacity={0.16}/>
                                            <stop offset="95%" stopColor={mainColor} stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />
                                    <XAxis dataKey="date" tick={{fill: '#94A3B8', fontSize: 11, fontWeight: '500'}} tickLine={false} axisLine={false} tickMargin={12} minTickGap={40} tickFormatter={(val) => val ? String(val).substring(5).replace('-', '.') : ''}/>
                                    <YAxis tick={{fill: '#94A3B8', fontSize: 11, fontWeight: '500'}} tickLine={false} axisLine={false} tickFormatter={(value) => value !== undefined && value !== null ? `${value > 0 ? '+' : ''}${value}%` : ''} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(100,116,139,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                    <Line type="monotone" dataKey="kospi_cum" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={true} animationDuration={900} animationEasing="ease-out" />
                                    <Area type="monotone" dataKey="cum" stroke={mainColor} strokeWidth={2} fillOpacity={1} fill="url(#colorCum)" activeDot={{r: 5, fill: mainColor, strokeWidth: 2, stroke: '#111827'}} isAnimationActive={true} animationDuration={900} animationEasing="ease-out" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[13px] text-slate-500">차트를 생성할 데이터가 부족합니다.</div>
                        )}
                    </div>
                </Card>
            </div>
          )}

          {/* ===================== WATCHLIST TAB ===================== */}
          {activeTab === "Watchlist" && (
              <div className="qd-fade-in w-full">
                <div className="w-full bg-white dark:bg-transparent md:border border-slate-200 dark:border-slate-800 md:rounded-md overflow-hidden mb-10">
                    <div className="w-full">
                        <div className="hidden md:flex px-4 md:px-5 py-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-transparent">
                            <div className="w-[10%] text-[12.5px] font-medium text-slate-500 text-center">순위</div>
                            <div className="w-[30%] text-[12.5px] font-medium text-slate-500">종목명</div>
                            <div className="w-[20%] text-[12.5px] font-medium text-slate-500 text-right">현재가</div>
                            <div className="w-[15%] text-[12.5px] font-medium text-slate-500 text-center">통과</div>
                            <div className="w-[15%] text-[12.5px] font-medium text-slate-500 text-center">랭킹점수</div>
                            <div className="w-[10%] text-[12.5px] font-medium text-slate-500 text-center">액션</div>
                        </div>

                        {filWatchlist.length === 0 ? <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-[13.5px]">종목이 없습니다.</div> : filWatchlist.map((c, idx) => {
                          return (
                            <div
                                key={idx}
                                className={`flex flex-col md:flex-row md:items-center px-4 md:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#111827] md:bg-transparent rounded-md md:rounded-none mb-2.5 md:mb-0 ${rowHoverCls} w-full gap-3 md:gap-0`}>
                                <div className="flex justify-between items-center w-full md:w-[40%] pr-0 md:pr-4">
                                    <div className="flex items-center gap-3 w-full">
                                        <span className="text-[11.5px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 rounded px-2 py-0.5 md:bg-transparent md:px-0 md:py-0 w-auto md:w-[25%] text-center">{idx+1}</span>
                                        <span className="text-[15px] font-medium text-slate-900 dark:text-white truncate md:w-[75%]">{c.name}</span>
                                    </div>
                                    <div className="md:hidden text-[14.5px] font-semibold text-slate-900 dark:text-white tabular-nums shrink-0">₩{Math.round(c.current_price || 0).toLocaleString()}</div>
                                </div>
                                <div className="hidden md:block w-[20%] text-[14.5px] font-medium text-slate-900 dark:text-white text-right tabular-nums">₩{Math.round(c.current_price || 0).toLocaleString()}</div>
                                <div className="flex justify-between items-center w-full md:w-[30%]">
                                    <div className="flex flex-col md:flex-row md:w-1/2 md:justify-center text-left md:text-center">
                                        <span className="text-[10.5px] font-medium text-slate-400 md:hidden mb-0.5">통과 관문</span>
                                        <span className="text-[13.5px] font-medium text-slate-600 dark:text-slate-400">{c.total_pass}/6</span>
                                    </div>
                                    <div className="flex flex-col md:flex-row md:w-1/2 md:justify-center text-right md:text-center">
                                        <span className="text-[10.5px] font-medium text-slate-400 md:hidden mb-0.5">랭킹 점수</span>
                                        <span className="text-[14px] font-medium text-slate-500 dark:text-slate-400">{(c.factor_score || 0).toFixed(2)}점</span>
                                    </div>
                                </div>
                                <div className="w-full md:w-[10%] flex justify-end md:justify-center mt-2 md:mt-0 pt-3 md:pt-0 border-t border-slate-100 dark:border-slate-800/80 md:border-0 px-2">
                                    <button onClick={() => handleStockClick(c.symbol, c)} className="inline-flex items-center gap-1 px-3 md:px-2.5 py-1.5 md:w-full justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[12.5px] font-medium rounded border border-slate-200 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"><BarChart3 size={13} strokeWidth={1.75}/> 리포트</button>
                                </div>
                            </div>
                          );
                        })}
                    </div>
                </div>
              </div>
          )}

          {/* ===================== SCREENER TAB ===================== */}
          {activeTab === "Screener" && (
              <QuantScreener screenerData={data.screener} />
          )}

          {/* ===================== HISTORY TAB ===================== */}
          {activeTab === "History" && (
              <div className="qd-fade-in w-full">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 w-full">
                      <Card padding="none" className="p-4 flex flex-col justify-center">
                          <Metric size="md" label="총 매도 횟수" value={<><CountUp value={sellTrades.length} decimals={0} />회</>} sub={`승 ${wins.length} / 패 ${losses.length}`} />
                      </Card>
                      <Card padding="none" className="p-4 flex flex-col justify-center">
                          <Metric size="md" label="승률 (타율)" tone="negative" value={<><CountUp value={winRate} decimals={1} />%</>} />
                      </Card>
                      <Card padding="none" className="p-4 flex flex-col justify-center">
                          <Metric
                            size="md"
                            label="손익비"
                            value={avgLoss !== 0 ? <CountUp value={Math.abs(avgWin/avgLoss)} decimals={2} /> : "0.00"}
                            sub={`평균 ${avgWin.toFixed(2)}% / ${avgLoss.toFixed(2)}%`}
                          />
                      </Card>
                      <Card padding="none" className="p-4 flex flex-col justify-center">
                          <Metric
                            size="md"
                            label="주당 누적 실현손익금"
                            tone={totalProfitAmt > 0 ? 'positive' : 'negative'}
                            value={<><CountUp value={totalProfitAmt} decimals={0} formatter={(v) => parseInt(v).toLocaleString('ko-KR')} />원</>}
                          />
                      </Card>
                  </div>

                  <div className="w-full bg-white dark:bg-transparent md:border border-slate-200 dark:border-slate-800 md:rounded-md overflow-hidden mb-10">
                      <div className="w-full">
                          <div className="hidden md:flex px-4 md:px-5 py-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-transparent">
                              <div className="w-[15%] text-[12.5px] font-medium text-slate-500">매도 일자</div>
                              <div className="w-[20%] text-[12.5px] font-medium text-slate-500">종목명</div>
                              <div className="w-[15%] text-[12.5px] font-medium text-slate-500 text-right">진입가</div>
                              <div className="w-[15%] text-[12.5px] font-medium text-slate-500 text-right">매도가</div>
                              <div className="w-[15%] text-[12.5px] font-medium text-slate-500 text-right">실현손익(%)</div>
                              <div className="w-[20%] text-[12.5px] font-medium text-slate-500 text-right">매도 사유</div>
                          </div>

                          {sellTrades.length === 0 ? <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-[13.5px] w-full">매도 이력이 없습니다.</div> : sellTrades.map((t, idx) => {
                                const entryPrice = t.trade_price / (1 + ((t.return_rate || 0) / 100));
                                return (
                                  <div
                                    key={idx}
                                    className={`flex flex-col md:flex-row md:items-center px-4 md:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#111827] md:bg-transparent rounded-md md:rounded-none mb-2.5 md:mb-0 ${rowHoverCls} w-full gap-3 md:gap-0`}>
                                      <div className="flex justify-between items-center w-full md:w-[35%] pr-0 md:pr-4">
                                          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 w-full">
                                              <span className="text-[11px] text-slate-400 md:w-[42%] md:text-[13.5px] md:text-slate-500 tabular-nums">{t.trade_date}</span>
                                              <span className="text-[15px] font-medium text-slate-900 dark:text-white md:w-[58%] truncate">{t.name}</span>
                                          </div>
                                          <div className="md:hidden text-[15px] font-semibold tabular-nums shrink-0" style={{ color: (t.return_rate || 0) > 0 ? POS : NEG }}>{(t.return_rate || 0) > 0 ? "+" : ""}{(t.return_rate || 0).toFixed(2)}%</div>
                                      </div>
                                      <div className="flex justify-between items-center w-full md:w-[30%]">
                                          <div className="flex flex-col md:w-1/2 text-left md:text-right">
                                              <span className="text-[10.5px] font-medium text-slate-400 md:hidden mb-0.5">진입가</span>
                                              <span className="text-[13.5px] font-medium text-slate-600 dark:text-slate-400 tabular-nums">₩{Math.round(entryPrice).toLocaleString()}</span>
                                          </div>
                                          <div className="flex flex-col md:w-1/2 text-right">
                                              <span className="text-[10.5px] font-medium text-slate-400 md:hidden mb-0.5">매도가</span>
                                              <span className="text-[13.5px] font-medium text-slate-800 dark:text-slate-200 tabular-nums">₩{Math.round(t.trade_price || 0).toLocaleString()}</span>
                                          </div>
                                      </div>
                                      <div className="hidden md:block w-[15%] text-[14.5px] font-semibold text-right tabular-nums" style={{ color: (t.return_rate || 0) > 0 ? POS : NEG }}>{(t.return_rate || 0) > 0 ? "+" : ""}{(t.return_rate || 0).toFixed(2)}%</div>
                                      <div className="w-full md:w-[20%] text-[12px] text-slate-500 dark:text-slate-400 text-left md:text-right mt-1 md:mt-0 pt-2 md:pt-0 border-t border-slate-100 dark:border-slate-800/80 md:border-0 leading-snug truncate" title={t.reason}>
                                          <span className="text-slate-400 md:hidden mr-1">사유:</span>
                                          {t.reason}
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  </div>
              </div>
          )}

          {/* ===================== BACKTEST TAB (12년치 검증 리포트) ===================== */}
          {activeTab === "Backtest" && (
            <div className="qd-fade-in w-full max-w-6xl mx-auto pb-10">
              {!bt || !btTrackRecord ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                  <p className="text-[14px] text-center leading-relaxed">12년치 백테스팅 데이터가 아직 없습니다.<br/>다음 주간 배치 실행 후 다시 확인해 주세요.</p>
                </div>
              ) : (
                <>
                  <div className="mb-6 flex items-center gap-2.5">
                    <Activity size={18} className="text-slate-400" strokeWidth={1.75} />
                    <div>
                      <h2 className="text-[17px] font-semibold text-slate-900 dark:text-white tracking-tight">12년 백테스팅 검증 리포트</h2>
                      <p className="text-[12px] text-slate-500 mt-0.5">
                        생성 시각 {bt.generated_at} · 대상 기간 {bt.trading_period?.start} ~ {bt.trading_period?.end} · 유니버스 {bt.universe_size}종목 (상장폐지 포함, 생존편향 제거)
                      </p>
                    </div>
                  </div>

                  {/* 헤드라인 지표 */}
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className="text-[11.5px] font-medium px-2.5 py-1 rounded border" style={{ color: btConfidenceMeta.color, borderColor: 'currentColor' }}>{btConfidenceMeta.text}</span>
                    {btTrackRecord.delisting_exits > 0 && (
                      <span className="text-[11.5px] font-medium px-2.5 py-1 rounded border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400">
                        상장폐지 강제청산 {btTrackRecord.delisting_exits}건 포함
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                    {btTrackRecord.confidence_note} 아래 통계는 특정 종목이 아니라 전략 자체가 12년간(상장폐지 종목 포함) 전체 시장에서 어떻게 작동했는지를 보여줍니다.
                  </p>

                  <Tabs
                    variant="static"
                    className="mb-6"
                    value={btSubTab}
                    onChange={setBtSubTab}
                    items={[
                      { key: "summary", label: "요약" },
                      { key: "detail", label: "상세 분석" },
                      { key: "trades", label: `거래내역 (${btTrades.length})` },
                    ]}
                  />

                  {btSubTab === "summary" && (
                  <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-8">
                    {btHeadlineMetrics.map((m, i) => (
                      <Panel key={i} level="inset" padding="sm">
                        <Metric size="sm" label={m.label} value={m.value} sub={m.sub} />
                      </Panel>
                    ))}
                  </div>

                  {/* Equity Curve */}
                  <Card padding="none" className="p-5 mb-8">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 mb-4">
                      <p className="text-[13.5px] font-medium text-slate-900 dark:text-white">전략 누적 수익률 추이 (벤치마크 대비 초과수익 {btTrackRecord.excess_return_pct > 0 ? '+' : ''}{btTrackRecord.excess_return_pct?.toFixed(1)}%)</p>
                      <div className="flex gap-1.5">
                        {['1Y', '3Y', '5Y', 'All'].map(r => (
                          <Button key={r} variant="pill" size="sm" active={btEquityRange === r} onClick={() => setBtEquityRange(r)}>{r}</Button>
                        ))}
                      </div>
                    </div>
                    <div className="w-full h-[260px]">
                      {btEquityDisplayData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={btEquityDisplayData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />
                            <XAxis dataKey="date" tick={{fill: '#94A3B8', fontSize: 10, fontWeight: '500'}} tickLine={false} axisLine={false} minTickGap={50} tickFormatter={(val) => val ? String(val).substring(0, 7) : ''} />
                            <YAxis tick={{fill: '#94A3B8', fontSize: 10, fontWeight: '500'}} tickLine={false} axisLine={false} tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`} />
                            <Tooltip formatter={(value) => [`${value > 0 ? '+' : ''}${value.toFixed(2)}%`, '전략']} contentStyle={{backgroundColor: '#0F1B2E', borderColor: '#334155', borderRadius: '8px', color: 'white', fontWeight: '500'}} labelStyle={{color: '#94A3B8'}} />
                            <Line type="monotone" dataKey="strategy" name="전략" stroke={POS} strokeWidth={2} dot={false} isAnimationActive={true} animationDuration={700} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[12px] text-slate-400">차트 데이터가 없습니다</div>
                      )}
                    </div>
                  </Card>
                  </>
                  )}

                  {btSubTab === "detail" && (
                  <>
                  {/* 연도별 성과 */}
                  {btYearlyChartData.length > 0 && (
                    <Card padding="none" className="p-5 mb-8">
                      <div className="flex items-center gap-2 mb-4">
                        <CalendarRange size={15} className="text-slate-400" strokeWidth={1.75} />
                        <p className="text-[13.5px] font-medium text-slate-900 dark:text-white">연도별 성과</p>
                      </div>
                      <div className="w-full h-[200px] mb-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={btYearlyChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />
                            <XAxis dataKey="year" tick={{fill: '#94A3B8', fontSize: 11, fontWeight: '500'}} tickLine={false} axisLine={false} />
                            <YAxis tick={{fill: '#94A3B8', fontSize: 11, fontWeight: '500'}} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                            <Tooltip formatter={(v) => [`${v > 0 ? '+' : ''}${v.toFixed(2)}%`, '수익률']} contentStyle={{backgroundColor: '#0F1B2E', borderColor: '#334155', borderRadius: '8px', color: 'white', fontWeight: '500'}} itemStyle={{color: 'white'}} />
                            <Bar dataKey="return_pct" radius={[3, 3, 0, 0]}>
                              {btYearlyChartData.map((d, i) => (
                                <Cell key={i} fill={d.return_pct >= 0 ? POS : NEG} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[12px]">
                          <thead>
                            <tr className="text-slate-500 font-medium border-b border-slate-200 dark:border-slate-800">
                              <th className="text-left py-2">연도</th><th className="text-right py-2">수익률</th><th className="text-right py-2">거래수</th><th className="text-right py-2">승률</th><th className="text-right py-2">MDD</th>
                            </tr>
                          </thead>
                          <tbody>
                            {btYearlyChartData.map((y, i) => (
                              <tr key={i} className="border-b border-slate-100 dark:border-slate-800/60">
                                <td className="py-2 font-medium text-slate-900 dark:text-white">{y.year}</td>
                                <td className="py-2 text-right font-medium tabular-nums" style={{ color: y.return_pct >= 0 ? POS : NEG }}>{y.return_pct > 0 ? '+' : ''}{y.return_pct?.toFixed(2)}%</td>
                                <td className="py-2 text-right text-slate-600 dark:text-slate-400 tabular-nums">{y.trade_count}건</td>
                                <td className="py-2 text-right text-slate-600 dark:text-slate-400 tabular-nums">{y.win_rate?.toFixed(1)}%</td>
                                <td className="py-2 text-right text-slate-600 dark:text-slate-400 tabular-nums">{y.mdd_pct?.toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}

                  {/* 레짐별 성과 + exit_type 분포 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                    <Card padding="none" className="p-5">
                      <p className="text-[13.5px] font-medium text-slate-900 dark:text-white mb-4">레짐(시장 국면)별 성과</p>
                      <div className="space-y-2.5">
                        {['BULL', 'NEUTRAL', 'BEAR'].map(r => {
                          const stat = btRegimeStats[r];
                          const rMeta = getRegimeMeta(r);
                          if (!stat) return null;
                          return (
                            <Panel key={r} padding="none" className="p-3 flex items-center justify-between">
                              <span className="text-[12.5px] font-medium" style={{ color: rMeta.color }}>{rMeta.label}</span>
                              <div className="text-right">
                                <div className="text-[11.5px] text-slate-600 dark:text-slate-400">{stat.trade_count}건 · 승률 {stat.win_rate?.toFixed(1)}%</div>
                                <div className="text-[12.5px] font-medium tabular-nums" style={{ color: (stat.expectancy_pct || 0) >= 0 ? POS : NEG }}>기대값 {(stat.expectancy_pct || 0) > 0 ? '+' : ''}{stat.expectancy_pct?.toFixed(2)}%</div>
                              </div>
                            </Panel>
                          );
                        })}
                      </div>
                    </Card>

                    <Card padding="none" className="p-5">
                      <p className="text-[13.5px] font-medium text-slate-900 dark:text-white mb-4">청산 사유별 분포</p>
                      <div className="space-y-2.5">
                        {btExitTypeStats.map((s, i) => {
                          const meta = getExitTypeMeta(s.type);
                          return (
                            <Panel key={i} padding="none" className="p-3 flex items-center justify-between">
                              <span className="text-[12.5px] font-medium" style={{ color: meta.color }}>{meta.label}</span>
                              <div className="text-right">
                                <div className="text-[11.5px] text-slate-600 dark:text-slate-400">{s.count}건</div>
                                <div className="text-[12.5px] font-medium tabular-nums" style={{ color: s.avgRet >= 0 ? POS : NEG }}>평균 {s.avgRet > 0 ? '+' : ''}{s.avgRet.toFixed(2)}%</div>
                              </div>
                            </Panel>
                          );
                        })}
                      </div>
                    </Card>
                  </div>

                  {/* 전반기 vs 후반기 워크포워드 */}
                  {bt.walk_forward && (bt.walk_forward.first_half?.trade_count > 0 || bt.walk_forward.second_half?.trade_count > 0) && (
                    <Card padding="none" className="p-5 mb-8">
                      <p className="text-[13.5px] font-medium text-slate-900 dark:text-white mb-1">전반기 vs 후반기 비교</p>
                      <p className="text-[11.5px] text-slate-500 mb-4">{bt.walk_forward.split_date} 기준으로 나눠, 특정 구간에만 잘 맞는 전략(과최적화)인지 점검합니다.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {[{ label: '전반기', d: bt.walk_forward.first_half }, { label: '후반기', d: bt.walk_forward.second_half }].map((seg, i) => (
                          <Panel key={i} level="surface" padding="none" className="p-3.5">
                            <p className="text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-2">{seg.label} ({seg.d?.trade_count ?? 0}건)</p>
                            <div className="grid grid-cols-2 gap-2 text-[12px]">
                              <div><span className="text-slate-500">승률 </span><span className="font-medium text-slate-900 dark:text-white tabular-nums">{seg.d?.win_rate?.toFixed(1) ?? '-'}%</span></div>
                              <div><span className="text-slate-500">기대값 </span><span className="font-medium text-slate-900 dark:text-white tabular-nums">{seg.d?.expectancy_pct != null ? `${seg.d.expectancy_pct > 0 ? '+' : ''}${seg.d.expectancy_pct.toFixed(2)}%` : '-'}</span></div>
                            </div>
                          </Panel>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Best / Worst 트레이드 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                    <div className="bg-white dark:bg-[#111827] border border-emerald-200 dark:border-emerald-900/40 rounded-md p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <Trophy size={15} className="text-emerald-500" strokeWidth={1.75} />
                        <p className="text-[13.5px] font-medium text-slate-900 dark:text-white">베스트 트레이드 Top 5</p>
                      </div>
                      <div className="space-y-1.5">
                        {btBestTrades.map((t, i) => (
                          <div key={i} className="flex items-center justify-between p-2.5 rounded bg-emerald-50/50 dark:bg-emerald-950/10">
                            <div className="min-w-0">
                              <div className="text-[12.5px] font-medium text-slate-900 dark:text-white truncate">{t.name}</div>
                              <div className="text-[10.5px] text-slate-400">{t.entry_date} → {t.exit_date} ({t.hold_days}일)</div>
                            </div>
                            <span className="text-[13.5px] font-semibold shrink-0 ml-2 tabular-nums" style={{ color: POS }}>+{t.return_pct?.toFixed(2)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white dark:bg-[#111827] border border-red-200 dark:border-red-900/40 rounded-md p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <Skull size={15} className="text-red-500" strokeWidth={1.75} />
                        <p className="text-[13.5px] font-medium text-slate-900 dark:text-white">워스트 트레이드 Top 5</p>
                      </div>
                      <div className="space-y-1.5">
                        {btWorstTrades.map((t, i) => (
                            <div key={i} className="flex items-center justify-between p-2.5 rounded bg-red-50/50 dark:bg-red-950/10">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[12.5px] font-medium text-slate-900 dark:text-white truncate">{t.name}</span>
                                  {t.exit_type === 'DELISTING' && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 shrink-0">상폐</span>}
                                </div>
                                <div className="text-[10.5px] text-slate-400">{t.entry_date} → {t.exit_date} ({t.hold_days}일)</div>
                              </div>
                              <span className="text-[13.5px] font-semibold shrink-0 ml-2 tabular-nums" style={{ color: NEG }}>{t.return_pct?.toFixed(2)}%</span>
                            </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 반복 진입 종목 — 63종목까지 나올 수 있어 기본은 상위 10개만, 필요하면 펼치기 */}
                  {btDuplicateSymbols.length > 0 && (
                    <Card padding="none" className="p-5 mb-8">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Repeat size={15} className="text-slate-400" strokeWidth={1.75} />
                          <p className="text-[13.5px] font-medium text-slate-900 dark:text-white">반복 진입 종목 ({btDuplicateSymbols.length}종목)</p>
                        </div>
                        {btDuplicateSymbols.length > BT_DUPLICATE_PREVIEW_COUNT && (
                          <button onClick={() => setBtShowAllDuplicates(v => !v)} className="text-[11.5px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                            {btShowAllDuplicates ? '접기' : `전체 보기 (+${btDuplicateSymbols.length - BT_DUPLICATE_PREVIEW_COUNT})`}
                          </button>
                        )}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[12px]">
                          <thead>
                            <tr className="text-slate-500 font-medium border-b border-slate-200 dark:border-slate-800">
                              <th className="text-left py-2">종목명</th><th className="text-right py-2">진입횟수</th><th className="text-right py-2">평균수익률</th><th className="text-right py-2">승률</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(btShowAllDuplicates ? btDuplicateSymbols : btDuplicateSymbols.slice(0, BT_DUPLICATE_PREVIEW_COUNT)).map((s, i) => (
                              <tr key={i} className="border-b border-slate-100 dark:border-slate-800/60">
                                <td className="py-2 font-medium text-slate-900 dark:text-white">{s.name}</td>
                                <td className="py-2 text-right text-slate-600 dark:text-slate-400 tabular-nums">{s.count}회</td>
                                <td className="py-2 text-right font-medium tabular-nums" style={{ color: s.avgRet >= 0 ? POS : NEG }}>{s.avgRet > 0 ? '+' : ''}{s.avgRet.toFixed(2)}%</td>
                                <td className="py-2 text-right text-slate-600 dark:text-slate-400 tabular-nums">{s.winRate.toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}

                  {/* 보유기간 분포 + MFE 산점도 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                    <Card padding="none" className="p-5">
                      <p className="text-[13.5px] font-medium text-slate-900 dark:text-white mb-4">보유기간 분포</p>
                      <div className="w-full h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={btHoldDaysHistogram} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />
                            <XAxis dataKey="label" tick={{fill: '#94A3B8', fontSize: 10, fontWeight: '500'}} tickLine={false} axisLine={false} />
                            <YAxis tick={{fill: '#94A3B8', fontSize: 10, fontWeight: '500'}} tickLine={false} axisLine={false} />
                            <Tooltip formatter={(v) => [`${v}건`, '거래수']} contentStyle={{backgroundColor: '#0F1B2E', borderColor: '#334155', borderRadius: '8px', color: 'white', fontWeight: '500'}} />
                            <Bar dataKey="count" fill={NEG} radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>

                    <Card padding="none" className="p-5">
                      <p className="text-[13.5px] font-medium text-slate-900 dark:text-white mb-1">MFE 대비 실제 수익률</p>
                      <p className="text-[10.5px] text-slate-400 mb-4">가로축: 보유 중 최대로 갈 수 있었던 수익률(MFE) · 세로축: 실제 실현 수익률</p>
                      <div className="w-full h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
                            <XAxis type="number" dataKey="x" name="MFE" tick={{fill: '#94A3B8', fontSize: 10, fontWeight: '500'}} tickFormatter={(v) => `${v}%`} />
                            <YAxis type="number" dataKey="y" name="실제수익률" tick={{fill: '#94A3B8', fontSize: 10, fontWeight: '500'}} tickFormatter={(v) => `${v}%`} />
                            <Tooltip formatter={(v, n) => [`${v.toFixed(2)}%`, n === 'x' ? 'MFE' : '실제수익률']} contentStyle={{backgroundColor: '#0F1B2E', borderColor: '#334155', borderRadius: '8px', color: 'white', fontWeight: '500'}} cursor={{ strokeDasharray: '3 3' }} />
                            <Scatter data={btMfeScatterData} fill={POS} fillOpacity={0.5} />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  </div>
                  </>
                  )}

                  {btSubTab === "trades" && (
                  <>
                  {/* 전체 거래내역 (필터 + 페이지네이션) */}
                  <div className="mb-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                      <p className="text-[15px] font-medium text-slate-900 dark:text-white">전체 거래내역 ({btFilteredTrades.length}건 / 총 {btTrades.length}건)</p>
                      <div className="flex flex-wrap gap-2">
                        <select value={btYearFilter} onChange={e => setBtYearFilter(e.target.value)} className="text-[12px] font-medium px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1120] text-slate-700 dark:text-slate-300">
                          <option value="All">전체 연도</option>
                          {btAvailableYears.map(y => <option key={y} value={y}>{y}년</option>)}
                        </select>
                        <select value={btExitTypeFilter} onChange={e => setBtExitTypeFilter(e.target.value)} className="text-[12px] font-medium px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1120] text-slate-700 dark:text-slate-300">
                          <option value="All">전체 사유</option>
                          <option value="SIGNAL">전략 신호 청산</option>
                          <option value="DELISTING">상장폐지 강제청산</option>
                          <option value="BACKTEST_END">백테스트 종료 강제청산</option>
                        </select>
                        <select value={btResultFilter} onChange={e => setBtResultFilter(e.target.value)} className="text-[12px] font-medium px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1120] text-slate-700 dark:text-slate-300">
                          <option value="All">승/패 전체</option>
                          <option value="WIN">승</option>
                          <option value="LOSS">패</option>
                        </select>
                      </div>
                    </div>

                    <div className="w-full bg-white dark:bg-transparent md:border border-slate-200 dark:border-slate-800 md:rounded-md overflow-hidden">
                      <div className="hidden md:flex px-4 md:px-5 py-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-transparent">
                        <div className="w-[14%] text-[12px] font-medium text-slate-500">매수일</div>
                        <div className="w-[18%] text-[12px] font-medium text-slate-500">종목명</div>
                        <div className="w-[14%] text-[12px] font-medium text-slate-500">매도일</div>
                        <div className="w-[12%] text-[12px] font-medium text-slate-500 text-right">매수가</div>
                        <div className="w-[12%] text-[12px] font-medium text-slate-500 text-right">매도가</div>
                        <div className="w-[10%] text-[12px] font-medium text-slate-500 text-right">수익률</div>
                        <div className="w-[20%] text-[12px] font-medium text-slate-500 text-right">사유</div>
                      </div>
                      {btPagedTrades.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 text-[13px]">조건에 맞는 거래가 없습니다.</div>
                      ) : btPagedTrades.map((t, idx) => {
                        const meta = getExitTypeMeta(t.exit_type);
                        return (
                          <div
                            key={idx}
                            className={`flex flex-col md:flex-row md:items-center px-4 md:px-5 py-2.5 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#111827] md:bg-transparent rounded-md md:rounded-none mb-2 md:mb-0 ${rowHoverCls} w-full gap-1 md:gap-0`}
                          >
                            <div className="hidden md:block w-[14%] text-[11.5px] text-slate-500 tabular-nums">{t.entry_date}</div>
                            <div className="w-full md:w-[18%] flex justify-between md:block">
                              <span className="text-[13.5px] font-medium text-slate-900 dark:text-white">{t.name}</span>
                              <span className="md:hidden text-[13.5px] font-medium tabular-nums" style={{ color: (t.return_pct || 0) >= 0 ? POS : NEG }}>{(t.return_pct || 0) > 0 ? '+' : ''}{t.return_pct?.toFixed(2)}%</span>
                            </div>
                            <div className="hidden md:block w-[14%] text-[11.5px] text-slate-500 tabular-nums">{t.exit_date}</div>
                            <div className="w-1/2 md:w-[12%] text-[11.5px] text-slate-600 dark:text-slate-400 text-left md:text-right tabular-nums">₩{formatNumber(t.entry_price)}</div>
                            <div className="w-1/2 md:w-[12%] text-[11.5px] text-slate-600 dark:text-slate-400 text-right tabular-nums">₩{formatNumber(t.exit_price)}</div>
                            <div className="hidden md:block w-[10%] text-[12.5px] font-medium text-right tabular-nums" style={{ color: (t.return_pct || 0) >= 0 ? POS : NEG }}>{(t.return_pct || 0) > 0 ? '+' : ''}{t.return_pct?.toFixed(2)}%</div>
                            <div className="w-full md:w-[20%] text-[11px] text-right truncate" style={{ color: meta.color }} title={t.reason}>{t.reason}</div>
                          </div>
                        );
                      })}
                    </div>

                    {btTotalPages > 1 && (
                      <div className="flex items-center justify-center gap-3 mt-4">
                        <button disabled={btPage <= 1} onClick={() => setBtPage(p => Math.max(1, p - 1))} className="px-3 py-1.5 text-[12px] font-medium rounded border border-slate-200 dark:border-slate-700 disabled:opacity-30 text-slate-600 dark:text-slate-300">이전</button>
                        <span className="text-[12px] text-slate-500 tabular-nums">{btPage} / {btTotalPages}</span>
                        <button disabled={btPage >= btTotalPages} onClick={() => setBtPage(p => Math.min(btTotalPages, p + 1))} className="px-3 py-1.5 text-[12px] font-medium rounded border border-slate-200 dark:border-slate-700 disabled:opacity-30 text-slate-600 dark:text-slate-300">다음</button>
                      </div>
                    )}
                  </div>
                  </>
                  )}

                  {/* 알려진 한계 — 어느 서브탭에서나 항상 보이도록 */}
                  {bt.known_limitations && bt.known_limitations.length > 0 && (
                    <Panel level="inset" padding="none" className="p-4">
                      <p className="text-[12px] font-medium text-slate-500 mb-2 flex items-center gap-1.5"><Info size={13} strokeWidth={1.75}/> 이 백테스트가 재현하지 못하는 부분 (알려진 한계)</p>
                      <ul className="space-y-1.5">
                        {bt.known_limitations.map((l, i) => (
                          <li key={i} className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed">· {l}</li>
                        ))}
                      </ul>
                    </Panel>
                  )}
                </>
              )}
            </div>
          )}

          {/* ===================== WHITEPAPER TAB ===================== */}
          {activeTab === "Whitepaper" && (
              <div className="qd-fade-in w-full max-w-4xl mx-auto pb-10">
                  {/* 매수 진입 섹션 */}
                  <div className="mb-10">
                      <div
                        className="flex items-center justify-between cursor-pointer group mb-5 px-1"
                        onClick={() => setIsEntryOpen(!isEntryOpen)}
                      >
                          <div className="flex items-center gap-2.5">
                              <Rocket className="text-slate-400" size={19} strokeWidth={1.75} />
                              <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white tracking-tight">매수 진입 6대 관문 (Entry Gates)</h3>
                          </div>
                          <ChevronDown className={`text-slate-400 transition-transform duration-200 ${isEntryOpen ? 'rotate-180' : ''}`} size={18} />
                      </div>

                      {isEntryOpen && (
                          <div className="grid grid-cols-1 gap-3">
                              {[
                                { label: 'A', title: '성장성', sub: 'Growth Composite', desc: <>최근 실적 기준 매출액, 영업이익, 당기순이익의 YoY 성장률(%)을 종합 산출하여 기초 체력이 확실하게 검증된 흑자 성장 기업만 선별합니다.</> },
                                { label: 'B', title: '방어력', sub: 'Dynamic MDD', desc: <>최근 60일 고점 대비 하락폭(MDD)을 추적합니다. 단순히 고정된 비율을 쓰지 않고, 종목별 변동성지표인 ATR(Average True Range)에 연동하여 한계 하락폭을 동적으로 계산해 맷집이 약한 종목을 차단합니다.</> },
                                { label: 'C', title: '유동성', sub: 'Liquidity', desc: <>원활한 진입과 슬리피지(Slippage) 없는 청산을 위해 최근 20일 일평균 거래대금이 최소 50억 원 이상인 메이저 종목들 사이에서만 트레이딩을 수행합니다.</> },
                                { label: 'D', title: '추세', sub: 'Trend Alignment', desc: <>현재가가 20일 이동평균선 위에, 20일선이 60일선 위에 위치한 완벽한 정배열 상승 기류 종목만 선별합니다. 동시에 ATR 기반의 동적 이격도 제한(15~50% 캡)을 적용해 이미 과열된 상투를 잡지 않습니다.</> },
                                { label: 'E', title: '가격 돌파', sub: 'Price Breakout', desc: <>최근 3개월(60일) 최고가의 90% 이상 매물대를 2일 연속 돌파한 종목을 포착합니다. 단, 60일 평균 대비 2배 이상의 대량 거래량이 동반될 경우 강력한 신호로 판단하여 1일 차라도 즉시 진입을 허용합니다.</> },
                                { label: 'F', title: '수급', sub: 'Volume Surge', desc: <>가격 상승을 뒷받침하는 강력한 자금 유입을 검증합니다. 최근 5일 평균 거래량과 당일 거래량이 모두 60일 평균 대비 1.5배 이상 폭발한 모멘텀 주도주만 선별합니다.</> },
                              ].map((g) => (
                                <Card key={g.label} interactive padding="none" className="qd-gate-card p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
                                    <div className="md:w-1/4 shrink-0 flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-md bg-slate-100 dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-semibold text-[14px]">{g.label}</div>
                                        <h4 className="font-medium text-[15px] text-slate-900 dark:text-white">{g.title} <span className="text-[12px] text-slate-400 block font-normal">{g.sub}</span></h4>
                                    </div>
                                    <div className="md:w-3/4">
                                        <p className="text-[14px] text-slate-600 dark:text-slate-300 leading-relaxed">
                                            {g.desc}
                                        </p>
                                    </div>
                                </Card>
                              ))}
                          </div>
                      )}
                  </div>

                  {/* 생존 매도 섹션 */}
                  <div>
                      <div
                        className="flex items-center justify-between cursor-pointer group mb-5 px-1"
                        onClick={() => setIsExitOpen(!isExitOpen)}
                      >
                          <div className="flex items-center gap-2.5">
                              <ShieldAlert className="text-slate-400" size={19} strokeWidth={1.75} />
                              <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white tracking-tight">생존 매도 3대 원칙 (Exit Signals)</h3>
                          </div>
                          <ChevronDown className={`text-slate-400 transition-transform duration-200 ${isExitOpen ? 'rotate-180' : ''}`} size={18} />
                      </div>

                      {isExitOpen && (
                          <div className="grid grid-cols-1 gap-3">
                              {[
                                { label: '1', title: '동적 손절', sub: 'Trailing Stop', desc: <>고정된 비율(-5% 등) 대신 종목별 일간 변동성(ATR) 수치에 연동된 손절선을 그립니다. 주가가 오르면 손절선도 추적하여 올라가며, +15% 이상 수익권 진입 시 방어선 추적 배수를 0.6배로 타이트하게 좁혀 실현 수익을 보호합니다.</> },
                                { label: '2', title: '추세 붕괴', sub: 'Trend Breakdown', desc: <>주가의 20일선 이탈, 단기 이평선 데드크로스(10일 &lt; 20일), 20일선 기울기 하락 전환이라는 3대 하락 징후를 감시합니다. 노이즈 방지를 위해 시장 국면에 따라 다수결(강세장 2개 충족, 약세장 1개 충족) 규칙을 적용하여 하락 엔진이 켜지기 전 신속히 청산합니다.</> },
                                { label: '3', title: '모멘텀 소진', sub: 'Momentum Exhaust', desc: <>초과 수익 상단을 제한하는 '목표가 고정 익절'을 전면 폐지했습니다. 단, 수익권에서 최근 5일 거래량이 20일 평균의 80% 밑으로 급감하고 주가가 10일선을 하향 이탈하면 시장의 관심이 소멸한 것으로 판단하여 즉시 실현 익절합니다.</> },
                              ].map((g) => (
                                <Card key={g.label} interactive padding="none" className="qd-gate-card p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
                                    <div className="md:w-1/4 shrink-0 flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-md bg-slate-100 dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-semibold text-[14px]">{g.label}</div>
                                        <h4 className="font-medium text-[15px] text-slate-900 dark:text-white">{g.title} <span className="text-[12px] text-slate-400 block font-normal">{g.sub}</span></h4>
                                    </div>
                                    <div className="md:w-3/4">
                                        <p className="text-[14px] text-slate-600 dark:text-slate-300 leading-relaxed">
                                            {g.desc}
                                        </p>
                                    </div>
                                </Card>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          )}
        </div>
      )}

      {/* RISK MODAL */}
      {riskStock && (
        <Modal open onClose={() => setRiskStock(null)} size="sm" className="p-6">
                <div className="flex justify-between items-center mb-5">
                    <h3 className="text-[17px] font-semibold text-slate-900 dark:text-white flex items-center gap-2"><ShieldAlert size={17} className="text-amber-500" strokeWidth={1.75}/> {riskStock.name} Risk 분석</h3>
                    <button onClick={() => setRiskStock(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-[13px] font-medium">닫기</button>
                </div>

                <p className="text-[13px] text-slate-600 dark:text-slate-400 mb-5 pb-4 border-b border-slate-100 dark:border-slate-800 tabular-nums">
                    현재가: ₩{Math.round(riskStock.current_price || 0).toLocaleString()} &nbsp;|&nbsp; 손절가: ₩{Math.round(riskStock.stop_price || 0).toLocaleString()}
                </p>

                <div className="space-y-5">
                    <div>
                        <div className="flex justify-between text-[13px] font-medium mb-2"><span>OVERALL EXIT PROXIMITY</span><span className="tabular-nums"><CountUp value={riskStock.exit_risk || 0} decimals={2} />%</span></div>
                        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden"><div className="qd-bar-fill h-2 rounded-full" style={{width: `${riskStock.exit_risk || 0}%`, background: (riskStock.exit_risk || 0) > 70 ? POS : GOOD}}></div></div>
                    </div>
                    <div>
                        <div className="flex justify-between text-[12.5px] mb-2 text-slate-500"><span>Trailing Stop (ATR) 추정</span><span className="tabular-nums"><CountUp value={Math.max(0, (riskStock.exit_risk || 0) - 15)} decimals={2} />%</span></div>
                        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden"><div className="qd-bar-fill bg-slate-400 dark:bg-slate-600 h-1.5 rounded-full" style={{width: `${Math.max(0, (riskStock.exit_risk || 0) - 15)}%`}}></div></div>
                    </div>
                    <div>
                        <div className="flex justify-between text-[12.5px] mb-2 text-slate-500"><span>Trend Break (MA20) 추정</span><span className="tabular-nums"><CountUp value={Math.max(0, (riskStock.exit_risk || 0) - 5)} decimals={2} />%</span></div>
                        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden"><div className="qd-bar-fill bg-slate-400 dark:bg-slate-600 h-1.5 rounded-full" style={{width: `${Math.max(0, (riskStock.exit_risk || 0) - 5)}%`}}></div></div>
                    </div>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-4">
                    <Metric size="sm" label="진입가 (Entry)" value={`₩${Math.round(riskStock.entry_price || 0).toLocaleString()}`} />
                    <Metric
                      size="sm"
                      label="보유 수익률 (P&L)"
                      tone={(riskStock.return_rate || 0) > 0 ? 'positive' : 'negative'}
                      value={<>{(riskStock.return_rate || 0) > 0 ? '+' : ''}<CountUp value={riskStock.return_rate || 0} decimals={2} />%</>}
                    />
                </div>
        </Modal>
      )}

      {/* 종목별 상세 팝업 — 12년치 과거 신호 이력 표시 */}
      {backtestStock && (
        <Modal open onClose={() => setBacktestStock(null)} size="lg" className="min-h-[40vh]">
            <Modal.Header>
                    <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">{backtestDisplayName} 과거 신호 이력</h3>
                    <button onClick={() => setBacktestStock(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-[13px] font-medium">닫기</button>
            </Modal.Header>

            <Modal.Body className="p-6">
                    {!bt ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 py-16">
                            <p className="text-[14px] text-center leading-relaxed">백테스팅 데이터가 없습니다.<br/>다음 배치(Cron) 실행 후 다시 확인해 주세요.</p>
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={() => { setBacktestStock(null); setActiveTab("Backtest"); }}
                                className="text-[12px] font-medium text-blue-600 dark:text-blue-400 underline underline-offset-2 mb-5 cursor-pointer"
                            >
                                전략 자체의 신뢰도(12년 트랙레코드)는 백테스팅 탭에서 확인하세요
                            </button>

                            <div className="flex items-center gap-2 mb-3">
                                <p className="text-[13.5px] font-medium text-slate-900 dark:text-white">이 종목의 12년치 과거 신호 이력 ({backtestOwnTrades.length}건)</p>
                                <Info size={13} className="text-slate-400" />
                            </div>
                            <p className="text-[12px] text-slate-500 mb-4 leading-relaxed">
                                표본이 작을 수 있어 참고용 보조지표로만 사용하세요. 신뢰도 판단은 백테스팅 탭의 전체 통계를 기준으로 합니다.
                            </p>
                            {backtestOwnTrades.length === 0 ? (
                                <p className="text-[13px] text-slate-400">해당 종목의 과거 신호 이력이 없습니다.</p>
                            ) : (
                                <div className="space-y-2">
                                    {backtestOwnTrades.map((t, i) => (
                                        <Panel key={i} level="inset" padding="none" className="flex flex-wrap items-center justify-between gap-2 p-3.5">
                                            <div className="text-[11.5px] text-slate-500 tabular-nums">{t.entry_date} → {t.exit_date} ({t.hold_days}일 보유)</div>
                                            <div className="text-[12.5px] font-medium text-slate-700 dark:text-slate-300 tabular-nums">₩{formatNumber(t.entry_price)} → ₩{formatNumber(t.exit_price)}</div>
                                            <div className="text-[13px] font-semibold tabular-nums" style={{ color: (t.return_pct || 0) >= 0 ? POS : NEG }}>{(t.return_pct || 0) > 0 ? '+' : ''}{t.return_pct?.toFixed(2)}%</div>
                                            <div className="text-[11.5px] text-slate-400 w-full md:w-auto">{t.reason}</div>
                                        </Panel>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
            </Modal.Body>
        </Modal>
      )}

      {/* REPORT MODAL (종목 리포트 전용) */}
      {selectedStock && (
        <Modal open onClose={() => setSelectedStock(null)} size="xl" className="min-h-[60vh] md:min-h-[74vh]">
            <Modal.Header>
                    <div className="flex gap-2 items-center">
                        <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">{selectedStock.symbol} · {selectedStock.market || "KOSPI"}</span>
                        {selectedStock.sector && <span className="text-[12px] font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{selectedStock.sector}</span>}
                    </div>
                    <button onClick={() => setSelectedStock(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-[13px] font-medium">닫기</button>
            </Modal.Header>

            <Modal.Body className="p-6 md:p-10">
                    {reportLoading || selectedStock.isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 py-20">
                            <RefreshCcw className="animate-spin mb-4 text-slate-400" size={28} strokeWidth={1.75} />
                            <p className="text-[14px] text-slate-600 dark:text-slate-300 text-center">최신 재무 데이터와 실시간 지표를 융합하여 정보를 생성 중입니다...</p>
                        </div>
                    ) : selectedStock.fetchError ? (
                        <div className="flex flex-col items-center justify-center h-full py-20" style={{ color: NEG }}>
                            <X size={32} className="mb-4" />
                            <p className="text-[14px] text-center">해당 종목의 데이터(API)를 불러오는데 실패했습니다.</p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-8">
                                <h2 className="text-[26px] md:text-[32px] font-semibold text-slate-900 dark:text-white mb-2 leading-tight tracking-tight">
                                    {selectedStock.name}
                                </h2>
                                <h1 className="text-[20px] md:text-[26px] font-semibold text-slate-900 dark:text-white tracking-tight flex items-baseline tabular-nums">
                                    {formatNumber(selectedStock.current_price)} 원 <span className="text-[14px] md:text-[17px] ml-2.5 font-medium" style={{ color: (selectedStock.ret_1m || 0) > 0 ? POS : NEG }}>{(selectedStock.ret_1m || 0) > 0 ? '+' : ''}{formatPct(selectedStock.ret_1m || 0)} (1M)</span>
                                </h1>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                                <Panel level="inset" padding="lg">
                                    <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white mb-5">Quant Scores</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Metric size="md" label="퀀트 랭킹 스코어" value={<><CountUp value={selectedStock.score || 0} decimals={2} />점</>} />
                                        <Metric
                                          size="md"
                                          label="생존 필터 통과"
                                          value={<><CountUp value={selectedStock.total_pass !== undefined ? selectedStock.total_pass : (selectedStock.gates ? Object.values(selectedStock.gates).filter(g => g.pass).length : 0)} decimals={0} /> / 6</>}
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-5 p-3 bg-white dark:bg-[#1E293B] rounded border border-slate-200 dark:border-slate-700/50 leading-relaxed">평가 지표(점수/게이트)는 가장 최근 배치(Cron) 시점을 기준으로 고정 표시됩니다. (재무 및 차트는 최신 반영)</p>
                                </Panel>

                                <Panel level="inset" padding="lg" className="flex flex-col justify-center items-center relative">
                                    <div className="relative w-44 md:w-52 h-24 md:h-28 mb-2 flex justify-center items-end">
                                        <svg viewBox="0 0 200 110" className="w-full h-full absolute bottom-0 overflow-visible">
                                            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="16" strokeLinecap="round" />
                                            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={GOOD} strokeWidth="16" strokeLinecap="round"
                                                  strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * animatedScore / 100)} style={{ transition: 'stroke-dashoffset 0.2s linear' }} />
                                            {(() => {
                                                const { x, y } = getGaugePoint(animatedScore);
                                                return <circle cx={x} cy={y} r="4.5" fill={GOOD} />;
                                            })()}
                                        </svg>
                                        <div className="absolute bottom-0 w-full flex flex-col items-center justify-end pb-2">
                                            <p className="text-[32px] md:text-[38px] font-semibold tracking-tight tabular-nums" style={{ color: GOOD }}>{animatedScore.toFixed(1)}</p>
                                        </div>
                                    </div>
                                    <p className="text-[12.5px] text-slate-500 mt-2">퀀트 랭킹 스코어</p>
                                </Panel>
                            </div>

                            <div className="mb-8">
                                <h5 className="text-[15px] font-semibold text-slate-900 dark:text-white mb-4">Entry Gates (6 conditions)</h5>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
                                    {['A', 'B', 'C', 'D', 'E', 'F'].map((label, idx) => {
                                        const gateKeys = selectedStock.gates ? Object.keys(selectedStock.gates) : [];
                                        const gate = gateKeys.length > idx ? selectedStock.gates[gateKeys[idx]] : { pass: false, name: '-', reason: '-' };
                                        const passed = gate.pass;

                                        return (
                                        <div key={label} className={`p-3.5 rounded-md border ${passed ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50' : 'bg-slate-50 dark:bg-[#1E2329] border-slate-200 dark:border-slate-800'} flex flex-col justify-between h-24`}>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="font-semibold text-[14px]" style={{ color: passed ? GOOD : NEUTRAL }}>{label}</span>
                                                <span className="text-[11px]" style={{ color: passed ? GOOD : NEUTRAL }}>{passed ? '통과' : '미달'}</span>
                                            </div>
                                            <div className="h-1 rounded-full w-full mb-2" style={{ background: passed ? GOOD : '#E2E8F0' }}></div>
                                            <p className="text-[11px] truncate" style={{ color: passed ? GOOD : NEUTRAL }} title={gate.reason || gate.name}>{gate.name}</p>
                                        </div>
                                    )})}
                                </div>
                            </div>

                            <Panel level="inset" padding="lg" className="mb-8">
                                <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white mb-5">Financials & Valuation</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-5 gap-x-4">
                                    <Metric size="sm" label="매출액" value={formatMarcap(selectedStock.fundamental?.revenue_cur)} />
                                    <Metric size="sm" label="영업이익" value={formatMarcap(selectedStock.fundamental?.op_profit_cur)} />
                                    <Metric size="sm" label="영업이익률" value={formatPct(selectedStock.fundamental?.op_margin)} />
                                    <Metric size="sm" label="ROE" value={formatPct(selectedStock.fundamental?.roe)} tone="positive" />
                                    <Metric size="sm" label="시가총액" value={formatMarcap(selectedStock.fundamental?.marcap_억)} />
                                    <Metric size="sm" label="PER" value={`${formatNumber(selectedStock.fundamental?.per)} 배`} />
                                    <Metric size="sm" label="PBR" value={`${formatNumber(selectedStock.fundamental?.pbr)} 배`} />
                                    <Metric size="sm" label="부채비율" value={formatPct(selectedStock.fundamental?.debt_ratio)} />
                                </div>
                            </Panel>

                            <Panel level="inset" padding="lg">
                                <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white mb-5">가격 차트 (최근 250일)</h3>
                                <div className="w-full h-[240px] md:h-[280px]">
                                    {selectedStock.chart_data && selectedStock.chart_data.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={selectedStock.chart_data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />
                                                <XAxis dataKey="date" tick={{fill: '#94A3B8', fontSize: 11, fontWeight: '500'}} tickLine={false} axisLine={false} minTickGap={30} tickFormatter={(val) => val ? String(val).substring(5).replace('-', '.') : ''}/>
                                                <YAxis domain={['auto', 'auto']} tick={{fill: '#94A3B8', fontSize: 11, fontWeight: '500'}} tickLine={false} axisLine={false} tickFormatter={(value) => value !== undefined && value !== null ? value.toLocaleString() : ''} />
                                                <Tooltip contentStyle={{backgroundColor: '#0F1B2E', borderColor: '#334155', borderRadius: '8px', color: 'white', fontWeight: '500'}} itemStyle={{color: POS}} labelStyle={{color: '#94A3B8', marginBottom: '4px'}} formatter={(value) => [value !== undefined && value !== null ? value.toLocaleString() : '', "종가"]} />
                                                <Line type="monotone" dataKey="price" stroke={POS} strokeWidth={2} dot={false} activeDot={{r: 4, fill: POS, strokeWidth: 0}} isAnimationActive={true} animationDuration={900} animationEasing="ease-out" />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[13px] text-slate-500">차트 데이터가 없습니다.</div>
                                    )}
                                </div>
                            </Panel>
                        </>
                    )}
            </Modal.Body>
        </Modal>
      )}

      {/* 글로벌 지수 비교 모달 */}
      {isIndexModalOpen && (
        <Modal open onClose={() => setIsIndexModalOpen(false)} size="sm">
            <Modal.Header style={{ alignItems: 'flex-start' }}>
              <div>
                <h2 className="text-[16px] font-semibold text-slate-900 dark:text-white mb-1">지수 비교</h2>
                <p className="text-[12.5px] text-slate-500">한국·미국 주요 지수</p>
              </div>
              <button onClick={() => setIsIndexModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-[13px] font-medium">닫기</button>
            </Modal.Header>

            <Modal.Body className="p-4 flex flex-col gap-2.5 bg-slate-50/50 dark:bg-transparent">
              {[
                { key: 'kospi', name: '코스피', icon: 'K', color: 'bg-[#1e4e8c]' },
                { key: 'kosdaq', name: '코스닥', icon: 'Q', color: 'bg-[#7e57c2]' },
                { key: 'nasdaq', name: 'NASDAQ', icon: 'NDQ', color: 'bg-[#007aff]' },
                { key: 'sp500', name: 'S&P 500', icon: 'S&P', color: 'bg-[#ff3b30]' }
              ].map(idx => {
                const data = indices[idx.key];
                if (!data) return null;
                const isPos = (data.ret_1d || 0) > 0;

                return (
                  <Panel key={idx.key} level="surface" padding="none" className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${idx.color} text-white flex items-center justify-center font-semibold text-[11px]`}>
                        {idx.icon}
                      </div>
                      <span className="text-[15px] font-medium text-slate-900 dark:text-white">{idx.name}</span>
                    </div>

                    <div className="flex items-baseline gap-3">
                      <span className="text-[12.5px] font-medium tabular-nums" style={{ color: isPos ? POS : NEG }}>
                        {isPos ? '+' : ''}{data.ret_1d?.toFixed(2)}%
                      </span>
                      <span className="text-[18px] font-semibold text-slate-900 dark:text-white tabular-nums w-20 text-right">
                        {data.current_price?.toLocaleString()}
                      </span>
                    </div>
                  </Panel>
                );
              })}
            </Modal.Body>

            <Modal.Footer>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                KR <span className="text-slate-500">KOSPI · KOSDAQ</span> &nbsp; US <span className="text-slate-500">NASDAQ · S&P 500</span>
              </p>
            </Modal.Footer>
        </Modal>
      )}

    </div>
  );
}
