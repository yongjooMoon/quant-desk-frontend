import { useState, useEffect, useRef } from "react";
import { Search, Globe, ChevronLeft, ChevronRight, Calendar as CalendarIcon, RefreshCcw, X, ExternalLink, Moon } from "lucide-react";

// 🌟 [프론트엔드 캐시] TTL 관리 헬퍼 함수
const setCacheWithExpiry = (key, value, ttl_ms) => {
  const item = { data: value, expiry: new Date().getTime() + ttl_ms };
  sessionStorage.setItem(key, JSON.stringify(item));
};

const getCacheWithExpiry = (key) => {
  const itemStr = sessionStorage.getItem(key);
  if (!itemStr) return null;
  const item = JSON.parse(itemStr);
  if (new Date().getTime() > item.expiry) {
    sessionStorage.removeItem(key);
    return null;
  }
  return item.data;
};

const CACHE_TTL_NEWS = 10 * 60 * 1000; // 10분

export default function NewsDesk() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("전체");
  const [selectedNews, setSelectedNews] = useState(null);
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]);

  // 🌟 [추가] 서버 수면 상태 감지 (Render Cold Start)
  const [isServerSleeping, setIsServerSleeping] = useState(false);

  // 🌟 클라이언트 캐싱이 추가된 API 호출 함수
  const fetchNews = (isRefresh = false) => {
    setLoading(true);
    setIsServerSleeping(false);

    if (!isRefresh) {
      const cachedNews = getCacheWithExpiry('newsDesk_data_ttl');
      if (cachedNews) {
        setNews(cachedNews);
        setLoading(false);
        return; // 미국 서버까지 안 가고 0초 컷!
      }
    }

    // 💡 3초 이상 응답이 없으면 서버가 잠든 것으로 간주하고 애니메이션 띄움
    const sleepTimer = setTimeout(() => {
        setIsServerSleeping(true);
    }, 3000);

    const url = isRefresh 
      ? "https://moon-bbh0.onrender.com/api/news?refresh=true" 
      : "https://moon-bbh0.onrender.com/api/news";

    fetch(url)
      .then((res) => res.json())
      .then((result) => {
        clearTimeout(sleepTimer); // 응답 오면 타이머 즉시 해제
        setIsServerSleeping(false); // 수면 팝업 끄기
        if (result.status === "success") {
            setNews(result.data);
            setCacheWithExpiry('newsDesk_data_ttl', result.data, CACHE_TTL_NEWS);
        }
        setLoading(false);
      })
      .catch(() => {
          clearTimeout(sleepTimer);
          setIsServerSleeping(false);
          setLoading(false);
      });
  };

  useEffect(() => { fetchNews(); }, []);

  const getRegionStyle = (region) => {
    const r = String(region).toUpperCase();
    if (r.includes("US")) return { color: "#F87171", bg: "rgba(248, 113, 113, 0.15)" };
    if (r.includes("KR")) return { color: "#60A5FA", bg: "rgba(96, 165, 250, 0.15)" };
    if (r.includes("JP")) return { color: "#34D399", bg: "rgba(52, 211, 153, 0.15)" };
    if (r.includes("HK") || r.includes("CN")) return { color: "#FBBF24", bg: "rgba(251, 191, 36, 0.15)" };
    if (r.includes("GLOBAL")) return { color: "#A78BFA", bg: "rgba(167, 139, 250, 0.15)" };
    return { color: "#94A3B8", bg: "rgba(148, 163, 184, 0.15)" };
  };

  const parseKST = (utcStr) => {
    if (!utcStr) return new Date();
    const cleanStr = String(utcStr).split(".")[0].replace("T", " ");
    return new Date(cleanStr + "Z");
  };

  const getTodayKST = () => {
    const d = new Date();
    d.setHours(d.getHours() + 9);
    return d.toISOString().split('T')[0];
  };

  const todayStr = getTodayKST();
  const todayNews = news.filter(n => parseKST(n.created_at).toISOString().split('T')[0] === todayStr);
  const majorNews = todayNews.filter(n => n.is_major);

  const [carouselIdx, setCarouselIdx] = useState(0);
  const maxIdx = Math.max(0, majorNews.length - 2);

  const nextCarousel = () => setCarouselIdx(p => Math.min(p + 1, maxIdx));
  const prevCarousel = () => setCarouselIdx(p => Math.max(p - 1, 0));

  const changeDate = (days) => {
    const d = new Date(historyDate);
    d.setDate(d.getDate() + days);
    setHistoryDate(d.toISOString().split('T')[0]);
  };

  const openNewsDetail = (item) => setSelectedNews(item);

  return (
    <div className="w-full transition-colors duration-300 relative font-['Nunito',_ui-rounded,_-apple-system,_system-ui,_sans-serif] pb-20">
      
      {/* 🌟 [추가] 서버 수면 감지 시 귀여운 이불 덮고 자는 캐릭터 애니메이션 팝업 */}
      {isServerSleeping && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-500">
            <div className="relative w-48 h-48 mb-4">
                {/* 쿨쿨 자는 달(Moon) 캐릭터 SVG 애니메이션 */}
                <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
                    {/* 별빛 */}
                    <circle cx="30" cy="40" r="2" fill="#FDE047" className="animate-pulse" />
                    <circle cx="160" cy="20" r="1.5" fill="#FDE047" className="animate-pulse delay-75" />
                    <circle cx="180" cy="70" r="2.5" fill="#FDE047" className="animate-pulse delay-150" />
                    
                    {/* 이불 속 몸체 */}
                    <path d="M 40,150 Q 100,100 160,150 Z" fill="#3B82F6" opacity="0.2" />
                    
                    {/* 달 얼굴 */}
                    <circle cx="100" cy="110" r="45" fill="#FDE047" />
                    {/* 감은 눈 */}
                    <path d="M 80,105 Q 88,112 95,105" fill="none" stroke="#854D0E" strokeWidth="3" strokeLinecap="round" />
                    <path d="M 105,105 Q 112,112 120,105" fill="none" stroke="#854D0E" strokeWidth="3" strokeLinecap="round" />
                    {/* 콧방울(zzz) */}
                    <text x="135" y="80" fill="#E2E8F0" fontSize="16" fontWeight="bold" className="animate-[bounce_2s_infinite]">z</text>
                    <text x="145" y="65" fill="#E2E8F0" fontSize="22" fontWeight="bold" className="animate-[bounce_2s_infinite_200ms]">z</text>
                    <text x="160" y="45" fill="#E2E8F0" fontSize="30" fontWeight="bold" className="animate-[bounce_2s_infinite_400ms]">Z</text>
                    
                    {/* 덮고 있는 이불 (위아래로 숨쉬는 애니메이션) */}
                    <g className="animate-[pulse_3s_ease-in-out_infinite]">
                        <path d="M 20,160 Q 100,120 180,160 L 180,180 Q 100,200 20,180 Z" fill="#3182F6" />
                        <path d="M 20,160 Q 100,130 180,160" fill="none" stroke="#60A5FA" strokeWidth="8" strokeLinecap="round" />
                    </g>
                </svg>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-2 text-center shadow-black drop-shadow-xl flex items-center gap-2">
                <Moon className="text-yellow-300" /> 서버가 꿀잠 자는 중...
            </h2>
            <p className="text-blue-300 font-bold tracking-wide text-center max-w-sm px-4">
                무료 서버(Render)가 오랫동안 사용되지 않아 잠에 들었습니다.<br/>
                현재 부팅 중이니 <span className="text-yellow-300">약 30~50초만</span> 기다려주세요! 🚀
            </p>
            <div className="mt-8 flex gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce delay-75"></div>
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce delay-150"></div>
            </div>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl md:text-[32px] font-black text-slate-900 dark:text-white flex items-center gap-3 tracking-tight mb-3">
          <Globe className="text-[#3182F6]" size={32} />
          마켓 뉴스 데스크
        </h1>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 뉴스 검색 (제목 또는 내용)"
            className="w-full bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4 focus-within:border-blue-400 dark:focus-within:border-[#3182F6] transition-colors outline-none text-slate-900 dark:text-white text-[16px] font-bold placeholder-slate-400 dark:placeholder-slate-600 shadow-sm"
          />
        </div>
      </div>

      {loading && news.length === 0 ? (
        <div className="flex justify-center p-20 w-full"><RefreshCcw className="animate-spin text-blue-500" size={40} /></div>
      ) : (
        <>
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-[20px] font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">🔥 오늘 주요뉴스</h3>
            {majorNews.length > 2 && (
              <div className="flex gap-2">
                <button onClick={prevCarousel} disabled={carouselIdx === 0} className="w-9 h-9 flex items-center justify-center bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-500 transition-colors shadow-sm"><ChevronLeft size={18}/></button>
                <button onClick={nextCarousel} disabled={carouselIdx >= maxIdx} className="w-9 h-9 flex items-center justify-center bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-500 transition-colors shadow-sm"><ChevronRight size={18}/></button>
              </div>
            )}
          </div>

          <div className="mb-10">
            {majorNews.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {majorNews.slice(carouselIdx, carouselIdx + 2).map((item, idx) => {
                  const style = getRegionStyle(item.region || 'Global');
                  const dt = parseKST(item.created_at);
                  
                  return (
                    <div key={idx} onClick={() => openNewsDetail(item)} className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 rounded-2xl cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all flex flex-col justify-between h-40">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[11px] font-extrabold px-2.5 py-1 rounded" style={{backgroundColor: style.bg, color: style.color}}>{item.region || 'Global'}</span>
                        <span className="text-[12px] font-bold text-slate-500">{dt.getHours().toString().padStart(2,'0')}:{dt.getMinutes().toString().padStart(2,'0')}</span>
                      </div>
                      <div className="text-[16px] md:text-[18px] font-black text-slate-900 dark:text-white leading-snug line-clamp-2 mb-3">
                        {item.title}
                      </div>
                      <div>
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] px-3 py-1 rounded-full font-extrabold">#{item.sector_asset}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-6 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500 font-bold text-center">오늘 수집된 새로운 주요 뉴스가 없습니다. (배치 대기 중)</div>
            )}
          </div>

          <hr className="border-slate-200 dark:border-slate-800/60 my-10" />

          <h3 className="text-[20px] font-black text-slate-900 dark:text-white tracking-tight mb-6 flex items-center gap-2">📌 섹터별 최신 뉴스</h3>

          {searchQuery ? (
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
               {news.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()) || (n.summary && n.summary.toLowerCase().includes(searchQuery.toLowerCase()))).map((item, idx) => {
                  const style = getRegionStyle(item.region || 'Global');
                  const dt = parseKST(item.created_at);
                  return (
                    <div key={idx} onClick={() => openNewsDetail(item)} className="flex flex-col md:flex-row md:items-center px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer gap-2 md:gap-0">
                      <div className="flex items-center gap-3 md:w-[85%] pr-4 overflow-hidden">
                        <span className="text-[11px] font-extrabold px-2 py-0.5 rounded shrink-0" style={{backgroundColor: style.bg, color: style.color}}>{item.region || 'Global'}</span>
                        <span className="text-[13px] font-bold text-slate-500 shrink-0 hidden md:inline-block">· {item.sector_asset}</span>
                        <span className="text-[16px] font-black text-slate-900 dark:text-white truncate" title={item.title}>{item.title}</span>
                      </div>
                      <div className="md:w-[15%] text-left md:text-right text-[12px] font-bold text-slate-400">
                        {dt.getMonth()+1}.{dt.getDate()} {dt.getHours().toString().padStart(2,'0')}:{dt.getMinutes().toString().padStart(2,'0')}
                      </div>
                    </div>
                  )
               })}
            </div>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-6 pb-2 border-b border-slate-200 dark:border-slate-800">
                {["전체", ...Array.from(new Set(news.map(n => n.sector_asset.split('-')[0]))).sort(), "🔥 주요뉴스"].map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`shrink-0 px-4 py-2 text-[15px] font-black rounded-xl transition-all ${activeTab === tab ? 'bg-[#3182F6] text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}>
                    {tab}
                  </button>
                ))}
              </div>

              {activeTab === "🔥 주요뉴스" ? (
                <div className="animate-in fade-in duration-300">
                  <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => changeDate(-1)} className="px-4 py-2 bg-slate-100 dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-black text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">◀ 이전일</button>
                    <div className="flex-1 flex items-center justify-center gap-2 text-lg font-black text-slate-900 dark:text-white bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 py-2 rounded-xl shadow-sm"><CalendarIcon size={18} className="text-[#3182F6]"/> {historyDate}</div>
                    <button onClick={() => changeDate(1)} className="px-4 py-2 bg-slate-100 dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-black text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">다음일 ▶</button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {news.filter(n => n.is_major && parseKST(n.created_at).toISOString().split('T')[0] === historyDate).map((item, idx) => {
                      const style = getRegionStyle(item.region || 'Global');
                      const dt = parseKST(item.created_at);
                      return (
                        <div key={idx} onClick={() => openNewsDetail(item)} className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 rounded-2xl cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all flex flex-col justify-between h-36">
                          <div className="flex justify-between items-center mb-2">
                            <div>
                                <span className="text-[11px] font-extrabold px-2.5 py-1 rounded" style={{backgroundColor: style.bg, color: style.color}}>SAVE · {item.region || 'Global'}</span>
                                <span className="text-[12px] font-bold text-slate-500 ml-2">· {item.sector_asset}</span>
                            </div>
                            <span className="text-[12px] font-bold text-slate-500">{dt.getHours().toString().padStart(2,'0')}:{dt.getMinutes().toString().padStart(2,'0')}</span>
                          </div>
                          <div className="text-[16px] md:text-[17px] font-black text-slate-900 dark:text-white leading-snug line-clamp-2">
                            {item.title}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm animate-in fade-in duration-300">
                  {news.filter(n => activeTab === "전체" || n.sector_asset.startsWith(activeTab)).map((item, idx) => {
                      const style = getRegionStyle(item.region || 'Global');
                      const dt = parseKST(item.created_at);
                      return (
                        <div key={idx} onClick={() => openNewsDetail(item)} className="flex flex-col md:flex-row md:items-center px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer gap-2 md:gap-0">
                          <div className="flex items-center gap-3 md:w-[85%] pr-4 overflow-hidden">
                            <span className="text-[11px] font-extrabold px-2 py-0.5 rounded shrink-0" style={{backgroundColor: style.bg, color: style.color}}>{item.region || 'Global'}</span>
                            <span className="text-[13px] font-bold text-slate-500 shrink-0 hidden md:inline-block">· {item.sector_asset}</span>
                            <span className="text-[16px] font-black text-slate-900 dark:text-white truncate" title={item.title}>{item.title}</span>
                          </div>
                          <div className="md:w-[15%] text-left md:text-right text-[12px] font-bold text-slate-400">
                            {dt.getMonth()+1}.{dt.getDate()} {dt.getHours().toString().padStart(2,'0')}:{dt.getMinutes().toString().padStart(2,'0')}
                          </div>
                        </div>
                      )
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* 뉴스 상세 모달 */}
      {selectedNews && (() => {
        const dt = parseKST(selectedNews.created_at);
        const style = getRegionStyle(selectedNews.region || 'Global');
        let rawSummary = selectedNews.summary || "";
        let newsUrl = "";
        const parts = rawSummary.split(" ");
        if (parts.length > 1 && parts[parts.length-1].startsWith("http")) {
            newsUrl = parts.pop();
            rawSummary = parts.join(" ");
        }
        
        let scoreColor = "#10B981", scoreTxt = "Bullish (긍정적)";
        if (selectedNews.sentiment_score <= 2) { scoreColor = "#F04452"; scoreTxt = "Bearish (부정적)"; }
        else if (selectedNews.sentiment_score === 3) { scoreColor = "#F59E0B"; scoreTxt = "Neutral (중립)"; }

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 w-full max-w-[850px] max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800/80">
                      <div className="flex gap-2 items-center">
                          <span className="text-[12px] font-extrabold px-2.5 py-1 rounded" style={{backgroundColor: style.bg, color: style.color}}>{selectedNews.region || 'Global'}</span>
                          <span className="text-[13px] font-bold text-slate-500 dark:text-slate-400">· {selectedNews.sector_asset} · {dt.getFullYear().toString().substring(2)}.{dt.getMonth()+1}.{dt.getDate()}. {dt.getHours().toString().padStart(2,'0')}:{dt.getMinutes().toString().padStart(2,'0')}</span>
                      </div>
                      <button onClick={() => setSelectedNews(null)} className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full transition-colors cursor-pointer"><X size={20}/></button>
                  </div>
                  
                  <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar">
                      <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-snug mb-8">{selectedNews.title}</h2>
                      
                      <div className="bg-gradient-to-br from-blue-50 to-slate-50 dark:from-[#1E3A8A]/20 dark:to-[#0F172A]/60 border border-blue-100 dark:border-[#38BDF8]/20 p-6 rounded-2xl mb-8">
                          <h4 className="text-[#3182F6] dark:text-[#38BDF8] text-lg font-black mb-4 flex items-center gap-2">✨ AI 핵심 요약</h4>
                          <div className="text-[16px] md:text-[17px] font-bold text-slate-700 dark:text-[#E2E8F0] leading-relaxed whitespace-pre-wrap">
                              {rawSummary.replace(/(\d\.)/g, '\n\n$1').trim()}
                          </div>
                          {newsUrl && (
                              <a href={newsUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-100 dark:bg-[#38BDF8]/15 text-blue-600 dark:text-[#38BDF8] border border-blue-200 dark:border-[#38BDF8]/30 rounded-xl text-sm font-black hover:bg-blue-200 dark:hover:bg-[#38BDF8]/30 transition-colors">
                                  🔗 원문 기사 보러가기 <ExternalLink size={16}/>
                              </a>
                          )}
                      </div>

                      <div className="flex justify-between items-center py-5 border-t border-slate-200 dark:border-white/10">
                          <span className="text-[15px] font-extrabold text-slate-500 dark:text-[#94A3B8]">AI Sentiment Score</span>
                          <span className="font-black text-[16px] px-5 py-2 rounded-full" style={{backgroundColor: `${scoreColor}1A`, color: scoreColor}}>
                              {selectedNews.sentiment_score} / 5 &nbsp;·&nbsp; {scoreTxt}
                          </span>
                      </div>
                  </div>
              </div>
          </div>
        );
      })()}
    </div>
  );
}
