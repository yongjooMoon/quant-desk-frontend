// src/pages/QuantDesk.jsx
import { useEffect, useState, useMemo } from 'react';
import {
  RefreshCcw, X,
  TrendingUp, ShieldCheck, Droplets, Activity, Rocket, Zap,
  Crosshair, TrendingDown, Flag, BookOpen, ShieldAlert, Target
} from 'lucide-react';
import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, LineChart } from 'recharts';

export default function QuantDesk() {
  const [activeTab, setActiveTab] = useState("Portfolio");
  const [data, setData] = useState({ holdings: [], trades: [], history: [], confirmed: [], watchlist: [] });
  const [kospiData, setKospiData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [selectedStock, setSelectedStock] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [riskStock, setRiskStock] = useState(null);

  const [timeRange, setTimeRange] = useState("All");

  const fetchQuantData = () => {
    setLoading(true);

    Promise.allSettled([
      fetch("https://moon-bbh0.onrender.com/api/quant-dashboard").then(res => res.ok ? res.json() : { status: 'error' }),
      fetch("https://moon-bbh0.onrender.com/api/search/KS11").then(res => res.ok ? res.json() : { status: 'error' })
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
    setSelectedStock({ ...basicData, isLoading: true });

    fetch(`https://moon-bbh0.onrender.com/api/search/${symbol}`)
      .then(res => res.json())
      .then(result => {
        if (result.status === "success") {
            setSelectedStock({
              ...basicData,
              ...result.data,
              name: result.data.name || basicData.name,
              isLoading: false
            });
        } else {
            setSelectedStock({ ...basicData, isLoading: false, fetchError: true });
        }
        setReportLoading(false);
      })
      .catch(() => {
          setSelectedStock({ ...basicData, isLoading: false, fetchError: true });
          setReportLoading(false);
      });
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

      {/* Syncing Overlay */}
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
        <button onClick={handleRefresh} className="px-4 py-2 border border-slate-300 dark:border-slate-700/80 rounded-xl flex items-center justify-center gap-2 text-sm font-extrabold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors bg-white dark:bg-transparent shadow-sm">
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
                className={`pb-3 px-2 text-[14px] md:text-[15px] font-black tracking-tight transition-colors ${activeTab === t.id ? 'text-[#FF4B4B] border-b-[3px] border-[#FF4B4B]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
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
                <h2 className="text-2xl md:text-[28px] font-black text-slate-900 dark:text-white mb-6 tracking-tight">Holdings ({holdings.length})</h2>
                
                <div className="w-full bg-white dark:bg-transparent md:border border-slate-200 dark:border-slate-800 md:rounded-2xl overflow-hidden md:shadow-sm mb-12">
                    <div className="w-full">
                        {/* Desktop Header (Hidden on Mobile) */}
                        <div className="hidden md:flex px-4 md:px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-transparent w-full">
                            <div className="w-[20%] text-[14px] font-extrabold text-slate-500">종목명</div>
                            <div className="w-[15%] text-[14px] font-extrabold text-slate-500 text-right">진입가</div>
                            <div className="w-[15%] text-[14px] font-extrabold text-slate-500 text-right">현재가</div>
                            <div className="w-[15%] text-[14px] font-extrabold text-slate-500 text-right">수익률(P&L)</div>
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
                            // Responsive Row: Flex-col on mobile, Flex-row on desktop
                            <div key={i} className="flex flex-col md:flex-row md:items-center px-4 md:px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#111827] md:bg-transparent rounded-xl md:rounded-none mb-3 md:mb-0 shadow-sm md:shadow-none hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors w-full gap-3 md:gap-0">
                                
                                {/* Mobile: Top Row (Name & PnL) | Desktop: Name col */}
                                <div className="flex justify-between items-center w-full md:w-[20%] pr-0 md:pr-4">
                                    <div className="text-[16px] md:text-[16px] font-black text-slate-900 dark:text-white truncate">{h.name}</div>
                                    <div className={`md:hidden text-[16px] font-black ${pnlColor}`}>{ret > 0 ? "+" : ""}{ret.toFixed(2)}%</div>
                                </div>
                                
                                {/* Mobile: Middle Row (Prices) | Desktop: Entry/Current cols */}
                                <div className="flex justify-between items-center w-full md:w-[30%]">
                                    <div className="flex flex-col md:w-1/2 text-left md:text-right">
                                        <span className="text-[11px] font-bold text-slate-400 md:hidden mb-0.5">진입가</span>
                                        <span className="text-[14px] md:text-[15px] font-extrabold text-slate-700 dark:text-slate-300">₩{Math.round(h.entry_price || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex flex-col md:w-1/2 text-right">
                                        <span className="text-[11px] font-bold text-slate-400 md:hidden mb-0.5">현재가</span>
                                        <span className="text-[14px] md:text-[15px] font-black text-slate-900 dark:text-white">₩{Math.round(h.current_price || 0).toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* Desktop: PnL col (Hidden on mobile) */}
                                <div className={`hidden md:block w-[15%] text-[16px] font-black text-right ${pnlColor}`}>{ret > 0 ? "+" : ""}{ret.toFixed(2)}%</div>
                                
                                {/* Mobile: Bottom Row (Risk & Actions) | Desktop: Risk/Action cols */}
                                <div className="flex justify-between items-center w-full md:w-[35%] mt-1 md:mt-0 pt-3 md:pt-0 border-t border-slate-100 dark:border-slate-800/80 md:border-0">
                                    <div className="flex items-center md:w-[45%] md:justify-center gap-2">
                                        <span className="text-[11px] font-bold text-slate-400 md:hidden">Exit Risk</span>
                                        <span className="text-[14px] md:text-[15px] font-black text-orange-500">{(h.exit_risk || dummyRisk).toFixed(2)}%</span>
                                    </div>
                                    <div className="flex justify-end md:w-[55%] md:justify-center gap-2">
                                        <button onClick={() => setRiskStock({...h, exit_risk: (h.exit_risk || dummyRisk)})} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[13px] font-black rounded-lg border border-slate-200 dark:border-slate-700/50 hover:border-orange-400 transition-colors">🚨 Risk</button>
                                        <button onClick={() => handleReportClick(h.symbol, h)} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[13px] font-black rounded-lg border border-slate-200 dark:border-slate-700/50 hover:border-blue-400 transition-colors">📊 리포트</button>
                                    </div>
                                </div>

                            </div>
                            );
                        })}
                    </div>
                </div>

                <h2 className="text-2xl md:text-[28px] font-black text-slate-900 dark:text-white mb-2 tracking-tight">KOSPI 대비 포트폴리오 성과 (Alpha)</h2>
                <p className="text-[14px] font-extrabold text-slate-500 mb-6 tracking-tight">※ 매도(Exit)가 완료된 종목의 실현 수익률을 바탕으로 KOSPI 지수와 비교합니다.</p>

                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-5 md:p-8 rounded-2xl shadow-sm w-full mb-12 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row justify-between md:items-end mb-6 md:mb-8 relative z-10 border-b border-slate-200 dark:border-slate-800/80 pb-6">
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
                                        className={`text-[12px] font-black px-3 py-1.5 rounded-lg transition-colors border shadow-sm ${
                                            timeRange === range
                                            ? 'bg-[#FF4B4B] border-[#FF4B4B] text-white'
                                            : 'bg-white dark:bg-[#0B1120] border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white'
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
                <h2 className="text-2xl md:text-[28px] font-black text-slate-900 dark:text-white mb-6 tracking-tight">👀 예비 관심 종목 (4/6 조건 이상)</h2>
                
                <div className="w-full bg-white dark:bg-transparent md:border border-slate-200 dark:border-slate-800 md:rounded-2xl overflow-hidden md:shadow-sm w-full mb-12">
                    <div className="w-full">
                        {/* Desktop Header */}
                        <div className="hidden md:flex px-4 md:px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-transparent">
                            <div className="w-[10%] text-[14px] font-extrabold text-slate-500 text-center">순위</div>
                            <div className="w-[30%] text-[14px] font-extrabold text-slate-500">종목명</div>
                            <div className="w-[20%] text-[14px] font-extrabold text-slate-500 text-right">현재가</div>
                            <div className="w-[15%] text-[14px] font-extrabold text-slate-500 text-center">통과</div>
                            <div className="w-[15%] text-[14px] font-extrabold text-slate-500 text-right">랭킹점수</div>
                            <div className="w-[10%] text-[14px] font-extrabold text-slate-500 text-center">액션</div>
                        </div>

                        {filWatchlist.length === 0 ? <div className="p-8 text-center text-slate-500 dark:text-slate-400 font-extrabold">종목이 없습니다.</div> : filWatchlist.map((c, idx) => (
                            // Responsive Row
                            <div key={idx} className="flex flex-col md:flex-row md:items-center px-4 md:px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#111827] md:bg-transparent rounded-xl md:rounded-none mb-3 md:mb-0 shadow-sm md:shadow-none hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors w-full gap-3 md:gap-0">
                                
                                {/* Mobile: Top Row (Name) | Desktop: Rank & Name cols */}
                                <div className="flex justify-between items-center w-full md:w-[40%] pr-0 md:pr-4">
                                    <div className="flex items-center gap-3 w-full">
                                        <span className="text-[12px] font-extrabold text-white bg-blue-500 rounded-md px-2 py-0.5 md:bg-transparent md:text-slate-500 md:px-0 md:py-0 w-auto md:w-[25%] text-center">{idx+1}</span>
                                        <span className="text-[16px] font-black text-slate-900 dark:text-white truncate md:w-[75%]">{c.name}</span>
                                    </div>
                                    <div className="md:hidden text-[15px] font-black text-slate-900 dark:text-white shrink-0">₩{Math.round(c.current_price || 0).toLocaleString()}</div>
                                </div>
                                
                                {/* Desktop: Price col (Hidden on mobile) */}
                                <div className="hidden md:block w-[20%] text-[15px] font-black text-slate-900 dark:text-white text-right">₩{Math.round(c.current_price || 0).toLocaleString()}</div>
                                
                                {/* Mobile: Middle Row (Pass & Score) | Desktop: Pass & Score cols */}
                                <div className="flex justify-between items-center w-full md:w-[30%]">
                                    <div className="flex flex-col md:flex-row md:w-1/2 md:justify-center text-left md:text-center">
                                        <span className="text-[11px] font-bold text-slate-400 md:hidden mb-0.5">통과 관문</span>
                                        <span className="text-[14px] md:text-[15px] font-extrabold text-slate-600 dark:text-slate-400">{c.total_pass}/6</span>
                                    </div>
                                    <div className="flex flex-col md:flex-row md:w-1/2 md:justify-end text-right">
                                        <span className="text-[11px] font-bold text-slate-400 md:hidden mb-0.5">랭킹 점수</span>
                                        <span className="text-[15px] md:text-[16px] font-black text-slate-500 dark:text-slate-400">{(c.factor_score || 0).toFixed(2)}점</span>
                                    </div>
                                </div>
                                
                                {/* Mobile: Bottom Row (Actions) | Desktop: Action col */}
                                <div className="w-full md:w-[10%] flex justify-end md:justify-center mt-2 md:mt-0 pt-3 md:pt-0 border-t border-slate-100 dark:border-slate-800/80 md:border-0">
                                    <button onClick={() => handleReportClick(c.symbol, c)} className="px-4 md:px-3 py-1.5 md:w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[13px] font-black rounded-lg border border-slate-200 dark:border-slate-700/50 hover:border-blue-400 transition-colors shadow-sm">📊 리포트</button>
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
                  <h2 className="text-2xl md:text-[28px] font-black text-slate-900 dark:text-white mb-6 tracking-tight">📉 자동 매도 (Exit) 완료 히스토리 & 성과 지표</h2>
                  
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
                          {/* Desktop Header */}
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
                                  // Responsive Row
                                  <div key={idx} className="flex flex-col md:flex-row md:items-center px-4 md:px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#111827] md:bg-transparent rounded-xl md:rounded-none mb-3 md:mb-0 shadow-sm md:shadow-none hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors w-full gap-3 md:gap-0">
                                      
                                      {/* Mobile: Top Row (Date & Name & PnL) | Desktop: Date & Name cols */}
                                      <div className="flex justify-between items-center w-full md:w-[35%] pr-0 md:pr-4">
                                          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 w-full">
                                              <span className="text-[11px] font-extrabold text-slate-400 md:w-[42%] md:text-[14px] md:text-slate-500">{t.trade_date}</span>
                                              <span className="text-[16px] md:text-[16px] font-black text-slate-900 dark:text-white md:w-[58%] truncate">{t.name}</span>
                                          </div>
                                          <div className={`md:hidden text-[16px] font-black shrink-0 ${(t.return_rate || 0) > 0 ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>{(t.return_rate || 0) > 0 ? "+" : ""}{(t.return_rate || 0).toFixed(2)}%</div>
                                      </div>

                                      {/* Mobile: Middle Row (Prices) | Desktop: Prices cols */}
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

                                      {/* Desktop: PnL col (Hidden on mobile) */}
                                      <div className={`hidden md:block w-[15%] text-[15px] md:text-[16px] font-black text-right ${(t.return_rate || 0) > 0 ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>{(t.return_rate || 0) > 0 ? "+" : ""}{(t.return_rate || 0).toFixed(2)}%</div>

                                      {/* Mobile: Bottom Row (Reason) | Desktop: Reason col */}
                                      <div className="w-full md:w-[20%] text-[13px] font-extrabold text-slate-500 dark:text-slate-400 text-left md:text-right mt-1 md:mt-0 pt-3 md:pt-0 border-t border-slate-100 dark:border-slate-800/80 md:border-0 leading-snug break-keep md:pl-4">
                                          <span className="text-[11px] font-bold text-slate-400 md:hidden mr-2">사유:</span>
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
              <div className="animate-in fade-in duration-500 w-full pb-10">
                  <div className="mb-10">
                      <h2 className="text-2xl md:text-[28px] font-black text-slate-900 dark:text-white mb-4 tracking-tight flex items-center gap-3">
                          <BookOpen className="text-blue-500" size={28} />
                          Chase Momentum Algorithm Whitepaper
                      </h2>
                      <p className="text-[16px] md:text-[18px] font-extrabold text-slate-700 dark:text-slate-300 leading-relaxed max-w-4xl">
                          시장의 주도주를 포착하고 철저한 기계적 리스크 관리로 계좌를 안정적으로 우상향시키는 정통 퀀트 추격매수 & 방어 전략 안내서입니다.
                      </p>
                  </div>

                  <div className="mb-16">
                      <div className="flex items-center gap-3 mb-6 px-2">
                          <Rocket className="text-[#FF4B4B]" size={24} />
                          <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">매수 진입 6대 관문 (Entry Gates)</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                          <div className="bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-2xl shadow-sm hover:border-[#FF4B4B]/50 transition-colors group">
                              <div className="flex items-center gap-3 mb-4">
                                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[#FF4B4B] font-black text-lg shadow-sm group-hover:bg-[#FF4B4B]/10">A</div>
                                  <h4 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">성장성</h4>
                              </div>
                              <p className="text-[#FF4B4B] font-black mb-3 text-[15px]">"돈을 더 잘 벌고 있는가?"</p>
                              <p className="text-[15px] font-extrabold text-slate-600 dark:text-slate-400 leading-loose">
                                  회사의 기초 체력을 봅니다. 단순히 흑자가 아니라, 매출, 영업이익, 순이익이 작년 동기 대비 얼마나 성장했는지 종합적으로 평가합니다.
                              </p>
                          </div>

                          <div className="bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-2xl shadow-sm hover:border-[#FF4B4B]/50 transition-colors group">
                              <div className="flex items-center gap-3 mb-4">
                                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[#FF4B4B] font-black text-lg shadow-sm group-hover:bg-[#FF4B4B]/10">B</div>
                                  <h4 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">방어력</h4>
                              </div>
                              <p className="text-[#FF4B4B] font-black mb-3 text-[15px]">"심하게 다친 적 없이 버티는가?"</p>
                              <p className="text-[15px] font-extrabold text-slate-600 dark:text-slate-400 leading-loose">
                                  롤러코스터처럼 고점 대비 심하게 폭락하는 종목을 피하기 위해, ATR 기반으로 해당 주식이 버틸 수 있는 최대 하락 폭을 엄격히 한정합니다.
                              </p>
                          </div>

                          <div className="bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-2xl shadow-sm hover:border-[#FF4B4B]/50 transition-colors group">
                              <div className="flex items-center gap-3 mb-4">
                                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[#FF4B4B] font-black text-lg shadow-sm group-hover:bg-[#FF4B4B]/10">C</div>
                                  <h4 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">유동성</h4>
                              </div>
                              <p className="text-[#FF4B4B] font-black mb-3 text-[15px]">"사람들이 많이 찾는 인기 주식인가?"</p>
                              <p className="text-[15px] font-extrabold text-slate-600 dark:text-slate-400 leading-loose">
                                  내가 사고 팔고 싶을 때 즉시 거래할 수 있도록, 최근 20일 동안 하루 평균 거래 대금이 50억 원을 넘는 메이저 종목들 사이에서만 트레이딩합니다.
                              </p>
                          </div>

                          <div className="bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-2xl shadow-sm hover:border-[#FF4B4B]/50 transition-colors group">
                              <div className="flex items-center gap-3 mb-4">
                                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[#FF4B4B] font-black text-lg shadow-sm group-hover:bg-[#FF4B4B]/10">D</div>
                                  <h4 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">추세</h4>
                              </div>
                              <p className="text-[#FF4B4B] font-black mb-3 text-[15px]">"오르막길을 안정적으로 걷는가?"</p>
                              <p className="text-[15px] font-extrabold text-slate-600 dark:text-slate-400 leading-loose">
                                  주가가 미끄럼틀을 타는 역배열 종목은 배제합니다. 현재 가격이 20일선 위에, 20일선이 60일선 위에 위치한 완벽한 정배열 상승 기류 종목만 선별합니다.
                              </p>
                          </div>

                          <div className="bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-2xl shadow-sm hover:border-[#FF4B4B]/50 transition-colors group">
                              <div className="flex items-center gap-3 mb-4">
                                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[#FF4B4B] font-black text-lg shadow-sm group-hover:bg-[#FF4B4B]/10">E</div>
                                  <h4 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">가격 돌파</h4>
                              </div>
                              <p className="text-[#FF4B4B] font-black mb-3 text-[15px]">"천장을 뚫을 준비가 되었는가?"</p>
                              <p className="text-[15px] font-extrabold text-slate-600 dark:text-slate-400 leading-loose">
                                  최근 3개월(60일)간 가장 비쌌던 최고 기록의 90% 이상까지 매물대를 뚫고 다시 치고 올라온, 폭발적 에너지를 모은 종목만 포착합니다.
                              </p>
                          </div>

                          <div className="bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-2xl shadow-sm hover:border-[#FF4B4B]/50 transition-colors group">
                              <div className="flex items-center gap-3 mb-4">
                                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[#FF4B4B] font-black text-lg shadow-sm group-hover:bg-[#FF4B4B]/10">F</div>
                                  <h4 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">수급</h4>
                              </div>
                              <p className="text-[#FF4B4B] font-black mb-3 text-[15px]">"관중들이 우르르 몰려오는가?"</p>
                              <p className="text-[15px] font-extrabold text-slate-600 dark:text-slate-400 leading-loose">
                                  단순히 가격만 오르는 것을 넘어, 평소 거래량 대비 1.5배 이상 수급이 터져야 합니다. 거대한 자금이 쏠리며 모멘텀이 폭발한 결정적 증거입니다.
                              </p>
                          </div>
                      </div>
                  </div>

                  <div>
                      <div className="flex items-center gap-3 mb-6 px-2">
                          <ShieldAlert className="text-[#3B82F6]" size={24} />
                          <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">생존 매도 3대 원칙 (Exit Signals)</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                          <div className="bg-blue-50/50 dark:bg-[#151D2C] border border-blue-100 dark:border-slate-700/50 p-6 md:p-8 rounded-2xl shadow-inner group">
                              <div className="flex items-center gap-3 mb-4">
                                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#1E293B] border border-blue-200 dark:border-slate-700 flex items-center justify-center text-[#3B82F6] font-black text-lg shadow-sm group-hover:bg-[#3B82F6]/10">1</div>
                                  <h4 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">동적 손절</h4>
                              </div>
                              <p className="text-[#3B82F6] font-black mb-2 text-[15px]">Trailing Stop</p>
                              <p className="text-[15px] font-extrabold text-slate-700 dark:text-slate-300 leading-loose">
                                  고정된 비율(-5% 등)을 쓰지 않고 주식의 성격(ATR)에 맞춰 유연하게 손절선을 잡습니다. 주가가 오르면 손절선도 함께 쫓아 올라가 이익을 철통같이 방어합니다.
                              </p>
                          </div>

                          <div className="bg-blue-50/50 dark:bg-[#151D2C] border border-blue-100 dark:border-slate-700/50 p-6 md:p-8 rounded-2xl shadow-inner group">
                              <div className="flex items-center gap-3 mb-4">
                                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#1E293B] border border-blue-200 dark:border-slate-700 flex items-center justify-center text-[#3B82F6] font-black text-lg shadow-sm group-hover:bg-[#3B82F6]/10">2</div>
                                  <h4 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">추세 붕괴</h4>
                              </div>
                              <p className="text-[#3B82F6] font-black mb-2 text-[15px]">Trend Breakdown</p>
                              <p className="text-[15px] font-extrabold text-slate-700 dark:text-slate-300 leading-loose">
                                  오르막길을 가던 주가가 단기 이평선(10일, 20일)을 뚫고 내려가며 평균선의 기울기마저 꺾이면, 상승 엔진이 꺼졌다고 판단하여 즉시 매도합니다.
                              </p>
                          </div>

                          <div className="bg-blue-50/50 dark:bg-[#151D2C] border border-blue-100 dark:border-slate-700/50 p-6 md:p-8 rounded-2xl shadow-inner group">
                              <div className="flex items-center gap-3 mb-4">
                                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#1E293B] border border-blue-200 dark:border-slate-700 flex items-center justify-center text-[#3B82F6] font-black text-lg shadow-sm group-hover:bg-[#3B82F6]/10">3</div>
                                  <h4 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">목표 달성</h4>
                              </div>
                              <p className="text-[#3B82F6] font-black mb-2 text-[15px]">Target Take-Profit</p>
                              <p className="text-[15px] font-extrabold text-slate-700 dark:text-slate-300 leading-loose">
                                  수익률이 목표(예: +40%)에 도달하면 욕심을 부리지 않고 즉각적으로 절반 또는 전량 매도하여 수익을 확정 짓는 기계적인 익절을 수행합니다.
                              </p>
                          </div>
                      </div>
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
                    <button onClick={() => setRiskStock(null)} className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"><X size={20}/></button>
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
                                        <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">실시간 랭킹 스코어</p><p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">{(selectedStock.score || 0).toFixed(2)}점</p></div>
                                        <div>
                                            <p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">현재시점 생존 필터</p>
                                            <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">
                                                {selectedStock.gates ? Object.values(selectedStock.gates).filter(g => g.pass).length : 0} / 6
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-[11px] md:text-[12px] font-extrabold text-slate-500 mt-6 p-3 bg-white dark:bg-[#1E293B] rounded-xl border border-slate-200 dark:border-slate-700/50">💡 과거 배치(Cron) 시점엔 6/6 통과였어도, 현재 실시간 주가 변동에 따라 다를 수 있습니다.</p>
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
                                            <p className={`text-[11px] md:text-[12px] font-extrabold truncate ${passed ? 'text-[#00B464]' : 'text-slate-500'}`} title={gate.name}>{gate.name}</p>
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
    </div>
  );
}
