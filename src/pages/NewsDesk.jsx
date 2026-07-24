// src/pages/NewsDesk.jsx
import { useEffect, useState, useRef } from 'react';
import { Search, ChevronLeft, ChevronRight, RefreshCcw, X, Calendar } from 'lucide-react';
// 🌟 분리된 공통 API 훅 임포트
import { useRenderApi } from '../hooks/useRenderApi';

// 🌟 마이크로 인터랙션 전용 스타일 (LIVE 펄스, 스켈레톤 셰머, 검색창 글로우)
const NEWS_MICRO_STYLES = `
  @keyframes newsLivePulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(1.6); }
  }
  .news-live-dot { position: relative; display: inline-block; width: 6px; height: 6px; border-radius: 9999px; background: #FF4B4B; }
  .news-live-dot::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 9999px;
    background: #FF4B4B;
    animation: newsLivePulse 1.6s ease-out infinite;
  }

  .news-skeleton {
    position: relative;
    overflow: hidden;
    background: linear-gradient(90deg, rgba(148,163,184,0.14) 25%, rgba(148,163,184,0.28) 37%, rgba(148,163,184,0.14) 63%);
    background-size: 400% 100%;
    animation: newsShimmer 1.4s ease infinite;
  }
  .dark .news-skeleton {
    background: linear-gradient(90deg, rgba(51,65,85,0.35) 25%, rgba(71,85,105,0.55) 37%, rgba(51,65,85,0.35) 63%);
    background-size: 400% 100%;
    animation: newsShimmer 1.4s ease infinite;
  }
  @keyframes newsShimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

  .news-search-glow { transition: box-shadow 0.3s ease, border-color 0.3s ease; }
  .news-search-glow:focus-within {
    box-shadow: 0 0 0 4px rgba(255,75,75,0.12), 0 0 24px rgba(255,75,75,0.18);
    border-color: rgba(255,75,75,0.5);
  }

  .news-tilt-card { transition: transform 0.2s ease-out, box-shadow 0.2s ease-out; will-change: transform; }

  .news-blob { position: absolute; border-radius: 9999px; filter: blur(70px); pointer-events: none; }

  @keyframes newsRowIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .news-row-in { animation: newsRowIn 0.45s ease-out both; }
`;

export default function NewsDesk() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("전체");
  const [selectedNews, setSelectedNews] = useState(null);

  // 🌟 공통 API 훅 사용
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

  // 🌟 탭 밑줄 슬라이드 애니메이션용 refs & state
  const tabRefs = useRef({});
  const [underlineStyle, setUnderlineStyle] = useState({ left: 0, width: 0 });

  // 🌟 상세 모달: 읽기 진행률 바 & 감성 게이지 애니메이션용
  const modalContentRef = useRef(null);
  const [readProgress, setReadProgress] = useState(0);
  const [gaugeAnimated, setGaugeAnimated] = useState(false);

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

    const endpoint = isRefresh ? "/api/news?refresh=true" : "/api/news";

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

  // 🌟 핵심 수정: 카드 리스트용 상대 시간 포맷 함수
  const formatTime = (isoString) => {
    if (!isoString) return "";
    const date = parseDBTime(isoString);
    const now = new Date();
    
    // 두 시간의 차이를 분 단위로 계산
    const diffMs = now - date;
    let diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 0) diffMins = 0; // 미래 시간이 나올 경우 방어

    // 1. 60분 미만일 경우: "X분 전"
    if (diffMins < 60) {
        // 0분 전일 경우 "방금 전"으로 표시
        // 분석가님 요청사항을 더 살려 "1분 전"부터 나오게 하려면 아래 코드 유지
        // 10분 단위로 끊고 싶으시다면 아래 주석을 참고해주세요!
        // --------------------------------------------------
        // (요청 해석) "10분단위로 몇분전" 이라는 말씀이
        // 1~9분 -> 방금 전
        // 12분 -> 10분 전
        // 27분 -> 20분 전
        // 이렇게 끊어서 보여달라는 말씀이시라면:
        // const roundedMins = Math.floor(diffMins / 10) * 10; 
        // return roundedMins === 0 ? "방금 전" : `${roundedMins}분 전`;
        // --------------------------------------------------
        // 일단은 정확하게 "X분 전" 으로 구현해두었습니다. (원하시면 위 로직으로 10분 절사 가능)
        return diffMins === 0 ? "방금 전" : `${diffMins}분 전`;
    }
    
    // 2. 24시간(1440분) 미만일 경우: "X시간 전"
    if (diffMins < 1440) {
        const diffHours = Math.floor(diffMins / 60);
        return `${diffHours}시간 전`;
    }

    // 3. 24시간 이상일 경우: "YY.MM.DD HH:mm" 형태
    return `${String(date.getFullYear()).slice(2)}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const formatExactTime = (isoString) => {
    if (!isoString) return "";
    const date = parseDBTime(isoString);
    return `${String(date.getFullYear()).slice(2)}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  // 🌟 최근 10분 이내 기사인지 판별 (LIVE 뱃지용)
  const isRecentNews = (isoString) => {
    if (!isoString) return false;
    const date = parseDBTime(isoString);
    const diffMins = Math.floor((new Date() - date) / (1000 * 60));
    return diffMins >= 0 && diffMins < 10;
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
    if (score <= 2) return { text: "Bearish (부정적)", classes: "bg-red-100 text-red-700 dark:bg-[#3F1A1A] dark:text-[#F87171] border border-red-900/50", ringColor: "#F87171" };
    if (score === 3) return { text: "Neutral (중립)", classes: "bg-yellow-100 text-yellow-700 dark:bg-[#3F311A] dark:text-[#FBBF24] border border-yellow-900/50", ringColor: "#FBBF24" };
    return { text: "Bullish (긍정적)", classes: "bg-emerald-100 text-emerald-700 dark:bg-[#1A3F2A] dark:text-[#34D399] border border-emerald-900/50", ringColor: "#34D399" };
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

  // 🌟 마그네틱 틸트 효과: 마우스 위치에 따라 카드가 살짝 기울어짐
  const handleTiltMove = (e) => {
    if (isDragging) return;
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -6;
    const rotateY = ((x - centerX) / centerX) * 6;
    card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
  };
  const handleTiltLeave = (e) => {
    e.currentTarget.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)';
  };

  // 🌟 상세 모달 스크롤 시 상단 읽기 진행률 바 갱신
  const handleModalScroll = () => {
    const el = modalContentRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const pct = max > 0 ? (el.scrollTop / max) * 100 : 0;
    setReadProgress(pct);
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

  // 🌟 활성 탭이 바뀌거나 탭 바가 나타날 때 밑줄 위치/너비를 재계산
  useEffect(() => {
    if (searchQuery) return;
    const el = tabRefs.current[activeTab];
    if (el) {
      setUnderlineStyle({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [activeTab, searchQuery, loading]);

  useEffect(() => {
    const recalc = () => {
      if (searchQuery) return;
      const el = tabRefs.current[activeTab];
      if (el) setUnderlineStyle({ left: el.offsetLeft, width: el.offsetWidth });
    };
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, searchQuery]);

  // 🌟 모달이 열릴 때 읽기 진행률 초기화 + 감성 게이지를 0에서 목표값까지 애니메이션
  useEffect(() => {
    if (selectedNews) {
      setReadProgress(0);
      if (modalContentRef.current) modalContentRef.current.scrollTop = 0;
      setGaugeAnimated(false);
      const t = setTimeout(() => setGaugeAnimated(true), 60);
      return () => clearTimeout(t);
    } else {
      setGaugeAnimated(false);
    }
  }, [selectedNews]);

  return (
    <div className="w-full transition-colors duration-300 pb-20 font-['Nunito',_ui-rounded,_-apple-system,_system-ui,_sans-serif]">

      <style>{NEWS_MICRO_STYLES}</style>

      {/* 🌟 통신 지연 시 띄워주는 서버 기상 오버레이 */}
      <ServerWakeupOverlay />

      <div className="mb-10">
        <div className="news-search-glow w-full flex items-center bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/80 rounded-xl px-4 py-3 shadow-sm">
          <Search className="text-slate-400 mr-3" size={20} />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="🔍 뉴스 검색 (제목 또는 내용)" className="flex-1 bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder-slate-400 text-sm md:text-base font-extrabold" />
        </div>
      </div>

      {loading ? (
        <>
          {/* 🌟 스켈레톤 로딩: 히어로 카드 + 리스트 뼈대 */}
          <div className="mb-12">
            <div className="news-skeleton h-8 w-48 rounded-lg mb-6" />
            <div className="flex gap-4 md:gap-5 overflow-hidden pb-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-[85vw] sm:w-[320px] md:w-[340px] lg:w-[360px] shrink-0 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] min-h-[160px] flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <div className="news-skeleton h-5 w-14 rounded-md" />
                      <div className="news-skeleton h-4 w-10 rounded-md" />
                    </div>
                    <div className="news-skeleton h-4 w-full rounded-md mb-2" />
                    <div className="news-skeleton h-4 w-3/4 rounded-md" />
                  </div>
                  <div className="news-skeleton h-5 w-16 rounded-md mt-4" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="news-skeleton h-8 w-56 rounded-lg mb-6" />
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} className="p-4 md:p-5 border-b border-slate-100 dark:border-slate-800/80 last:border-0 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="news-skeleton h-5 w-16 rounded" />
                    <div className="news-skeleton h-4 w-10 rounded" />
                  </div>
                  <div className="news-skeleton h-5 w-full rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {!searchQuery && (
            <div className="relative mb-12 select-none">
              {/* 🌟 은은한 그라디언트 블롭 배경 (깊이감) */}
              <div className="news-blob w-72 h-72 -top-10 -left-10 bg-[#FF4B4B]/10 dark:bg-[#FF4B4B]/[0.08] -z-10" />
              <div className="news-blob w-64 h-64 top-10 right-0 bg-[#3B82F6]/10 dark:bg-[#3B82F6]/[0.08] -z-10" />

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
                      onMouseMove={handleTiltMove}
                      onMouseLeave={handleTiltLeave}
                      className="news-tilt-card w-[85vw] sm:w-[320px] md:w-[340px] lg:w-[360px] snap-center shrink-0 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:border-blue-400 dark:hover:border-slate-600 hover:shadow-xl flex flex-col justify-between min-h-[160px] shadow-sm"
                    >
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          {showCategoryBadge && (
                            <span className={`text-[11px] font-black px-2.5 py-1 rounded-md ${getCategoryStyle(getItemCategory(item))}`}>
                              {getShortCategoryName(getItemCategory(item))}
                            </span>
                          )}
                          <span className="text-[12px] text-slate-500 dark:text-slate-400 font-extrabold flex items-center gap-1.5">
                            {isRecentNews(item.created_at) && (
                              <span className="news-live-dot" title="방금 업데이트됨" />
                            )}
                            {formatTime(item.created_at)}
                          </span>
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
                className={`relative flex gap-3 md:gap-5 border-b border-slate-200 dark:border-slate-800 mb-6 overflow-x-auto whitespace-nowrap hide-scrollbar pb-0 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              >
                {tabsNames.map(tab => (
                  <button
                    key={tab}
                    ref={(el) => { tabRefs.current[tab] = el; }}
                    onClick={() => setActiveTab(tab)}
                    className={`relative z-10 pb-3 px-2 text-[14px] md:text-[15px] font-black tracking-tight transition-colors ${activeTab === tab ? 'text-[#FF4B4B]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                  >
                    {tab}
                  </button>
                ))}
                {/* 🌟 활성 탭을 따라 부드럽게 슬라이드하는 밑줄 인디케이터 */}
                <div
                  className="absolute bottom-0 h-[3px] bg-[#FF4B4B] rounded-full transition-all duration-300 ease-out pointer-events-none"
                  style={{ left: underlineStyle.left, width: underlineStyle.width }}
                />
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
              {filteredList.length > 0 ? filteredList.slice(0, 50).map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedNews(item)}
                  style={{ animationDelay: `${Math.min(idx, 20) * 30}ms` }}
                  className="news-row-in p-4 md:p-5 border-b border-slate-100 dark:border-slate-800/80 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:translate-x-1 cursor-pointer transition-all flex flex-col gap-2"
                >
                  
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
                    
                    <span className="text-[12.5px] text-slate-400 dark:text-slate-500 font-extrabold shrink-0 whitespace-nowrap ml-2 flex items-center gap-1.5">
                      {isRecentNews(item.created_at) && (
                        <span className="news-live-dot" title="방금 업데이트됨" />
                      )}
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
        const ringRadius = 16;
        const ringCircumference = 2 * Math.PI * ringRadius;
        const ringOffset = ringCircumference * (1 - (gaugeAnimated ? (selectedNews.sentiment_score || 0) / 5 : 0));
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 w-full max-w-[1200px] min-h-[60vh] md:min-h-[75vh] max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

              {/* 🌟 모달 헤더: 군더더기 없이 카테고리, 시간, 닫기 버튼만 (기존 방식 복구 및 간소화) */}
              <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800/80">
                {/* 왼쪽 */}
                <div className="flex items-center gap-3">
                  {showCategoryBadge && (
                    <span
                      className={`text-[13.5px] font-black px-2.5 py-1 rounded ${getCategoryStyle(
                        getItemCategory(selectedNews)
                      )}`}
                    >
                      {getShortCategoryName(getItemCategory(selectedNews))}
                    </span>
                  )}
                </div>
              
                {/* 오른쪽 */}
                <div className="flex items-center gap-3">
                  <span className="text-[14.5px] font-extrabold text-slate-400 dark:text-slate-500 tracking-tight whitespace-nowrap">
                    {formatExactTime(selectedNews.created_at)}
                  </span>
              
                  <button
                    onClick={() => setSelectedNews(null)}
                    className="shrink-0 p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* 🌟 읽기 진행률 바 (본문 스크롤에 따라 채워짐) */}
              <div className="h-[3px] w-full bg-slate-100 dark:bg-slate-800/80">
                <div className="h-full bg-[#FF4B4B] transition-[width] duration-150 ease-out" style={{ width: `${readProgress}%` }} />
              </div>

              <div ref={modalContentRef} onScroll={handleModalScroll} className="p-6 md:p-10 overflow-y-auto flex-1">
                  
                  {/* 🌟 섹터/자산 태그: 분석가님 아이디어 적용! 본문 상단으로 이동하여 칩(Chip) 형태로 배치 */}
                  {selectedNews.sector_asset && selectedNews.sector_asset.trim() !== "" && (
                      <div className="mb-4 flex flex-wrap gap-2">
                          <span className="text-[12.5px] md:text-[13.5px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/50 shadow-sm">
                              #{selectedNews.sector_asset}
                          </span>
                      </div>
                  )}

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
                          <div className="flex items-center gap-3">
                              {/* 🌟 감성 점수 애니메이션 링 게이지 */}
                              <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0 -rotate-90">
                                  <circle cx="20" cy="20" r={ringRadius} fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="5" />
                                  <circle
                                      cx="20" cy="20" r={ringRadius} fill="none"
                                      stroke={sentiment.ringColor}
                                      strokeWidth="5" strokeLinecap="round"
                                      strokeDasharray={ringCircumference}
                                      strokeDashoffset={ringOffset}
                                      style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)' }}
                                  />
                              </svg>
                              <span className={`font-black px-4 sm:px-5 py-2.5 rounded-xl sm:rounded-full text-[13px] sm:text-[14px] md:text-[15px] shadow-sm text-center sm:text-left ${sentiment.classes}`}>
                                  {selectedNews.sentiment_score} / 5 · {sentiment.text}
                              </span>
                          </div>
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
