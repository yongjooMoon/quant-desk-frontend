// src/pages/NewsDesk.jsx
import { useEffect, useState, useRef } from 'react';
import { Search, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
// 공통 API 훅 임포트
import { useRenderApi } from '../hooks/useRenderApi';
// Phase 2 공통 UI 컴포넌트 (src/components) — 이 페이지의 실제 패턴과 맞는 것만 사용.
// Badge는 감성/카테고리 라벨이 색상 의미 축(가격방향 vs 감성호오)이 서로 달라 억지로
// 끼워맞추면 오독 위험이 있어 이번엔 적용하지 않음(기존 로직 그대로 유지).
import { Panel, Card, Button, Modal, Tabs } from '../components';

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

  /* 미세한 3D depth — 실사용자가 명확히 "기울어진다"고 인식하지 않는 범위(±2deg)로 제한 */
  .news-tilt { transition: transform 0.15s ease-out, box-shadow 0.15s ease-out; transform-style: preserve-3d; will-change: transform; }

  /* Card 컴포넌트의 기본 dark:bg-panel(#111827)보다 한 단 밝은 히어로 전용 표면.
     유틸리티 클래스끼리 겹치면 소스 순서에 따라 승자가 갈리므로(둘 다 specificity 1),
     이 규칙은 일반 클래스 셀렉터(.dark .news-hero-card, specificity 2)로 확실히 이긴다. */
  .dark .news-hero-card { background-color: #131E30; }
  /* 모달 안에 한 단 더 들어간 "AI Sentiment Score" 패널 — elevated(#0F1B2E)보다도
     한 단 밝은, 이 화면 전용 표면. 위와 같은 이유로 유틸리티가 아닌 전용 클래스로 오버라이드. */
  .dark .news-sentiment-panel { background-color: #16233A; }

  @media (prefers-reduced-motion: reduce) {
    .news-tilt { transition: none !important; }
  }

  /* 모달 진입 애니메이션은 이제 components/Modal.jsx의 ui-modal-panel/uiModalIn이 담당 */

  /* 가로 discovery rail 전용 — 새로 드러나는 카드가 공간적으로 이어지는 느낌만 (바운스/스케일 없음) */
  @keyframes newsHeroCardIn { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
  .news-hero-card-in { animation: newsHeroCardIn 0.3s ease-out both; }
  @media (prefers-reduced-motion: reduce) {
    .news-hero-card-in { animation: none !important; }
  }

  /* 세로 리스트 무한스크롤 전용 — 스크롤로 새로 로드된 행이 "안 보였다가 스르르 나타나는" 느낌.
     리스트 재정렬/재마운트가 아니라 실제로 새로 mount된 DOM 노드에서만 1회 재생된다. */
  @keyframes newsRowIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .news-row-in { animation: newsRowIn 0.35s ease-out both; }
  @media (prefers-reduced-motion: reduce) {
    .news-row-in { animation: none !important; }
  }
`;

export default function NewsDesk() {
  // 세로 리스트(섹터별 최신 뉴스)용 누적 피드 — 탭/검색/날짜가 바뀌어도 리셋하지 않는다.
  // 각 뷰(전체/카테고리/검색/특정일 주요뉴스)는 이 누적분 안에서만 클라이언트 필터링하고,
  // 필터링 후 화면에 보일 게 부족하면 아래 IntersectionObserver가 다음 페이지를 더 당겨온다.
  const [news, setNews] = useState([]);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const [feedLoading, setFeedLoading] = useState(false);

  // 히어로 레일("오늘 주요뉴스")은 별도 전용 조회 — 세로 피드가 아직 오늘자까지
  // 다 안 당겨왔어도 항상 정확해야 하므로 서버의 major_only=true로 직접 받는다.
  const [heroNews, setHeroNews] = useState([]);

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

  // 상세 모달: 읽기 진행률 바 & 감성 게이지 애니메이션용
  const modalContentRef = useRef(null);
  const [readProgress, setReadProgress] = useState(0);
  const [gaugeAnimated, setGaugeAnimated] = useState(false);

  // 히어로 레일 노출 개수(뷰포트 관심사, 데이터는 이미 heroNews에 전부 있음)와
  // 세로 피드 백엔드 페이지 크기(데이터 계층 관심사)는 서로 다른 개념이라 분리 유지.
  const HERO_INITIAL_COUNT = 6;
  const HERO_BATCH_SIZE = 6;
  const LIST_PAGE_SIZE = 20;
  const [visibleMajorCount, setVisibleMajorCount] = useState(HERO_INITIAL_COUNT);

  const sentinelRef = useRef(null);

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

  // 세로 피드 다음 페이지를 당겨온다. offset은 "지금까지 실제로 받아온 원본 개수" 기준
  // (필터링된 개수가 아니라 누적 원본 개수) — 백엔드 캐시가 이 offset부터 이어서 잘라준다.
  const fetchNextFeedPage = () => {
    if (feedLoading || !feedHasMore) return; // 중복 요청 방지
    setFeedLoading(true);
    callApi(`/api/news?offset=${news.length}&limit=${LIST_PAGE_SIZE}`)
      .then((result) => {
        if (result.status === "success") {
          setNews((prev) => [...prev, ...result.data]);
          setFeedHasMore(Boolean(result.has_more));
        } else {
          setFeedHasMore(false);
        }
        setFeedLoading(false);
      })
      .catch(() => {
        setFeedHasMore(false);
        setFeedLoading(false);
      });
  };

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      callApi(`/api/news?offset=0&limit=${LIST_PAGE_SIZE}`),
      callApi("/api/news?major_only=true"),
    ]).then(([feedResult, heroResult]) => {
      if (feedResult.status === "fulfilled" && feedResult.value.status === "success") {
        setNews(feedResult.value.data);
        setFeedHasMore(Boolean(feedResult.value.has_more));
      }
      if (heroResult.status === "fulfilled" && heroResult.value.status === "success") {
        setHeroNews(heroResult.value.data);
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 화면에 실제로 그려진 필터 결과가 스크린을 못 채우거나(스크롤할 곳이 없어 관찰자가
  // 못 뜨는 상황) 관찰 대상 자체가 아직 없을 때를 대비해, 목록이 바뀔 때마다도 한 번씩
  // "더 채워야 하는지" 확인한다 — sentinel의 IntersectionObserver와 함께 이중 안전장치.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !feedHasMore || feedLoading) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) fetchNextFeedPage();
    }, { rootMargin: '400px' });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedHasMore, feedLoading, news.length, activeTab, searchQuery, historyDate]);

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

  // 트랙패드/마우스 휠의 세로 스크롤 의도를 가로 스크롤로 변환 — 더 이상 가로로 갈 곳이 없을 때는
  // 그대로 두어 페이지 전체 스크롤을 막지 않는다.
  const handleWheelHorizontal = (e) => {
    const el = e.currentTarget;
    const canScrollMore = el.scrollWidth > el.clientWidth;
    if (canScrollMore && Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }
  };

  // 가로 rail 끝에 가까워지면 이미 받아온 데이터에서 다음 묶음을 더 그려낸다 (재요청/전체 리로드 없음)
  const handleHeroScroll = (e) => {
    const el = e.currentTarget;
    const nearEnd = el.scrollWidth - el.scrollLeft - el.clientWidth < 220;
    if (nearEnd) {
      setVisibleMajorCount((c) => Math.min(todayMajorNews.length, c + HERO_BATCH_SIZE));
    }
  };

  // 미세한 3D hover — 마우스 정밀 포인터(pointer:fine) + reduced-motion 미설정 환경에서만, ±2deg로 제한
  const handleCardTilt = (e) => {
    if (isDragging) return;
    if (window.matchMedia && (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.matchMedia('(pointer: fine)').matches)) return;
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(700px) rotateX(${(-py * 3).toFixed(2)}deg) rotateY(${(px * 3).toFixed(2)}deg) translateZ(0)`;
  };
  const resetCardTilt = (e) => {
    e.currentTarget.style.transform = '';
  };

  // 모달 스크롤 시 상단 읽기 진행률 바 갱신
  const handleModalScroll = () => {
    const el = modalContentRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const pct = max > 0 ? (el.scrollTop / max) * 100 : 0;
    setReadProgress(pct);
  };

  const todayMajorNews = heroNews;

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

  // 탭 밑줄 위치/너비 계산은 이제 Tabs 컴포넌트(variant="sliding") 내부 책임.
  // (예전엔 여기서 탭/검색/날짜가 바뀔 때 클라이언트 슬라이스 개수를 리셋했지만,
  // 이제 세로 리스트는 슬라이스하지 않고 누적된 것을 전부 그린다 — 위 sentinel 효과가 대신함)

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
        <Panel padding="none" className="w-full flex items-center px-3.5 py-2.5 transition-colors focus-within:border-slate-400 dark:focus-within:border-slate-600">
          <Search className="text-slate-400 dark:text-slate-500 mr-2.5" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="뉴스 검색 (제목 또는 내용)"
            className="flex-1 bg-transparent border-none outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm md:text-[15px]"
          />
        </Panel>
      </div>

      {loading ? (
        <>
          <div className="mb-10">
            <div className="news-skeleton h-5 w-40 rounded mb-5" />
            <div className="flex gap-3 overflow-hidden pb-2">
              {[0, 1, 2].map(i => (
                <Card key={i} padding="none" className="w-[82%] sm:w-[46%] md:w-[31%] lg:w-[23%] xl:w-[18.5%] shrink-0 p-4 min-h-[136px] flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <div className="news-skeleton h-4 w-12 rounded" />
                      <div className="news-skeleton h-3 w-8 rounded" />
                    </div>
                    <div className="news-skeleton h-4 w-full rounded mb-2" />
                    <div className="news-skeleton h-4 w-3/4 rounded" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
          <div>
            <div className="news-skeleton h-5 w-48 rounded mb-5" />
            <Card padding="none" className="overflow-hidden">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} className="p-4 border-b border-slate-100 dark:border-slate-800 last:border-0 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="news-skeleton h-4 w-14 rounded" />
                    <div className="news-skeleton h-3 w-8 rounded" />
                  </div>
                  <div className="news-skeleton h-4 w-full rounded" />
                </div>
              ))}
            </Card>
          </div>
        </>
      ) : (
        <>
          {!searchQuery && (
            <div className="mb-10 select-none">
              <h2 className="text-[15px] md:text-[17px] font-semibold text-slate-900 dark:text-slate-100 mb-4 tracking-tight">
                오늘 주요뉴스
              </h2>
              {todayMajorNews.length > 0 ? (
                <div
                  ref={sliderRef}
                  onMouseDown={(e) => handleMouseDown(e, sliderRef)}
                  onMouseLeave={handleMouseLeaveOrUp}
                  onMouseUp={handleMouseLeaveOrUp}
                  onMouseMove={handleMouseMove}
                  onWheel={handleWheelHorizontal}
                  onScroll={handleHeroScroll}
                  className={`flex overflow-x-auto gap-3 pb-2 hide-scrollbar snap-x snap-mandatory ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                >
                  {todayMajorNews.slice(0, visibleMajorCount).map((item) => {
                    const catStyle = getCategoryStyle(getItemCategory(item));
                    return (
                      <Card
                        key={item.id}
                        as="div"
                        interactive
                        padding="none"
                        onClick={(e) => handleCardClick(e, item)}
                        onMouseMove={handleCardTilt}
                        onMouseLeave={resetCardTilt}
                        className="news-tilt news-hero-card-in news-hero-card relative w-[82%] sm:w-[46%] md:w-[31%] lg:w-[23%] xl:w-[18.5%] snap-center shrink-0 pl-4 pr-4 py-4 md:py-5 cursor-pointer flex flex-col justify-between min-h-[136px] md:min-h-[150px]"
                      >
                        <span
                          className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
                          style={{ background: catStyle.bar }}
                        />
                        <div>
                          <div className="flex justify-between items-center mb-2.5">
                            {showCategoryBadge && (
                              <span className={`text-[11px] md:text-[12px] font-medium ${catStyle.text}`}>
                                {getShortCategoryName(getItemCategory(item))}
                              </span>
                            )}
                            <span className="text-[11px] md:text-[12px] text-slate-400 dark:text-slate-500 tabular-nums flex items-center gap-1.5">
                              {isRecentNews(item.created_at) && (
                                <span className="news-live-dot" title="방금 업데이트됨" />
                              )}
                              {formatTime(item.created_at)}
                            </span>
                          </div>
                          <h3 className="text-[15px] md:text-[16.5px] font-medium text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">{item.title}</h3>
                        </div>

                        {item.sector_asset && item.sector_asset.trim() !== "" && (
                          <div className="mt-3">
                            <span className="text-[11px] md:text-[12px] text-slate-500 dark:text-slate-400">
                              #{item.sector_asset}
                            </span>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Panel className="text-slate-500 dark:text-slate-400 text-sm py-8 text-center">
                  오늘 수집된 주요 뉴스가 없습니다.
                </Panel>
              )}
            </div>
          )}

          <div>
            <h2 translate="no" className="text-[15px] md:text-[17px] font-semibold text-slate-900 dark:text-slate-100 mb-4 tracking-tight">{searchQuery ? '검색 결과' : '섹터별 최신 뉴스'}</h2>

            {!searchQuery && (
              <Tabs
                variant="sliding"
                items={tabsNames.map(tab => ({ key: tab, label: tab }))}
                value={activeTab}
                onChange={setActiveTab}
                getLabel={(item) => getTabLabel(item.label)}
                className={`mb-5 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                containerProps={{
                  ref: tabsRef,
                  onMouseDown: (e) => handleMouseDown(e, tabsRef),
                  onMouseLeave: handleMouseLeaveOrUp,
                  onMouseUp: handleMouseLeaveOrUp,
                  onMouseMove: handleMouseMove,
                }}
              />
            )}

            {!searchQuery && activeTab === "🔥 주요뉴스" && (
                <div className="flex items-center gap-1 mb-5 w-fit border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
                    <button onClick={() => shiftDate(-1)} className="px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium text-[13px] md:text-[14px] flex items-center transition-colors">
                        <ChevronLeft size={14} className="mr-1"/> 이전일
                    </button>
                    <div className="flex items-center gap-2 px-3 py-2 border-x border-slate-200 dark:border-slate-800 font-medium text-[13px] md:text-[14px] relative cursor-pointer">
                        <Calendar size={13} className="text-slate-400 dark:text-slate-500" />
                        <input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                        <span className="text-slate-700 dark:text-slate-200 tabular-nums">{historyDate}</span>
                    </div>
                    <button onClick={() => shiftDate(1)} className="px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium text-[13px] md:text-[14px] flex items-center transition-colors">
                        다음일 <ChevronRight size={14} className="ml-1"/>
                    </button>
                </div>
            )}

            <Card padding="none" className="overflow-hidden">
              {filteredList.length > 0 ? filteredList.map((item) => {
                const catStyle = getCategoryStyle(getItemCategory(item));
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedNews(item)}
                    className="news-row-in px-4 py-4 md:py-4.5 border-b border-slate-100 dark:border-slate-800/80 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between w-full gap-3">
                      <div className="flex items-center gap-2 overflow-hidden min-w-0">
                        {showCategoryBadge && (
                          <span className={`text-[11px] md:text-[12.5px] font-medium shrink-0 ${catStyle.text}`}>
                            {getShortCategoryName(getItemCategory(item))}
                          </span>
                        )}
                        {item.sector_asset && item.sector_asset.trim() !== "" && (
                          <span className="text-[12px] md:text-[13px] text-slate-400 dark:text-slate-500 truncate">
                            · {item.sector_asset}
                          </span>
                        )}
                      </div>

                      <span className="text-[12px] md:text-[13px] text-slate-400 dark:text-slate-500 tabular-nums shrink-0 whitespace-nowrap flex items-center gap-1.5">
                        {isRecentNews(item.created_at) && (
                          <span className="news-live-dot" title="방금 업데이트됨" />
                        )}
                        {formatTime(item.created_at)}
                      </span>
                    </div>

                    <h3 className="text-[14.5px] md:text-[16.5px] font-medium text-slate-800 dark:text-slate-100 leading-snug break-words">
                      {item.title}
                    </h3>
                  </div>
                );
              }) : !feedHasMore && (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">해당 조건의 뉴스가 없습니다.</div>
              )}
            </Card>

            {/* 무한스크롤 트리거 — 뷰포트에 들어오면(또는 필터 결과가 부족하면 즉시) 다음 페이지를 이어서 당겨온다.
                평소엔 높이만 있는 빈 감지용 div, 실제로 요청 중일 때만 스피너를 보여준다. */}
            {feedHasMore && (
              <div ref={sentinelRef} className="flex justify-center py-6 min-h-[1px]">
                {feedLoading && (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-700 border-t-slate-500 dark:border-t-slate-400 animate-spin" />
                )}
              </div>
            )}
          </div>
        </>
      )}

      {selectedNews && (() => {
        const sentiment = getSentimentInfo(selectedNews.sentiment_score);
        const scoreValue = selectedNews.sentiment_score || 0;
        const catStyle = getCategoryStyle(getItemCategory(selectedNews));
        return (
          <Modal open onClose={() => setSelectedNews(null)} size="xl" className="min-h-[60vh] md:min-h-[72vh] lg:min-h-[74vh]">
            <Modal.Header>
              <div className="flex items-center gap-3">
                {showCategoryBadge && (
                  <span className={`text-[12px] md:text-[14px] font-medium ${catStyle.text}`}>
                    {getShortCategoryName(getItemCategory(selectedNews))}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4">
                <span className="text-[13px] md:text-[14px] text-slate-400 dark:text-slate-500 tabular-nums">
                  {formatExactTime(selectedNews.created_at)}
                </span>

                <button
                  onClick={() => setSelectedNews(null)}
                  className="shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-[13px] md:text-[14px] font-medium"
                >
                  닫기
                </button>
              </div>
            </Modal.Header>

            {/* 읽기 진행률 바 */}
            <div className="h-[2px] w-full bg-slate-100 dark:bg-slate-800 shrink-0">
              <div className="h-full bg-slate-400 dark:bg-slate-500 transition-[width] duration-150 ease-out" style={{ width: `${readProgress}%` }} />
            </div>

            <Modal.Body ref={modalContentRef} onScroll={handleModalScroll}>
              <div className="p-6 md:p-10 lg:p-12 flex flex-col lg:flex-row gap-8 lg:gap-12">

                {/* 본문 */}
                <div className="flex-1 min-w-0">
                  {selectedNews.sector_asset && selectedNews.sector_asset.trim() !== "" && (
                      <div className="mb-5">
                          {/* outline-only 태그 — Badge의 soft(배경 있음)/solid 어느 쪽과도 안 맞아 그대로 유지 */}
                          <span className="text-[12px] md:text-[13.5px] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1">
                              #{selectedNews.sector_asset}
                          </span>
                      </div>
                  )}

                  <h2 className="text-[24px] md:text-[30px] lg:text-[34px] font-semibold text-slate-900 dark:text-slate-100 mb-7 leading-[1.3]">
                      {selectedNews.title}
                  </h2>

                  <div className="border-l-2 border-slate-200 dark:border-slate-700 pl-5 md:pl-6">
                      <h4 className="text-slate-500 dark:text-slate-400 font-medium mb-3 text-[13px] md:text-[14.5px]">AI 핵심 요약</h4>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed md:leading-loose whitespace-pre-line text-[15.5px] md:text-[18px]">
                          {selectedNews.summary.replace(/http[^\s]+/g, '').replace(/<br><br>/g, '\n\n').trim()}
                      </p>
                  </div>
                </div>

                {/* 메타 사이드 패널 — 큰 화면에서 데이터가 여백으로 흩어지지 않도록 별도 elevated panel로 분리 */}
                <div className="lg:w-[280px] shrink-0">
                  <Panel level="elevated" padding="none" className="news-sentiment-panel p-5 md:p-6 lg:sticky lg:top-0">
                    <span className="text-[12.5px] md:text-[13.5px] font-medium text-slate-500 dark:text-slate-400 block mb-4">AI Sentiment Score</span>

                    <div className="flex items-center gap-1.5 mb-4">
                      {[1, 2, 3, 4, 5].map((seg) => (
                        <span
                          key={seg}
                          className="block flex-1 h-2.5 rounded-sm transition-colors duration-500"
                          style={{
                            background: gaugeAnimated && seg <= scoreValue ? sentiment.barColor : 'rgba(148,163,184,0.25)',
                          }}
                        />
                      ))}
                    </div>

                    <span className={`inline-block font-medium px-3 py-1.5 rounded-md text-[13px] md:text-[14px] ${sentiment.classes}`}>
                        {scoreValue} / 5 · {sentiment.text} ({sentiment.label})
                    </span>
                  </Panel>
                </div>

              </div>
            </Modal.Body>

            <Modal.Footer>
              <Button variant="ghost" onClick={handlePrevNews} disabled={selectedIdx <= 0}>
                <ChevronLeft size={15}/> 이전 뉴스
              </Button>
              <Button variant="ghost" onClick={handleNextNews} disabled={selectedIdx >= currentViewList.length - 1 || selectedIdx === -1}>
                다음 뉴스 <ChevronRight size={15}/>
              </Button>
            </Modal.Footer>
          </Modal>
        );
      })()}
    </div>
  );
}
