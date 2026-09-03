import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { Newspaper, TrendingUp, Building2, Search, Sun, Moon, ChevronsLeft, ChevronsRight, CalendarDays } from 'lucide-react';

import NewsDesk from './pages/NewsDesk';
import QuantDesk from './pages/QuantDesk';
import HousingCalendar from './pages/HousingCalendar';
import RealEstate from './pages/RealEstate';
import StockSearch from './pages/StockSearch';

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

        /* Tailwind v4 다크모드 클래스 인식 오류 강제 우회
           — 이전에는 slate-900/800/700이 전부 동일한 #F8FAFC로 강제되어
             다크모드에서 타이포그래피 위계(제목/본문/보조텍스트)가 사라지는 문제가 있었다.
             단계별로 다른 명도를 줘서 원래 의도한 대비 위계를 다크모드에서도 유지한다. */
        .dark .text-slate-900 { color: #F8FAFC !important; }
        .dark .text-slate-800 { color: #E2E8F0 !important; }
        .dark .text-slate-700 { color: #CBD5E1 !important; }
        .dark .bg-white { background-color: #111827 !important; border-color: #1E293B !important; }
        .dark .bg-slate-50 { background-color: #0B1120 !important; }
        .dark .border-slate-200, .dark .border-slate-100, .dark .border-slate-300 { border-color: #1E293B !important; }
        .dark input, .dark select, .dark textarea { color: #F8FAFC !important; background-color: transparent !important; }
        .dark option { background-color: #1E293B !important; color: #F8FAFC !important; }
        .dark input::placeholder { color: #64748B !important; }
      `}</style>

      {/* 최상위 래퍼 (Full Width & Height) */}
      <div className="flex w-full h-screen bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 transition-colors duration-300 overflow-hidden">

        {}
        {/* PC 좌측 슬림 메뉴바 */}
        <aside className={`hidden md:flex h-full bg-white dark:bg-[#111827] border-r border-slate-200 dark:border-slate-800/80 flex-col py-6 z-30 flex-shrink-0 transition-all duration-300 ease-in-out relative ${isSidebarOpen ? 'w-[168px]' : 'w-[72px]'}`}>

          {/* 헤더 영역 (로고 및 토글 버튼) */}
          <div className={`flex items-center mb-9 w-full transition-all duration-300 ${isSidebarOpen ? 'justify-between px-4' : 'justify-center'}`}>
            {isSidebarOpen ? (
              <div className="flex items-center gap-2 select-none">
                <span className="w-6 h-6 flex items-center justify-center rounded-sm bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-mono text-[11px] font-semibold">Q</span>
                <span className="text-[13.5px] font-semibold tracking-tight text-slate-800 dark:text-slate-200">QUANT DESK</span>
              </div>
            ) : (
              <span className="w-6 h-6 flex items-center justify-center rounded-sm bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-mono text-[11px] font-semibold select-none">Q</span>
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
                    <item.icon size={18} strokeWidth={isActive ? 2.25 : 1.75} className="shrink-0" />

                    {/* 펼쳤을 때 라벨 */}
                    {isSidebarOpen && (
                      <span className="ml-3 text-[13.5px] font-medium whitespace-nowrap">
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
        <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800/80 flex justify-around items-center h-16 z-50 pb-safe">
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

          {/* 컨텐츠 래퍼 (너무 좁지도 넓지도 않게 폭 제한) */}
          <div className="w-full max-w-[1150px] min-h-full px-4 md:px-8 py-6 md:py-10 pb-24 md:pb-10">
            <Routes>
              <Route path="/" element={<Navigate to="/news" replace />} />
              <Route path="/news" element={<NewsDesk />} />
              <Route path="/quant" element={<QuantDesk />} />
              <Route path="/calendar" element={<HousingCalendar />} />
              <Route path="/realestate" element={<RealEstate />} />
              <Route path="/search" element={<StockSearch />} />
            </Routes>
          </div>
        </main>

      </div>
    </BrowserRouter>
  );
}

export default App;
