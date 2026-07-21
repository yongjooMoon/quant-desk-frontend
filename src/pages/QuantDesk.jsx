import { useEffect, useState, useMemo, useRef } from 'react';
import {
  RefreshCcw, X,
  TrendingUp, ShieldCheck, Droplets, Activity, Rocket, Zap,
  Crosshair, TrendingDown, Flag, BookOpen, ShieldAlert, Target, ChevronRight, ChevronDown
} from 'lucide-react';
import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, LineChart } from 'recharts';

import { useRenderApi } from '../hooks/useRenderApi';

export default function QuantDesk() {
  const [activeTab, setActiveTab] = useState("Portfolio");
  const [data, setData] = useState({ holdings: [], trades: [], history: [], confirmed: [], watchlist: [], backtest: null });
  const [kospiData, setKospiData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [selectedStock, setSelectedStock] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [riskStock, setRiskStock] = useState(null);
  const [backtestStock, setBacktestStock] = useState(null); // 🧪 백테스팅 결과 팝업 대상 종목

  const [timeRange, setTimeRange] = useState("All");

  const [indices, setIndices] = useState({ kospi: null, kosdaq: null, nasdaq: null, sp500: null });
  const [isIndexModalOpen, setIsIndexModalOpen] = useState(false);

  // 화이트페이퍼 토글 상태
  const [isEntryOpen, setIsEntryOpen] = useState(true);
  const [isExitOpen, setIsExitOpen] = useState(true);

  const { callApi, ServerWakeupOverlay } = useRenderApi();

  const initialLoadRef = useRef({ kr: false, us: false });

  useEffect(() => {
    let intervalId;

    const getMarketStatus = () => {
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const kst = new Date(utc + (9 * 3600000));
      const day = kst.getDay(); // 0:일, 1:월 ... 6:토
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

  const fetchQuantData = () => {
    setLoading(true);

    Promise.allSettled([
      callApi("/api/quant-dashboard"),
      callApi("/api/search/KS11")
    ])
    .then((results) => {
      const quantResult = results[0].status === 'fulfilled' ? results[0].value : null;
      const kospiResult = results[1].status === 'fulfilled' ? results[1].value : null;

      if (quantResult && quantResult.status === "success" && quantResult.data) {
        setData(quantResult.data);
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
      } else {
        setKospiData([]);
      }
      setLoading(false);
    });
  };

  useEffect(() => { fetchQuantData(); }, []);

  const handleRefresh = () => {
    setSyncing(true);
    setTimeout(() => {
        fetchQuantData();
        setSyncing(false);
    }, 1500);
  };

  const handleReportClick = (symbol, basicData) => {
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

  // 🧪 quant_cron.py의 run_backtest_for_symbols() → save_backtest_result()로 캐시된
  // OLD(수정 전 고정로직) vs NEW(현재 로직) 백테스트 결과(data.backtest)를 그대로 사용합니다.
  const handleBacktestClick = (symbol, basicData) => {
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

  // 🧪 build_json_summary()가 만든 old/new 각각의 equity_curve를 날짜 기준으로 합쳐서
  // OLD vs NEW 누적수익률(%) 비교 라인차트 데이터로 변환
  const backtestChartData = useMemo(() => {
    const bt = data.backtest;
    if (!bt) return [];
    const oldCurve = bt.old?.equity_curve || [];
    const newCurve = bt.new?.equity_curve || [];
    const map = {};
    oldCurve.forEach(p => { map[p.date] = { date: p.date, old_cum: (p.value - 1) * 100 }; });
    newCurve.forEach(p => {
      if (!map[p.date]) map[p.date] = { date: p.date };
      map[p.date].new_cum = (p.value - 1) * 100;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [data.backtest]);

  // 🧪 선택한 종목(symbol)의 OLD/NEW 개별 트레이드만 필터링 (진입가·손익 비교용)
  const backtestSymbolTrades = useMemo(() => {
    const bt = data.backtest;
    if (!bt || !backtestStock) return { old: [], new: [] };
    return {
      old: (bt.old?.trades || []).filter(t => t.symbol === backtestStock.symbol),
      new: (bt.new?.trades || []).filter(t => t.symbol === backtestStock.symbol),
    };
  }, [data.backtest, backtestStock]);

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

  return (
    <div className="w-full transition-colors duration-300 pb-20 font-['Nunito',_ui-rounded,_-apple-system,_system-ui,_sans-serif]">

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
        <h2 className="text-2xl md:text-[28px] font-black text-slate-900 dark:text-white flex items-center mb-2 tracking-tight gap-3">
          📡 퀀트투자
        </h2>
        <button onClick={handleRefresh} className="px-4 py-2 border border-slate-300 dark:border-slate-700/80 rounded-xl flex items-center justify-center gap-2 text-sm font-extrabold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer active:scale-95 bg-white dark:bg-transparent shadow-sm hover:shadow-md">
            <RefreshCcw size={16} className={loading ? "animate-spin text-blue-500" : ""} /> 데이터 동기화
        </button>
      </div>

      <div className="flex gap-3 md:gap-5 border-b border-slate-200 dark:border-slate-800 mb-8 overflow-x-auto whitespace-nowrap hide-scrollbar pb-0 select-none">
        {[{id: "Portfolio", label: `Portfolio (${holdings.length})`},
          {id: "Watchlist", label: `Watchlist (${filWatchlist.length})`},
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

      {loading && !syncing ? (
        <div className="flex justify-center p-20 w-full"><RefreshCcw className="animate-spin text-blue-500" size={40} /></div>
      ) : (
        <div className="w-full">

          {/* ===================== PORTFOLIO TAB ===================== */}
          {activeTab === "Portfolio" && (
            <div className="animate-in fade-in duration-300 w-full">

                {/* 🌟 토스 스타일 지수 티커 */}
                {indices.kospi && (
                  <div
                    onClick={() => setIsIndexModalOpen(true)}
                    className="mb-8 p-4 md:p-5 bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-400 dark:hover:border-slate-600 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-inner overflow-hidden border border-slate-200 shrink-0">
                        <img src="/태극기.png" alt="KR" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[18px] md:text-[20px] font-black text-slate-900 dark:text-white">KOSPI</span>

                      {indices.kospi.market_status === "장중" ? (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">● 장중</span>
                      ) : (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">장마감</span>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end md:flex-row md:items-baseline md:gap-3">
                        <span className="text-[11px] md:text-[13px] font-extrabold text-slate-500 mb-0.5 md:mb-0">
                          전일대비 <span className={(indices.kospi.ret_1d || 0) > 0 ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}>{(indices.kospi.ret_1d > 0 ? '+' : '')}{indices.kospi.ret_1d?.toFixed(2)}%</span>
                        </span>
                        <span className="text-[22px] md:text-[26px] font-black text-slate-900 dark:text-white tracking-tighter">
                          {indices.kospi.current_price?.toLocaleString()}
                        </span>
                      </div>
                      <ChevronRight className="text-slate-400 group-hover:text-slate-600 transition-colors" size={20} />
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

                            return (
                            <div key={i} className="flex flex-col md:flex-row md:items-center px-4 md:px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#111827] md:bg-transparent rounded-xl md:rounded-none mb-3 md:mb-0 shadow-sm md:shadow-none hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors w-full gap-3 md:gap-0">
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
                                    <div className="flex flex-col md:w-1/3 text-right">
                                        <span className="text-[11px] font-bold text-slate-400 md:hidden mb-0.5">수량</span>
                                        <span className="text-[14px] md:text-[15px] font-extrabold text-slate-600 dark:text-slate-400">{formatNumber(h.quantity)}주</span>
                                    </div>
                                </div>
                                <div className={`hidden md:block w-[13%] text-[16px] font-black text-right ${pnlColor}`}>{ret > 0 ? "+" : ""}{ret.toFixed(2)}%</div>
                                <div className="flex justify-between items-center w-full md:w-[35%] mt-1 md:mt-0 pt-3 md:pt-0 border-t border-slate-100 dark:border-slate-800/80 md:border-0">
                                    <div className="flex items-center md:w-[28%] md:justify-center gap-2">
                                        <span className="text-[11px] font-bold text-slate-400 md:hidden">Exit Risk</span>
                                        <span className="text-[14px] md:text-[15px] font-black text-orange-500">{(h.exit_risk || dummyRisk).toFixed(2)}%</span>
                                    </div>
                                    <div className="flex justify-end md:w-[72%] md:justify-center gap-2 flex-wrap">
                                        <button onClick={() => setRiskStock({...h, exit_risk: (h.exit_risk || dummyRisk)})} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[13px] font-black rounded-lg border border-slate-200 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-orange-600 dark:hover:text-orange-400 hover:border-orange-400 dark:hover:border-orange-500 transition-all cursor-pointer shadow-sm hover:shadow-md">🚨 Risk</button>
                                        <button onClick={() => handleBacktestClick(h.symbol, h)} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[13px] font-black rounded-lg border border-slate-200 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-400 dark:hover:border-emerald-500 transition-all cursor-pointer shadow-sm hover:shadow-md">🧪 백테스팅</button>
                                        <button onClick={() => handleReportClick(h.symbol, h)} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[13px] font-black rounded-lg border border-slate-200 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-pointer shadow-sm hover:shadow-md">📊 리포트</button>
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
                                    {lastChartData.cum > 0 ? '+' : ''}{lastChartData.cum.toFixed(2)}%
                                </h1>
                                <span className={`text-[14px] md:text-[15px] font-black ${lastChartData.alpha >= 0 ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>
                                    ▲ {lastChartData.alpha > 0 ? '+' : ''}{lastChartData.alpha.toFixed(2)}% (Alpha)
                                </span>
                            </div>
                        </div>
                        <div className="text-left md:text-right flex flex-col md:items-end gap-1 mt-4 md:mt-0">
                            <div className="flex gap-2">
                                {['1W', '1M', 'All'].map(range => (
                                    <button
                                        key={range}
                                        onClick={() => setTimeRange(range)}
                                        className={`text-[12px] font-black px-3 py-1.5 rounded-lg transition-all cursor-pointer hover:-translate-y-0.5 border shadow-sm ${
                                            timeRange === range
                                            ? 'bg-[#FF4B4B] border-[#FF4B4B] text-white'
                                            : 'bg-white dark:bg-[#0B1120] border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        {range}
                                    </button>
                                ))}
                            </div>
                            <div className="text-[13px] font-extrabold text-slate-400 mt-2 tracking-tight">
                                Day <span style={{ color: mainColor }}>{lastDayRet > 0 ? '+' : ''}{lastDayRet.toFixed(2)}%</span> &nbsp;&nbsp;
                                KOSPI <span className="text-[#64748B]">{lastChartData.kospi_cum > 0 ? '+' : ''}{lastChartData.kospi_cum.toFixed(2)}%</span>
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
                                    <Line type="monotone" dataKey="kospi_cum" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={false} />
                                    <Area type="monotone" dataKey="cum" stroke={mainColor} strokeWidth={3} fillOpacity={1} fill="url(#colorCum)" activeDot={{r: 6, fill: mainColor, strokeWidth: 2, stroke: '#111827'}} />
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

                        {filWatchlist.length === 0 ? <div className="p-8 text-center text-slate-500 dark:text-slate-400 font-extrabold">종목이 없습니다.</div> : filWatchlist.map((c, idx) => (
                            <div key={idx} className="flex flex-col md:flex-row md:items-center px-4 md:px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#111827] md:bg-transparent rounded-xl md:rounded-none mb-3 md:mb-0 shadow-sm md:shadow-none hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors w-full gap-3 md:gap-0">
                                <div className="flex justify-between items-center w-full md:w-[40%] pr-0 md:pr-4">
                                    <div className="flex items-center gap-3 w-full">
                                        <span className="text-[12px] font-extrabold text-white bg-blue-500 rounded-md px-2 py-0.5 md:bg-transparent md:text-slate-500 md:px-0 md:py-0 w-auto md:w-[25%] text-center">{idx+1}</span>
                                        <span className="text-[16px] font-black text-slate-900 dark:text-white truncate md:w-[75%]">{c.name}</span>
                                    </div>
                                    <div className="md:hidden text-[15px] font-black text-slate-900 dark:text-white shrink-0">₩{Math.round(c.current_price || 0).toLocaleString()}</div>
                                </div>
                                <div className="hidden md:block w-[20%] text-[15px] font-black text-slate-900 dark:text-white text-right">₩{Math.round(c.current_price || 0).toLocaleString()}</div>
                                <div className="flex justify-between items-center w-full md:w-[30%]">
                                    <div className="flex flex-col md:flex-row md:w-1/2 md:justify-center text-left md:text-center">
                                        <span className="text-[11px] font-bold text-slate-400 md:hidden mb-0.5">통과 관문</span>
                                        <span className="text-[14px] md:text-[15px] font-extrabold text-slate-600 dark:text-slate-400">{c.total_pass}/6</span>
                                    </div>
                                    <div className="flex flex-col md:flex-row md:w-1/2 md:justify-center text-right md:text-center">
                                        <span className="text-[11px] font-bold text-slate-400 md:hidden mb-0.5">랭킹 점수</span>
                                        <span className="text-[15px] md:text-[16px] font-black text-slate-500 dark:text-slate-400">{(c.factor_score || 0).toFixed(2)}점</span>
                                    </div>
                                </div>
                                <div className="w-full md:w-[10%] flex justify-end md:justify-center mt-2 md:mt-0 pt-3 md:pt-0 border-t border-slate-100 dark:border-slate-800/80 md:border-0 px-2">
                                    <button onClick={() => handleReportClick(c.symbol, c)} className="px-4 md:px-3 py-1.5 md:w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[13px] font-black rounded-lg border border-slate-200 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-pointer shadow-sm hover:shadow-md">📊 리포트</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
              </div>
          )}

          {/* ===================== HISTORY TAB ===================== */}
          {activeTab === "History" && (
              <div className="animate-in fade-in duration-300 w-full">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 w-full">
                      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-center">
                          <p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">총 매도 횟수</p>
                          <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-1">{sellTrades.length}회</p>
                          <p className="text-[11px] md:text-[12px] font-extrabold text-slate-400">승 {wins.length} / 패 {losses.length}</p>
                      </div>
                      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-center">
                          <p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">🎯 승률 (타율)</p>
                          <p className="text-2xl md:text-3xl font-black text-[#3B82F6]">{winRate.toFixed(1)}%</p>
                      </div>
                      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-center">
                          <p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">⚖️ 손익비</p>
                          <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-1">{avgLoss !== 0 ? Math.abs(avgWin/avgLoss).toFixed(2) : "0.00"}</p>
                          <p className="text-[11px] md:text-[12px] font-extrabold text-slate-400">평균 {avgWin.toFixed(2)}% / {avgLoss.toFixed(2)}%</p>
                      </div>
                      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-center">
                          <p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">💰 주당 누적 실현손익금</p>
                          <p className={`text-xl md:text-2xl lg:text-3xl font-black tracking-tight ${totalProfitAmt > 0 ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>{parseInt(totalProfitAmt).toLocaleString('ko-KR')}원</p>
                      </div>
                  </div>

                  <div className="w-full bg-white dark:bg-transparent md:border border-slate-200 dark:border-slate-800 md:rounded-2xl overflow-hidden md:shadow-sm w-full mb-12">
                      <div className="w-full">
                          <div className="hidden md:flex px-4 md:px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-transparent">
                              <div className="w-[15%] text-[14px] font-extrabold text-slate-500">매도 일자</div>
                              <div className="w-[20%] text-[14px] font-extrabold text-slate-500">종목명</div>
                              <div className="w-[15%] text-[14px] font-extrabold text-slate-500 text-right">진입가</div>
                              <div className="w-[15%] text-[14px] font-extrabold text-slate-500 text-right">매도가</div>
                              <div className="w-[15%] text-[14px] font-extrabold text-slate-500 text-right">실현손익(%)</div>
                              <div className="w-[20%] text-[14px] font-extrabold text-slate-500 text-right">매도 사유</div>
                          </div>

                          {sellTrades.length === 0 ? <div className="p-8 text-center text-slate-500 dark:text-slate-400 font-extrabold w-full">매도 이력이 없습니다.</div> : sellTrades.map((t, idx) => {
                                const entryPrice = t.trade_price / (1 + ((t.return_rate || 0) / 100));
                                return (
                                  <div key={idx} className="flex flex-col md:flex-row md:items-center px-4 md:px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#111827] md:bg-transparent rounded-xl md:rounded-none mb-3 md:mb-0 shadow-sm md:shadow-none hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors w-full gap-3 md:gap-0">
                                      <div className="flex justify-between items-center w-full md:w-[35%] pr-0 md:pr-4">
                                          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 w-full">
                                              <span className="text-[11px] font-extrabold text-slate-400 md:w-[42%] md:text-[14px] md:text-slate-500">{t.trade_date}</span>
                                              <span className="text-[16px] md:text-[16px] font-black text-slate-900 dark:text-white md:w-[58%] truncate">{t.name}</span>
                                          </div>
                                          <div className={`md:hidden text-[16px] font-black shrink-0 ${(t.return_rate || 0) > 0 ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>{(t.return_rate || 0) > 0 ? "+" : ""}{(t.return_rate || 0).toFixed(2)}%</div>
                                      </div>
                                      <div className="flex justify-between items-center w-full md:w-[30%]">
                                          <div className="flex flex-col md:w-1/2 text-left md:text-right">
                                              <span className="text-[11px] font-bold text-slate-400 md:hidden mb-0.5">진입가</span>
                                              <span className="text-[14px] md:text-[15px] font-extrabold text-slate-600 dark:text-slate-400">₩{Math.round(entryPrice).toLocaleString()}</span>
                                          </div>
                                          <div className="flex flex-col md:w-1/2 text-right">
                                              <span className="text-[11px] font-bold text-slate-400 md:hidden mb-0.5">매도가</span>
                                              <span className="text-[14px] md:text-[15px] font-black text-slate-800 dark:text-slate-200">₩{Math.round(t.trade_price || 0).toLocaleString()}</span>
                                          </div>
                                      </div>
                                      <div className={`hidden md:block w-[15%] text-[15px] md:text-[16px] font-black text-right ${(t.return_rate || 0) > 0 ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>{(t.return_rate || 0) > 0 ? "+" : ""}{(t.return_rate || 0).toFixed(2)}%</div>
                                      <div className="w-full md:w-[20%] text-[12px] md:text-[13px] font-extrabold text-slate-500 dark:text-slate-400 text-left md:text-right mt-1 md:mt-0 pt-2 md:pt-0 border-t border-slate-100 dark:border-slate-800/80 md:border-0 leading-snug truncate" title={t.reason}>
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
                  {/* 매수 진입 섹션 */}
                  <div className="mb-12">
                      <div
                        className="flex items-center justify-between cursor-pointer group mb-6 px-2"
                        onClick={() => setIsEntryOpen(!isEntryOpen)}
                      >
                          <div className="flex items-center gap-3">
                              <Rocket className="text-[#FF4B4B] group-hover:scale-110 transition-transform" size={24} />
                              <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight group-hover:text-[#FF4B4B] transition-colors">매수 진입 6대 관문 (Entry Gates)</h3>
                          </div>
                          <ChevronDown className={`text-slate-400 transition-transform duration-300 ${isEntryOpen ? 'rotate-180' : ''}`} size={24} />
                      </div>

                      {isEntryOpen && (
                          <div className="grid grid-cols-1 gap-4 animate-in slide-in-from-top-2 duration-300 opacity-100">

                              <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl dark:hover:shadow-[0_8px_30px_rgba(255,75,75,0.1)] hover:border-[#FF4B4B] hover:-translate-y-1 transition-all duration-300 group flex flex-col md:flex-row md:items-center gap-4 md:gap-8 cursor-default">
                                  <div className="md:w-1/4 shrink-0 flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[#FF4B4B] font-black text-lg shadow-sm group-hover:bg-[#FF4B4B] group-hover:text-white transition-colors">A</div>
                                      <h4 className="font-black text-lg text-slate-900 dark:text-white">성장성 <span className="text-[13px] text-slate-400 block font-bold">Growth Composite</span></h4>
                                  </div>
                                  <div className="md:w-3/4">
                                      <p className="text-[15px] md:text-[16px] font-extrabold text-slate-600 dark:text-slate-300 leading-loose">
                                          최근 실적 기준 <span className="text-[#FF4B4B]">매출액, 영업이익, 당기순이익의 YoY 성장률(%)</span>을 종합 산출하여 기초 체력이 확실하게 검증된 흑자 성장 기업만 선별합니다.
                                      </p>
                                  </div>
                              </div>

                              <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl dark:hover:shadow-[0_8px_30px_rgba(255,75,75,0.1)] hover:border-[#FF4B4B] hover:-translate-y-1 transition-all duration-300 group flex flex-col md:flex-row md:items-center gap-4 md:gap-8 cursor-default">
                                  <div className="md:w-1/4 shrink-0 flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[#FF4B4B] font-black text-lg shadow-sm group-hover:bg-[#FF4B4B] group-hover:text-white transition-colors">B</div>
                                      <h4 className="font-black text-lg text-slate-900 dark:text-white">방어력 <span className="text-[13px] text-slate-400 block font-bold">Dynamic MDD</span></h4>
                                  </div>
                                  <div className="md:w-3/4">
                                      <p className="text-[15px] md:text-[16px] font-extrabold text-slate-600 dark:text-slate-300 leading-loose">
                                          최근 60일 고점 대비 하락폭(MDD)을 추적합니다. 단순히 고정된 비율을 쓰지 않고, 종목별 변동성지표인 <span className="text-[#FF4B4B]">ATR(Average True Range)에 연동하여 한계 하락폭을 동적으로 계산</span>해 맷집이 약한 종목을 차단합니다.
                                      </p>
                                  </div>
                              </div>

                              <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl dark:hover:shadow-[0_8px_30px_rgba(255,75,75,0.1)] hover:border-[#FF4B4B] hover:-translate-y-1 transition-all duration-300 group flex flex-col md:flex-row md:items-center gap-4 md:gap-8 cursor-default">
                                  <div className="md:w-1/4 shrink-0 flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[#FF4B4B] font-black text-lg shadow-sm group-hover:bg-[#FF4B4B] group-hover:text-white transition-colors">C</div>
                                      <h4 className="font-black text-lg text-slate-900 dark:text-white">유동성 <span className="text-[13px] text-slate-400 block font-bold">Liquidity</span></h4>
                                  </div>
                                  <div className="md:w-3/4">
                                      <p className="text-[15px] md:text-[16px] font-extrabold text-slate-600 dark:text-slate-300 leading-loose">
                                          원활한 진입과 슬리피지(Slippage) 없는 청산을 위해 <span className="text-[#FF4B4B]">최근 20일 일평균 거래대금이 최소 50억 원 이상</span>인 메이저 종목들 사이에서만 트레이딩을 수행합니다.
                                      </p>
                                  </div>
                              </div>

                              <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl dark:hover:shadow-[0_8px_30px_rgba(255,75,75,0.1)] hover:border-[#FF4B4B] hover:-translate-y-1 transition-all duration-300 group flex flex-col md:flex-row md:items-center gap-4 md:gap-8 cursor-default">
                                  <div className="md:w-1/4 shrink-0 flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[#FF4B4B] font-black text-lg shadow-sm group-hover:bg-[#FF4B4B] group-hover:text-white transition-colors">D</div>
                                      <h4 className="font-black text-lg text-slate-900 dark:text-white">추세 <span className="text-[13px] text-slate-400 block font-bold">Trend Alignment</span></h4>
                                  </div>
                                  <div className="md:w-3/4">
                                      <p className="text-[15px] md:text-[16px] font-extrabold text-slate-600 dark:text-slate-300 leading-loose">
                                          현재가가 20일 이동평균선 위에, 20일선이 60일선 위에 위치한 <span className="text-[#FF4B4B]">완벽한 정배열 상승 기류</span> 종목만 선별합니다. 동시에 ATR 기반의 동적 이격도 제한(15~50% 캡)을 적용해 이미 과열된 상투를 잡지 않습니다.
                                      </p>
                                  </div>
                              </div>

                              <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl dark:hover:shadow-[0_8px_30px_rgba(255,75,75,0.1)] hover:border-[#FF4B4B] hover:-translate-y-1 transition-all duration-300 group flex flex-col md:flex-row md:items-center gap-4 md:gap-8 cursor-default">
                                  <div className="md:w-1/4 shrink-0 flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[#FF4B4B] font-black text-lg shadow-sm group-hover:bg-[#FF4B4B] group-hover:text-white transition-colors">E</div>
                                      <h4 className="font-black text-lg text-slate-900 dark:text-white">가격 돌파 <span className="text-[13px] text-slate-400 block font-bold">Price Breakout</span></h4>
                                  </div>
                                  <div className="md:w-3/4">
                                      <p className="text-[15px] md:text-[16px] font-extrabold text-slate-600 dark:text-slate-300 leading-loose">
                                          최근 3개월(60일) 최고가의 90% 이상 매물대를 2일 연속 돌파한 종목을 포착합니다. 단, <span className="text-[#FF4B4B]">60일 평균 대비 2배 이상의 대량 거래량</span>이 동반될 경우 강력한 신호로 판단하여 1일 차라도 즉시 진입을 허용합니다.
                                      </p>
                                  </div>
                              </div>

                              <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl dark:hover:shadow-[0_8px_30px_rgba(255,75,75,0.1)] hover:border-[#FF4B4B] hover:-translate-y-1 transition-all duration-300 group flex flex-col md:flex-row md:items-center gap-4 md:gap-8 cursor-default">
                                  <div className="md:w-1/4 shrink-0 flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[#FF4B4B] font-black text-lg shadow-sm group-hover:bg-[#FF4B4B] group-hover:text-white transition-colors">F</div>
                                      <h4 className="font-black text-lg text-slate-900 dark:text-white">수급 <span className="text-[13px] text-slate-400 block font-bold">Volume Surge</span></h4>
                                  </div>
                                  <div className="md:w-3/4">
                                      <p className="text-[15px] md:text-[16px] font-extrabold text-slate-600 dark:text-slate-300 leading-loose">
                                          가격 상승을 뒷받침하는 강력한 자금 유입을 검증합니다. 최근 5일 평균 거래량과 당일 거래량이 모두 <span className="text-[#FF4B4B]">60일 평균 대비 1.5배 이상 폭발</span>한 모멘텀 주도주만 선별합니다.
                                      </p>
                                  </div>
                              </div>

                          </div>
                      )}
                  </div>

                  {/* 생존 매도 섹션 */}
                  <div>
                      <div
                        className="flex items-center justify-between cursor-pointer group mb-6 px-2"
                        onClick={() => setIsExitOpen(!isExitOpen)}
                      >
                          <div className="flex items-center gap-3">
                              <ShieldAlert className="text-[#3B82F6] group-hover:scale-110 transition-transform" size={24} />
                              <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight group-hover:text-[#3B82F6] transition-colors">생존 매도 3대 원칙 (Exit Signals)</h3>
                          </div>
                          <ChevronDown className={`text-slate-400 transition-transform duration-300 ${isExitOpen ? 'rotate-180' : ''}`} size={24} />
                      </div>

                      {isExitOpen && (
                          <div className="grid grid-cols-1 gap-4 animate-in slide-in-from-top-2 duration-300 opacity-100">

                              <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl dark:hover:shadow-[0_8px_30px_rgba(59,130,246,0.1)] hover:border-[#3B82F6] hover:-translate-y-1 transition-all duration-300 group flex flex-col md:flex-row md:items-center gap-4 md:gap-8 cursor-default">
                                  <div className="md:w-1/4 shrink-0 flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[#3B82F6] font-black text-lg shadow-sm group-hover:bg-[#3B82F6] group-hover:text-white transition-colors">1</div>
                                      <h4 className="font-black text-lg text-slate-900 dark:text-white">동적 손절 <span className="text-[13px] text-slate-400 block font-bold">Trailing Stop</span></h4>
                                  </div>
                                  <div className="md:w-3/4">
                                      <p className="text-[15px] md:text-[16px] font-extrabold text-slate-600 dark:text-slate-300 leading-loose">
                                          고정된 비율(-5% 등) 대신 종목별 일간 변동성(ATR) 수치에 연동된 손절선을 그립니다. 주가가 오르면 손절선도 추적하여 올라가며, <span className="text-[#3B82F6]">+15% 이상 수익권 진입 시 방어선 추적 배수를 0.6배로 타이트하게 좁혀</span> 실현 수익을 철통같이 보호합니다.
                                      </p>
                                  </div>
                              </div>

                              <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl dark:hover:shadow-[0_8px_30px_rgba(59,130,246,0.1)] hover:border-[#3B82F6] hover:-translate-y-1 transition-all duration-300 group flex flex-col md:flex-row md:items-center gap-4 md:gap-8 cursor-default">
                                  <div className="md:w-1/4 shrink-0 flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[#3B82F6] font-black text-lg shadow-sm group-hover:bg-[#3B82F6] group-hover:text-white transition-colors">2</div>
                                      <h4 className="font-black text-lg text-slate-900 dark:text-white">추세 붕괴 <span className="text-[13px] text-slate-400 block font-bold">Trend Breakdown</span></h4>
                                  </div>
                                  <div className="md:w-3/4">
                                      <p className="text-[15px] md:text-[16px] font-extrabold text-slate-600 dark:text-slate-300 leading-loose">
                                          주가의 20일선 이탈, 단기 이평선 데드크로스(10일 &lt; 20일), 20일선 기울기 하락 전환이라는 3대 하락 징후를 감시합니다. 노이즈 방지를 위해 <span className="text-[#3B82F6]">시장 국면에 따라 다수결(강세장 2개 충족, 약세장 1개 충족) 규칙을 적용</span>하여 하락 엔진이 켜지기 전 신속히 청산합니다.
                                      </p>
                                  </div>
                              </div>

                              <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl dark:hover:shadow-[0_8px_30px_rgba(59,130,246,0.1)] hover:border-[#3B82F6] hover:-translate-y-1 transition-all duration-300 group flex flex-col md:flex-row md:items-center gap-4 md:gap-8 cursor-default">
                                  <div className="md:w-1/4 shrink-0 flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[#3B82F6] font-black text-lg shadow-sm group-hover:bg-[#3B82F6] group-hover:text-white transition-colors">3</div>
                                      <h4 className="font-black text-lg text-slate-900 dark:text-white">모멘텀 소진 <span className="text-[13px] text-slate-400 block font-bold">Momentum Exhaust</span></h4>
                                  </div>
                                  <div className="md:w-3/4">
                                      <p className="text-[15px] md:text-[16px] font-extrabold text-slate-600 dark:text-slate-300 leading-loose">
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
                    <button onClick={() => setRiskStock(null)} className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors cursor-pointer"><X size={20}/></button>
                </div>

                <p className="text-[14px] md:text-[15px] font-extrabold text-slate-600 dark:text-slate-400 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
                    현재가: ₩{Math.round(riskStock.current_price || 0).toLocaleString()} &nbsp;|&nbsp; 손절가: ₩{Math.round(riskStock.stop_price || 0).toLocaleString()}
                </p>

                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between text-[14px] font-black mb-2"><span>OVERALL EXIT PROXIMITY</span><span>{(riskStock.exit_risk || 0).toFixed(2)}%</span></div>
                        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-3"><div className={`h-3 rounded-full ${(riskStock.exit_risk || 0) > 70 ? 'bg-[#FF4B4B]' : 'bg-[#00B464]'}`} style={{width: `${riskStock.exit_risk || 0}%`}}></div></div>
                    </div>
                    <div>
                        <div className="flex justify-between text-[13px] md:text-[14px] font-extrabold mb-2 text-slate-500"><span>Trailing Stop (ATR) 추정</span><span>{Math.max(0, (riskStock.exit_risk || 0) - 15).toFixed(2)}%</span></div>
                        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2"><div className="bg-slate-400 dark:bg-slate-600 h-2 rounded-full" style={{width: `${Math.max(0, (riskStock.exit_risk || 0) - 15)}%`}}></div></div>
                    </div>
                    <div>
                        <div className="flex justify-between text-[13px] md:text-[14px] font-extrabold mb-2 text-slate-500"><span>Trend Break (MA20) 추정</span><span>{Math.max(0, (riskStock.exit_risk || 0) - 5).toFixed(2)}%</span></div>
                        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2"><div className="bg-slate-400 dark:bg-slate-600 h-2 rounded-full" style={{width: `${Math.max(0, (riskStock.exit_risk || 0) - 5)}%`}}></div></div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-4">
                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">진입가 (Entry)</p><p className="text-lg md:text-xl font-black text-slate-900 dark:text-white">₩{Math.round(riskStock.entry_price || 0).toLocaleString()}</p></div>
                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">보유 수익률 (P&L)</p><p className={`text-lg md:text-xl font-black ${(riskStock.return_rate || 0) > 0 ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>{(riskStock.return_rate || 0) > 0 ? '+' : ''}{(riskStock.return_rate || 0).toFixed(2)}%</p></div>
                </div>
            </div>
        </div>
      )}

      {/* BACKTEST MODAL */}
      {backtestStock && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 w-full max-w-[1000px] min-h-[55vh] md:min-h-[70vh] max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800/80">
                    <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">🧪 {backtestStock.name} 백테스팅 결과</h3>
                    <button onClick={() => setBacktestStock(null)} className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full transition-colors cursor-pointer"><X size={20}/></button>
                </div>

                <div className="p-6 md:p-8 overflow-y-auto flex-1">
                    {!data.backtest ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 py-16">
                            <p className="font-black text-[15px] md:text-lg text-center">아직 백테스팅 결과 데이터가 없습니다.<br/>다음 배치(Cron) 실행 후 다시 확인해 주세요.</p>
                        </div>
                    ) : (
                        <>
                            <p className="text-[13px] font-extrabold text-slate-500 mb-6">
                                최근 {data.backtest.trading_days || 0}거래일 기준 · OLD(수정 전 고정로직) vs NEW(현재 로직, 레짐 대응) 비교 · 체결비용(수수료·세금·슬리피지) 반영
                            </p>

                            {/* OLD vs NEW 요약 카드 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                {[{ key: 'old', label: 'OLD (수정 전)', color: '#64748B' }, { key: 'new', label: 'NEW (현재 로직)', color: '#FF4B4B' }].map(({ key, label, color }) => {
                                    const m = data.backtest[key] || {};
                                    return (
                                        <div key={key} className="p-5 bg-slate-50 dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800">
                                            <p className="text-[13px] font-black mb-3" style={{ color }}>{label}</p>
                                            <div className="grid grid-cols-2 gap-y-3 gap-x-3">
                                                <div><p className="text-[11px] font-bold text-slate-500 mb-0.5">트레이드</p><p className="text-[15px] font-black text-slate-900 dark:text-white">{m.trade_count ?? 0}건</p></div>
                                                <div><p className="text-[11px] font-bold text-slate-500 mb-0.5">승률</p><p className="text-[15px] font-black text-slate-900 dark:text-white">{formatPct(m.win_rate)}</p></div>
                                                <div><p className="text-[11px] font-bold text-slate-500 mb-0.5">평균익절/손절</p><p className="text-[13px] font-extrabold text-slate-700 dark:text-slate-300">{formatPct(m.avg_win_pct)} / {formatPct(m.avg_loss_pct)}</p></div>
                                                <div><p className="text-[11px] font-bold text-slate-500 mb-0.5">손익비</p><p className="text-[15px] font-black text-slate-900 dark:text-white">{(m.payoff_ratio ?? 0).toFixed(2)}</p></div>
                                                <div><p className="text-[11px] font-bold text-slate-500 mb-0.5">기대값(Expectancy)</p><p className="text-[15px] font-black text-slate-900 dark:text-white">{formatPct(m.expectancy_pct)}</p></div>
                                                <div><p className="text-[11px] font-bold text-slate-500 mb-0.5">평균 보유일</p><p className="text-[15px] font-black text-slate-900 dark:text-white">{(m.avg_hold_days ?? 0).toFixed(1)}일</p></div>
                                                <div><p className="text-[11px] font-bold text-slate-500 mb-0.5">근사 누적수익률</p><p className={`text-[15px] font-black ${(m.cum_return_pct || 0) >= 0 ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>{(m.cum_return_pct || 0) > 0 ? '+' : ''}{formatPct(m.cum_return_pct)}</p></div>
                                                <div><p className="text-[11px] font-bold text-slate-500 mb-0.5">근사 MDD</p><p className="text-[15px] font-black text-slate-900 dark:text-white">{formatPct(m.mdd_pct)}</p></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* OLD vs NEW 누적수익률 곡선 */}
                            <div className="p-5 md:p-6 bg-slate-50 dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 mb-8">
                                <h4 className="text-[15px] font-black text-slate-900 dark:text-white mb-4">근사 누적수익률 비교 (동일가중, 참고용)</h4>
                                <div className="w-full h-[220px] md:h-[260px]">
                                    {backtestChartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={backtestChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />
                                                <XAxis dataKey="date" tick={{fill: '#94A3B8', fontSize: 10, fontWeight: '800'}} tickLine={false} axisLine={false} minTickGap={35} tickFormatter={(val) => val ? String(val).substring(5).replace('-', '.') : ''}/>
                                                <YAxis tick={{fill: '#94A3B8', fontSize: 10, fontWeight: '800'}} tickLine={false} axisLine={false} tickFormatter={(v) => v !== undefined && v !== null ? `${v > 0 ? '+' : ''}${v.toFixed(0)}%` : ''} />
                                                <Tooltip contentStyle={{backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', color: 'white', fontWeight: '900', fontSize: '12px'}} formatter={(value, name) => [`${value > 0 ? '+' : ''}${value.toFixed(2)}%`, name === 'old_cum' ? 'OLD' : 'NEW']} />
                                                <Line type="monotone" dataKey="old_cum" name="old_cum" stroke="#64748B" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                                                <Line type="monotone" dataKey="new_cum" name="new_cum" stroke="#FF4B4B" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center font-extrabold text-slate-500 text-[13px]">누적수익률 곡선 데이터가 부족합니다.</div>
                                    )}
                                </div>
                            </div>

                            {/* 선택 종목의 개별 매매 내역 */}
                            <div>
                                <h4 className="text-[15px] font-black text-slate-900 dark:text-white mb-4">{backtestStock.name} 개별 매매 시뮬레이션</h4>
                                {backtestSymbolTrades.old.length === 0 && backtestSymbolTrades.new.length === 0 ? (
                                    <div className="p-6 text-center text-slate-500 font-extrabold text-[13px] bg-slate-50 dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800">이 종목에 대한 개별 매매 시뮬레이션 결과가 없습니다.</div>
                                ) : (
                                    <div className="space-y-2">
                                        {[...backtestSymbolTrades.new.map(t => ({...t, tag: 'NEW'})), ...backtestSymbolTrades.old.map(t => ({...t, tag: 'OLD'}))].map((t, idx) => (
                                            <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 gap-2 md:gap-4">
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-md ${t.tag === 'NEW' ? 'bg-[#FF4B4B]/10 text-[#FF4B4B]' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300'}`}>{t.tag}</span>
                                                    <span className="text-[13px] font-extrabold text-slate-600 dark:text-slate-400">{t.entry_date} → {t.exit_date}</span>
                                                </div>
                                                <div className="flex items-center gap-4 text-[13px] font-extrabold text-slate-600 dark:text-slate-400">
                                                    <span>진입 ₩{formatNumber(t.entry_price)}</span>
                                                    <span>{formatNumber(t.quantity)}주</span>
                                                    <span className={`font-black ${(t.return_pct || 0) >= 0 ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>{(t.return_pct || 0) > 0 ? '+' : ''}{formatPct(t.return_pct)}</span>
                                                </div>
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

      {/* REPORT MODAL */}
      {selectedStock && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 w-full max-w-[1200px] min-h-[60vh] md:min-h-[75vh] max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex gap-2 items-center">
                        <span className="text-[14px] md:text-[14.5px] font-black text-slate-500 dark:text-slate-400">{selectedStock.symbol} · {selectedStock.market || "KOSPI"}</span>
                        {selectedStock.sector && <span className="text-[12px] md:text-[13.5px] font-extrabold px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{selectedStock.sector}</span>}
                    </div>
                    <button onClick={() => setSelectedStock(null)} className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full transition-colors"><X size={20}/></button>
                </div>

                <div className="p-6 md:p-10 overflow-y-auto flex-1">
                    {reportLoading || selectedStock.isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <RefreshCcw className="animate-spin mb-4 text-blue-500" size={40} />
                            <p className="font-black text-[15px] md:text-lg animate-pulse text-slate-700 dark:text-slate-300 text-center">최신 재무 데이터와 실시간 지표를 융합하여 리포트를 생성 중입니다...</p>
                        </div>
                    ) : selectedStock.fetchError ? (
                        <div className="flex flex-col items-center justify-center h-full text-[#FF4B4B]">
                            <X size={40} className="mb-4" />
                            <p className="font-black text-[15px] md:text-lg text-center">해당 종목의 데이터(API)를 불러오는데 실패했습니다.</p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-8 md:mb-10">
                                <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-2 md:mb-4 leading-tight tracking-tight">
                                    {selectedStock.name}
                                </h2>
                                <h1 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-baseline">
                                    {formatNumber(selectedStock.current_price)} 원 <span className={`text-[16px] md:text-[24px] ml-2 md:ml-3 ${(selectedStock.ret_1m || 0) > 0 ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>{(selectedStock.ret_1m || 0) > 0 ? '+' : ''}{formatPct(selectedStock.ret_1m || 0)} (1M)</span>
                                </h1>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                                <div className="p-6 md:p-8 bg-slate-50 dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6">⚡ Quant Scores</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">퀀트 랭킹 스코어</p><p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">{(selectedStock.score || 0).toFixed(2)}점</p></div>
                                        <div>
                                            <p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">생존 필터 통과</p>
                                            <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">
                                                {selectedStock.total_pass !== undefined ? selectedStock.total_pass : (selectedStock.gates ? Object.values(selectedStock.gates).filter(g => g.pass).length : 0)} / 6
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-[11px] md:text-[12px] font-extrabold text-slate-500 mt-6 p-3 bg-white dark:bg-[#1E293B] rounded-xl border border-slate-200 dark:border-slate-700/50">💡 평가 지표(점수/게이트)는 가장 최근 배치(Cron) 시점을 기준으로 고정 표시됩니다. (재무 및 차트는 최신 반영)</p>
                                </div>

                                <div className="p-6 md:p-8 bg-slate-50 dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center items-center relative">
                                    <div className="relative w-48 md:w-56 h-28 md:h-32 mb-2 flex justify-center items-end">
                                        <svg viewBox="0 0 200 110" className="w-full h-full absolute bottom-0">
                                            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="18" strokeLinecap="round" />
                                            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#00B464" strokeWidth="18" strokeLinecap="round"
                                                  strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * (selectedStock.score || 0) / 100)}
                                                  style={{ transition: 'stroke-dashoffset 1.5s ease-in-out' }} />
                                        </svg>
                                        <div className="absolute bottom-0 w-full flex flex-col items-center justify-end pb-2">
                                            <p className="text-4xl md:text-5xl font-black text-[#00B464] tracking-tighter">{(selectedStock.score || 0).toFixed(1)}</p>
                                        </div>
                                    </div>
                                    <p className="text-[13px] md:text-[14px] font-extrabold text-slate-500 mt-2">퀀트 랭킹 스코어</p>
                                </div>
                            </div>

                            <div className="mb-10">
                                <h5 className="text-xl font-black text-slate-900 dark:text-white mb-4 md:mb-6">Entry Gates (6 conditions)</h5>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
                                    {['A', 'B', 'C', 'D', 'E', 'F'].map((label, idx) => {
                                        const gateKeys = selectedStock.gates ? Object.keys(selectedStock.gates) : [];
                                        const gate = gateKeys.length > idx ? selectedStock.gates[gateKeys[idx]] : { pass: false, name: '-', reason: '-' };
                                        const passed = gate.pass;

                                        return (
                                        <div key={label} className={`p-4 rounded-2xl border ${passed ? 'bg-[#00B464]/10 border-[#00B464]/50 shadow-sm' : 'bg-slate-50 dark:bg-[#1E2329] border-slate-200 dark:border-slate-800'} flex flex-col justify-between h-24 md:h-28`}>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className={`font-black text-[15px] md:text-[16px] ${passed ? 'text-[#00B464]' : 'text-slate-400'}`}>{label}</span>
                                                <span className="text-[12px]">{passed ? '✔️' : '❌'}</span>
                                            </div>
                                            <div className={`h-1 md:h-1.5 rounded-full w-full mb-2 md:mb-3 ${passed ? 'bg-[#00B464]' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                                            <p className={`text-[11px] md:text-[12px] font-extrabold truncate ${passed ? 'text-[#00B464]' : 'text-slate-500'}`} title={gate.reason || gate.name}>{gate.name}</p>
                                        </div>
                                    )})}
                                </div>
                            </div>

                            <div className="p-6 md:p-8 bg-slate-50 dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-10">
                                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6">📊 Financials & Valuation</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 md:gap-y-8 gap-x-4 md:gap-x-6">
                                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">매출액</p><p className="text-[15px] md:text-[16px] font-black text-slate-900 dark:text-white">{formatMarcap(selectedStock.fundamental?.revenue_cur)}</p></div>
                                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">영업이익</p><p className="text-[15px] md:text-[16px] font-black text-slate-900 dark:text-white">{formatMarcap(selectedStock.fundamental?.op_profit_cur)}</p></div>
                                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">영업이익률</p><p className="text-[15px] md:text-[16px] font-black text-slate-900 dark:text-white">{formatPct(selectedStock.fundamental?.op_margin)}</p></div>
                                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">ROE</p><p className="text-[15px] md:text-[16px] font-black text-[#FF4B4B]">{formatPct(selectedStock.fundamental?.roe)}</p></div>
                                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">시가총액</p><p className="text-[15px] md:text-[16px] font-black text-slate-900 dark:text-white">{formatMarcap(selectedStock.fundamental?.marcap_억)}</p></div>
                                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">PER</p><p className="text-[15px] md:text-[16px] font-black text-slate-900 dark:text-white">{formatNumber(selectedStock.fundamental?.per)} 배</p></div>
                                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">PBR</p><p className="text-[15px] md:text-[16px] font-black text-slate-900 dark:text-white">{formatNumber(selectedStock.fundamental?.pbr)} 배</p></div>
                                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">부채비율</p><p className="text-[15px] md:text-[16px] font-black text-slate-900 dark:text-white">{formatPct(selectedStock.fundamental?.debt_ratio)}</p></div>
                                </div>
                            </div>

                            <div className="p-6 md:p-8 bg-slate-50 dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6">📈 가격 차트 (최근 120일)</h3>
                                <div className="w-full h-[250px] md:h-[300px]">
                                    {selectedStock.chart_data && selectedStock.chart_data.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={selectedStock.chart_data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />
                                                <XAxis dataKey="date" tick={{fill: '#94A3B8', fontSize: 11, fontWeight: '800'}} tickLine={false} axisLine={false} minTickGap={30} tickFormatter={(val) => val ? String(val).substring(5).replace('-', '.') : ''}/>
                                                <YAxis domain={['auto', 'auto']} tick={{fill: '#94A3B8', fontSize: 11, fontWeight: '800'}} tickLine={false} axisLine={false} tickFormatter={(value) => value !== undefined && value !== null ? value.toLocaleString() : ''} />
                                                <Tooltip contentStyle={{backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', color: 'white', fontWeight: '900'}} itemStyle={{color: '#FF4B4B'}} labelStyle={{color: '#94A3B8', marginBottom: '4px'}} formatter={(value) => [value !== undefined && value !== null ? value.toLocaleString() : '', "종가"]} />
                                                <Line type="monotone" dataKey="price" stroke="#FF4B4B" strokeWidth={2.5} dot={false} activeDot={{r: 5, fill: '#FF4B4B', strokeWidth: 0}} />
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

      {/* 🌟 글로벌 지수 비교 모달 */}
      {isIndexModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

            <div className="p-6 border-b border-slate-100 dark:border-slate-800/80 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white mb-1">지수 비교</h2>
                <p className="text-[13px] font-bold text-slate-500">한국·미국 주요 지수</p>
              </div>
              <button onClick={() => setIsIndexModalOpen(false)} className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 rounded-full transition-colors"><X size={18}/></button>
            </div>

            <div className="p-5 flex flex-col gap-3 bg-slate-50/50 dark:bg-transparent">
              {[
                { key: 'kospi', name: '코스피', icon: 'K', color: 'bg-[#1e4e8c]', isUS: false },
                { key: 'kosdaq', name: '코스닥', icon: 'Q', color: 'bg-[#7e57c2]', isUS: false },
                { key: 'nasdaq', name: 'NASDAQ', icon: 'NDQ', color: 'bg-[#007aff]', isUS: true },
                { key: 'sp500', name: 'S&P 500', icon: 'S&P', color: 'bg-[#ff3b30]', isUS: true }
              ].map(idx => {
                const data = indices[idx.key];
                if (!data) return null;
                const isPos = (data.ret_1d || 0) > 0;

                return (
                  <div key={idx.key} className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full ${idx.color} text-white flex items-center justify-center font-black text-[12px] shadow-sm`}>
                        {idx.icon}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[17px] font-black text-slate-900 dark:text-white">{idx.name}</span>
                      </div>
                    </div>

                    <div className="flex items-baseline gap-3">
                      <span className={`text-[13px] font-black ${isPos ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>
                        {isPos ? '+' : ''}{data.ret_1d?.toFixed(2)}%
                      </span>
                      <span className="text-[20px] font-black text-slate-900 dark:text-white tracking-tighter w-20 text-right">
                        {data.current_price?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-5 border-t border-slate-100 dark:border-slate-800/80 bg-white dark:bg-[#111827]">
              <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
                KR <span className="font-extrabold text-slate-500">KOSPI · KOSDAQ</span> &nbsp; US <span className="font-extrabold text-slate-500">NASDAQ · S&P 500</span><br/>
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
