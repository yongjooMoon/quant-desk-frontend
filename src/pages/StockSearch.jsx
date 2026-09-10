// src/pages/StockSearch.jsx
import { useState, useEffect, useRef } from 'react';
import { Search, BarChart2, RefreshCcw } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, XAxis, CartesianGrid } from 'recharts';
// 공통 API 훅 임포트
import { useRenderApi } from '../hooks/useRenderApi';

// 색상 토큰 — 다른 페이지와 동일한 팔레트
const POS = '#DC2626';
const NEG = '#2563EB';
const GOOD = '#059669';

// 🚫 [캐시 비활성화] 세션스토리지 TTL 캐시 로직 제거됨
// 기존에는 setCacheWithExpiry / getCacheWithExpiry 를 통해
// sessionStorage 에 종목 리스트 / 상세 데이터를 저장해두고 재사용했지만,
// 이제 새로고침 또는 재검색 시 항상 백엔드로 요청이 가도록 캐시를 사용하지 않습니다.

const PAGE_STYLES = `
  .ss-custom-scrollbar::-webkit-scrollbar { width: 8px; }
  .ss-custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
  .dark .ss-custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }

  @keyframes ssFadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .ss-report-in { animation: ssFadeInUp 0.25s ease-out both; }
  @media (prefers-reduced-motion: reduce) {
    .ss-report-in { animation: none !important; }
  }
`;

export default function StockSearch() {
  const [options, setOptions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [focusedIndex, setFocusedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const optionsListRef = useRef(null);
  const inputRef = useRef(null);

  // 공통 API 훅 및 오버레이 가져오기
  const { callApi, ServerWakeupOverlay } = useRenderApi();

  useEffect(() => {
    callApi("/api/krx-list")
      .then(data => {
        if (data.status === "success") {
          setOptions(data.data);
        }
      })
      .catch(err => console.error(err));

    callApi("/api/fundamentals")
      .then(data => {
        if (data.status === "success") {
          console.log("백엔드 펀더멘털 일괄 캐싱 완료");
        }
      });
  }, [callApi]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const filteredOptions = options.filter(opt => opt.SearchStr.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 50);

  useEffect(() => { setFocusedIndex(-1); }, [searchTerm]);

  useEffect(() => {
    if (isDropdownOpen && optionsListRef.current && focusedIndex >= 0) {
      const listNode = optionsListRef.current;
      const focusedNode = listNode.children[focusedIndex];
      if (focusedNode) {
        const nodeTop = focusedNode.offsetTop;
        const nodeBottom = nodeTop + focusedNode.offsetHeight;
        const scrollTop = listNode.scrollTop;
        const scrollBottom = scrollTop + listNode.offsetHeight;
        if (nodeTop < scrollTop) listNode.scrollTop = nodeTop;
        else if (nodeBottom > scrollBottom) listNode.scrollTop = nodeBottom - listNode.offsetHeight;
      }
    }
  }, [focusedIndex, isDropdownOpen]);

  const handleSelect = (symbol, searchStr) => {
    const displayName = searchStr.includes(' (') ? searchStr.split(' (')[0] : searchStr;
    setSearchTerm(displayName);

    setIsDropdownOpen(false);
    setFocusedIndex(-1);
    setLoading(true);
    setError("");
    setResult(null);

    if (inputRef.current) {
      inputRef.current.blur();
    }

    callApi(`/api/search/${symbol}`)
      .then(data => {
        if (data.status === "success") {
          if (!data.data.name) {
            const matched = options.find(o => o.Symbol === symbol);
            if (matched) data.data.name = matched.Name;
          }
          setResult(data.data);
        } else setError(data.message || "종목 검색 실패");
        setLoading(false);
      }).catch(() => {
        setError("서버 통신 오류가 발생했습니다.");
        setLoading(false);
      });
  };

  const handleKeyDown = (e) => {
    if (!isDropdownOpen) {
      if (e.key === "Enter" && searchTerm) setIsDropdownOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
        const opt = filteredOptions[focusedIndex];
        handleSelect(opt.Symbol, opt.SearchStr);
      } else if (filteredOptions.length > 0) {
        const opt = filteredOptions[0];
        handleSelect(opt.Symbol, opt.SearchStr);
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false);
    }
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
    <div className="w-full px-4 md:px-8 py-8 md:py-10 transition-colors duration-300 relative pb-20">
      <style>{PAGE_STYLES}</style>

      {/* 통신 지연 시 띄워주는 서버 기상 오버레이 */}
      <ServerWakeupOverlay />

      {/* 타이틀 섹션 */}
      <div className="mb-6">
        <h1 className="text-[18px] font-semibold text-slate-900 dark:text-white tracking-tight mb-1.5">
          주식 가격 통합 검색
        </h1>
        <p className="text-[13px] text-slate-500 dark:text-slate-400">
          원하는 종목명 또는 코드를 검색하면 실시간 퀀트 분석 결과를 출력합니다.
        </p>
      </div>

      {/* 메인 검색 컨테이너 */}
      <div className="mb-8 relative z-50 w-full" ref={wrapperRef}>
        <div className="relative">
          <div className="flex items-center bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-md px-4 py-3 focus-within:border-slate-400 dark:focus-within:border-slate-600 transition-colors">
            <Search className="text-slate-400 mr-3" size={18} strokeWidth={1.75} />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setIsDropdownOpen(true); }}
              onFocus={() => setIsDropdownOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder="종목명 또는 코드를 입력하세요 (예: 삼성전자)"
              className="flex-1 bg-transparent border-none outline-none text-slate-900 dark:text-white text-[15px] placeholder-slate-400 dark:placeholder-slate-600"
            />
          </div>

          {/* 드롭다운 리스트 */}
          {isDropdownOpen && searchTerm && (
            <div
              ref={optionsListRef}
              className="ss-custom-scrollbar absolute z-[100] w-full mt-2 bg-white dark:bg-[#0F1B2E] border border-slate-200 dark:border-slate-700/60 rounded-md shadow-md max-h-[320px] overflow-y-auto"
            >
              {filteredOptions.length > 0 ? filteredOptions.map((opt, idx) => (
                  <div
                    key={opt.Symbol}
                    onClick={() => handleSelect(opt.Symbol, opt.SearchStr)}
                    onMouseEnter={() => setFocusedIndex(idx)}
                    className={`px-4 py-2.5 text-[14px] font-medium cursor-pointer border-b border-slate-100 dark:border-slate-800/80 last:border-0 transition-colors ${
                      focusedIndex === idx
                        ? 'bg-slate-100 dark:bg-slate-800/60 text-slate-900 dark:text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    {opt.SearchStr}
                  </div>
                )) : (
                  <div className="px-4 py-6 text-center text-slate-500 dark:text-slate-500 text-[13px]">
                    검색 결과가 없습니다.
                  </div>
                )}
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-slate-500 mt-3 text-[13px] pl-1">
            <RefreshCcw size={14} className="animate-spin" strokeWidth={1.75} /> 실시간 데이터 분석 중...
          </div>
        )}
        {error && (
          <div className="text-[13px] mt-3 pl-1" style={{ color: POS }}>
            {error}
          </div>
        )}
      </div>

      {/* 분석 리포트 */}
      {result && !loading && (
        <div className="ss-report-in w-full mt-2">

            <div className="mb-5 flex flex-col items-start gap-1 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{result.symbol}</span>
                    <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{result.market || "KOSPI"}</span>
                    {result.sector && <span className="text-[12px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{result.sector}</span>}
                </div>
                <h2 className="text-[26px] md:text-[32px] font-semibold text-slate-900 dark:text-white mb-1 leading-tight tracking-tight">
                    {result.name}
                </h2>
                <h1 className="text-[20px] md:text-[26px] font-semibold text-slate-900 dark:text-white tracking-tight flex items-baseline tabular-nums">
                    {formatNumber(result.current_price)} 원
                    <span className="text-[14px] md:text-[17px] ml-2.5 font-medium" style={{ color: (result.ret_1m || 0) > 0 ? POS : NEG }}>
                        {(result.ret_1m || 0) > 0 ? '+' : ''}{formatPct(result.ret_1m || 0)} (1M)
                    </span>
                </h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                {/* Quant Scores Card */}
                <div className="p-6 bg-slate-50 dark:bg-[#111827] rounded-md border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                    <div>
                        <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white mb-5">Quant Scores</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[12px] text-slate-500 mb-1">실시간 랭킹 스코어</p>
                                <p className="text-[22px] font-semibold text-slate-900 dark:text-white tabular-nums">{(result.score || 0).toFixed(2)}점</p>
                            </div>
                            <div>
                                <p className="text-[12px] text-slate-500 mb-1">현재시점 생존 필터</p>
                                <p className="text-[22px] font-semibold text-slate-900 dark:text-white tabular-nums">
                                    {result.gates ? Object.values(result.gates).filter(g => g.pass).length : 0} / 6
                                </p>
                            </div>
                        </div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-5 p-3 bg-white dark:bg-[#1E293B] rounded border border-slate-200 dark:border-slate-700/50 leading-relaxed">
                        과거 배치(Cron) 시점엔 6/6 통과였어도, 현재 실시간 주가 변동에 따라 다를 수 있습니다.
                    </p>
                </div>

                {/* SVG Half Circle Gauge Card */}
                <div className="p-6 bg-slate-50 dark:bg-[#111827] rounded-md border border-slate-200 dark:border-slate-800 flex flex-col justify-center items-center relative min-h-[180px]">
                    <div className="relative w-44 md:w-52 h-24 md:h-28 mb-2 flex justify-center items-end">
                        <svg viewBox="0 0 200 110" className="w-full h-full absolute bottom-0">
                            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="16" strokeLinecap="round" />
                            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={GOOD} strokeWidth="16" strokeLinecap="round"
                                  strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * (result.score || 0) / 100)}
                                  style={{ transition: 'stroke-dashoffset 0.6s ease-out' }} />
                        </svg>
                        <div className="absolute bottom-0 w-full flex flex-col items-center justify-end pb-2">
                            <p className="text-[32px] md:text-[38px] font-semibold tracking-tight tabular-nums" style={{ color: GOOD }}>{(result.score || 0).toFixed(1)}</p>
                        </div>
                    </div>
                    <p className="text-[12.5px] text-slate-500 mt-2">퀀트 랭킹 스코어</p>
                </div>
            </div>

            {/* Entry Gates */}
            <div className="mb-8">
                <h5 className="text-[15px] font-semibold text-slate-900 dark:text-white mb-4">Entry Gates (6 conditions)</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    {['A', 'B', 'C', 'D', 'E', 'F'].map((label, idx) => {
                        const gateKeys = result.gates ? Object.keys(result.gates) : [];
                        const gate = gateKeys.length > idx ? result.gates[gateKeys[idx]] : { pass: false, name: '-', reason: '-' };
                        const passed = gate.pass;

                        return (
                        <div key={label} className={`p-3.5 rounded-md border flex flex-col justify-between h-24 ${passed ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50' : 'bg-slate-50 dark:bg-[#1E2329] border-slate-200 dark:border-slate-800'}`}>
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-semibold text-[14px]" style={{ color: passed ? GOOD : '#94A3B8' }}>{label}</span>
                                <span className="text-[10.5px]" style={{ color: passed ? GOOD : '#94A3B8' }}>{passed ? '통과' : '미달'}</span>
                            </div>
                            <div className="h-1 rounded-full w-full mb-2" style={{ background: passed ? GOOD : '#E2E8F0' }}></div>
                            <p className="text-[11px] truncate" style={{ color: passed ? GOOD : '#94A3B8' }} title={gate.name}>{gate.name}</p>
                        </div>
                    )})}
                </div>
            </div>

            {/* Financials & Valuation */}
            <div className="p-6 bg-slate-50 dark:bg-[#111827] rounded-md border border-slate-200 dark:border-slate-800 mb-8">
                <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white mb-5">Financials & Valuation</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-5 gap-x-4">
                    <div><p className="text-[12px] text-slate-500 mb-1">매출액</p><p className="text-[14.5px] font-medium text-slate-900 dark:text-white tabular-nums">{formatMarcap(result.fundamental?.revenue_cur)}</p></div>
                    <div><p className="text-[12px] text-slate-500 mb-1">영업이익</p><p className="text-[14.5px] font-medium text-slate-900 dark:text-white tabular-nums">{formatMarcap(result.fundamental?.op_profit_cur)}</p></div>
                    <div><p className="text-[12px] text-slate-500 mb-1">영업이익률</p><p className="text-[14.5px] font-medium text-slate-900 dark:text-white tabular-nums">{formatPct(result.fundamental?.op_margin)}</p></div>
                    <div><p className="text-[12px] text-slate-500 mb-1">ROE</p><p className="text-[14.5px] font-medium tabular-nums" style={{ color: POS }}>{formatPct(result.fundamental?.roe)}</p></div>
                    <div><p className="text-[12px] text-slate-500 mb-1">시가총액</p><p className="text-[14.5px] font-medium text-slate-900 dark:text-white tabular-nums">{formatMarcap(result.fundamental?.marcap_억)}</p></div>
                    <div><p className="text-[12px] text-slate-500 mb-1">PER</p><p className="text-[14.5px] font-medium text-slate-900 dark:text-white tabular-nums">{formatNumber(result.fundamental?.per)} 배</p></div>
                    <div><p className="text-[12px] text-slate-500 mb-1">PBR</p><p className="text-[14.5px] font-medium text-slate-900 dark:text-white tabular-nums">{formatNumber(result.fundamental?.pbr)} 배</p></div>
                    <div><p className="text-[12px] text-slate-500 mb-1">부채비율</p><p className="text-[14.5px] font-medium text-slate-900 dark:text-white tabular-nums">{formatPct(result.fundamental?.debt_ratio)}</p></div>
                </div>
            </div>

            {/* Price History Chart */}
            <div className="p-6 bg-slate-50 dark:bg-[#111827] rounded-md border border-slate-200 dark:border-slate-800 mb-8">
                <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                  <BarChart2 className="text-slate-400" size={16} strokeWidth={1.75} /> 가격 차트 (최근 120일)
                </h3>
                <div className="w-full h-[240px] md:h-[320px]">
                    {result.chart_data && result.chart_data.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={result.chart_data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />
                                <XAxis dataKey="date" tick={{fill: '#94A3B8', fontSize: 11, fontWeight: '500'}} tickLine={false} axisLine={false} minTickGap={30} tickFormatter={(val) => val ? String(val).substring(5).replace('-', '.') : ''}/>
                                <YAxis domain={['auto', 'auto']} tick={{fill: '#94A3B8', fontSize: 11, fontWeight: '500'}} tickLine={false} axisLine={false} tickFormatter={(value) => value !== undefined && value !== null ? value.toLocaleString() : ''} />
                                <Tooltip contentStyle={{backgroundColor: '#0F1B2E', borderColor: '#334155', borderRadius: '8px', color: 'white', fontWeight: '500'}} itemStyle={{color: POS}} labelStyle={{color: '#94A3B8', marginBottom: '4px'}} formatter={(value) => [value !== undefined && value !== null ? value.toLocaleString() : '', "종가"]} />
                                <Line type="monotone" dataKey="price" stroke={POS} strokeWidth={2} dot={false} activeDot={{r: 4, fill: POS, strokeWidth: 0}} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-[13px] text-slate-500">차트 데이터가 없습니다.</div>
                    )}
                </div>
            </div>

        </div>
      )}
    </div>
  );
}
