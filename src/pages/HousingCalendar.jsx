import { useEffect, useMemo, useState, useRef } from 'react';
import { RefreshCcw, Check, X } from 'lucide-react';
import { useRenderApi } from '../hooks/useRenderApi';

// =========================================================================
// 배지(공급 유형) 설정 — badge/color 값 매핑 + LH 신규 추가
// =========================================================================
const BADGE_CONFIG = {
  '특': { label: '특별공급', short: '특', color: '#f59e0b', color2: '#f97316' },
  '1': { label: '1순위', short: '1', color: '#3b82f6', color2: '#2563eb' },
  '2': { label: '2순위', short: '2', color: '#10b981', color2: '#059669' },
  '무': { label: '무순위', short: '무', color: '#64748b', color2: '#475569' },
  '임': { label: '임의공급', short: '임', color: '#f97316', color2: '#ea580c' },
  '오': { label: '오피스텔/생활숙박/도시형/민간임대', short: '오', color: '#ec4899', color2: '#db2777' },
  '공': { label: '공공지원민간임대', short: '공', color: '#a855f7', color2: '#9333ea' },
  '불': { label: '불법행위재공급', short: '불', color: '#14b8a6', color2: '#0d9488' },
  // 🌟 신규 추가 — LH 실 분양 주택
  'LH': { label: 'LH 분양', short: 'LH', color: '#6366f1', color2: '#4f46e5' },
};

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금'];

// =========================================================================
// 전역 마이크로 인터랙션 스타일 — 배경 텍스처, 펄스, 진입 애니메이션 등
// =========================================================================
const GLOBAL_STYLES = `
  @keyframes hcPulseRing {
    0% { transform: scale(0.9); opacity: 0.9; }
    70% { transform: scale(1.9); opacity: 0; }
    100% { transform: scale(1.9); opacity: 0; }
  }
  @keyframes hcFadeInUp {
    0% { opacity: 0; transform: translateY(6px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes hcFadeInUpSheet {
    0% { opacity: 0; transform: translateY(24px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes hcShimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes hcDrift {
    0%   { transform: translate(0px, 0px); }
    33%  { transform: translate(10px, 8px); }
    66%  { transform: translate(-8px, 12px); }
    100% { transform: translate(0px, 0px); }
  }
  @keyframes hcBadgePop {
    0% { transform: scale(0.4); opacity: 0; }
    60% { transform: scale(1.15); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  .hc-cell {
    animation: hcFadeInUp 0.35s ease-out backwards;
    transition: transform 0.25s cubic-bezier(0.22,1,0.36,1), box-shadow 0.25s ease, border-color 0.25s ease, min-height 0.2s ease, padding 0.2s ease;
  }
  .hc-cell:hover { transform: translateY(-3px); }
  .hc-cell.hc-clickable:active { transform: scale(0.97); }
  .hc-chip { transition: transform 0.2s cubic-bezier(0.22,1,0.36,1), box-shadow 0.2s ease, background 0.2s ease; }
  .hc-chip:hover { transform: translateY(-2px) scale(1.03); }
  .hc-row { transition: background 0.18s ease, transform 0.18s ease; }
  .hc-row:hover { transform: translateX(2px); }
  .hc-mobile-pill { animation: hcBadgePop 0.4s cubic-bezier(0.34,1.56,0.64,1); }
  .hc-shimmer {
    background: linear-gradient(90deg, rgba(148,163,184,0.08) 25%, rgba(148,163,184,0.22) 37%, rgba(148,163,184,0.08) 63%);
    background-size: 200% 100%;
    animation: hcShimmer 1.4s ease-in-out infinite;
  }
`;

// =========================================================================
// 은은하게 움직이는 배경 (도트 그리드 + 컬러 블롭) — SVG 기반
// =========================================================================
function AmbientBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[28px] pointer-events-none">
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <defs>
          <pattern id="hcDotGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1.2" cy="1.2" r="1.2" className="fill-slate-300 dark:fill-slate-700" opacity="0.35" />
          </pattern>
          <filter id="hcBlobBlur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="46" />
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#hcDotGrid)" />
        <circle cx="12%" cy="18%" r="120" fill="#6366f1" opacity="0.10" filter="url(#hcBlobBlur)" style={{ animation: 'hcDrift 18s ease-in-out infinite' }} />
        <circle cx="88%" cy="82%" r="140" fill="#f97316" opacity="0.08" filter="url(#hcBlobBlur)" style={{ animation: 'hcDrift 22s ease-in-out infinite reverse' }} />
      </svg>
    </div>
  );
}

// =========================================================================
// 헤더용 캘린더 아이콘 (SVG, 상단에 살짝 펄스되는 dot)
// =========================================================================
function HeaderIcon() {
  return (
    <div className="relative shrink-0">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <defs>
          <linearGradient id="hcHeaderGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <rect x="4" y="7" width="32" height="29" rx="8" fill="url(#hcHeaderGrad)" opacity="0.15" />
        <rect x="4" y="7" width="32" height="29" rx="8" stroke="url(#hcHeaderGrad)" strokeWidth="2" />
        <path d="M4 16H36" stroke="url(#hcHeaderGrad)" strokeWidth="2" />
        <path d="M12 4V10" stroke="url(#hcHeaderGrad)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M28 4V10" stroke="url(#hcHeaderGrad)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="14" cy="24" r="2.2" fill="url(#hcHeaderGrad)" />
        <circle cx="20" cy="24" r="2.2" fill="url(#hcHeaderGrad)" opacity="0.55" />
        <circle cx="26" cy="24" r="2.2" fill="url(#hcHeaderGrad)" opacity="0.55" />
      </svg>
      <span className="absolute -top-1 -right-1 flex items-center justify-center">
        <span className="absolute w-3 h-3 rounded-full bg-emerald-400" style={{ animation: 'hcPulseRing 1.8s ease-out infinite' }} />
        <span className="relative w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
      </span>
    </div>
  );
}

// =========================================================================
// 필터 칩 (배지 유형 토글) — 그라디언트 글로우, hover lift
// =========================================================================
function FilterChips({ activeFilters, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2 mb-7">
      {Object.entries(BADGE_CONFIG).map(([key, conf]) => {
        const active = activeFilters.has(key);
        return (
          <button
            key={key}
            onClick={() => onToggle(key)}
            className="hc-chip flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-black cursor-pointer border"
            style={
              active
                ? {
                    color: '#fff',
                    background: `linear-gradient(135deg, ${conf.color}, ${conf.color2})`,
                    borderColor: 'transparent',
                    boxShadow: `0 6px 16px -4px ${conf.color}80`,
                  }
                : {
                    color: '#94a3b8',
                    background: 'transparent',
                    borderColor: 'rgba(148,163,184,0.35)',
                  }
            }
          >
            {active ? <Check size={12} strokeWidth={3.5} /> : (
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: conf.color, opacity: 0.5 }} />
            )}
            {conf.label}
          </button>
        );
      })}
    </div>
  );
}

// =========================================================================
// 배지 pill (셀 내부 항목에 붙는 작은 라벨) — 그라디언트 + 글로우
// =========================================================================
function ItemBadge({ badge }) {
  const conf = BADGE_CONFIG[badge] || { short: badge, color: '#64748b', color2: '#475569', label: badge };
  return (
    <span
      className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white"
      style={{
        background: `linear-gradient(135deg, ${conf.color}, ${conf.color2})`,
        boxShadow: `0 0 0 3px ${conf.color}1f`,
      }}
      title={conf.label}
    >
      {conf.short}
    </span>
  );
}

// =========================================================================
// 개별 공고 한 줄 (데스크탑 셀 / 모바일 시트 내부에서 공용 사용)
// =========================================================================
function ListingRow({ item, dense = false }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`hc-row flex items-center gap-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 ${dense ? 'px-1.5 py-1' : 'px-2.5 py-2'}`}
    >
      <ItemBadge badge={item.badge} />
      <span className={`truncate text-slate-700 dark:text-slate-200 font-bold ${dense ? 'text-[11.5px]' : 'text-[13.5px]'}`} title={item.name}>
        {item.name}
      </span>
    </a>
  );
}

// =========================================================================
// 날짜 셀 — 카드형(rounded, gap 기반), 오늘은 그라디언트 링 + 펄스
// 지난 날짜는 크기 자체를 축소, 전체 항목은 잘리지 않고 다 표시됨
// 모바일에서는 탭하면 하단 시트로 전체 리스트 오픈
// =========================================================================
function DayCell({ dateObj, items, isPast, isToday, delayIdx, onOpenDetail }) {
  if (!dateObj) {
    return <div className="hidden md:block rounded-2xl min-h-[64px]" />;
  }

  const clickable = !isPast && items.length > 0;

  const sizeClasses = isPast
    ? 'p-1.5 md:p-2 min-h-[40px] md:min-h-[56px]'
    : 'p-2.5 md:p-3 min-h-[68px] md:min-h-[148px]';

  const themeClasses = isPast
    ? 'bg-slate-50/70 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800/60 opacity-40'
    : isToday
    ? 'bg-white dark:bg-[#111827] border-transparent shadow-[0_0_0_2px_rgba(99,102,241,0.55)] shadow-lg'
    : 'bg-white dark:bg-[#111827] border-slate-200/70 dark:border-slate-800 shadow-sm hover:shadow-md';

  return (
    <div
      onClick={clickable ? () => onOpenDetail(dateObj, items) : undefined}
      className={`hc-cell relative rounded-2xl border overflow-hidden ${sizeClasses} ${themeClasses} ${clickable ? 'hc-clickable cursor-pointer md:cursor-default' : ''}`}
      style={{ animationDelay: `${Math.min(delayIdx, 14) * 25}ms` }}
    >
      {/* 오늘 표시 그라디언트 백광 */}
      {isToday && (
        <div
          className="absolute -top-6 -right-6 w-16 h-16 rounded-full opacity-25 blur-xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }}
        />
      )}

      {/* 데스크탑: 날짜 숫자 */}
      <div className="hidden md:flex items-center gap-1.5 mb-2 relative z-10">
        {isToday ? (
          <span className="relative flex items-center justify-center w-6 h-6 rounded-full text-[12px] font-black text-white" style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
            {dateObj.getDate()}
            <span className="absolute inset-0 rounded-full" style={{ animation: 'hcPulseRing 1.8s ease-out infinite', background: 'radial-gradient(circle,#6366f1,transparent 70%)' }} />
          </span>
        ) : (
          <span className={`font-black ${isPast ? 'text-[11px] text-slate-300 dark:text-slate-600 line-through' : 'text-[13px] text-slate-800 dark:text-slate-100'}`}>
            {dateObj.getDate()}
          </span>
        )}
      </div>

      {/* 데스크탑: 전체 리스트 — 더보기 없이 전부 표시 */}
      <div className="hidden md:flex md:flex-col gap-0.5 relative z-10">
        {!isPast && items.map((item) => <ListingRow key={item.id} item={item} dense />)}
      </div>

      {/* 모바일: 날짜 + 건수 그라디언트 필 (탭하면 하단 시트로 리스트 오픈) */}
      <div className="md:hidden w-full flex flex-col items-center justify-center gap-1 py-0.5 relative z-10">
        <span
          className={`flex items-center justify-center rounded-full font-black ${
            isPast ? 'w-5 h-5 text-[11px]' : 'w-7 h-7 text-[13px]'
          } ${
            isToday ? 'text-white' : isPast ? 'text-slate-300 dark:text-slate-600 line-through' : 'text-slate-800 dark:text-slate-100'
          }`}
          style={isToday ? { background: 'linear-gradient(135deg,#6366f1,#a855f7)' } : {}}
        >
          {dateObj.getDate()}
        </span>
        {!isPast && items.length > 0 && (
          <span
            className="hc-mobile-pill text-[10px] font-black text-white px-1.5 py-0.5 rounded-full"
            style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)' }}
          >
            {items.length}건
          </span>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// 모바일 하단 시트 — 날짜 셀 탭 시 해당 날짜의 전체 리스트를 보여줌
// =========================================================================
function DayDetailSheet({ day, onClose }) {
  if (!day) return null;
  const { dateObj, items } = day;

  return (
    <div
      className="md:hidden fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-h-[75vh] bg-white dark:bg-[#111827] rounded-t-3xl px-4 pt-3 pb-5 overflow-y-auto shadow-2xl"
        style={{ animation: 'hcFadeInUpSheet 0.25s cubic-bezier(0.22,1,0.36,1)' }}
      >
        <div className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto mb-4" />
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-[15px] font-black text-slate-800 dark:text-slate-100">
            {dateObj.getMonth() + 1}월 {dateObj.getDate()}일{' '}
            <span className="text-indigo-500">{items.length}건</span>
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400"
          >
            <X size={14} strokeWidth={3} />
          </button>
        </div>
        <div className="flex flex-col gap-1">
          {items.map((item) => (
            <ListingRow key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 로딩 스켈레톤 (shimmer, SVG 도트 로더 대체 텍스트 애니메이션)
// =========================================================================
function CalendarSkeleton() {
  return (
    <div className="grid grid-cols-5 gap-2 md:gap-3">
      {Array.from({ length: 25 }).map((_, i) => (
        <div key={i} className="hc-shimmer rounded-2xl min-h-[68px] md:min-h-[148px]" style={{ animationDelay: `${(i % 5) * 80}ms` }} />
      ))}
    </div>
  );
}

// =========================================================================
// 빈 상태 (SVG 일러스트)
// =========================================================================
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3">
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="30" className="fill-slate-100 dark:fill-slate-800" />
        <rect x="18" y="20" width="28" height="24" rx="5" className="fill-white dark:fill-[#111827] stroke-slate-300 dark:stroke-slate-600" strokeWidth="2" />
        <path d="M18 27H46" className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="2" />
        <circle cx="38" cy="38" r="9" className="fill-white dark:fill-[#111827] stroke-indigo-400" strokeWidth="2" />
        <path d="M44 44L48 48" className="stroke-indigo-400" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <p className="text-[13px] font-black text-slate-400">이번 달 등록된 공고가 없습니다.</p>
    </div>
  );
}

// =========================================================================
// 유틸
// =========================================================================
function buildWeekdayGrid(year, month) {
  const firstOfMonth = new Date(year, month - 1, 1);
  const lastOfMonth = new Date(year, month, 0);

  const gridStart = new Date(firstOfMonth);
  const firstDow = firstOfMonth.getDay();
  const diffToMonday = firstDow === 0 ? -6 : 1 - firstDow;
  gridStart.setDate(firstOfMonth.getDate() + diffToMonday);

  const weeks = [];
  let cursor = new Date(gridStart);

  while (cursor <= lastOfMonth || cursor.getMonth() + 1 === month) {
    const week = [];
    for (let i = 0; i < 5; i++) {
      const inMonth = cursor.getMonth() + 1 === month;
      week.push(inMonth ? new Date(cursor) : null);
      cursor.setDate(cursor.getDate() + 1);
    }
    cursor.setDate(cursor.getDate() + 2);
    weeks.push(week);
    if (cursor > lastOfMonth) break;
  }
  return weeks;
}

const toDateKey = (dateObj) => {
  if (!dateObj) return null;
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const isSameDate = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// =========================================================================
// 메인 컴포넌트
// =========================================================================
export default function HousingCalendar() {
  const { callApi } = useRenderApi();
  const [viewDate] = useState(new Date()); // 연/월 이동 없음 — 항상 현재 달 고정
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState(new Set(Object.keys(BADGE_CONFIG)));
  const [selectedDay, setSelectedDay] = useState(null); // { dateObj, items } — 모바일 하단 시트용

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth() + 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    setLoading(true);

    callApi(`/api/home/search?year=${year}&month=${month}`)
      .then((res) => {
        if (res.status === 'success') {
          setRawData(res.data); // [{ id, name, url, badge, source, date: 'YYYY-MM-DD' }, ...]
        } else {
          setRawData([]);
        }
        setLoading(false);
      })
      .catch(() => {
        setRawData([]);
        setLoading(false);
      });
  }, [year, month]);

  const groupedByDate = useMemo(() => {
    const map = {};
    rawData
      .filter((item) => activeFilters.has(item.badge))
      .forEach((item) => {
        if (!map[item.date]) map[item.date] = [];
        map[item.date].push(item);
      });
    return map;
  }, [rawData, activeFilters]);

  const weeks = useMemo(() => buildWeekdayGrid(year, month), [year, month]);

  const handleToggleFilter = (key) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // 모바일 전용 — 데스크탑(md 이상)에서는 이미 리스트가 전부 보이므로 시트를 띄우지 않음
  const handleOpenDetail = (dateObj, items) => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) return;
    if (!items.length) return;
    setSelectedDay({ dateObj, items });
  };

  let cellCounter = 0;

  return (
    <div className="w-full pb-16 font-['Nunito',_ui-rounded,_-apple-system,_system-ui,_sans-serif]">
      <style>{GLOBAL_STYLES}</style>

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-7">
        <div className="flex items-center gap-3">
          <HeaderIcon />
          <div>
            <h2 className="text-xl md:text-[26px] font-black tracking-tight bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(120deg,#4f46e5,#a855f7 60%,#ec4899)' }}>
              {year}년 {month}월 청약 캘린더
            </h2>
            <p className="text-[11px] md:text-[12px] font-bold text-slate-400 mt-0.5">청약홈 · LH 분양 통합 일정</p>
          </div>
        </div>
        {loading && <RefreshCcw size={18} className="animate-spin text-indigo-500" />}
      </div>

      {/* 필터 칩 */}
      <FilterChips activeFilters={activeFilters} onToggle={handleToggleFilter} />

      {/* 캘린더 본체 */}
      <div className="relative w-full rounded-[28px] border border-slate-200/70 dark:border-slate-800 shadow-sm bg-white/70 dark:bg-[#0B1120]/70 backdrop-blur-sm p-3 md:p-5 overflow-hidden">
        <AmbientBackground />

        {/* 요일 헤더 */}
        <div className="grid grid-cols-5 mb-2 md:mb-3 relative z-10">
          {WEEKDAY_LABELS.map((label, i) => (
            <div key={label} className="text-center text-[11px] md:text-[12.5px] font-black py-2 tracking-wide" style={{ color: ['#6366f1', '#8b5cf6', '#a855f7', '#c026d3', '#db2777'][i] }}>
              {label}
            </div>
          ))}
        </div>

        {/* 주 단위 렌더링 */}
        <div className="relative z-10">
          {loading ? (
            <CalendarSkeleton />
          ) : (
            <div className="flex flex-col gap-2 md:gap-3">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="grid grid-cols-5 gap-2 md:gap-3 items-start">
                  {week.map((dateObj, dIdx) => {
                    const key = toDateKey(dateObj);
                    const items = key ? (groupedByDate[key] || []) : [];
                    const isPast = dateObj ? dateObj < today : false;
                    const isToday = dateObj ? isSameDate(dateObj, today) : false;
                    cellCounter += 1;

                    return (
                      <DayCell
                        key={dIdx}
                        dateObj={dateObj}
                        items={items}
                        isPast={isPast}
                        isToday={isToday}
                        delayIdx={cellCounter}
                        onOpenDetail={handleOpenDetail}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {!loading && rawData.length === 0 && <EmptyState />}

      {/* 모바일 날짜 상세 시트 */}
      <DayDetailSheet day={selectedDay} onClose={() => setSelectedDay(null)} />
    </div>
  );
}
