// src/pages/NewsDesk.jsx
import { useEffect, useState, useRef } from 'react';
import { Search, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
// 공통 API 훅 임포트
import { useRenderApi } from '../hooks/useRenderApi';

// 기능적으로 필요한 최소한의 마이크로 인터랙션만 남김 (LIVE 표시, 스켈레톤, 언더라인 이동)
const NEWS_MICRO_STYLES = `
  @keyframes newsLivePulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.35; transform: scale(1.4); }
  }
  .news-live-dot { position: relative; display: inline-block; width: 5px; height: 5px; border-radius: 9999px; background: #EF4444; }
  .news-live-dot::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 9999px;
    background: #EF4444;
    animation: newsLivePulse 1.8s ease-out infinite;
  }

  .news-skeleton {
    position: relative;
    overflow: hidden;
    background: rgba(148,163,184,0.14);
  }
  .news-skeleton::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(148,163,184,0.16), transparent);
    animation: newsShimmer 1.6s ease infinite;
  }
  .dark .news-skeleton { background: rgba(51,65,85,0.4); }
  .dark .news-skeleton::after { background: linear-gradient(90deg, transparent, rgba(148,163,184,0.12), transparent); }
  @keyframes newsShimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
`;

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

  // 탭 밑줄 슬라이드 애니메이션용 refs & state
  const tabRefs = useRef({});
  const [underlineStyle, setUnderlineStyle] = useState({ left: 0, width: 0 });

  // 상세 모달: 읽기 진행률 바 & 감성 게이지 애니메이션용
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

  // 탭 버튼에는 이모지를 노출하지 않는다 (매칭 로직은 원본 문자열 그대로 사용)
  const getTabLabel = (tab) => tab.replace(/^[^\uAC00-\uD7A3a-zA-Z]+\s*/, '');

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

  // 카드/리스트용 상대 시간 포맷 함수
  const formatTime = (isoString) => {
    if (!isoString) return "";
    const date = parseDBTime(isoString);
    const now = new Date();

    const diffMs = now - date;
    let diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 0) diffMins = 0;

    if (diffMins < 60) {
        return diffMins === 0 ? "방금" : `${diffMins}분 전`;
    }

    if (diffMins < 1440) {
        const diffHours = Math.floor(diffMins / 60);
        return `${diffHours}시간 전`;
    }

    return `${String(date.getFullYear()).slice(2)}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const formatExactTime = (isoString) => {
    if (!isoString) return "";
    const date = parseDBTime(isoString);
    return `${String(date.getFullYear()).slice(2)}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  // 최근 10분 이내 기사인지 판별 (LIVE 뱃지용)
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

  // 감성 점수: 색으로만 장식하지 않고 포지티브/네거티브 의미에 고정
  const getSentimentInfo = (score) => {
    if (score <= 2) return { text: "Bearish", label: "부정적", classes: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20", barColor: "#EF4444" };
    if (score === 3) return { text: "Neutral", label: "중립", classes: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20", barColor: "#D97706" };
    return { text: "Bullish", label: "긍정적", classes: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20", barColor: "#059669" };
  };

  // 카테고리 색은 장식이 아니라 섹터 구분용 식별 신호로만 사용 (채도를 낮춰 절제)
  const getCategoryStyle = (category) => {
    const c = category || "";
    if (c.includes("거시경제") || c.includes("지수")) return { text: "text-sky-600 dark:text-sky-400", bar: "#0284C7" };
    if (c.includes("기업") || c.includes("산업")) return { text: "text-emerald-600 dark:text-emerald-400", bar: "#059669" };
    if (c.includes("원자재") || c.includes("에너지")) return { text: "text-amber-600 dark:text-amber-400", bar: "#D97706" };
    if (c.includes("외환") || c.includes("채권")) return { text: "text-indigo-600 dark:text-indigo-400", bar: "#4F46E5" };
    if (c.includes("지정학") || c.includes("글로벌")) return { text: "text-rose-600 dark:text-rose-400", bar: "#E11D48" };
    if (c.includes("대체") || c.includes("기타")) return { text: "text-violet-600 dark:text-violet-400", bar: "#7C3AED" };
    return { text: "text-teal-600 dark:text-teal-400", bar: "#0D9488" };
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

  // 모달 스크롤 시 상단 읽기 진행률 바 갱신
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

  // 활성 탭이 바뀌거나 탭 바가 나타날 때 밑줄 위치/너비를 재계산
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

  // 모달이 열릴 때 읽기 진행률 초기화 + 감성 바를 0에서 목표값까지 애니메이션
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
    <div className="w-full transition-colors duration-300 pb-20">

      <style>{NEWS_MICRO_STYLES}</style>

      {/* 통신 지연 시 띄워주는 서버 기상 오버레이 */}
      <ServerWakeupOverlay />

      {/* 검색 */}
      <div className="mb-8">
        <div className="w-full flex items-center bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-md px-3.5 py-2.5 transition-colors focus-within:border-slate-400 dark:focus-within:border-slate-600">
          <Search className="text-slate-400 dark:text-slate-500 mr-2.5" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="뉴스 검색 (제목 또는 내용)"
            className="flex-1 bg-transparent border-none outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <>
          <div className="mb-10">
            <div className="news-skeleton h-5 w-40 rounded mb-5" />
            <div className="flex gap-3 overflow-hidden pb-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-[85vw] sm:w-[300px] md:w-[320px] shrink-0 p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] min-h-[136px] flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <div className="news-skeleton h-4 w-12 rounded" />
                      <div className="news-skeleton h-3 w-8 rounded" />
                    </div>
                    <div className="news-skeleton h-4 w-full rounded mb-2" />
                    <div className="news-skeleton h-4 w-3/4 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="news-skeleton h-5 w-48 rounded mb-5" />
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} className="p-4 border-b border-slate-100 dark:border-slate-800 last:border-0 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="news-skeleton h-4 w-14 rounded" />
                    <div className="news-skeleton h-3 w-8 rounded" />
                  </div>
                  <div className="news-skeleton h-4 w-full rounded" />
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {!searchQuery && (
            <div className="mb-10 select-none">
              <h2 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 mb-4 tracking-tight">
                오늘 주요뉴스
              </h2>
              {todayMajorNews.length > 0 ? (
                <div
                  ref={sliderRef}
                  onMouseDown={(e) => handleMouseDown(e, sliderRef)}
                  onMouseLeave={handleMouseLeaveOrUp}
                  onMouseUp={handleMouseLeaveOrUp}
                  onMouseMove={handleMouseMove}
                  className={`flex overflow-x-auto gap-3 pb-2 hide-scrollbar snap-x snap-mandatory ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                >
                  {todayMajorNews.map((item) => {
                    const catStyle = getCategoryStyle(getItemCategory(item));
                    return (
                      <div
                        key={item.id}
                        onClick={(e) => handleCardClick(e, item)}
                        className="relative w-[85vw] sm:w-[300px] md:w-[320px] snap-center shrink-0 pl-4 pr-4 py-4 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer flex flex-col justify-between min-h-[136px] transition-colors"
                      >
                        <span
                          className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
                          style={{ background: catStyle.bar }}
                        />
                        <div>
                          <div className="flex justify-between items-center mb-2.5">
                            {showCategoryBadge && (
                              <span className={`text-[11px] font-medium ${catStyle.text}`}>
                                {getShortCategoryName(getItemCategory(item))}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums flex items-center gap-1.5">
                              {isRecentNews(item.created_at) && (
                                <span className="news-live-dot" title="방금 업데이트됨" />
                              )}
                              {formatTime(item.created_at)}
                            </span>
                          </div>
                          <h3 className="text-[15px] font-medium text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">{item.title}</h3>
                        </div>

                        {item.sector_asset && item.sector_asset.trim() !== "" && (
                          <div className="mt-3">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              #{item.sector_asset}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-slate-500 dark:text-slate-400 text-sm py-8 text-center bg-white dark:bg-[#111827] rounded-md border border-slate-200 dark:border-slate-800">
                  오늘 수집된 주요 뉴스가 없습니다.
                </div>
              )}
            </div>
          )}

          <div>
            <h2 translate="no" className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 mb-4 tracking-tight">{searchQuery ? '검색 결과' : '섹터별 최신 뉴스'}</h2>

            {!searchQuery && (
              <div
                ref={tabsRef}
                onMouseDown={(e) => handleMouseDown(e, tabsRef)}
                onMouseLeave={handleMouseLeaveOrUp}
                onMouseUp={handleMouseLeaveOrUp}
                onMouseMove={handleMouseMove}
                className={`relative flex gap-5 border-b border-slate-200 dark:border-slate-800 mb-5 overflow-x-auto whitespace-nowrap hide-scrollbar pb-0 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              >
                {tabsNames.map(tab => (
                  <button
                    key={tab}
                    ref={(el) => { tabRefs.current[tab] = el; }}
                    onClick={() => setActiveTab(tab)}
                    className={`relative z-10 pb-2.5 px-0.5 text-[13px] font-medium transition-colors ${activeTab === tab ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    {getTabLabel(tab)}
                  </button>
                ))}
                <div
                  className="absolute bottom-0 h-[2px] bg-slate-900 dark:bg-slate-100 transition-all duration-200 ease-out pointer-events-none"
                  style={{ left: underlineStyle.left, width: underlineStyle.width }}
                />
              </div>
            )}

            {!searchQuery && activeTab === "🔥 주요뉴스" && (
                <div className="flex items-center gap-1 mb-5 w-fit border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
                    <button onClick={() => shiftDate(-1)} className="px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium text-[13px] flex items-center transition-colors">
                        <ChevronLeft size={14} className="mr-1"/> 이전일
                    </button>
                    <div className="flex items-center gap-2 px-3 py-2 border-x border-slate-200 dark:border-slate-800 font-medium text-[13px] relative cursor-pointer">
                        <Calendar size={13} className="text-slate-400 dark:text-slate-500" />
                        <input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                        <span className="text-slate-700 dark:text-slate-200 tabular-nums">{historyDate}</span>
                    </div>
                    <button onClick={() => shiftDate(1)} className="px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium text-[13px] flex items-center transition-colors">
                        다음일 <ChevronRight size={14} className="ml-1"/>
                    </button>
                </div>
            )}

            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
              {filteredList.length > 0 ? filteredList.slice(0, 50).map((item) => {
                const catStyle = getCategoryStyle(getItemCategory(item));
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedNews(item)}
                    className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800/80 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between w-full gap-3">
                      <div className="flex items-center gap-2 overflow-hidden min-w-0">
                        {showCategoryBadge && (
                          <span className={`text-[11px] font-medium shrink-0 ${catStyle.text}`}>
                            {getShortCategoryName(getItemCategory(item))}
                          </span>
                        )}
                        {item.sector_asset && item.sector_asset.trim() !== "" && (
                          <span className="text-[12px] text-slate-400 dark:text-slate-500 truncate">
                            · {item.sector_asset}
                          </span>
                        )}
                      </div>

                      <span className="text-[12px] text-slate-400 dark:text-slate-500 tabular-nums shrink-0 whitespace-nowrap flex items-center gap-1.5">
                        {isRecentNews(item.created_at) && (
                          <span className="news-live-dot" title="방금 업데이트됨" />
                        )}
                        {formatTime(item.created_at)}
                      </span>
                    </div>

                    <h3 className="text-[14.5px] font-medium text-slate-800 dark:text-slate-100 leading-snug break-words">
                      {item.title}
                    </h3>
                  </div>
                );
              }) : <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">해당 조건의 뉴스가 없습니다.</div>}
            </div>
          </div>
        </>
      )}

      {selectedNews && (() => {
        const sentiment = getSentimentInfo(selectedNews.sentiment_score);
        const scoreValue = selectedNews.sentiment_score || 0;
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
            <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 w-full max-w-[900px] min-h-[60vh] md:min-h-[70vh] max-h-[90vh] rounded-lg shadow-xl flex flex-col overflow-hidden">

              {/* 모달 헤더 */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  {showCategoryBadge && (
                    <span className={`text-[12px] font-medium ${getCategoryStyle(getItemCategory(selectedNews)).text}`}>
                      {getShortCategoryName(getItemCategory(selectedNews))}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-[13px] text-slate-400 dark:text-slate-500 tabular-nums">
                    {formatExactTime(selectedNews.created_at)}
                  </span>

                  <button
                    onClick={() => setSelectedNews(null)}
                    className="shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-[13px] font-medium"
                  >
                    닫기
                  </button>
                </div>
              </div>

              {/* 읽기 진행률 바 */}
              <div className="h-[2px] w-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full bg-slate-400 dark:bg-slate-500 transition-[width] duration-150 ease-out" style={{ width: `${readProgress}%` }} />
              </div>

              <div ref={modalContentRef} onScroll={handleModalScroll} className="p-6 md:p-8 overflow-y-auto flex-1">

                  {selectedNews.sector_asset && selectedNews.sector_asset.trim() !== "" && (
                      <div className="mb-4">
                          <span className="text-[12px] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-2 py-1">
                              #{selectedNews.sector_asset}
                          </span>
                      </div>
                  )}

                  <h2 className="text-[22px] md:text-[26px] font-semibold text-slate-900 dark:text-slate-100 mb-6 leading-snug">
                      {selectedNews.title}
                  </h2>

                  <div className="border-l-2 border-slate-200 dark:border-slate-700 pl-5 mb-8">
                      <h4 className="text-slate-500 dark:text-slate-400 font-medium mb-3 text-[13px]">AI 핵심 요약</h4>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line text-[15px]">
                          {selectedNews.summary.replace(/http[^\s]+/g, '').replace(/<br><br>/g, '\n\n').trim()}
                      </p>
                  </div>

                  <div className="py-4 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">AI Sentiment Score</span>
                          <div className="flex items-center gap-3">
                              {/* 5단계 세그먼트 바 — 게이지보다 스캔하기 쉬운 형태 */}
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((seg) => (
                                  <span
                                    key={seg}
                                    className="block w-3 h-1.5 rounded-sm transition-colors duration-500"
                                    style={{
                                      background: gaugeAnimated && seg <= scoreValue ? sentiment.barColor : 'rgba(148,163,184,0.25)',
                                    }}
                                  />
                                ))}
                              </div>
                              <span className={`font-medium px-3 py-1.5 rounded-md text-[13px] ${sentiment.classes}`}>
                                  {scoreValue} / 5 · {sentiment.text} ({sentiment.label})
                              </span>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex justify-between bg-slate-50 dark:bg-[#111827]">
                <button
                  onClick={handlePrevNews} disabled={selectedIdx <= 0}
                  className="flex items-center gap-1.5 px-3 py-2 font-medium text-[13px] text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                >
                  <ChevronLeft size={15}/> 이전 뉴스
                </button>
                <button
                  onClick={handleNextNews} disabled={selectedIdx >= currentViewList.length - 1 || selectedIdx === -1}
                  className="flex items-center gap-1.5 px-3 py-2 font-medium text-[13px] text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                >
                  다음 뉴스 <ChevronRight size={15}/>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
