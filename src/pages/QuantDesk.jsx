import { useEffect, useState, useMemo, useRef } from 'react';
import {
  RefreshCcw, X,
  TrendingUp, ShieldCheck, Droplets, Activity, Rocket, Zap,
  Crosshair, TrendingDown, Flag, BookOpen, ShieldAlert, Target, ChevronRight, ChevronDown, Info
} from 'lucide-react';
import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, LineChart, Legend } from 'recharts';
import { useRenderApi } from '../hooks/useRenderApi';
import MacroPage from './MacroPage';
import QuantScreener from './QuantScreener';

// =========================================================================
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
  }, [target, duration]);
  return value;
}

function CountUp({ value, duration = 1100, decimals = 2, formatter }) {
  const animated = useCountUp(value, duration);
  if (formatter) return <>{formatter(animated)}</>;
  return <>{animated.toFixed(decimals)}</>;
}

function getGaugePoint(percent) {
  const clamped = Math.max(0, Math.min(100, percent || 0));
  const t = (180 - 1.8 * clamped) * (Math.PI / 180);
  const x = 100 + 80 * Math.cos(t);
  const y = 100 - 80 * Math.sin(t);
  return { x, y };
}

function getDockScale(index, hoverIndex) {
  if (hoverIndex === null || hoverIndex === undefined) return { scale: 1, lift: 0 };
  const diff = Math.abs(index - hoverIndex);
  if (diff === 0) return { scale: 1.035, lift: -4 };
  if (diff === 1) return { scale: 1.015, lift: -1 };
  return { scale: 1, lift: 0 };
}

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

function MacroTickerItem({ item, onClick }) {
  const change = item?.change_percent || 0;
  const isUp = change > 0;
  const isDown = change < 0;
  const color = isUp ? "text-[#FF4B4B]" : isDown ? "text-[#3B82F6]" : "text-slate-400";
  const arrow = isUp ? "▲" : isDown ? "▼" : "─";
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-5 py-2.5 shrink-0 whitespace-nowrap cursor-pointer hover:opacity-70 transition-opacity">
      <span className="text-[13px] font-extrabold text-slate-500 dark:text-slate-400">{item.display_name}</span>
      <span className="text-[13px] font-black text-slate-900 dark:text-white">{formatMacroValue(item)}</span>
      <span className={`text-[12px] font-black ${color}`}>{arrow} {change > 0 ? "+" : ""}{change.toFixed(2)}%</span>
    </button>
  );
}

function MacroTicker({ macroData, onNavigate }) {
  if (!macroData || macroData.length === 0) return null;
  const items = [...macroData, ...macroData];
  const duration = Math.max(30, macroData.length * 4);
  return (
    <div className="macro-ticker-wrap bg-white dark:bg-[#0B1120] border-y border-slate-200 dark:border-slate-800/80 mb-8 rounded-xl">
      <div className="macro-ticker-track" style={{ "--macro-duration": `${duration}s` }}>
        {items.map((item, idx) => (
          <MacroTickerItem key={`${item.indicator}-${idx}`} item={item} onClick={onNavigate} />
        ))}
      </div>
    </div>
  );
}

const REGIME_META = {
  BULL:    { label: 'BULL', color: '#FF4B4B', bg: 'bg-red-50 dark:bg-red-950/20', border: 'border-red-200 dark:border-red-900/50' },
  BEAR:    { label: 'BEAR', color: '#3B82F6', bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-200 dark:border-blue-900/50' },
  NEUTRAL: { label: 'NEUTRAL', color: '#94A3B8', bg: 'bg-slate-100 dark:bg-slate-800/40', border: 'border-slate-300 dark:border-slate-700' },
};
const getRegimeMeta = (r) => REGIME_META[r] || REGIME_META.NEUTRAL;

const MICRO_INTERACTION_STYLES = `
  .gate-spotlight { position: relative; overflow: hidden; }
  .gate-spotlight::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at var(--mx, 50%) var(--my, 50%), var(--spotlight-color, rgba(255,75,75,0.14)), transparent 42%); opacity: 0; transition: opacity 0.35s ease; pointer-events: none; z-index: 0; }
  .gate-spotlight:hover::before { opacity: 1; }
  .gate-spotlight > * { position: relative; z-index: 1; }
  .qd-dock-row { transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.28s ease; will-change: transform; }
  .qd-gauge-glow { filter: drop-shadow(0 0 6px currentColor); animation: qdGaugePulse 1.8s ease-in-out infinite; }
  @keyframes qdGaugePulse { 0%, 100% { opacity: 0.85; r: 5; } 50% { opacity: 1; r: 6.5; } }
  .qd-bar-fill { transition: width 1s cubic-bezier(0.22, 1, 0.36, 1); }
  .qd-bg-texture { position: absolute; inset: 0; pointer-events: none; opacity: 0.55; z-index: -1; }
  .dark .qd-bg-texture { opacity: 0.35; }
  .macro-ticker-wrap { position: relative; width: 100%; overflow: hidden; -webkit-mask-image: linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%); mask-image: linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%); }
  .macro-ticker-track { display: flex; align-items: center; width: max-content; animation: macroTickerScroll var(--macro-duration, 40s) linear infinite; }
  .macro-ticker-wrap:hover .macro-ticker-track { animation-play-state: paused; }
  @keyframes macroTickerScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
  @keyframes qdRegimePing { 75%, 100% { transform: scale(2.2); opacity: 0; } }
  .qd-regime-ping { animation: qdRegimePing 1.8s cubic-bezier(0, 0, 0.2, 1) infinite; }
  .qd-qty-chip { transition: all 0.15s ease; }
  .qd-qty-chip:hover { transform: translateY(-1px); }
`;

const QUANT_CACHE_KEY = 'qd_quant_macro_cache_v2';
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
  } catch (e) { }
}

const EMPTY_QUANT_DATA = { holdings: [], trades: [], history: [], confirmed: [], watchlist: [], backtest: null, macro: [], screener: [], strategyReport: null };

export default function QuantDesk() {
  const [activeTab, setActiveTab] = useState("Macro");
  const [data, setData] = useState(EMPTY_QUANT_DATA);
  const [kospiData, setKospiData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [selectedStock, setSelectedStock] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [riskStock, setRiskStock] = useState(null);
  const [backtestStock, setBacktestStock] = useState(null);
  const [isStrategyModalOpen, setIsStrategyModalOpen] = useState(false);

  const [timeRange, setTimeRange] = useState("All");
  const [indices, setIndices] = useState({ kospi: null, kosdaq: null, nasdaq: null, sp500: null });
  const [isIndexModalOpen, setIsIndexModalOpen] = useState(false);

  const [isEntryOpen, setIsEntryOpen] = useState(true);
  const [isExitOpen, setIsExitOpen] = useState(true);

  const [hoverHoldingIdx, setHoverHoldingIdx] = useState(null);
  const [hoverWatchIdx, setHoverWatchIdx] = useState(null);
  const [hoverHistoryIdx, setHoverHistoryIdx] = useState(null);

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

    Promise.allSettled([
      callApi("/api/quant-dashboard"),
      callApi("/api/search/KS11"),
      callApi("/api/macro"),
      callApi("/api/screener"),
      callApi("/api/backtesting/result"),
    ])
    .then((results) => {
      const quantResult = results[0].status === 'fulfilled' ? results[0].value : null;
      const kospiResult = results[1].status === 'fulfilled' ? results[1].value : null;
      const macroResult = results[2].status === 'fulfilled' ? results[2].value : null;
      const screenerResult = results[3].status === 'fulfilled' ? results[3].value : null;
      const strategyResult = results[4].status === 'fulfilled' ? results[4].value : null;

      let mergedDataForCache = null;
      let processedKospiForCache = [];

      if (quantResult && quantResult.status === "success" && quantResult.data) {
        const mergedData = { ...quantResult.data };
        mergedData.macro = (macroResult && macroResult.status === "success" && macroResult.data) ? macroResult.data : [];
        mergedData.screener = (screenerResult && screenerResult.status === "success" && screenerResult.data) ? screenerResult.data : [];
        mergedData.strategyReport = (strategyResult && strategyResult.status === "success" && strategyResult.data && strategyResult.data.track_record_used) ? strategyResult.data : null;
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
            processedKospi.push({ date: rawChart[i].date, pct_change: pct });
        }
        setKospiData(processedKospi);
        processedKospiForCache = processedKospi;
      } else {
        setKospiData([]);
        processedKospiForCache = [];
      }

      if (mergedDataForCache) {
        writeQuantMacroCache({ ...mergedDataForCache, kospiData: processedKospiForCache });
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
      if (!dailySellTrades[dDate]) dailySellTrades[dDate] = { sum: 0, count: 0 };
      dailySellTrades[dDate].sum += (t.return_rate || 0);
      dailySellTrades[dDate].count += 1;
    });

    let kospiCum = 0;
    let portCum = 0;
    return backboneDates.map(dateStr => {
        if (kospiMap[dateStr]) kospiCum += kospiMap[dateStr];
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

  const backtestSymbol = backtestStock?.symbol;
  const backtestDisplayName = (data.strategyReport?.name_map && backtestSymbol && data.strategyReport.name_map[backtestSymbol]) || backtestStock?.name;

  const backtestSymbolReport = useMemo(() => {
    if (!data.strategyReport || !backtestSymbol) return null;
    return (data.strategyReport.per_symbol || []).find(p => p.symbol === backtestSymbol) || null;
  }, [data.strategyReport, backtestSymbol]);

  const backtestSizing = backtestSymbolReport?.position_sizing || null;
  const backtestOwnHistory = backtestSymbolReport?.own_history || null;
  const backtestOwnTrades = backtestOwnHistory?.trades || [];

  const strategyTrackRecord = data.strategyReport?.track_record_used || null;
  const strategyRegime = data.strategyReport?.per_symbol?.[0]?.regime || null;
  const strategyWalkForward = data.strategyReport?.walk_forward || null;

  const strategyEquityChartData = useMemo(() => {
    if (!strategyTrackRecord?.equity_curve) return [];
    return strategyTrackRecord.equity_curve.map(pt => ({
      date: pt.date,
      strategy: (pt.value - 1) * 100,
    }));
  }, [strategyTrackRecord]);

  const CONFIDENCE_LABEL = {
    insufficient: { text: '표본 부족', color: '#94A3B8', bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-300 dark:border-slate-700' },
    reference: { text: '참고 가능', color: '#3B82F6', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-300 dark:border-blue-800' },
    reliable: { text: '신뢰 가능', color: '#00B464', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-300 dark:border-emerald-800' },
  };
  const getConfidenceMeta = (level) => CONFIDENCE_LABEL[level] || CONFIDENCE_LABEL.insufficient;

  const strategyHeadlineMetrics = strategyTrackRecord ? [
    { label: '표본(트레이드) 수', value: `${strategyTrackRecord.trade_count}건` },
    { label: '승률', value: `${strategyTrackRecord.win_rate?.toFixed(1)}%`, sub: `95% CI ${strategyTrackRecord.win_rate_ci95?.[0]?.toFixed(1)}~${strategyTrackRecord.win_rate_ci95?.[1]?.toFixed(1)}%` },
    { label: '기대값 (Expectancy)', value: `${strategyTrackRecord.expectancy_pct > 0 ? '+' : ''}${strategyTrackRecord.expectancy_pct?.toFixed(2)}%`, sub: `95% CI ${strategyTrackRecord.expectancy_ci95?.[0]?.toFixed(2)}~${strategyTrackRecord.expectancy_ci95?.[1]?.toFixed(2)}%` },
    { label: 'Profit Factor', value: strategyTrackRecord.profit_factor?.toFixed(2) },
    { label: '손익비 (Payoff)', value: strategyTrackRecord.payoff_ratio?.toFixed(2) },
    { label: '트레이드 샤프', value: strategyTrackRecord.return_sharpe?.toFixed(2) },
    { label: '평균 보유일', value: `${strategyTrackRecord.avg_hold_days?.toFixed(1)}일` },
    { label: 'MDD', value: `${strategyTrackRecord.mdd_pct?.toFixed(1)}%` },
    { label: '누적수익률', value: `${strategyTrackRecord.cum_return_pct > 0 ? '+' : ''}${strategyTrackRecord.cum_return_pct?.toFixed(1)}%` },
    { label: '벤치마크 대비 초과수익', value: `${strategyTrackRecord.excess_return_pct > 0 ? '+' : ''}${strategyTrackRecord.excess_return_pct?.toFixed(1)}%` },
  ] : [];

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
                <span className="text-slate-900 dark:text-slate-200 font-black text-[15px]">Portfolio</span>
             </div>
             <span className="font-black text-[15px]" style={{ color: tooltipColor }}>
                {(data.cum || 0) > 0 ? '+' : ''}{(data.cum || 0).toFixed(2)}%
             </span>
          </div>
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200 dark:border-slate-700/60">
             <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#64748B]"></span><span className="text-slate-500 dark:text-slate-400 font-extrabold text-[14px]">KOSPI</span></div>
             <span className="text-slate-500 dark:text-slate-400 font-extrabold text-[14px]">{(data.kospi_cum || 0) > 0 ? '+' : ''}{(data.kospi_cum || 0).toFixed(2)}%</span>
          </div>
          <div className="flex justify-between items-center">
             <span className="text-slate-600 dark:text-slate-500 font-black text-[14px]">Alpha (α)</span>
             <span className={`font-black text-[15px] ${(data.alpha || 0) >= 0 ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>{(data.alpha || 0) > 0 ? '+' : ''}{(data.alpha || 0).toFixed(2)}%</span>
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

  const handleSpotlightMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 100;
    const my = ((e.clientY - rect.top) / rect.height) * 100;
    e.currentTarget.style.setProperty('--mx', `${mx}%`);
    e.currentTarget.style.setProperty('--my', `${my}%`);
  };

  return (
    <div className="relative w-full transition-colors duration-300 pb-20 font-['Nunito',_ui-rounded,_-apple-system,_system-ui,_sans-serif]">
      <style>{MICRO_INTERACTION_STYLES}</style>
      <svg className="qd-bg-texture" width="100%" height="100%" aria-hidden="true">
        <defs><pattern id="qdDotGrid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.5" className="fill-slate-400/40 dark:fill-slate-600/40" /></pattern></defs>
        <rect width="100%" height="100%" fill="url(#qdDotGrid)" />
      </svg>
      <ServerWakeupOverlay />

      {syncing && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
           <div className="relative w-40 h-32 mb-6">
                <svg viewBox="0 0 160 130" className="w-full h-full overflow-visible">
                    <line x1="0" y1="35" x2="160" y2="35" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" strokeDasharray="4 6" />
                    <line x1="0" y1="85" x2="160" y2="85" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" strokeDasharray="4 6" />
                    <line x1="0" y1="130" x2="160" y2="130" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" strokeDasharray="4 6" />
                    <path d="M 0,120 L 35,90 L 70,105 L 115,45 L 155,10" fill="none" stroke="#FF4B4B" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" className="animate-[drawLine_1s_ease-in-out_forwards]" style={{ strokeDasharray: 400, strokeDashoffset: 400, filter: 'drop-shadow(0px 0px 8px rgba(255,75,75,0.7))' }} />
                    <circle cx="155" cy="10" r="7" fill="#FF4B4B" className="animate-[fadeIn_0.3s_ease-out_0.9s_forwards] opacity-0" style={{ filter: 'drop-shadow(0px 0px 12px rgba(255,75,75,1))' }} />
                </svg>
           </div>
           <style>{`@keyframes drawLine { to { stroke-dashoffset: 0; } } @keyframes fadeIn { to { opacity: 1; } }`}</style>
           <h2 className="text-3xl font-black text-white tracking-widest mb-2 shadow-black drop-shadow-xl">SYNCHRONIZING</h2>
           <p className="text-[#FF4B4B] font-black tracking-wide">최신 시장 데이터를 퀀트 엔진에 반영 중입니다 🚀</p>
        </div>
      )}

      {/* Header */}
      <div className="mb-10 flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h2 className="text-2xl md:text-[28px] font-black text-slate-900 dark:text-white flex items-center mb-2 tracking-tight gap-3">📡 퀀트투자</h2>
        <button onClick={handleRefresh} className="px-4 py-2 border border-slate-300 dark:border-slate-700/80 rounded-xl flex items-center justify-center gap-2 text-sm font-extrabold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer active:scale-95 bg-white dark:bg-transparent shadow-sm hover:shadow-md">
            <RefreshCcw size={16} className={loading ? "animate-spin text-blue-500" : ""} /> 데이터 동기화
        </button>
      </div>

      <div className="flex gap-3 md:gap-5 border-b border-slate-200 dark:border-slate-800 mb-8 overflow-x-auto whitespace-nowrap hide-scrollbar pb-0 select-none">
        {[{id: "Macro", label: "Macro"},
          {id: "Portfolio", label: `Portfolio (${holdings.length})`},
          {id: "Watchlist", label: `Watchlist (${filWatchlist.length})`},
          {id: "Screener", label: "Screener"},
          {id: "History", label: "History"},
          {id: "Whitepaper", label: "Explain"}].map(t => (
            <button
                key={t.id} onClick={() => setActiveTab(t.id)}
                className={`pb-3 px-2 text-[14px] md:text-[15px] font-black tracking-tight transition-all cursor-pointer hover:-translate-y-0.5 ${activeTab === t.id ? 'text-[#FF4B4B] border-b-[3px] border-[#FF4B4B]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
                {t.label}
            </button>
        ))}
      </div>

      <MacroTicker macroData={data.macro} onNavigate={() => setActiveTab("Macro")} />

      {loading && !syncing ? (
        <div className="flex justify-center p-20 w-full"><RefreshCcw className="animate-spin text-blue-500" size={40} /></div>
      ) : (
        <div className="w-full">
          {/* ===================== MACRO TAB ===================== */}
          {activeTab === "Macro" && <MacroPage macroData={data.macro} />}

          {/* ===================== PORTFOLIO TAB ===================== */}
          {activeTab === "Portfolio" && (
            <div className="animate-in fade-in duration-300 w-full">
                {(indices.kospi || strategyTrackRecord) && (
                  <div className="mb-8 bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800/70">
                      {/* 세그먼트 1: KOSPI */}
                      {indices.kospi && (
                        <button onClick={() => setIsIndexModalOpen(true)} className="flex-1 flex items-center justify-between gap-2 sm:gap-3 p-3.5 sm:p-4 md:p-5 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group min-w-0">
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center shadow-inner overflow-hidden border border-slate-200 shrink-0">
                              <img src="/태극기.png" alt="KR" className="w-full h-full object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                <span className="text-[14px] sm:text-[15px] md:text-[16px] font-black text-slate-900 dark:text-white whitespace-nowrap">KOSPI</span>
                                {indices.kospi.market_status === "장중" ? (
                                  <span className="text-[9px] sm:text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50 whitespace-nowrap">● 장중</span>
                                ) : (
                                  <span className="text-[9px] sm:text-[9.5px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 whitespace-nowrap">장마감</span>
                                )}
                              </div>
                              <div className="text-[10.5px] sm:text-[11px] font-extrabold text-slate-500 truncate">
                                전일대비 <span className={(indices.kospi.ret_1d || 0) > 0 ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}>{(indices.kospi.ret_1d > 0 ? '+' : '')}{indices.kospi.ret_1d?.toFixed(2)}%</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                            <span className="text-[16px] sm:text-[19px] md:text-[22px] font-black text-slate-900 dark:text-white tracking-tighter whitespace-nowrap">{indices.kospi.current_price?.toLocaleString()}</span>
                            <ChevronRight className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors shrink-0 w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                          </div>
                        </button>
                      )}
                      
                      {/* 세그먼트 2: 레짐 + 전략 신뢰도 */}
                      {strategyTrackRecord && (() => {
                        const rMeta = getRegimeMeta(strategyRegime);
                        const cMeta = getConfidenceMeta(strategyTrackRecord.confidence_level);
                        const previewColor = strategyTrackRecord.expectancy_pct >= 0 ? '#FF4B4B' : '#3B82F6';
                        return (
                          <button onClick={() => setIsStrategyModalOpen(true)} className="flex-1 flex items-center justify-between gap-2 sm:gap-3 p-3.5 sm:p-4 md:p-5 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group min-w-0">
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                              <span className="relative flex h-2.5 w-2.5 shrink-0">
                                <span className="qd-regime-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: rMeta.color }}></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: rMeta.color }}></span>
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                  <span className="text-[14px] sm:text-[15px] md:text-[16px] font-black text-slate-900 dark:text-white whitespace-nowrap">{strategyRegime ? rMeta.label : '레짐 확인중'}</span>
                                  <span className={`text-[9px] sm:text-[9.5px] font-black px-1.5 py-0.5 rounded-full border whitespace-nowrap ${cMeta.bg} ${cMeta.border}`} style={{ color: cMeta.color }}>{cMeta.text}</span>
                                </div>
                                <div className="text-[10.5px] sm:text-[11px] font-extrabold text-slate-500 truncate">전략 신뢰도 · 표본 {strategyTrackRecord.trade_count}건</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                              <div className="text-right hidden sm:block">
                                <div className="text-[10.5px] font-extrabold text-slate-500 whitespace-nowrap">승률</div>
                                <div className="text-[16px] md:text-[18px] font-black" style={{ color: previewColor }}>{strategyTrackRecord.win_rate?.toFixed(1)}%</div>
                              </div>
                              <ChevronRight className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors shrink-0 w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                            </div>
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                )}

                <div className="w-full bg-white dark:bg-transparent md:border border-slate-200 dark:border-slate-800 md:rounded-2xl overflow-hidden md:shadow-sm mb-12">
                    <div className="w-full">
                        <div className="hidden md:flex px-4 md:px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-transparent w-full">
                            <div className="w-[18%] text-[14px] font-extrabold text-slate-500">종목명</div>
                            <div className="w-[12%] text-[14px] font-extrabold text-slate-500 text-right">진입가</div>
                            <div className="w-[12%] text-[14px] font-extrabold text-slate-500 text-right">현재가</div>
                            <div className="w-[10%] text-[14px] font-extrabold text-slate-500 text-right">수량</div>
                            <div className="w-[13%] text-[14px] font-extrabold text-slate-500 text-right">수익률(P&L)</div>
                            <div className="w-[15%] text-[14px] font-extrabold text-slate-500 text-center">Exit Risk</div>
                            <div className="w-[20%] text-[14px] font-extrabold text-slate-500 text-center">상세 액션</div>
                        </div>

                        {holdings.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 dark:text-slate-400 font-extrabold">현재 보유 중인 종목이 없습니다.</div>
                        ) : holdings.map((h, i) => {
                            const ret = h.return_rate || 0.0;
                            const pnlColor = ret > 0 ? "text-[#FF4B4B]" : (ret < 0 ? "text-[#3B82F6]" : "text-slate-500");
                            const dummyRisk = Math.min(100, Math.max(0, 100 - (ret * 2 + 50)));
                            const dock = getDockScale(i, hoverHoldingIdx);

                            return (
                            <div key={i} onMouseEnter={() => setHoverHoldingIdx(i)} onMouseLeave={() => setHoverHoldingIdx(null)} style={{ transform: `translateY(${dock.lift}px) scale(${dock.scale})`, zIndex: dock.scale > 1 ? 10 : 1 }} className="qd-dock-row flex flex-col md:flex-row md:items-center px-4 md:px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#111827] md:bg-transparent rounded-xl md:rounded-none mb-3 md:mb-0 shadow-sm md:shadow-none hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors w-full gap-3 md:gap-0">
                                <div className="flex justify-between items-center w-full md:w-[18%] pr-0 md:pr-4">
                                    <div className="text-[16px] md:text-[16px] font-black text-slate-900 dark:text-white truncate">{h.name}</div>
                                    <div className={`md:hidden text-[16px] font-black ${pnlColor}`}>{ret > 0 ? "+" : ""}{ret.toFixed(2)}%</div>
                                </div>
                                <div className="flex justify-between items-center w-full md:w-[34%]">
                                    <div className="flex flex-col md:w-1/3 text-left md:text-right">
                                        <span className="text-[11px] font-bold text-slate-400 md:hidden mb-0.5">진입가</span>
                                        <span className="text-[14px] md:text-[15px] font-extrabold text-slate-700 dark:text-slate-300">₩{Math.round(h.entry_price || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex flex-col md:w-1/3 text-right">
                                        <span className="text-[11px] font-bold text-slate-400 md:hidden mb-0.5">현재가</span>
                                        <span className="text-[14px] md:text-[15px] font-black text-slate-900 dark:text-white">₩{Math.round(h.current_price || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex flex-col md:w-1/3 items-end">
                                        <span className="text-[11px] font-bold text-slate-400 md:hidden mb-0.5">수량</span>
                                        <button onClick={() => handlePositionSizingClick(h.symbol, h)} title={`${h.name} 상세 보기`} className="qd-qty-chip inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[14px] md:text-[15px] font-extrabold text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer">
                                            {formatNumber(h.quantity)}주
                                        </button>
                                    </div>
                                </div>
                                <div className={`hidden md:block w-[13%] text-[16px] font-black text-right ${pnlColor}`}>{ret > 0 ? "+" : ""}{ret.toFixed(2)}%</div>
                                <div className="flex justify-between items-center w-full md:w-[35%] mt-1 md:mt-0 pt-3 md:pt-0 border-t border-slate-100 dark:border-slate-800/80 md:border-0">
                                    <div className="flex items-center md:w-[28%] md:justify-center gap-2">
                                        <span className="text-[11px] font-bold text-slate-400 md:hidden">Exit Risk</span>
                                        <span className="text-[14px] md:text-[15px] font-black text-orange-500">{(h.exit_risk || dummyRisk).toFixed(2)}%</span>
                                    </div>
                                    <div className="flex justify-end md:w-[72%] md:justify-center gap-2 flex-wrap">
                                        <button onClick={() => setRiskStock({...h, exit_risk: (h.exit_risk || dummyRisk)})} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[13px] font-black rounded-lg border border-slate-200 hover:bg-slate-200 hover:text-orange-600 hover:border-orange-400 transition-all cursor-pointer shadow-sm">🚨 Risk</button>
                                        <button onClick={() => handleStockClick(h.symbol, h)} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[13px] font-black rounded-lg border border-slate-200 hover:bg-slate-200 hover:text-emerald-600 hover:border-emerald-400 transition-all cursor-pointer shadow-sm">📊 리포트</button>
                                    </div>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                </div>

                <h2 className="text-2xl md:text-[28px] font-black text-slate-900 dark:text-white mb-2 tracking-tight">KOSPI 대비 포트폴리오 성과 (Alpha)</h2>
                <p className="text-[14px] font-extrabold text-slate-500 mb-6 tracking-tight">※ 매도(Exit)가 완료된 종목의 실현 수익률을 바탕으로 KOSPI 지수와 비교합니다.</p>

                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-5 md:p-4 rounded-2xl shadow-sm w-full mb-12 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row justify-between md:items-end mb-4 md:mb-5 relative z-10 border-b border-slate-200 dark:border-slate-800/80 pb-3">
                        <div>
                            <div className="flex items-baseline gap-4 mt-2">
                                <h1 className="text-4xl md:text-5xl font-black tracking-tighter" style={{ color: mainColor }}>
                                    {lastChartData.cum > 0 ? '+' : ''}<CountUp value={lastChartData.cum} decimals={2} duration={1400} />%
                                </h1>
                                <span className={`text-[14px] md:text-[15px] font-black ${lastChartData.alpha >= 0 ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>
                                    ▲ {lastChartData.alpha > 0 ? '+' : ''}<CountUp value={lastChartData.alpha} decimals={2} duration={1400} />% (Alpha)
                                </span>
                            </div>
                        </div>
                        <div className="text-left md:text-right flex flex-col md:items-end gap-1 mt-4 md:mt-0">
                            <div className="flex gap-2">
                                {['1W', '1M', 'All'].map(range => (
                                    <button key={range} onClick={() => setTimeRange(range)} className={`text-[12px] font-black px-3 py-1.5 rounded-lg transition-all cursor-pointer hover:-translate-y-0.5 border shadow-sm ${timeRange === range ? 'bg-[#FF4B4B] border-[#FF4B4B] text-white' : 'bg-white dark:bg-[#0B1120] border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>
                                        {range}
                                    </button>
                                ))}
                            </div>
                            <div className="text-[13px] font-extrabold text-slate-400 mt-2 tracking-tight">
                                Day <span style={{ color: mainColor }}>{lastDayRet > 0 ? '+' : ''}<CountUp value={lastDayRet} decimals={2} /></span>% &nbsp;&nbsp;
                                KOSPI <span className="text-[#64748B]">{lastChartData.kospi_cum > 0 ? '+' : ''}<CountUp value={lastChartData.kospi_cum} decimals={2} /></span>%
                            </div>
                        </div>
                    </div>

                    <div className="w-full h-[300px] md:h-[400px] relative z-10">
                        {displayChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={displayChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorCum" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={mainColor} stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor={mainColor} stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />
                                    <XAxis dataKey="date" tick={{fill: '#94A3B8', fontSize: 11, fontWeight: '800'}} tickLine={false} axisLine={false} tickMargin={12} minTickGap={40} tickFormatter={(val) => val ? String(val).substring(5).replace('-', '.') : ''}/>
                                    <YAxis tick={{fill: '#94A3B8', fontSize: 11, fontWeight: '800'}} tickLine={false} axisLine={false} tickFormatter={(value) => value !== undefined && value !== null ? `${value > 0 ? '+' : ''}${value}%` : ''} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(100,116,139,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                    <Line type="monotone" dataKey="kospi_cum" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={true} animationDuration={1600} animationEasing="ease-out" />
                                    <Area type="monotone" dataKey="cum" stroke={mainColor} strokeWidth={3} fillOpacity={1} fill="url(#colorCum)" activeDot={{r: 6, fill: mainColor, strokeWidth: 2, stroke: '#111827'}} isAnimationActive={true} animationDuration={1800} animationEasing="ease-out" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center font-extrabold text-slate-500">차트를 생성할 데이터가 부족합니다.</div>
                        )}
                    </div>
                </div>
            </div>
          )}

          {/* ===================== WATCHLIST TAB ===================== */}
          {activeTab === "Watchlist" && (
              <div className="animate-in fade-in duration-300 w-full">
                <div className="w-full bg-white dark:bg-transparent md:border border-slate-200 dark:border-slate-800 md:rounded-2xl overflow-hidden md:shadow-sm w-full mb-12">
                    <div className="w-full">
                        <div className="hidden md:flex px-4 md:px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-transparent">
                            <div className="w-[10%] text-[13px] md:text-[14px] font-extrabold text-slate-500 text-center">순위</div>
                            <div className="w-[30%] text-[13px] md:text-[14px] font-extrabold text-slate-500">종목명</div>
                            <div className="w-[20%] text-[13px] md:text-[14px] font-extrabold text-slate-500 text-right">현재가</div>
                            <div className="w-[15%] text-[13px] md:text-[14px] font-extrabold text-slate-500 text-center">통과</div>
                            <div className="w-[15%] text-[13px] md:text-[14px] font-extrabold text-slate-500 text-center">랭킹점수</div>
                            <div className="w-[10%] text-[13px] md:text-[14px] font-extrabold text-slate-500 text-center">액션</div>
                        </div>

                        {filWatchlist.length === 0 ? <div className="p-8 text-center text-slate-500 font-extrabold">종목이 없습니다.</div> : filWatchlist.map((c, idx) => {
                          const dock = getDockScale(idx, hoverWatchIdx);
                          return (
                            <div key={idx} onMouseEnter={() => setHoverWatchIdx(idx)} onMouseLeave={() => setHoverWatchIdx(null)} style={{ transform: `translateY(${dock.lift}px) scale(${dock.scale})`, zIndex: dock.scale > 1 ? 10 : 1 }} className="qd-dock-row flex flex-col md:flex-row md:items-center px-4 md:px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#111827] md:bg-transparent rounded-xl md:rounded-none mb-3 md:mb-0 shadow-sm md:shadow-none hover:bg-slate-50 transition-colors w-full gap-3 md:gap-0">
                                <div className="flex justify-between items-center w-full md:w-[40%] pr-0 md:pr-4">
                                    <div className="flex items-center gap-3 w-full">
                                        <span className="text-[12px] font-extrabold text-white bg-blue-500 rounded-md px-2 py-0.5 md:bg-transparent md:text-slate-500 md:px-0 md:py-0 w-auto md:w-[25%] text-center">{idx+1}</span>
                                        <span className="text-[16px] font-black text-slate-900 dark:text-white truncate md:w-[75%]">{c.name}</span>
                                    </div>
                                    <div className="md:hidden text-[15px] font-black text-slate-900 shrink-0">₩{Math.round(c.current_price || 0).toLocaleString()}</div>
                                </div>
                                <div className="hidden md:block w-[20%] text-[15px] font-black text-slate-900 text-right">₩{Math.round(c.current_price || 0).toLocaleString()}</div>
                                <div className="flex justify-between items-center w-full md:w-[30%]">
                                    <div className="flex flex-col md:flex-row md:w-1/2 md:justify-center text-left md:text-center">
                                        <span className="text-[11px] font-bold text-slate-400 md:hidden mb-0.5">통과 관문</span>
                                        <span className="text-[14px] md:text-[15px] font-extrabold text-slate-600">{c.total_pass}/6</span>
                                    </div>
                                    <div className="flex flex-col md:flex-row md:w-1/2 md:justify-center text-right md:text-center">
                                        <span className="text-[11px] font-bold text-slate-400 md:hidden mb-0.5">랭킹 점수</span>
                                        <span className="text-[15px] md:text-[16px] font-black text-slate-500">{(c.factor_score || 0).toFixed(2)}점</span>
                                    </div>
                                </div>
                                <div className="w-full md:w-[10%] flex justify-end md:justify-center mt-2 md:mt-0 pt-3 md:pt-0 border-t border-slate-100 md:border-0 px-2">
                                    <button onClick={() => handleStockClick(c.symbol, c)} className="px-4 md:px-3 py-1.5 md:w-full bg-slate-100 text-slate-600 text-[13px] font-black rounded-lg border border-slate-200 hover:bg-slate-200 hover:text-blue-600 hover:border-blue-400 transition-all cursor-pointer shadow-sm">📊 리포트</button>
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
              // 🌟 부모의 팝업 함수인 handleStockClick을 넘겨줍니다!
              <QuantScreener screenerData={data.screener} onStockClick={handleStockClick} />
          )}

          {/* ===================== HISTORY TAB ===================== */}
          {activeTab === "History" && (
              <div className="animate-in fade-in duration-300 w-full">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 w-full">
                      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-center hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
                          <p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">총 매도 횟수</p>
                          <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-1"><CountUp value={sellTrades.length} decimals={0} />회</p>
                          <p className="text-[11px] md:text-[12px] font-extrabold text-slate-400">승 {wins.length} / 패 {losses.length}</p>
                      </div>
                      <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-center hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
                          <p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">🎯 승률 (타율)</p>
                          <p className="text-2xl md:text-3xl font-black text-[#3B82F6]"><CountUp value={winRate} decimals={1} />%</p>
                      </div>
                      <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-center hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
                          <p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">⚖️ 손익비</p>
                          <p className="text-2xl md:text-3xl font-black text-slate-900 mb-1">{avgLoss !== 0 ? <CountUp value={Math.abs(avgWin/avgLoss)} decimals={2} /> : "0.00"}</p>
                          <p className="text-[11px] md:text-[12px] font-extrabold text-slate-400">평균 {avgWin.toFixed(2)}% / {avgLoss.toFixed(2)}%</p>
                      </div>
                      <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-center hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
                          <p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">💰 주당 누적 실현손익금</p>
                          <p className={`text-xl md:text-2xl lg:text-3xl font-black tracking-tight ${totalProfitAmt > 0 ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>
                              <CountUp value={totalProfitAmt} decimals={0} formatter={(v) => parseInt(v).toLocaleString('ko-KR')} />원
                          </p>
                      </div>
                  </div>

                  <div className="w-full bg-white md:border border-slate-200 md:rounded-2xl overflow-hidden md:shadow-sm w-full mb-12">
                      <div className="w-full">
                          <div className="hidden md:flex px-4 md:px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                              <div className="w-[15%] text-[14px] font-extrabold text-slate-500">매도 일자</div>
                              <div className="w-[20%] text-[14px] font-extrabold text-slate-500">종목명</div>
                              <div className="w-[15%] text-[14px] font-extrabold text-slate-500 text-right">진입가</div>
                              <div className="w-[15%] text-[14px] font-extrabold text-slate-500 text-right">매도가</div>
                              <div className="w-[15%] text-[14px] font-extrabold text-slate-500 text-right">실현손익(%)</div>
                              <div className="w-[20%] text-[14px] font-extrabold text-slate-500 text-right">매도 사유</div>
                          </div>
                          {sellTrades.length === 0 ? <div className="p-8 text-center text-slate-500 font-extrabold w-full">매도 이력이 없습니다.</div> : sellTrades.map((t, idx) => {
                                const entryPrice = t.trade_price / (1 + ((t.return_rate || 0) / 100));
                                const dock = getDockScale(idx, hoverHistoryIdx);
                                return (
                                  <div key={idx} onMouseEnter={() => setHoverHistoryIdx(idx)} onMouseLeave={() => setHoverHistoryIdx(null)} style={{ transform: `translateY(${dock.lift}px) scale(${dock.scale})`, zIndex: dock.scale > 1 ? 10 : 1 }} className="qd-dock-row flex flex-col md:flex-row md:items-center px-4 md:px-5 py-4 border-b border-slate-200 bg-white md:bg-transparent rounded-xl md:rounded-none mb-3 md:mb-0 shadow-sm md:shadow-none hover:bg-slate-50 transition-colors w-full gap-3 md:gap-0">
                                      <div className="flex justify-between items-center w-full md:w-[35%] pr-0 md:pr-4">
                                          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 w-full">
                                              <span className="text-[11px] font-extrabold text-slate-400 md:w-[42%] md:text-[14px] md:text-slate-500">{t.trade_date}</span>
                                              <span className="text-[16px] md:text-[16px] font-black text-slate-900 md:w-[58%] truncate">{t.name}</span>
                                          </div>
                                          <div className={`md:hidden text-[16px] font-black shrink-0 ${(t.return_rate || 0) > 0 ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>{(t.return_rate || 0) > 0 ? "+" : ""}{(t.return_rate || 0).toFixed(2)}%</div>
                                      </div>
                                      <div className="flex justify-between items-center w-full md:w-[30%]">
                                          <div className="flex flex-col md:w-1/2 text-left md:text-right">
                                              <span className="text-[11px] font-bold text-slate-400 md:hidden mb-0.5">진입가</span>
                                              <span className="text-[14px] md:text-[15px] font-extrabold text-slate-600">₩{Math.round(entryPrice).toLocaleString()}</span>
                                          </div>
                                          <div className="flex flex-col md:w-1/2 text-right">
                                              <span className="text-[11px] font-bold text-slate-400 md:hidden mb-0.5">매도가</span>
                                              <span className="text-[14px] md:text-[15px] font-black text-slate-800">₩{Math.round(t.trade_price || 0).toLocaleString()}</span>
                                          </div>
                                      </div>
                                      <div className={`hidden md:block w-[15%] text-[15px] md:text-[16px] font-black text-right ${(t.return_rate || 0) > 0 ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>{(t.return_rate || 0) > 0 ? "+" : ""}{(t.return_rate || 0).toFixed(2)}%</div>
                                      <div className="w-full md:w-[20%] text-[12px] md:text-[13px] font-extrabold text-slate-500 text-left md:text-right mt-1 md:mt-0 pt-2 md:pt-0 border-t border-slate-100 md:border-0 leading-snug truncate" title={t.reason}>
                                          <span className="font-bold text-slate-400 md:hidden mr-1">사유:</span>
                                          {t.reason}
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  </div>
              </div>
          )}

          {/* ===================== WHITEPAPER TAB ===================== */}
          {activeTab === "Whitepaper" && (
              <div className="animate-in fade-in duration-500 w-full max-w-4xl mx-auto pb-10">
                  <div className="mb-12">
                      <div className="flex items-center justify-between cursor-pointer group mb-6 px-2" onClick={() => setIsEntryOpen(!isEntryOpen)}>
                          <div className="flex items-center gap-3">
                              <Rocket className="text-[#FF4B4B] group-hover:scale-110 transition-transform" size={24} />
                              <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight group-hover:text-[#FF4B4B] transition-colors">매수 진입 6대 관문 (Entry Gates)</h3>
                          </div>
                          <ChevronDown className={`text-slate-400 transition-transform duration-300 ${isEntryOpen ? 'rotate-180' : ''}`} size={24} />
                      </div>

                      {isEntryOpen && (
                          <div className="grid grid-cols-1 gap-4 animate-in slide-in-from-top-2 duration-300 opacity-100">
                              <div onMouseMove={handleSpotlightMove} className="gate-spotlight bg-white border border-slate-200 p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl hover:border-[#FF4B4B] hover:-translate-y-1 transition-all duration-300 group flex flex-col md:flex-row md:items-center gap-4 md:gap-8 cursor-default">
                                  <div className="md:w-1/4 shrink-0 flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#FF4B4B] font-black text-lg shadow-sm group-hover:bg-[#FF4B4B] group-hover:text-white transition-colors">A</div>
                                      <h4 className="font-black text-lg text-slate-900">성장성 <span className="text-[13px] text-slate-400 block font-bold">Growth Composite</span></h4>
                                  </div>
                                  <div className="md:w-3/4">
                                      <p className="text-[15px] md:text-[16px] font-extrabold text-slate-600 leading-loose">
                                          최근 실적 기준 <span className="text-[#FF4B4B]">매출액, 영업이익, 당기순이익의 YoY 성장률(%)</span>을 종합 산출하여 기초 체력이 확실하게 검증된 흑자 성장 기업만 선별합니다.
                                      </p>
                                  </div>
                              </div>
                              <div onMouseMove={handleSpotlightMove} className="gate-spotlight bg-white border border-slate-200 p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl hover:border-[#FF4B4B] hover:-translate-y-1 transition-all duration-300 group flex flex-col md:flex-row md:items-center gap-4 md:gap-8 cursor-default">
                                  <div className="md:w-1/4 shrink-0 flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#FF4B4B] font-black text-lg shadow-sm group-hover:bg-[#FF4B4B] group-hover:text-white transition-colors">B</div>
                                      <h4 className="font-black text-lg text-slate-900">방어력 <span className="text-[13px] text-slate-400 block font-bold">Dynamic MDD</span></h4>
                                  </div>
                                  <div className="md:w-3/4">
                                      <p className="text-[15px] md:text-[16px] font-extrabold text-slate-600 leading-loose">
                                          최근 60일 고점 대비 하락폭(MDD)을 추적합니다. 단순히 고정된 비율을 쓰지 않고, 종목별 변동성지표인 <span className="text-[#FF4B4B]">ATR(Average True Range)에 연동하여 한계 하락폭을 동적으로 계산</span>해 맷집이 약한 종목을 차단합니다.
                                      </p>
                                  </div>
                              </div>
                              <div onMouseMove={handleSpotlightMove} className="gate-spotlight bg-white border border-slate-200 p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl hover:border-[#FF4B4B] hover:-translate-y-1 transition-all duration-300 group flex flex-col md:flex-row md:items-center gap-4 md:gap-8 cursor-default">
                                  <div className="md:w-1/4 shrink-0 flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#FF4B4B] font-black text-lg shadow-sm group-hover:bg-[#FF4B4B] group-hover:text-white transition-colors">C</div>
                                      <h4 className="font-black text-lg text-slate-900">유동성 <span className="text-[13px] text-slate-400 block font-bold">Liquidity</span></h4>
                                  </div>
                                  <div className="md:w-3/4">
                                      <p className="text-[15px] md:text-[16px] font-extrabold text-slate-600 leading-loose">
                                          원활한 진입과 슬리피지(Slippage) 없는 청산을 위해 <span className="text-[#FF4B4B]">최근 20일 일평균 거래대금이 최소 50억 원 이상</span>인 메이저 종목들 사이에서만 트레이딩을 수행합니다.
                                      </p>
                                  </div>
                              </div>
                              <div onMouseMove={handleSpotlightMove} className="gate-spotlight bg-white border border-slate-200 p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl hover:border-[#FF4B4B] hover:-translate-y-1 transition-all duration-300 group flex flex-col md:flex-row md:items-center gap-4 md:gap-8 cursor-default">
                                  <div className="md:w-1/4 shrink-0 flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#FF4B4B] font-black text-lg shadow-sm group-hover:bg-[#FF4B4B] group-hover:text-white transition-colors">D</div>
                                      <h4 className="font-black text-lg text-slate-900">추세 <span className="text-[13px] text-slate-400 block font-bold">Trend Alignment</span></h4>
                                  </div>
                                  <div className="md:w-3/4">
                                      <p className="text-[15px] md:text-[16px] font-extrabold text-slate-600 leading-loose">
                                          현재가가 20일 이동평균선 위에, 20일선이 60일선 위에 위치한 <span className="text-[#FF4B4B]">완벽한 정배열 상승 기류</span> 종목만 선별합니다. 동시에 ATR 기반의 동적 이격도 제한(15~50% 캡)을 적용해 이미 과열된 상투를 잡지 않습니다.
                                      </p>
                                  </div>
                              </div>
                              <div onMouseMove={handleSpotlightMove} className="gate-spotlight bg-white border border-slate-200 p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl hover:border-[#FF4B4B] hover:-translate-y-1 transition-all duration-300 group flex flex-col md:flex-row md:items-center gap-4 md:gap-8 cursor-default">
                                  <div className="md:w-1/4 shrink-0 flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#FF4B4B] font-black text-lg shadow-sm group-hover:bg-[#FF4B4B] group-hover:text-white transition-colors">E</div>
                                      <h4 className="font-black text-lg text-slate-900">가격 돌파 <span className="text-[13px] text-slate-400 block font-bold">Price Breakout</span></h4>
                                  </div>
                                  <div className="md:w-3/4">
                                      <p className="text-[15px] md:text-[16px] font-extrabold text-slate-600 leading-loose">
                                          최근 3개월(60일) 최고가의 90% 이상 매물대를 2일 연속 돌파한 종목을 포착합니다. 단, <span className="text-[#FF4B4B]">60일 평균 대비 2배 이상의 대량 거래량</span>이 동반될 경우 강력한 신호로 판단하여 1일 차라도 즉시 진입을 허용합니다.
                                      </p>
                                  </div>
                              </div>
                              <div onMouseMove={handleSpotlightMove} className="gate-spotlight bg-white border border-slate-200 p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl hover:border-[#FF4B4B] hover:-translate-y-1 transition-all duration-300 group flex flex-col md:flex-row md:items-center gap-4 md:gap-8 cursor-default">
                                  <div className="md:w-1/4 shrink-0 flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#FF4B4B] font-black text-lg shadow-sm group-hover:bg-[#FF4B4B] group-hover:text-white transition-colors">F</div>
                                      <h4 className="font-black text-lg text-slate-900">수급 <span className="text-[13px] text-slate-400 block font-bold">Volume Surge</span></h4>
                                  </div>
                                  <div className="md:w-3/4">
                                      <p className="text-[15px] md:text-[16px] font-extrabold text-slate-600 leading-loose">
                                          가격 상승을 뒷받침하는 강력한 자금 유입을 검증합니다. 최근 5일 평균 거래량과 당일 거래량이 모두 <span className="text-[#FF4B4B]">60일 평균 대비 1.5배 이상 폭발</span>한 모멘텀 주도주만 선별합니다.
                                      </p>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>

                  {/* 생존 매도 섹션 */}
                  <div>
                      <div className="flex items-center justify-between cursor-pointer group mb-6 px-2" onClick={() => setIsExitOpen(!isExitOpen)}>
                          <div className="flex items-center gap-3">
                              <ShieldAlert className="text-[#3B82F6] group-hover:scale-110 transition-transform" size={24} />
                              <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight group-hover:text-[#3B82F6] transition-colors">생존 매도 3대 원칙 (Exit Signals)</h3>
                          </div>
                          <ChevronDown className={`text-slate-400 transition-transform duration-300 ${isExitOpen ? 'rotate-180' : ''}`} size={24} />
                      </div>

                      {isExitOpen && (
                          <div className="grid grid-cols-1 gap-4 animate-in slide-in-from-top-2 duration-300 opacity-100">
                              <div onMouseMove={handleSpotlightMove} style={{ '--spotlight-color': 'rgba(59,130,246,0.14)' }} className="gate-spotlight bg-white border border-slate-200 p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl hover:border-[#3B82F6] hover:-translate-y-1 transition-all duration-300 group flex flex-col md:flex-row md:items-center gap-4 md:gap-8 cursor-default">
                                  <div className="md:w-1/4 shrink-0 flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#3B82F6] font-black text-lg shadow-sm group-hover:bg-[#3B82F6] group-hover:text-white transition-colors">1</div>
                                      <h4 className="font-black text-lg text-slate-900">동적 손절 <span className="text-[13px] text-slate-400 block font-bold">Trailing Stop</span></h4>
                                  </div>
                                  <div className="md:w-3/4">
                                      <p className="text-[15px] md:text-[16px] font-extrabold text-slate-600 leading-loose">
                                          고정된 비율(-5% 등) 대신 종목별 일간 변동성(ATR) 수치에 연동된 손절선을 그립니다. 주가가 오르면 손절선도 추적하여 올라가며, <span className="text-[#3B82F6]">+15% 이상 수익권 진입 시 방어선 추적 배수를 0.6배로 타이트하게 좁혀</span> 실현 수익을 철통같이 보호합니다.
                                      </p>
                                  </div>
                              </div>
                              <div onMouseMove={handleSpotlightMove} style={{ '--spotlight-color': 'rgba(59,130,246,0.14)' }} className="gate-spotlight bg-white border border-slate-200 p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl hover:border-[#3B82F6] hover:-translate-y-1 transition-all duration-300 group flex flex-col md:flex-row md:items-center gap-4 md:gap-8 cursor-default">
                                  <div className="md:w-1/4 shrink-0 flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#3B82F6] font-black text-lg shadow-sm group-hover:bg-[#3B82F6] group-hover:text-white transition-colors">2</div>
                                      <h4 className="font-black text-lg text-slate-900">추세 붕괴 <span className="text-[13px] text-slate-400 block font-bold">Trend Breakdown</span></h4>
                                  </div>
                                  <div className="md:w-3/4">
                                      <p className="text-[15px] md:text-[16px] font-extrabold text-slate-600 leading-loose">
                                          주가의 20일선 이탈, 단기 이평선 데드크로스(10일 &lt; 20일), 20일선 기울기 하락 전환이라는 3대 하락 징후를 감시합니다. 노이즈 방지를 위해 <span className="text-[#3B82F6]">시장 국면에 따라 다수결(강세장 2개 충족, 약세장 1개 충족) 규칙을 적용</span>하여 하락 엔진이 켜지기 전 신속히 청산합니다.
                                      </p>
                                  </div>
                              </div>
                              <div onMouseMove={handleSpotlightMove} style={{ '--spotlight-color': 'rgba(59,130,246,0.14)' }} className="gate-spotlight bg-white border border-slate-200 p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl hover:border-[#3B82F6] hover:-translate-y-1 transition-all duration-300 group flex flex-col md:flex-row md:items-center gap-4 md:gap-8 cursor-default">
                                  <div className="md:w-1/4 shrink-0 flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#3B82F6] font-black text-lg shadow-sm group-hover:bg-[#3B82F6] group-hover:text-white transition-colors">3</div>
                                      <h4 className="font-black text-lg text-slate-900">모멘텀 소진 <span className="text-[13px] text-slate-400 block font-bold">Momentum Exhaust</span></h4>
                                  </div>
                                  <div className="md:w-3/4">
                                      <p className="text-[15px] md:text-[16px] font-extrabold text-slate-600 leading-loose">
                                          초과 수익 상단을 제한하는 '목표가 고정 익절'을 전면 폐지했습니다. 단, 수익권에서 <span className="text-[#3B82F6]">최근 5일 거래량이 20일 평균의 80% 밑으로 급감하고 주가가 10일선을 하향 이탈</span>하면 시장의 관심이 소멸한 것으로 판단하여 즉시 실현 익절합니다.
                                      </p>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          )}
        </div>
      )}

      {/* RISK MODAL */}
      {riskStock && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl shadow-2xl p-6 md:p-8 relative animate-in fade-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">🚨 {riskStock.name} Risk 분석</h3>
                    <button onClick={() => setRiskStock(null)} className="p-1.5 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"><X size={20}/></button>
                </div>
                <p className="text-[14px] md:text-[15px] font-extrabold text-slate-600 mb-6 pb-4 border-b border-slate-200">
                    현재가: ₩{Math.round(riskStock.current_price || 0).toLocaleString()} &nbsp;|&nbsp; 손절가: ₩{Math.round(riskStock.stop_price || 0).toLocaleString()}
                </p>
                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between text-[14px] font-black mb-2"><span>OVERALL EXIT PROXIMITY</span><span><CountUp value={riskStock.exit_risk || 0} decimals={2} />%</span></div>
                        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden"><div className={`qd-bar-fill h-3 rounded-full ${(riskStock.exit_risk || 0) > 70 ? 'bg-[#FF4B4B]' : 'bg-[#00B464]'}`} style={{width: `${riskStock.exit_risk || 0}%`}}></div></div>
                    </div>
                    <div>
                        <div className="flex justify-between text-[13px] md:text-[14px] font-extrabold mb-2 text-slate-500"><span>Trailing Stop (ATR) 추정</span><span><CountUp value={Math.max(0, (riskStock.exit_risk || 0) - 15)} decimals={2} />%</span></div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden"><div className="qd-bar-fill bg-slate-400 h-2 rounded-full" style={{width: `${Math.max(0, (riskStock.exit_risk || 0) - 15)}%`}}></div></div>
                    </div>
                    <div>
                        <div className="flex justify-between text-[13px] md:text-[14px] font-extrabold mb-2 text-slate-500"><span>Trend Break (MA20) 추정</span><span><CountUp value={Math.max(0, (riskStock.exit_risk || 0) - 5)} decimals={2} />%</span></div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden"><div className="qd-bar-fill bg-slate-400 h-2 rounded-full" style={{width: `${Math.max(0, (riskStock.exit_risk || 0) - 5)}%`}}></div></div>
                    </div>
                </div>
                <div className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-2 gap-4">
                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">진입가 (Entry)</p><p className="text-lg md:text-xl font-black text-slate-900">₩{Math.round(riskStock.entry_price || 0).toLocaleString()}</p></div>
                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">보유 수익률 (P&L)</p><p className={`text-lg md:text-xl font-black ${(riskStock.return_rate || 0) > 0 ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>{(riskStock.return_rate || 0) > 0 ? '+' : ''}<CountUp value={riskStock.return_rate || 0} decimals={2} />%</p></div>
                </div>
            </div>
        </div>
      )}

      {/* POSITION SIZING MODAL */}
      {backtestStock && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 w-full max-w-[720px] min-h-[40vh] max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-5 border-b border-slate-100">
                    <h3 className="text-xl md:text-2xl font-black text-slate-900">📐 {backtestDisplayName || backtestStock.name} 포지션사이징</h3>
                    <button onClick={() => setBacktestStock(null)} className="p-1.5 bg-slate-100 text-slate-500 hover:text-slate-900 rounded-full transition-colors cursor-pointer"><X size={20}/></button>
                </div>
                <div className="p-6 md:p-8 overflow-y-auto flex-1">
                    {!data.strategyReport ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 py-16">
                            <p className="font-black text-[15px] md:text-lg text-center">전략 데이터가 없습니다.<br/>다음 배치(Cron) 실행 후 다시 확인해 주세요.</p>
                        </div>
                    ) : (
                        <>
                            <button onClick={() => { setBacktestStock(null); setIsStrategyModalOpen(true); }} className="text-[12px] font-black text-blue-600 underline underline-offset-2 mb-6 cursor-pointer">
                                ⚡ 이 전략 자체의 신뢰도(트랙레코드)는 여기서 확인하세요
                            </button>
                            {backtestSizing ? (
                              <div className="p-5 md:p-6 bg-slate-50 rounded-2xl border border-slate-200 mb-6">
                                  <p className="text-[14px] font-black text-slate-900 mb-4">🎯 {backtestDisplayName} 권장 수량/투입금액</p>
                                  {backtestSizing.hold_recommended && (
                                      <div className="mb-4 p-3 rounded-xl bg-orange-50 border border-orange-300 text-[12.5px] font-extrabold text-orange-600">
                                          ⚠️ {backtestSizing.hold_reason}
                                      </div>
                                  )}
                                  <div className="flex items-baseline gap-3 mb-5">
                                      <span className="text-3xl md:text-4xl font-black text-slate-900">{formatNumber(backtestSizing.recommended_quantity)}주</span>
                                      <span className="text-[14px] font-extrabold text-slate-500">₩{formatNumber(backtestSizing.recommended_position_value)}</span>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                                          <p className="text-[11px] font-extrabold text-slate-500 mb-1">진입가 / 손절가</p>
                                          <p className="text-[13px] font-black text-slate-900">₩{formatNumber(backtestSizing.entry_price)} / ₩{formatNumber(backtestSizing.stop_price)}</p>
                                      </div>
                                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                                          <p className="text-[11px] font-extrabold text-slate-500 mb-1">ATR 리스크</p>
                                          <p className="text-[13px] font-black text-slate-900">{backtestSizing.atr_risk_pct?.toFixed(2)}%</p>
                                      </div>
                                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                                          <p className="text-[11px] font-extrabold text-slate-500 mb-1">기준 수량(ATR)</p>
                                          <p className="text-[13px] font-black text-slate-900">{formatNumber(backtestSizing.base_quantity)}주</p>
                                      </div>
                                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                                          <p className="text-[11px] font-extrabold text-slate-500 mb-1">현재 시장 레짐</p>
                                          <p className="text-[13px] font-black text-slate-900">{backtestSymbolReport?.regime || '-'}</p>
                                      </div>
                                  </div>
                                  <p className="text-[11.5px] font-extrabold text-slate-500 mb-2">권장 수량 = 기준 수량 × 켈리 배율 × 신뢰도 배율</p>
                                  <div className="grid grid-cols-3 gap-3">
                                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                                          <p className="text-[11px] font-extrabold text-slate-500 mb-1">프랙셔널 켈리(1/4)</p>
                                          <p className="text-[13px] font-black text-slate-900">{(backtestSizing.kelly_scale * 100)?.toFixed(0)}%</p>
                                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">원값 {backtestSizing.kelly_fraction_raw} → 캡 적용 {backtestSizing.kelly_fraction_capped}</p>
                                      </div>
                                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                                          <p className="text-[11px] font-extrabold text-slate-500 mb-1">신뢰도 배율</p>
                                          <p className="text-[13px] font-black text-slate-900">{(backtestSizing.confidence_scale * 100)?.toFixed(0)}%</p>
                                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">{getConfidenceMeta(backtestSizing.confidence_level).text}</p>
                                      </div>
                                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                                          <p className="text-[11px] font-extrabold text-slate-500 mb-1">최종 축소 배율</p>
                                          <p className="text-[13px] font-black text-[#FF4B4B]">{(backtestSizing.final_scale * 100)?.toFixed(0)}%</p>
                                      </div>
                                  </div>
                              </div>
                            ) : (
                              <div className="p-5 md:p-6 bg-slate-50 rounded-2xl border border-slate-200 mb-6 text-center">
                                  <p className="text-[13px] font-bold text-slate-400">이 종목에 대한 포지션사이징 데이터가 없습니다.</p>
                              </div>
                            )}
                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 mb-6">
                                <p className="text-[12px] font-extrabold text-slate-500 mb-3">거래 비용 가정</p>
                                <div className="flex justify-between text-[13px] font-black text-slate-700">
                                    <span>진입 {data.strategyReport.cost_assumptions?.entry_cost_pct}%</span>
                                    <span>청산 {data.strategyReport.cost_assumptions?.exit_cost_pct}%</span>
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <p className="text-[14px] font-black text-slate-900">📌 이 종목 자체의 과거 신호 이력 ({backtestOwnTrades.length}건)</p>
                                    <Info size={14} className="text-slate-400" />
                                </div>
                                <p className="text-[12px] font-extrabold text-slate-500 mb-4 leading-relaxed">
                                    {backtestSymbolReport?.own_history_note || '표본이 매우 작을 수 있어 참고용 보조지표로만 사용하세요. 신뢰도 판단은 전략 신뢰도 배너를 기준으로 합니다.'}
                                </p>
                                {backtestOwnTrades.length === 0 ? (
                                    <p className="text-[13px] font-bold text-slate-400">해당 종목의 과거 신호 이력이 없습니다.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {backtestOwnTrades.map((t, i) => (
                                            <div key={i} className="flex flex-wrap items-center justify-between gap-2 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                                <div className="text-[12px] font-extrabold text-slate-500">{t.entry_date} → {t.exit_date} ({t.hold_days}일 보유)</div>
                                                <div className="text-[13px] font-black text-slate-700">₩{formatNumber(t.entry_price)} → ₩{formatNumber(t.exit_price)}</div>
                                                <div className={`text-[14px] font-black ${(t.return_pct || 0) >= 0 ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>{(t.return_pct || 0) > 0 ? '+' : ''}{t.return_pct?.toFixed(2)}%</div>
                                                <div className="text-[12px] font-extrabold text-slate-400 w-full md:w-auto">{t.reason}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* STRATEGY MODAL */}
      {isStrategyModalOpen && strategyTrackRecord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 w-full max-w-[900px] min-h-[50vh] max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-5 border-b border-slate-100">
                    <div>
                        <h3 className="text-xl md:text-2xl font-black text-slate-900">⚡ 전략 검증 리포트</h3>
                        <p className="text-[12px] font-bold text-slate-500 mt-1">생성 시각 {data.strategyReport?.generated_at} · 참고 기간 {data.strategyReport?.trading_days}거래일 · 전체 유니버스 기준</p>
                    </div>
                    <button onClick={() => setIsStrategyModalOpen(false)} className="p-1.5 bg-slate-100 text-slate-500 hover:text-slate-900 rounded-full transition-colors cursor-pointer"><X size={20}/></button>
                </div>
                <div className="p-6 md:p-8 overflow-y-auto flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-5">
                        {(() => {
                            const rMeta = getRegimeMeta(strategyRegime);
                            const cMeta = getConfidenceMeta(strategyTrackRecord.confidence_level);
                            return (
                                <>
                                    <span className={`text-[12px] font-black px-3 py-1.5 rounded-full border ${rMeta.bg} ${rMeta.border}`} style={{ color: rMeta.color }}>● {strategyRegime ? rMeta.label : '레짐 확인중'}</span>
                                    <span className={`text-[12px] font-black px-3 py-1.5 rounded-full border ${cMeta.bg} ${cMeta.border}`}>{cMeta.text}</span>
                                </>
                            );
                        })()}
                    </div>
                    <p className="text-[12.5px] font-extrabold text-slate-500 mb-6 leading-relaxed">
                        {strategyTrackRecord.confidence_note} 오늘 확정/보유 중인 종목들은 모두 이 전략(관문 A~F)에서 나온 신호이며, 아래 통계는 특정 종목이 아니라 <b>전략 자체</b>가 지난 {data.strategyReport?.trading_days}거래일 동안 전체 시장에서 어떻게 작동했는지를 보여줍니다.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-2">
                        {strategyHeadlineMetrics.map((m, i) => (
                            <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <p className="text-[11px] font-extrabold text-slate-500 mb-1">{m.label}</p>
                                <p className="text-[15px] font-black text-slate-900">{m.value}</p>
                                {m.sub && <p className="text-[10.5px] font-bold text-slate-400 mt-0.5">{m.sub}</p>}
                            </div>
                        ))}
                    </div>
                    <div className="mt-5 mb-8">
                        <p className="text-[12px] font-black text-slate-500 mb-2">전략 누적 수익률 추이 (벤치마크 대비 초과수익 {strategyTrackRecord.excess_return_pct > 0 ? '+' : ''}{strategyTrackRecord.excess_return_pct?.toFixed(1)}%)</p>
                        <div className="w-full h-[220px]">
                            {strategyEquityChartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={strategyEquityChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />
                                        <XAxis dataKey="date" tick={{fill: '#94A3B8', fontSize: 10, fontWeight: '800'}} tickLine={false} axisLine={false} minTickGap={40} tickFormatter={(val) => val ? String(val).substring(5).replace('-', '.') : ''} />
                                        <YAxis tick={{fill: '#94A3B8', fontSize: 10, fontWeight: '800'}} tickLine={false} axisLine={false} tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`} />
                                        <Tooltip formatter={(value) => [`${value > 0 ? '+' : ''}${value.toFixed(2)}%`, '전략']} contentStyle={{backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', color: 'white', fontWeight: '900'}} labelStyle={{color: '#94A3B8'}} />
                                        <Line type="monotone" dataKey="strategy" name="전략" stroke="#FF4B4B" strokeWidth={2.5} dot={false} isAnimationActive={true} animationDuration={1400} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-[12px] font-bold text-slate-400">차트 데이터가 없습니다</div>
                            )}
                        </div>
                    </div>
                    {strategyWalkForward && (strategyWalkForward.first_half?.trade_count > 0 || strategyWalkForward.second_half?.trade_count > 0) && (
                        <div>
                            <p className="text-[14px] font-black text-slate-900 mb-1">전반기 vs 후반기 비교</p>
                            <p className="text-[11.5px] font-bold text-slate-500 mb-4">{strategyWalkForward.split_date} 기준으로 나눠, 특정 구간에만 잘 맞는 전략(과최적화)인지 최소한으로 점검합니다.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {[{ label: '전반기', d: strategyWalkForward.first_half }, { label: '후반기', d: strategyWalkForward.second_half }].map((seg, i) => (
                                    <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                        <p className="text-[12px] font-black text-slate-700 mb-2">{seg.label} ({seg.d?.trade_count ?? 0}건)</p>
                                        <div className="grid grid-cols-2 gap-2 text-[12px]">
                                            <div><span className="text-slate-500 font-bold">승률 </span><span className="font-black text-slate-900">{seg.d?.win_rate?.toFixed(1) ?? '-'}%</span></div>
                                            <div><span className="text-slate-500 font-bold">기대값 </span><span className="font-black text-slate-900">{seg.d?.expectancy_pct != null ? `${seg.d.expectancy_pct > 0 ? '+' : ''}${seg.d.expectancy_pct.toFixed(2)}%` : '-'}</span></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* 🌟 REPORT MODAL (통합 종목 팝업 — 선형 차트 및 Math.round 적용 완료) */}
      {selectedStock && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 w-full max-w-[1200px] min-h-[60vh] md:min-h-[75vh] max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-5 border-b border-slate-100">
                    <div className="flex gap-2 items-center">
                        <span className="text-[14px] md:text-[14.5px] font-black text-slate-500">{selectedStock.symbol} · {selectedStock.market || "KOSPI"}</span>
                        {selectedStock.sector && <span className="text-[12px] md:text-[13.5px] font-extrabold px-2.5 py-1 rounded bg-slate-100 text-slate-600">{selectedStock.sector}</span>}
                    </div>
                    <button onClick={() => setSelectedStock(null)} className="p-1.5 bg-slate-100 text-slate-500 hover:text-slate-900 rounded-full transition-colors"><X size={20}/></button>
                </div>
                <div className="p-6 md:p-10 overflow-y-auto flex-1">
                    {reportLoading || selectedStock.isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <RefreshCcw className="animate-spin mb-4 text-blue-500" size={40} />
                            <p className="font-black text-[15px] md:text-lg animate-pulse text-slate-700 text-center">최신 가격/이동평균 데이터를 불러오는 중입니다...</p>
                        </div>
                    ) : selectedStock.fetchError ? (
                        <div className="flex flex-col items-center justify-center h-full text-[#FF4B4B]">
                            <X size={40} className="mb-4" />
                            <p className="font-black text-[15px] md:text-lg text-center">데이터(API)를 불러오는데 실패했습니다.</p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-8 md:mb-10">
                                <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-2 md:mb-4 leading-tight tracking-tight">
                                    {selectedStock.name}
                                </h2>
                                <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight flex items-baseline">
                                    {formatNumber(selectedStock.current_price)} 원 <span className={`text-[16px] md:text-[24px] ml-2 md:ml-3 ${(selectedStock.ret_1m || 0) > 0 ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>{(selectedStock.ret_1m || 0) > 0 ? '+' : ''}{formatPct(selectedStock.ret_1m || 0)} (1M)</span>
                                </h1>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                                <div className="p-6 md:p-8 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm">
                                    <h3 className="text-xl font-black text-slate-900 mb-6">⚡ Quant Scores</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">퀀트 랭킹 스코어</p><p className="text-2xl md:text-3xl font-black text-slate-900"><CountUp value={selectedStock.score || 0} decimals={2} />점</p></div>
                                        <div>
                                            <p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">생존 필터 통과</p>
                                            <p className="text-2xl md:text-3xl font-black text-slate-900">
                                                <CountUp value={selectedStock.total_pass !== undefined ? selectedStock.total_pass : (selectedStock.gates ? Object.values(selectedStock.gates).filter(g => g.pass).length : 0)} decimals={0} /> / 6
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-[11px] md:text-[12px] font-extrabold text-slate-500 mt-6 p-3 bg-white rounded-xl border border-slate-200">💡 평가 지표(점수/게이트)는 가장 최근 배치(Cron) 시점을 기준으로 고정 표시됩니다. (재무 및 차트는 최신 반영)</p>
                                </div>

                                <div className="p-6 md:p-8 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center items-center relative">
                                    <div className="relative w-48 md:w-56 h-28 md:h-32 mb-2 flex justify-center items-end">
                                        <svg viewBox="0 0 200 110" className="w-full h-full absolute bottom-0 overflow-visible">
                                            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="currentColor" className="text-slate-200" strokeWidth="18" strokeLinecap="round" />
                                            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#00B464" strokeWidth="18" strokeLinecap="round" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * animatedScore / 100)} />
                                            {(() => {
                                                const { x, y } = getGaugePoint(animatedScore);
                                                return <circle cx={x} cy={y} r="5" fill="#00B464" className="qd-gauge-glow" style={{ color: '#00B464' }} />;
                                            })()}
                                        </svg>
                                        <div className="absolute bottom-0 w-full flex flex-col items-center justify-end pb-2">
                                            <p className="text-4xl md:text-5xl font-black text-[#00B464] tracking-tighter">{animatedScore.toFixed(1)}</p>
                                        </div>
                                    </div>
                                    <p className="text-[13px] md:text-[14px] font-extrabold text-slate-500 mt-2">퀀트 랭킹 스코어</p>
                                </div>
                            </div>

                            <div className="mb-10">
                                <h5 className="text-xl font-black text-slate-900 mb-4 md:mb-6">Entry Gates (6 conditions)</h5>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
                                    {['A', 'B', 'C', 'D', 'E', 'F'].map((label, idx) => {
                                        const gateKeys = selectedStock.gates ? Object.keys(selectedStock.gates) : [];
                                        const gate = gateKeys.length > idx ? selectedStock.gates[gateKeys[idx]] : { pass: false, name: '-', reason: '-' };
                                        const passed = gate.pass;
                                        return (
                                        <div key={label} className={`p-4 rounded-2xl border ${passed ? 'bg-[#00B464]/10 border-[#00B464]/50 shadow-sm' : 'bg-slate-50 border-slate-200'} flex flex-col justify-between h-24 md:h-28`}>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className={`font-black text-[15px] md:text-[16px] ${passed ? 'text-[#00B464]' : 'text-slate-400'}`}>{label}</span>
                                                <span className="text-[12px]">{passed ? '✔️' : '❌'}</span>
                                            </div>
                                            <div className={`h-1 md:h-1.5 rounded-full w-full mb-2 md:mb-3 ${passed ? 'bg-[#00B464]' : 'bg-slate-200'}`}></div>
                                            <p className={`text-[11px] md:text-[12px] font-extrabold truncate ${passed ? 'text-[#00B464]' : 'text-slate-500'}`} title={gate.reason || gate.name}>{gate.name}</p>
                                        </div>
                                    )})}
                                </div>
                            </div>

                            <div className="p-6 md:p-8 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm mb-10">
                                <h3 className="text-xl font-black text-slate-900 mb-6">📊 Financials & Valuation</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 md:gap-y-8 gap-x-4 md:gap-x-6">
                                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">매출액</p><p className="text-[15px] md:text-[16px] font-black text-slate-900">{formatMarcap(selectedStock.fundamental?.revenue_cur)}</p></div>
                                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">영업이익</p><p className="text-[15px] md:text-[16px] font-black text-slate-900">{formatMarcap(selectedStock.fundamental?.op_profit_cur)}</p></div>
                                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">영업이익률</p><p className="text-[15px] md:text-[16px] font-black text-slate-900">{formatPct(selectedStock.fundamental?.op_margin)}</p></div>
                                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">ROE</p><p className="text-[15px] md:text-[16px] font-black text-[#FF4B4B]">{formatPct(selectedStock.fundamental?.roe)}</p></div>
                                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">시가총액</p><p className="text-[15px] md:text-[16px] font-black text-slate-900">{formatMarcap(selectedStock.fundamental?.marcap_억)}</p></div>
                                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">PER</p><p className="text-[15px] md:text-[16px] font-black text-slate-900">{formatNumber(selectedStock.fundamental?.per)} 배</p></div>
                                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">PBR</p><p className="text-[15px] md:text-[16px] font-black text-slate-900">{formatNumber(selectedStock.fundamental?.pbr)} 배</p></div>
                                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">부채비율</p><p className="text-[15px] md:text-[16px] font-black text-slate-900">{formatPct(selectedStock.fundamental?.debt_ratio)}</p></div>
                                </div>
                            </div>

                            {/* 🌟 차트 변경 사항: type="linear" & Math.round() 적용 완료! */}
                            <div className="p-6 md:p-8 bg-slate-50 dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6">📈 가격 차트 & 이동평균선</h3>
                                <div className="w-full h-[280px] md:h-[340px]">
                                    {selectedStock.chart_data && selectedStock.chart_data.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={selectedStock.chart_data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />
                                                <XAxis dataKey="date" tick={{fill: '#94A3B8', fontSize: 11, fontWeight: '800'}} tickLine={false} axisLine={false} minTickGap={30} tickFormatter={(val) => val ? String(val).substring(5).replace('-', '.') : ''}/>
                                                <YAxis domain={['auto', 'auto']} tick={{fill: '#94A3B8', fontSize: 11, fontWeight: '800'}} tickLine={false} axisLine={false} tickFormatter={(value) => value !== undefined && value !== null ? Math.round(value).toLocaleString() : ''} />
                                                <Tooltip contentStyle={{backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', color: 'white', fontWeight: '900'}} labelStyle={{color: '#94A3B8', marginBottom: '4px'}} formatter={(value, name) => [value !== undefined && value !== null ? Math.round(value).toLocaleString() : '', name]} />
                                                <Legend wrapperStyle={{ fontSize: 11, fontWeight: 800 }} />
                                                <Line type="linear" dataKey="price" name="종가" stroke="#FF4B4B" strokeWidth={2.5} dot={false} activeDot={{r: 5, fill: '#FF4B4B', strokeWidth: 0}} isAnimationActive={true} animationDuration={1200} animationEasing="ease-out" />
                                                <Line type="linear" dataKey="ma50" name="50일선" stroke="#F8B12A" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                                                <Line type="linear" dataKey="ma150" name="150일선" stroke="#3B82F6" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                                                <Line type="linear" dataKey="ma200" name="200일선" stroke="#A78BFA" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center font-extrabold text-slate-500">차트 데이터가 없습니다.</div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* GLOBAL INDEX MODAL */}
      {isIndexModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-black text-slate-900 mb-1">지수 비교</h2>
                <p className="text-[13px] font-bold text-slate-500">한국·미국 주요 지수</p>
              </div>
              <button onClick={() => setIsIndexModalOpen(false)} className="p-1.5 bg-slate-100 text-slate-500 hover:text-slate-900 rounded-full transition-colors"><X size={18}/></button>
            </div>
            <div className="p-5 flex flex-col gap-3 bg-slate-50/50">
              {[
                { key: 'kospi', name: '코스피', icon: 'K', color: 'bg-[#1e4e8c]', isUS: false },
                { key: 'kosdaq', name: '코스닥', icon: 'Q', color: 'bg-[#7e57c2]', isUS: false },
                { key: 'nasdaq', name: 'NASDAQ', icon: 'NDQ', color: 'bg-[#007aff]', isUS: true },
                { key: 'sp500', name: 'S&P 500', icon: 'S&P', color: 'bg-[#ff3b30]', isUS: true }
              ].map(idx => {
                const d = indices[idx.key];
                if (!d) return null;
                const isPos = (d.ret_1d || 0) > 0;
                return (
                  <div key={idx.key} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full ${idx.color} text-white flex items-center justify-center font-black text-[12px] shadow-sm`}>{idx.icon}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[17px] font-black text-slate-900">{idx.name}</span>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className={`text-[13px] font-black ${isPos ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>{isPos ? '+' : ''}{d.ret_1d?.toFixed(2)}%</span>
                      <span className="text-[20px] font-black text-slate-900 tracking-tighter w-20 text-right">{d.current_price?.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-5 border-t border-slate-100 bg-white">
              <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
                KR <span className="font-extrabold text-slate-500">KOSPI · KOSDAQ</span> &nbsp; US <span className="font-extrabold text-slate-500">NASDAQ · S&P 500</span>
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
