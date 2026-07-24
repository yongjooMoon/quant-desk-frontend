import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Newspaper, TrendingUp, Building2, Search, Sun, Moon, ChevronsLeft, ChevronsRight, CalendarDays } from 'lucide-react';

import NewsDesk from './pages/NewsDesk';
import QuantDesk from './pages/QuantDesk';
import HousingCalendar from './pages/HousingCalendar';
import RealEstate from './pages/RealEstate';
import StockSearch from './pages/StockSearch';

function App() {
  // 🌟 기본 모드를 다크 모드로 설정 (true)
  const [isDarkMode, setIsDarkMode] = useState(true);

  // 🌟 사이드바 기본 상태를 '접힘'으로 변경
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
      {/* 🔥 Vite 기본 index.css의 찌그러짐 속성을 강제로 무력화 및 다크모드 버그 강제 픽스 🔥 */}
      <style>{`
        #root { max-width: 100% !important; width: 100% !important; margin: 0 !important; padding: 0 !important; text-align: left !important; }
        body, html { width: 100%; height: 100%; margin: 0; padding: 0; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        /* 🌟 Tailwind v4 다크모드 클래스 인식 오류 강제 우회 */
        .dark .text-slate-900, .dark .text-slate-800, .dark .text-slate-700 { color: #F8FAFC !important; }
        .dark .bg-white { background-color: #111827 !important; border-color: #1E293B !important; }
        .dark .bg-slate-50 { background-color: #0B1120 !important; }
        .dark .border-slate-200, .dark .border-slate-100, .dark .border-slate-300 { border-color: #1E293B !important; }
        .dark input, .dark select, .dark textarea { color: #F8FAFC !important; background-color: transparent !important; }
        .dark option { background-color: #1E293B !important; color: #F8FAFC !important; }
        .dark input::placeholder { color: #64748B !important; }
      `}</style>

      {/* 최상위 래퍼 (Full Width & Height) */}
      <div className="flex w-full h-screen bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300 overflow-hidden font-['Nunito',_ui-rounded,_-apple-system,_system-ui,_sans-serif]">

        {}
        {/* 💻 PC 좌측 슬림 메뉴바 (너비를 3분의 1 줄여서 160px로 슬림하게 적용) */}
        <aside className={`hidden md:flex h-full bg-white dark:bg-[#111827] border-r border-slate-200 dark:border-slate-800/80 flex-col py-6 z-30 flex-shrink-0 transition-all duration-300 ease-in-out relative ${isSidebarOpen ? 'w-[160px]' : 'w-[72px]'}`}>

          {/* 🌟 헤더 영역 (로고 및 토글 버튼) */}
          <div className={`flex items-center mb-10 w-full transition-all duration-300 ${isSidebarOpen ? 'justify-between px-4' : 'justify-center'}`}>
            {isSidebarOpen && (
              <div className="bg-[#0B1120] dark:bg-black text-white px-2.5 py-1 font-black text-lg italic -skew-x-[12deg] tracking-widest rounded shadow-md border border-slate-800/50 select-none animate-in fade-in zoom-in-95 duration-300">
                MOON
              </div>
            )}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {isSidebarOpen ? <ChevronsLeft size={22} /> : <ChevronsRight size={22} />}
            </button>
          </div>

          {}
          {/* 🌟 네비게이션 아이템 영역 */}
          <nav className="flex flex-col w-full px-3 flex-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({isActive}) => `group relative flex items-center ${isSidebarOpen ? 'justify-start px-4 py-3.5' : 'justify-center p-3.5'} w-full rounded-2xl transition-all mb-2 ${isActive ? 'text-[#3182F6] dark:text-[#3182F6] bg-blue-50 dark:bg-[#3182F6]/10 font-black' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 font-bold'}`}
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />

                    {/* 펼쳤을 때 라벨 */}
                    {isSidebarOpen && (
                      <span className={`ml-3 text-[15px] whitespace-nowrap transition-all duration-300 ${isActive ? 'text-[#3182F6]' : 'text-slate-600 dark:text-slate-300'}`}>
                        {item.label}
                      </span>
                    )}

                    {/* 접었을 때 툴팁 (마우스 오버 시 표시) */}
                    {!isSidebarOpen && (
                      <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-800 dark:bg-slate-700 text-white text-[13px] font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-xl border border-slate-700 dark:border-slate-600 flex items-center pointer-events-none">
                        <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-b-[5px] border-r-[6px] border-transparent border-r-slate-800 dark:border-r-slate-700"></div>
                        {item.label}
                      </div>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {}
          {/* 🌟 하단 테마 변경 토글 */}
          <div className="w-full px-3 mt-auto">
            <button
              onClick={toggleTheme}
              className={`group relative w-full flex items-center ${isSidebarOpen ? 'justify-start px-4 py-3.5' : 'justify-center p-3.5'} text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors bg-slate-50 hover:bg-slate-100 dark:bg-[#1E293B] dark:hover:bg-slate-800 rounded-2xl`}
            >
              {isDarkMode ? <Sun size={20} className="shrink-0" /> : <Moon size={20} className="shrink-0" />}

              {isSidebarOpen && (
                <span className="ml-3 font-bold text-[14px] whitespace-nowrap text-slate-600 dark:text-slate-300">
                  {isDarkMode ? '라이트 모드' : '다크 모드'}
                </span>
              )}

              {!isSidebarOpen && (
                <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-800 dark:bg-slate-700 text-white text-[13px] font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-xl border border-slate-700 dark:border-slate-600 flex items-center pointer-events-none">
                  <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-b-[5px] border-r-[6px] border-transparent border-r-slate-800 dark:border-r-slate-700"></div>
                  {isDarkMode ? '라이트 모드로 변경' : '다크 모드로 변경'}
                </div>
              )}
            </button>
          </div>
        </aside>

        {}
        {/* 📱 모바일 하단 탭 */}
        <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800/80 flex justify-around items-center h-16 z-50 pb-safe">
            {navItems.map((item) => (
              <NavLink key={item.path} to={item.path} className={({isActive}) => `flex flex-col items-center justify-center w-full h-full transition-colors ${isActive ? 'text-[#3182F6] dark:text-[#3182F6]' : 'text-slate-400 dark:text-slate-500'}`}>
                {({ isActive }) => (
                  <>
                    <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} className="mb-1" />
                    <span className="text-[10px] font-black tracking-tight">{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
        </nav>

        {}
        {/* 🌟 메인 컨텐츠 영역 (가운데 정렬) */}
        <main className="flex-1 h-full overflow-y-auto relative scroll-smooth flex justify-center w-full">
          {/* 모바일 상단 테마 버튼 */}
          <button onClick={toggleTheme} className="md:hidden fixed top-4 right-4 z-50 p-2.5 bg-white dark:bg-[#1E293B] rounded-full shadow-lg text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 hover:scale-105 transition-transform">
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
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
