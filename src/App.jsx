import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Newspaper, TrendingUp, Building2, Search, Sun, Moon, ChevronsLeft, ChevronsRight, CalendarDays } from 'lucide-react';

// 라우트별 코드 스플리팅 — 첫 진입 시 방문한 페이지의 번들만 내려받는다.
// (예: /news 진입 시 QuantDesk의 recharts 포함 번들은 받지 않음)
const NewsDesk = lazy(() => import('./pages/NewsDesk'));
const QuantDesk = lazy(() => import('./pages/QuantDesk'));
const HousingCalendar = lazy(() => import('./pages/HousingCalendar'));
const RealEstate = lazy(() => import('./pages/RealEstate'));
const StockSearch = lazy(() => import('./pages/StockSearch'));

// 메뉴(경로) 전환 시 스크롤을 맨 위로 리셋하는 컴포넌트.
//    이 앱은 window가 아니라 <main>(overflow-y-auto)이 실제 스크롤 컨테이너이므로
//    window.scrollTo가 아니라 containerRef가 가리키는 <main> 엘리먼트를 직접 스크롤한다.
//    useLocation()은 <BrowserRouter> 자식에서만 호출 가능해서 별도 컴포넌트로 분리했다.
function ScrollToTop({ containerRef }) {
  const { pathname } = useLocation();

  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, containerRef]);

  return null;
}

// 페이지 전환 시 1회성으로 살짝 떠오르며 정착하는 트랜지션 ("reveal" 모션 토큰).
// 반복 hover가 아니라 경로가 바뀌는 순간에만 발생하므로 스프링 이징을 허용한다.
function PageFade({ children }) {
  const { pathname } = useLocation();
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      key={pathname}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-full"
    >
      {children}
    </motion.div>
  );
}

// 라우트 코드가 아직 로딩 중일 때 보여줄 최소한의 자리표시자 (레이아웃 흔들림 방지용)
function PageSuspenseFallback() {
  return (
    <div className="w-full h-40 flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-700 border-t-slate-500 dark:border-t-slate-400 animate-spin" />
    </div>
  );
}

function App() {
  // 기본 모드를 다크 모드로 설정 (true)
  const [isDarkMode, setIsDarkMode] = useState(true);

  // 사이드바 기본 상태를 '접힘'으로 변경
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // 실제 스크롤이 일어나는 <main> 엘리먼트 참조
  const mainRef = useRef(null);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const navItems = [
    { path: '/news', icon: Newspaper, label: '마켓뉴스' },
    { path: '/quant', icon: TrendingUp, label: '퀀트투자' },
    { path: '/calendar', icon: CalendarDays, label: '캘린더' },
    { path: '/realestate', icon: Building2, label: '부동산' },
    { path: '/search', icon: Search, label: '종목검색' },
  ];

  return (
    <BrowserRouter>
      {/* 경로가 바뀔 때마다 <main> 스크롤을 맨 위로 리셋 — BrowserRouter 자식 위치에 있어야 useLocation 사용 가능 */}
      <ScrollToTop containerRef={mainRef} />

      {/* Vite 기본 index.css의 찌그러짐 속성 무력화 + 다크모드 색상 보정 */}
      <style>{`
        #root { max-width: 100% !important; width: 100% !important; margin: 0 !important; padding: 0 !important; text-align: left !important; }
        body, html {
          width: 100%; height: 100%; margin: 0; padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Pretendard Variable', Pretendard, Roboto, Helvetica, Arial, sans-serif;
        }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      {/* 다크모드 호환 레이어와 모션(페이지 전환)은 각각 index.css / framer-motion(PageFade)으로 이동했다. */}

      {/* 최상위 래퍼 (Full Width & Height) */}
      <div className="flex w-full h-screen bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 transition-colors duration-300 overflow-hidden">

        {}
        {/* PC 좌측 슬림 메뉴바 */}
        <aside className={`hidden md:flex h-full bg-white/75 dark:bg-[#111827]/70 backdrop-blur-xl border-r border-slate-200/70 dark:border-slate-800/60 flex-col py-6 z-30 flex-shrink-0 transition-all duration-300 ease-in-out relative ${isSidebarOpen ? 'w-[192px]' : 'w-[76px]'}`}>

          {/* 헤더 영역 (로고 및 토글 버튼) */}
          <div className={`flex items-center mb-9 w-full transition-all duration-300 ${isSidebarOpen ? 'justify-between px-4' : 'justify-center'}`}>
            {isSidebarOpen ? (
              <div className="flex items-center gap-2.5 select-none">
                <span className="w-[26px] h-[26px] flex items-center justify-center rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-mono text-[11.5px] font-semibold shadow-[0_2px_8px_rgba(15,23,42,0.18)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.45)]">Q</span>
                <span className="text-[14.5px] font-semibold tracking-tight text-slate-800 dark:text-slate-200">Moon</span>
              </div>
            ) : (
              <span className="w-[26px] h-[26px] flex items-center justify-center rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-mono text-[11.5px] font-semibold select-none shadow-[0_2px_8px_rgba(15,23,42,0.18)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.45)]">Q</span>
            )}
          </div>

          {isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="absolute top-6 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronsLeft size={16} />
            </button>
          )}
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="mx-auto mb-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronsRight size={16} />
            </button>
          )}

          {}
          {/* 네비게이션 아이템 영역 */}
          <nav className="flex flex-col w-full px-3 flex-1 gap-0.5 mt-2">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({isActive}) => `group relative flex items-center ${isSidebarOpen ? 'justify-start pl-3 pr-3 py-2.5' : 'justify-center p-2.5'} w-full rounded-md transition-colors ${isActive ? 'text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800/70' : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-slate-900 dark:bg-slate-100" />}
                    <item.icon size={18} strokeWidth={isActive ? 2.25 : 1.75} className="shrink-0 transition-transform duration-200 group-hover:scale-110" />

                    {/* 펼쳤을 때 라벨 */}
                    {isSidebarOpen && (
                      <span className="ml-3 text-[14px] font-medium whitespace-nowrap">
                        {item.label}
                      </span>
                    )}

                    {/* 접었을 때 툴팁 (마우스 오버 시 표시) */}
                    {!isSidebarOpen && (
                      <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 dark:bg-slate-700 text-white text-[12.5px] font-medium rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity whitespace-nowrap z-50 shadow-lg flex items-center pointer-events-none">
                        {item.label}
                      </div>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {}
          {/* 하단 테마 변경 토글 */}
          <div className="w-full px-3 mt-auto">
            <button
              onClick={toggleTheme}
              className={`group relative w-full flex items-center ${isSidebarOpen ? 'justify-start pl-3 pr-3 py-2.5' : 'justify-center p-2.5'} text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-md`}
            >
              {isDarkMode ? <Sun size={17} className="shrink-0" strokeWidth={1.75} /> : <Moon size={17} className="shrink-0" strokeWidth={1.75} />}

              {isSidebarOpen && (
                <span className="ml-3 font-medium text-[13px] whitespace-nowrap">
                  {isDarkMode ? '라이트 모드' : '다크 모드'}
                </span>
              )}

              {!isSidebarOpen && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 dark:bg-slate-700 text-white text-[12.5px] font-medium rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity whitespace-nowrap z-50 shadow-lg flex items-center pointer-events-none">
                  {isDarkMode ? '라이트 모드로 변경' : '다크 모드로 변경'}
                </div>
              )}
            </button>
          </div>
        </aside>

        {}
        {/* 모바일 하단 탭 */}
        <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border-t border-slate-200/70 dark:border-slate-800/60 flex justify-around items-center h-16 z-50 pb-safe">
            {navItems.map((item) => (
              <NavLink key={item.path} to={item.path} className={({isActive}) => `flex flex-col items-center justify-center w-full h-full transition-colors ${isActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
                {({ isActive }) => (
                  <>
                    <item.icon size={19} strokeWidth={isActive ? 2.25 : 1.75} className="mb-1" />
                    <span className="text-[10.5px] font-medium tracking-tight">{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
        </nav>

        {}
        {/* 메인 컨텐츠 영역 (가운데 정렬) */}
        <main ref={mainRef} className="flex-1 h-full overflow-y-auto relative scroll-smooth flex justify-center w-full">
          {/* 모바일 상단 테마 버튼 */}
          <button onClick={toggleTheme} className="md:hidden fixed top-4 right-4 z-50 p-2.5 bg-white dark:bg-[#1E293B] rounded-full shadow-md text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50">
            {isDarkMode ? <Sun size={17} strokeWidth={1.75} /> : <Moon size={17} strokeWidth={1.75} />}
          </button>

          {/* 컨텐츠 래퍼 — 큰 화면에서 너무 좁게 갇히지 않도록 폭/패딩을 브레이크포인트별로 확장 */}
          <div className="w-full max-w-[1600px] min-h-full px-5 md:px-10 xl:px-14 2xl:px-20 py-6 md:py-10 pb-24 md:pb-10">
            <PageFade>
              <Suspense fallback={<PageSuspenseFallback />}>
                <Routes>
                  <Route path="/" element={<Navigate to="/news" replace />} />
                  <Route path="/news" element={<NewsDesk />} />
                  <Route path="/quant" element={<QuantDesk />} />
                  <Route path="/calendar" element={<HousingCalendar />} />
                  <Route path="/realestate" element={<RealEstate />} />
                  <Route path="/search" element={<StockSearch />} />
                </Routes>
              </Suspense>
            </PageFade>
          </div>
        </main>

      </div>
    </BrowserRouter>
  );
}

export default App;
