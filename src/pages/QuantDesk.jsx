import { useEffect, useState, useMemo } from 'react';
import { RefreshCcw, TrendingUp, TrendingDown, ShieldAlert } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { useRenderApi } from '../hooks/useRenderApi';

function formatPrice(v) {
  if (v === null || v === undefined || isNaN(v)) return "N/A";
  return Math.round(v).toLocaleString();
}

function formatPct(v) {
  if (v === null || v === undefined || isNaN(v)) return "N/A";
  return `${v > 0 ? '+' : ''}${Number(v).toFixed(2)}%`;
}

// 🌟 recent_30d 가격 배열 → recharts용 [{i, price}] 변환
function toSparklineData(recent30d) {
  if (!Array.isArray(recent30d)) return [];
  return recent30d.map((price, i) => ({ i, price }));
}

// =========================================================================
// 종목 1개 카드 — 진입/현재가, 수익률, 최근 30일 스파크라인 차트, 손절가
// =========================================================================
function BacktestCard({ item }) {
  const ret = item.return_rate ?? 0;
  const isUp = ret > 0;
  const isDown = ret < 0;
  const color = isUp ? '#FF4B4B' : isDown ? '#3B82F6' : '#94A3B8';
  const sparkline = useMemo(() => toSparklineData(item.recent_30d), [item.recent_30d]);

  return (
    <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[16px] font-black text-slate-900 dark:text-white">{item.name}</p>
          <p className="text-[12px] font-extrabold text-slate-400">{item.symbol}</p>
        </div>
        <div className="text-right">
          <p className="text-[18px] font-black" style={{ color }}>{formatPct(ret)}</p>
          <p className="text-[11px] font-extrabold text-slate-400 flex items-center justify-end gap-1">
            {isUp ? <TrendingUp size={12} /> : isDown ? <TrendingDown size={12} /> : null}
            진입일 {item.entry_date}
          </p>
        </div>
      </div>

      <div className="w-full h-16 mb-4">
        {sparkline.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`spark-${item.symbol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis domain={['auto', 'auto']} hide />
              <Area
                type="monotone" dataKey="price" stroke={color} strokeWidth={2}
                fill={`url(#spark-${item.symbol})`} dot={false}
                isAnimationActive={true} animationDuration={900}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[11px] font-bold text-slate-400">차트 데이터 없음</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-y-3 gap-x-3 text-[13px]">
        <div><p className="text-[11px] font-bold text-slate-400 mb-0.5">진입가</p><p className="font-extrabold text-slate-700 dark:text-slate-300">₩{formatPrice(item.entry_price)}</p></div>
        <div><p className="text-[11px] font-bold text-slate-400 mb-0.5">현재가</p><p className="font-black text-slate-900 dark:text-white">₩{formatPrice(item.current_price)}</p></div>
        <div><p className="text-[11px] font-bold text-slate-400 mb-0.5">수량</p><p className="font-extrabold text-slate-700 dark:text-slate-300">{formatPrice(item.quantity)}주</p></div>
        <div><p className="text-[11px] font-bold text-slate-400 mb-0.5">평가금액</p><p className="font-extrabold text-slate-700 dark:text-slate-300">₩{formatPrice(item.current_value)}</p></div>
        <div className="col-span-2 flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <ShieldAlert size={13} className="text-orange-500" />
          <p className="text-[11px] font-bold text-slate-400">손절가</p>
          <p className="text-[13px] font-black text-orange-500">₩{formatPrice(item.stop_price)}</p>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 메인 패널 — 목록 조회 + 정렬 + 새로고침 + 요약 카드 3종
// =========================================================================
export default function BacktestResultPanel() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sortBy, setSortBy] = useState('return_desc');
  const { callApi, ServerWakeupOverlay } = useRenderApi();

  const fetchData = (forceRefresh = false) => {
    setLoading(true);
    callApi(`/api/backtesting/result${forceRefresh ? '?refresh=true' : ''}`)
      .then((res) => {
        setData(res.status === 'success' && Array.isArray(res.data) ? res.data : []);
        setLoading(false);
      })
      .catch(() => {
        setData([]);
        setLoading(false);
      });
  };

  useEffect(() => { fetchData(); }, []);

  const handleRefresh = () => {
    setSyncing(true);
    fetchData(true);
    setTimeout(() => setSyncing(false), 800);
  };

  const sortedData = useMemo(() => {
    const copy = [...data];
    if (sortBy === 'return_desc') copy.sort((a, b) => (b.return_rate ?? 0) - (a.return_rate ?? 0));
    if (sortBy === 'return_asc') copy.sort((a, b) => (a.return_rate ?? 0) - (b.return_rate ?? 0));
    return copy;
  }, [data, sortBy]);

  const winners = data.filter((d) => (d.return_rate ?? 0) > 0).length;
  const losers = data.filter((d) => (d.return_rate ?? 0) < 0).length;
  const avgReturn = data.length > 0 ? data.reduce((s, d) => s + (d.return_rate ?? 0), 0) / data.length : 0;

  return (
    <div className="w-full pb-16 font-['Nunito',_ui-rounded,_-apple-system,_system-ui,_sans-serif]">
      <ServerWakeupOverlay />

      <div className="mb-8 flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h2 className="text-2xl md:text-[28px] font-black text-slate-900 dark:text-white tracking-tight">🧪 백테스팅 결과</h2>
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 text-[13px] font-extrabold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1120] text-slate-700 dark:text-slate-300"
          >
            <option value="return_desc">수익률 높은순</option>
            <option value="return_asc">수익률 낮은순</option>
          </select>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 border border-slate-300 dark:border-slate-700/80 rounded-xl flex items-center justify-center gap-2 text-sm font-extrabold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer active:scale-95 bg-white dark:bg-transparent shadow-sm"
          >
            <RefreshCcw size={16} className={loading || syncing ? 'animate-spin text-blue-500' : ''} /> 새로고침
          </button>
        </div>
      </div>

      {!loading && data.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <p className="text-[12px] font-extrabold text-slate-500 mb-1">대상 종목</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{data.length}개</p>
          </div>
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <p className="text-[12px] font-extrabold text-slate-500 mb-1">평균 수익률</p>
            <p className={`text-2xl font-black ${avgReturn >= 0 ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>{formatPct(avgReturn)}</p>
          </div>
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <p className="text-[12px] font-extrabold text-slate-500 mb-1">수익/손실</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{winners} <span className="text-[#FF4B4B]">▲</span> / {losers} <span className="text-[#3B82F6]">▼</span></p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-20"><RefreshCcw className="animate-spin text-blue-500" size={40} /></div>
      ) : sortedData.length === 0 ? (
        <div className="p-16 text-center text-slate-500 dark:text-slate-400 font-extrabold bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl">
          백테스팅 결과 데이터가 없습니다. 다음 배치(Cron) 실행 후 다시 확인해 주세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedData.map((item) => (
            <BacktestCard key={item.symbol} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
