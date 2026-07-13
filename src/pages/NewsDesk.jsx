// src/pages/NewsDesk.jsx
import { useEffect, useState, useRef } from 'react';
import { Search, ChevronLeft, ChevronRight, RefreshCcw, X, Calendar } from 'lucide-react';
// 분리된 공통 API 훅 임포트
import { useRenderApi } from '../hooks/useRenderApi';

export default function NewsDesk() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("전체");
  const [selectedNews, setSelectedNews] = useState(null);

  // 공통 API 훅 사용
  const { callApi, ServerWakeupOverlay } = useRenderApi();

  const getTodayStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const [historyDate, setHistoryDate] = useState(getTodayStr());

  const sliderRef = useRef(null);
  const tabsRef = useRef(null);
  const dragRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });

  const tabsNames = [
    "전체", 
    "🔥 주요뉴스", 
    "📊 거시경제/지수", 
    "🏢 기업/산업", 
    "🛢️ 원자재/에너지", 
    "💱 외환/채권", 
    "🌍 지정학/글로벌", 
    "🏘️ 대체/기타 자산"
  ];

  const fetchNews = (isRefresh = false) => {
    setLoading(true);

    // 🌟 BASE_URL이 fetchApi에 정의되어 있으므로 엔드포인트만 전달
    const endpoint = isRefresh ? "/api/news?refresh=true" : "/api/news";

    // 🌟 분리된 callApi(fetchApi 래퍼) 호출 (내부적으로 슬립 타이머 작동, 이미 json으로 파싱되어 반환됨)
    callApi(endpoint)
      .then((result) => {
        if (result.status === "success") {
           setNews(result.data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchNews(); }, []);

  const parseDBTime = (isoString) => {
    if (!isoString) return new Date();
    const parts = isoString.match(/\d+/g);
    if (!parts || parts.length < 5) return new Date();
    return new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10),
      parseInt(parts[3], 10),
      parseInt(parts[4], 10),
      parts[5] ? parseInt(parts[5], 10) : 0
    );
  };

  const formatTime = (isoString) => {
    if (!isoString) return "";
    const date = parseDBTime(isoString);
    const now = new Date();
    let diffMins = Math.floor((now - date) / 1000 / 60);

    if (diffMins < 0) diffMins = 0;

    if (diffMins < 60) return diffMins === 0 ? "방금 전" : `${diffMins}분 전`;
    if (diffMins >= 60 && diffMins < 1440) return `${Math.floor(diffMins / 60)}시간 전`;

    return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const formatExactTime = (isoString) => {
    if (!isoString) return "";
    const date = parseDBTime(isoString);
    return `${String(date.getFullYear()).slice(2)}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const getDateStr = (d) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getItemCategory = (item) => {
    return (item.region || item.category || "").trim();
  };

  const getShortCategoryName = (category) => {
    if (!category) return "기타";
    const cleanCat = category.replace(/[^가-힣a-zA-Z0-9/ ]/g, '').trim();
    if (!cleanCat.includes('/')) return cleanCat.substring(0, 3);
    
    const parts = cleanCat.split('/').map(p => p.trim());
    return parts[0].length <= parts[1].length ? parts[0] : parts[1];
  };

  const getSentimentInfo = (score) => {
    if (score <= 2) return { text: "Bearish (부정적)", classes: "bg-red-100 text-red-700 dark:bg-[#3F1A1A] dark:text-[#F87171] border border-red-900/50" };
    if (score === 3) return { text: "Neutral (중립)", classes: "bg-yellow-100 text-yellow-700 dark:bg-[#3F311A] dark:text-[#FBBF24] border border-yellow-900/50" };
    return { text: "Bullish (긍정적)", classes: "bg-emerald-100 text-emerald-700 dark:bg-[#1A3F2A] dark:text-[#34D399] border border-emerald-900/50" };
  };

  const getCategoryStyle = (category) => {
    const c = category || "";
    if (c.includes("거시경제") || c.includes("지수")) return "text-[#60A5FA] bg-[#60A5FA]/10 border border-[#60A5FA]/20";
    if (c.includes("기업") || c.includes("산업")) return "text-[#34D399] bg-[#34D399]/10 border border-[#34D399]/20";
    if (c.includes("원자재") || c.includes("에너지")) return "text-[#FBBF24] bg-[#FBBF24]/10 border border-[#FBBF24]/20";
    if (c.includes("외환") || c.includes("채권")) return "text-[#818CF8] bg-[#818CF8]/10 border border-[#818CF8]/20";
    if (c.includes("지정학") || c.includes("글로벌")) return "text-[#F87171] bg-[#F87171]/10 border border-[#F87171]/20";
    if (c.includes("대체") || c.includes("기타")) return "text-[#A78BFA] bg-[#A78BFA]/10 border border-[#A78BFA]/20";
    return "text-[#2DD4BF] bg-[#2DD4BF]/10 border border-[#2DD4BF]/20";
  };

  const handleMouseDown = (e, ref) => {
    dragRef.current = ref.current;
    setIsDragging(true);
    setStartX(e.pageX - ref.current.offsetLeft);
    setScrollLeft(ref.current.scrollLeft);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    ref.current.style.scrollSnapType = 'none';
  };

  const handleMouseLeaveOrUp = () => {
    setIsDragging(false);
    if(dragRef.current) dragRef.current.style.scrollSnapType = 'x mandatory';
    dragRef.current = null;
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !dragRef.current) return;
    e.preventDefault();
    const x = e.pageX - dragRef.current.offsetLeft;
    const walk = (x - startX) * 2.2;
    dragRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleCardClick = (e, item) => {
    const distance = Math.abs(e.clientX - dragStartPos.x);
    if (distance > 5) return;
    setSelectedNews(item);
  };

  const todayMajorNews = news.filter(n => n.is_major && getDateStr(parseDBTime(n.created_at)) === getTodayStr());

  const filteredList = news.filter(n => {
    if (searchQuery) return n.title.toLowerCase().includes(searchQuery.toLowerCase()) || (n.summary || "").toLowerCase().includes(searchQuery.toLowerCase());
    if (activeTab === "전체") return true;
    if (activeTab === "🔥 주요뉴스") {
      return n.is_major && getDateStr(parseDBTime(n.created_at)) === historyDate;
    }
    const itemCat = getItemCategory(n);
    return activeTab.includes(itemCat);
  });

  const currentViewList = activeTab === "🔥 주요뉴스" || (!searchQuery && activeTab === "전체") ? news : filteredList;
  const selectedIdx = selectedNews ? currentViewList.findIndex(n => n.id === selectedNews.id) : -1;

  const handlePrevNews = () => { if (selectedIdx > 0) setSelectedNews(currentViewList[selectedIdx - 1]); };
  const handleNextNews = () => { if (selectedIdx < currentViewList.length - 1) setSelectedNews(currentViewList[selectedIdx + 1]); };

  const shiftDate = (days) => {
    const d = new Date(historyDate);
    d.setDate(d.getDate() + days);
    setHistoryDate(d.toISOString().split('T')[0]);
  };

  const showCategoryBadge = true;

  return (
    <div className="w-full transition-colors duration-300 pb-20 font-['Nunito',_ui-rounded,_-apple-system,_system-ui,_sans-serif]">
      
      {/* 🌟 통신 지연 시 띄워주는 서버 기상 오버레이 */}
      <ServerWakeupOverlay />

      <div className="mb-10">
        <div className="w-full flex items-center bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/80 rounded-xl px-4 py-3 shadow-sm">
          <Search className="text-slate-400 mr-3" size={20} />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="🔍 뉴스 검색 (제목 또는 내용)" className="flex-1 bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder-slate-400 text-sm md:text-base font-extrabold" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><RefreshCcw className="animate-spin text-blue-500" size={32} /></div>
      ) : (
        <>
          {!searchQuery && (
            <div className="mb-12 select-none">
              <h2 className="text-2xl md:text-[28px] font-black text-slate-900 dark:text-white flex items-center mb-6 tracking-tight">
                🔥 오늘 주요뉴스
              </h2>
              {todayMajorNews.length > 0 ? (
                <div
                  ref={sliderRef}
                  onMouseDown={(e) => handleMouseDown(e, sliderRef)}
                  onMouseLeave={handleMouseLeaveOrUp}
                  onMouseUp={handleMouseLeaveOrUp}
                  onMouseMove={handleMouseMove}
                  className={`flex overflow-x-auto gap-4 md:gap-5 pb-4 hide-scrollbar snap-x snap-mandatory ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                >
                  {todayMajorNews.map((item) => (
                    <div
                      key={item.id}
                      onClick={(e) => handleCardClick(e, item)}
                      className="w-[85vw] sm:w-[320px] md:w-[340px] lg:w-[360px] snap-center shrink-0 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:border-blue-400 dark:hover:border-slate-600 transition-all flex flex-col justify-between min-h-[160px] shadow-sm hover:shadow-lg"
                    >
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          {showCategoryBadge && (
                            <span className={`text-[11px] font-black px-2.5 py-1 rounded-md ${getCategoryStyle(getItemCategory(item))}`}>
                              {getShortCategoryName(getItemCategory(item))}
                            </span>
                          )}
                          <span className="text-[12px] text-slate-500 dark:text-slate-400 font-extrabold">{formatTime(item.created_at)}</span>
                        </div>
                        <h3 className="text-[18px] md:text-[20px] font-black text-slate-900 dark:text-white leading-snug line-clamp-2 tracking-tight">{item.title}</h3>
                      </div>
                      
                      {item.sector_asset && item.sector_asset.trim() !== "" && (
                        <div className="mt-4">
                          <span className="text-[12px] font-extrabold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700/50">
                            #{item.sector_asset}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-500 text-sm py-8 text-center bg-slate-50 dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 font-extrabold">
                  오늘 수집된 주요 뉴스가 없습니다.
                </div>
              )}
            </div>
          )}

          <div>
            <h2 translate="no" className="text-2xl md:text-[28px] font-black text-slate-900 dark:text-white mb-6 tracking-tight">📌 {searchQuery ? '검색 결과' : '섹터별 최신 뉴스'}</h2>

            {!searchQuery && (
              <div
                ref={tabsRef}
                onMouseDown={(e) => handleMouseDown(e, tabsRef)}
                onMouseLeave={handleMouseLeaveOrUp}
                onMouseUp={handleMouseLeaveOrUp}
                onMouseMove={handleMouseMove}
                className={`flex gap-3 md:gap-5 border-b border-slate-200 dark:border-slate-800 mb-6 overflow-x-auto whitespace-nowrap hide-scrollbar pb-0 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              >
                {tabsNames.map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-3 px-2 text-[14px] md:text-[15px] font-black tracking-tight transition-colors ${activeTab === tab ? 'text-[#FF4B4B] border-b-[3px] border-[#FF4B4B]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                    {tab}
                  </button>
                ))}
              </div>
            )}

            {!searchQuery && activeTab === "🔥 주요뉴스" && (
                <div className="flex items-center gap-2 mb-6 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-xl w-fit border border-slate-200 dark:border-slate-700/50 shadow-sm">
                    <button onClick={() => shiftDate(-1)} className="px-3 py-2 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 font-extrabold text-sm flex items-center transition-colors">
                        <ChevronLeft size={16} className="mr-1"/> 이전일
                    </button>
                    <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#0B1120] border border-slate-300 dark:border-slate-600 rounded-lg font-extrabold text-sm relative shadow-inner cursor-pointer hover:border-blue-400 transition-colors">
                        <Calendar size={15} className="text-blue-500 dark:text-blue-400" />
                        <input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                        <span className="text-slate-800 dark:text-slate-100 pr-1 tracking-tight">{historyDate}</span>
                    </div>
                    <button onClick={() => shiftDate(1)} className="px-3 py-2 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 font-extrabold text-sm flex items-center transition-colors">
                        다음일 <ChevronRight size={16} className="ml-1"/>
                    </button>
                </div>
            )}

            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              {filteredList.length > 0 ? filteredList.slice(0, 50).map((item) => (
                <div key={item.id} onClick={() => setSelectedNews(item)} className="p-4 md:p-5 border-b border-slate-100 dark:border-slate-800/80 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors flex flex-col gap-2">
                  
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 overflow-hidden">
                      {showCategoryBadge && (
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded shrink-0 ${getCategoryStyle(getItemCategory(item))}`}>
                          {getShortCategoryName(getItemCategory(item))}
                        </span>
                      )}
                      
                      {item.sector_asset && item.sector_asset.trim() !== "" && (
                        <span className="text-[13px] font-bold text-slate-500 dark:text-slate-400 truncate">
                          · {item.sector_asset}
                        </span>
                      )}
                    </div>
                    
                    <span className="text-[12.5px] text-slate-400 dark:text-slate-500 font-extrabold shrink-0 whitespace-nowrap ml-2">
                      {formatTime(item.created_at)}
                    </span>
                  </div>

                  <div className="w-full">
                    <h3 className="text-[16px] md:text-[18px] font-black text-slate-900 dark:text-slate-100 tracking-tight leading-snug break-words">
                      {item.title}
                    </h3>
                  </div>
                  
                </div>
              )) : <div className="p-8 text-center text-slate-500 dark:text-slate-400 font-extrabold">해당 조건의 뉴스가 없습니다.</div>}
            </div>
          </div>
        </>
      )}

      {selectedNews && (() => {
        const sentiment = getSentimentInfo(selectedNews.sentiment_score);
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 w-full max-w-[1200px] min-h-[60vh] md:min-h-[75vh] max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

              <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex gap-2 items-center">
                      {showCategoryBadge && (
                        <span className={`text-[11.5px] font-black px-2.5 py-1 rounded ${getCategoryStyle(getItemCategory(selectedNews))}`}>
                          {getShortCategoryName(getItemCategory(selectedNews))}
                        </span>
                      )}
                      
                      {selectedNews.sector_asset && selectedNews.sector_asset.trim() !== "" && (
                        <span className="text-[14.5px] font-extrabold text-slate-500 dark:text-slate-400">
                          · {selectedNews.sector_asset}
                        </span>
                      )}
                  </div>
                  <div className="flex items-center gap-4">
                      <span className="text-[14px] font-extrabold text-slate-400 dark:text-slate-500 tracking-tight">{formatExactTime(selectedNews.created_at)}</span>
                      <button onClick={() => setSelectedNews(null)} className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full transition-colors"><X size={20}/></button>
                  </div>
              </div>

              <div className="p-6 md:p-10 overflow-y-auto flex-1">
                  <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-8 leading-tight tracking-tight">
                      {selectedNews.title}
                  </h2>
                  <div className="bg-blue-50/50 dark:bg-[#151D2C] border border-blue-100 dark:border-slate-700/50 rounded-2xl p-6 md:p-8 mb-8 shadow-inner">
                      <h4 className="text-blue-600 dark:text-[#38BDF8] font-black mb-5 flex items-center gap-2 text-lg">✨ AI 핵심 요약</h4>
                      <p className="text-slate-800 dark:text-slate-200 leading-loose whitespace-pre-line text-[16px] md:text-[18px] font-bold">
                          {selectedNews.summary.replace(/http[^\s]+/g, '').replace(/<br><br>/g, '\n\n').trim()}
                      </p>
                  </div>

                  <div className="py-4 border-t border-slate-100 dark:border-slate-800/80 mt-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                          <span className="text-[15px] sm:text-[16px] md:text-[17px] font-black text-slate-500 dark:text-slate-400 tracking-tight">AI Sentiment Score</span>
                          <span className={`font-black px-4 sm:px-5 py-2.5 rounded-xl sm:rounded-full text-[13px] sm:text-[14px] md:text-[15px] shadow-sm text-center sm:text-left ${sentiment.classes}`}>
                              {selectedNews.sentiment_score} / 5 · {sentiment.text}
                          </span>
                      </div>
                  </div>
              </div>

              <div className="p-5 border-t border-slate-100 dark:border-slate-800/80 flex justify-between bg-slate-50 dark:bg-[#111827]">
                <button
                  onClick={handlePrevNews} disabled={selectedIdx <= 0}
                  className="flex items-center gap-2 px-5 py-2.5 font-extrabold text-[15px] text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <ChevronLeft size={18}/> 이전 뉴스
                </button>
                <button
                  onClick={handleNextNews} disabled={selectedIdx >= currentViewList.length - 1 || selectedIdx === -1}
                  className="flex items-center gap-2 px-5 py-2.5 font-extrabold text-[15px] text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  다음 뉴스 <ChevronRight size={18}/>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
