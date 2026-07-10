// src/pages/StockSearch.jsx
import { useState, useEffect, useRef } from 'react';
import { Search, BarChart2, RefreshCcw } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, XAxis, CartesianGrid } from 'recharts';

export default function StockSearch() {
  const [options, setOptions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 🌟 키보드 네비게이션을 위한 상태 및 Ref 추가
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const optionsListRef = useRef(null);

  useEffect(() => {
    fetch("https://moon-bbh0.onrender.com/api/krx-list")
      .then(res => res.json())
      .then(data => { if (data.status === "success") setOptions(data.data); })
      .catch(err => console.error(err));
  }, []);

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

  // 검색어가 바뀌면 포커스 초기화
  useEffect(() => {
    setFocusedIndex(-1);
  }, [searchTerm]);

  // 포커스된 항목이 화면에 보이도록 스크롤 자동 이동
  useEffect(() => {
    if (isDropdownOpen && optionsListRef.current && focusedIndex >= 0) {
      const listNode = optionsListRef.current;
      const focusedNode = listNode.children[focusedIndex];
      if (focusedNode) {
        const nodeTop = focusedNode.offsetTop;
        const nodeBottom = nodeTop + focusedNode.offsetHeight;
        const scrollTop = listNode.scrollTop;
        const scrollBottom = scrollTop + listNode.offsetHeight;

        if (nodeTop < scrollTop) {
          listNode.scrollTop = nodeTop;
        } else if (nodeBottom > scrollBottom) {
          listNode.scrollTop = nodeBottom - listNode.offsetHeight;
        }
      }
    }
  }, [focusedIndex, isDropdownOpen]);

  const handleSelect = (symbol, searchStr) => {
    setSearchTerm(searchStr);
    setIsDropdownOpen(false);
    setFocusedIndex(-1);
    setLoading(true);
    setError("");
    setResult(null);

    fetch(`https://moon-bbh0.onrender.com/api/search/${symbol}`)
      .then(res => res.json())
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

  // 🌟 키보드 입력 핸들러 (위/아래 방향키 및 엔터 지원)
  const handleKeyDown = (e) => {
    if (!isDropdownOpen) {
      if (e.key === "Enter" && searchTerm) {
        setIsDropdownOpen(true);
      }
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
        // 포커스가 없어도 엔터 치면 가장 첫 번째 항목 자동 선택
        const opt = filteredOptions[0];
        handleSelect(opt.Symbol, opt.SearchStr);
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false);
    }
  };

  // 🌟 퀀트 데스크와 동일한 포맷팅 함수 적용
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
    <div className="w-full px-4 md:px-8 py-8 md:py-10 transition-colors duration-300 relative font-['Nunito',_ui-rounded,_-apple-system,_system-ui,_sans-serif] pb-20">

      {/* 🌟 타이틀 섹션 */}
      <div className="mb-10">
        <h1 className="text-3xl md:text-[32px] font-black text-slate-900 dark:text-white flex items-center gap-3 tracking-tight mb-3">
          <Search className="text-[#3182F6]" size={32} />
          주식 가격 통합 검색
        </h1>
        <p className="text-[15px] md:text-[16px] font-bold text-slate-500 dark:text-slate-400">
          원하는 종목명 또는 코드를 검색하면 실시간 퀀트 분석 결과를 출력합니다.
        </p>
      </div>

      {/* 🌟 메인 검색 컨테이너 (콤보박스) */}
      <div className="mb-12 relative z-50 w-full" ref={wrapperRef}>
        <div className="relative">
          <div className="flex items-center bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-5 focus-within:border-blue-400 dark:focus-within:border-[#3182F6] transition-all shadow-sm hover:shadow-md">
            <Search className="text-slate-400 mr-4" size={24} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setIsDropdownOpen(true); }}
              onFocus={() => setIsDropdownOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder="종목명 또는 코드를 입력하세요 (예: 삼성전자)"
              className="flex-1 bg-transparent border-none outline-none text-slate-900 dark:text-white text-[18px] md:text-[20px] font-black placeholder-slate-400 dark:placeholder-slate-600"
            />
          </div>

          {/* 🌟 드롭다운 리스트 */}
          {isDropdownOpen && searchTerm && (
            <div
              ref={optionsListRef}
              className="absolute z-[100] w-full mt-3 bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-[350px] overflow-y-auto custom-scrollbar overflow-hidden"
            >
              {filteredOptions.length > 0 ? filteredOptions.map((opt, idx) => (
                  <div
                    key={opt.Symbol}
                    onClick={() => handleSelect(opt.Symbol, opt.SearchStr)}
                    onMouseEnter={() => setFocusedIndex(idx)}
                    className={`px-6 py-4 text-[16px] font-black cursor-pointer border-b border-slate-100 dark:border-slate-800/80 last:border-0 transition-colors ${
                      focusedIndex === idx
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#111827]'
                    }`}
                  >
                    {opt.SearchStr}
                  </div>
                )) : (
                  <div className="px-6 py-8 text-center text-slate-500 dark:text-slate-500 font-bold text-[15px]">
                    검색 결과가 없습니다.
                  </div>
                )}
            </div>
          )}
          <style>{`.custom-scrollbar::-webkit-scrollbar { width: 8px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; } .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }`}</style>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-blue-500 mt-4 font-black text-[15px] animate-pulse pl-2">
            <RefreshCcw size={18} className="animate-spin" /> 실시간 데이터 분석 중...
          </div>
        )}
        {error && (
          <div className="text-[#F04452] font-black text-[15px] mt-4 pl-2">
            ❌ {error}
          </div>
        )}
      </div>

      {/* 📊 분석 리포트 (퀀트 데스크 모달과 100% 동일한 레이아웃 적용) */}
      {result && !loading && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
            
            <div className="mb-8 md:mb-10 flex flex-col items-start gap-1 border-b border-slate-200 dark:border-slate-800/80 pb-8">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-[14px] md:text-[15px] font-black text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-md">{result.symbol}</span>
                    <span className="text-[14px] md:text-[15px] font-black text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-md">{result.market || "KOSPI"}</span>
                    {result.sector && <span className="text-[14px] md:text-[15px] font-black text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-md">{result.sector}</span>}
                </div>
                <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-2 md:mb-4 leading-tight tracking-tight">
                    {result.name}
                </h2>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-baseline">
                    {formatNumber(result.current_price)} 원 
                    <span className={`text-[18px] md:text-[24px] ml-3 ${(result.ret_1m || 0) > 0 ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>
                        {(result.ret_1m || 0) > 0 ? '+' : ''}{formatPct(result.ret_1m || 0)} (1M)
                    </span>
                </h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                {/* Quant Scores Card */}
                <div className="p-6 md:p-8 bg-slate-50 dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-6 tracking-tight">⚡ Quant Scores</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">실시간 랭킹 스코어</p>
                                <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">{(result.score || 0).toFixed(2)}점</p>
                            </div>
                            <div>
                                <p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">현재시점 생존 필터</p>
                                <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">
                                    {result.gates ? Object.values(result.gates).filter(g => g.pass).length : 0} / 6
                                </p>
                            </div>
                        </div>
                    </div>
                    <p className="text-[11px] md:text-[12px] font-extrabold text-slate-500 mt-6 p-3 md:p-4 bg-white dark:bg-[#1E293B] rounded-xl border border-slate-200 dark:border-slate-700/50 leading-relaxed">
                        💡 과거 배치(Cron) 시점엔 6/6 통과였어도, 현재 실시간 주가 변동에 따라 다를 수 있습니다.
                    </p>
                </div>

                {/* SVG Half Circle Gauge Card */}
                <div className="p-6 md:p-8 bg-slate-50 dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center items-center relative min-h-[220px]">
                    <div className="relative w-48 md:w-56 h-28 md:h-32 mb-2 flex justify-center items-end">
                        <svg viewBox="0 0 200 110" className="w-full h-full absolute bottom-0">
                            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="18" strokeLinecap="round" />
                            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#00B464" strokeWidth="18" strokeLinecap="round"
                                  strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * (result.score || 0) / 100)}
                                  style={{ transition: 'stroke-dashoffset 1.5s ease-in-out' }} />
                        </svg>
                        <div className="absolute bottom-0 w-full flex flex-col items-center justify-end pb-2">
                            <p className="text-4xl md:text-5xl font-black text-[#00B464] tracking-tighter">{(result.score || 0).toFixed(1)}</p>
                        </div>
                    </div>
                    <p className="text-[13px] md:text-[14px] font-extrabold text-slate-500 mt-2">퀀트 랭킹 스코어</p>
                </div>
            </div>

            {/* Entry Gates */}
            <div className="mb-10">
                <h5 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-4 md:mb-6 tracking-tight">Entry Gates (6 conditions)</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
                    {['A', 'B', 'C', 'D', 'E', 'F'].map((label, idx) => {
                        const gateKeys = result.gates ? Object.keys(result.gates) : [];
                        const gate = gateKeys.length > idx ? result.gates[gateKeys[idx]] : { pass: false, name: '-', reason: '-' };
                        const passed = gate.pass;

                        return (
                        <div key={label} className={`p-4 md:p-5 rounded-3xl border ${passed ? 'bg-[#00B464]/10 border-[#00B464]/50 shadow-sm' : 'bg-slate-50 dark:bg-[#1E2329] border-slate-200 dark:border-slate-800'} flex flex-col justify-between h-28 md:h-32 transition-all`}>
                            <div className="flex justify-between items-center mb-2">
                                <span className={`font-black text-[16px] md:text-[18px] ${passed ? 'text-[#00B464]' : 'text-slate-400'}`}>{label}</span>
                                <span className="text-[14px]">{passed ? '✔️' : '❌'}</span>
                            </div>
                            <div className={`h-1.5 md:h-2 rounded-full w-full mb-2 md:mb-3 ${passed ? 'bg-[#00B464]' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                            <p className={`text-[12px] md:text-[13px] font-extrabold truncate ${passed ? 'text-[#00B464]' : 'text-slate-500'}`} title={gate.name}>{gate.name}</p>
                        </div>
                    )})}
                </div>
            </div>

            {/* Financials & Valuation */}
            <div className="p-6 md:p-8 bg-slate-50 dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm mb-10">
                <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-6 tracking-tight">📊 Financials & Valuation</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 md:gap-y-8 gap-x-4 md:gap-x-6">
                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">매출액</p><p className="text-[15px] md:text-[18px] font-black text-slate-900 dark:text-white">{formatMarcap(result.fundamental?.revenue_cur)}</p></div>
                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">영업이익</p><p className="text-[15px] md:text-[18px] font-black text-slate-900 dark:text-white">{formatMarcap(result.fundamental?.op_profit_cur)}</p></div>
                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">영업이익률</p><p className="text-[15px] md:text-[18px] font-black text-slate-900 dark:text-white">{formatPct(result.fundamental?.op_margin)}</p></div>
                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">ROE</p><p className="text-[15px] md:text-[18px] font-black text-[#FF4B4B]">{formatPct(result.fundamental?.roe)}</p></div>
                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">시가총액</p><p className="text-[15px] md:text-[18px] font-black text-slate-900 dark:text-white">{formatMarcap(result.fundamental?.marcap_억)}</p></div>
                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">PER</p><p className="text-[15px] md:text-[18px] font-black text-slate-900 dark:text-white">{formatNumber(result.fundamental?.per)} 배</p></div>
                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">PBR</p><p className="text-[15px] md:text-[18px] font-black text-slate-900 dark:text-white">{formatNumber(result.fundamental?.pbr)} 배</p></div>
                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">부채비율</p><p className="text-[15px] md:text-[18px] font-black text-slate-900 dark:text-white">{formatPct(result.fundamental?.debt_ratio)}</p></div>
                </div>
            </div>

            {/* Price History Chart */}
            <div className="p-6 md:p-8 bg-slate-50 dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-6 tracking-tight flex items-center gap-2">
                  <BarChart2 className="text-[#FF4B4B]" size={24} /> 가격 차트 (최근 120일)
                </h3>
                <div className="w-full h-[250px] md:h-[350px]">
                    {result.chart_data && result.chart_data.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={result.chart_data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />
                                <XAxis dataKey="date" tick={{fill: '#94A3B8', fontSize: 11, fontWeight: '800'}} tickLine={false} axisLine={false} minTickGap={30} tickFormatter={(val) => val ? String(val).substring(5).replace('-', '.') : ''}/>
                                <YAxis domain={['auto', 'auto']} tick={{fill: '#94A3B8', fontSize: 11, fontWeight: '800'}} tickLine={false} axisLine={false} tickFormatter={(value) => value !== undefined && value !== null ? value.toLocaleString() : ''} />
                                <Tooltip contentStyle={{backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', color: 'white', fontWeight: '900'}} itemStyle={{color: '#FF4B4B'}} labelStyle={{color: '#94A3B8', marginBottom: '4px'}} formatter={(value) => [value !== undefined && value !== null ? value.toLocaleString() : '', "종가"]} />
                                <Line type="monotone" dataKey="price" stroke="#FF4B4B" strokeWidth={2.5} dot={false} activeDot={{r: 6, fill: '#FF4B4B', strokeWidth: 0}} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center font-extrabold text-slate-500">차트 데이터가 없습니다.</div>
                    )}
                </div>
            </div>

        </div>
      )}
    </div>
  );
}
