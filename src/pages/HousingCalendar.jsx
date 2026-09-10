import { useEffect, useMemo, useState } from 'react';
import { RefreshCcw, Check, X } from 'lucide-react';
import { useRenderApi } from '../hooks/useRenderApi';

// =========================================================================
// 색상 토큰 — 공급 유형별 식별 색상 (그라디언트 대신 단일 플랫 컬러로 통일)
// =========================================================================
const BADGE_CONFIG = {
  '특': { label: '특별공급', short: '특', color: '#D97706' },
  '1': { label: '1순위', short: '1', color: '#2563EB' },
  '2': { label: '2순위', short: '2', color: '#059669' },
  '무': { label: '무순위', short: '무', color: '#64748B' },
  '임': { label: '임의공급', short: '임', color: '#EA580C' },
  '오': { label: '오피스텔/생활숙박/도시형/민간임대', short: '오', color: '#DB2777' },
  '공': { label: '공공지원민간임대', short: '공', color: '#9333EA' },
  '불': { label: '불법행위재공급', short: '불', color: '#0D9488' },
  'LH': { label: 'LH 분양', short: 'LH', color: '#4F46E5' },
};

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금'];

// =========================================================================
// 전역 스타일 — 기능적으로 필요한 트랜지션(모바일 시트 진입, 로딩 shimmer)만 유지
// =========================================================================
const GLOBAL_STYLES = `
  @keyframes hcFadeInUpSheet {
    0% { opacity: 0; transform: translateY(24px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes hcShimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  .hc-cell { transition: border-color 0.15s ease; }
  .hc-cell.hc-clickable:active { opacity: 0.85; }
  .hc-row { transition: background 0.15s ease; }
  .hc-shimmer {
    background: linear-gradient(90deg, rgba(148,163,184,0.08) 25%, rgba(148,163,184,0.2) 37%, rgba(148,163,184,0.08) 63%);
    background-size: 200% 100%;
    animation: hcShimmer 1.4s ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .hc-cell, .hc-row { transition: none !important; }
  }
`;

// =========================================================================
// 헤더용 캘린더 아이콘
// =========================================================================
function HeaderIcon() {
  return (
    <div className="shrink-0 w-9 h-9 rounded-md flex items-center justify-center bg-slate-100 dark:bg-slate-800">
      <svg width="20" height="20" viewBox="0 0 40 40" fill="none">
        <rect x="4" y="7" width="32" height="29" rx="8" fill="#4F46E5" opacity="0.14" />
        <rect x="4" y="7" width="32" height="29" rx="8" stroke="#4F46E5" strokeWidth="2.25" />
        <path d="M4 16H36" stroke="#4F46E5" strokeWidth="2.25" />
        <path d="M12 4V10" stroke="#4F46E5" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M28 4V10" stroke="#4F46E5" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="14" cy="24" r="2.2" fill="#4F46E5" />
        <circle cx="20" cy="24" r="2.2" fill="#4F46E5" />
        <circle cx="26" cy="24" r="2.2" fill="#4F46E5" />
      </svg>
    </div>
  );
}

// =========================================================================
// 필터 칩 (배지 유형 토글)
// =========================================================================
function FilterChips({ activeFilters, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {Object.entries(BADGE_CONFIG).map(([key, conf]) => {
        const active = activeFilters.has(key);
        return (
          <button
            key={key}
            onClick={() => onToggle(key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium cursor-pointer border transition-colors"
            style={
              active
                ? { color: '#fff', background: conf.color, borderColor: conf.color }
                : { color: '#94a3b8', background: 'transparent', borderColor: 'rgba(148,163,184,0.35)' }
            }
          >
            {active ? <Check size={11} strokeWidth={2.5} /> : (
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: conf.color, opacity: 0.6 }} />
            )}
            {conf.label}
          </button>
        );
      })}
    </div>
  );
}

// =========================================================================
// 배지 pill (셀 내부 항목에 붙는 작은 라벨)
// =========================================================================
function ItemBadge({ badge }) {
  const conf = BADGE_CONFIG[badge] || { short: badge, color: '#64748b', label: badge };
  return (
    <span
      className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium text-white"
      style={{ background: conf.color }}
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
      className={`hc-row flex items-center gap-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800/60 ${dense ? 'px-1.5 py-1' : 'px-2 py-1.5'}`}
    >
      <ItemBadge badge={item.badge} />
      <span className={`truncate text-slate-700 dark:text-slate-200 font-medium leading-snug ${dense ? 'text-[12px]' : 'text-[14px]'}`} title={item.name}>
        {item.name}
      </span>
    </a>
  );
}

// =========================================================================
// 날짜 셀
// =========================================================================
function DayCell({ dateObj, items, isPast, isToday, onOpenDetail }) {
  if (!dateObj) {
    return <div className="hidden md:block rounded-md min-h-[64px]" />;
  }

  const clickable = !isPast && items.length > 0;

  const sizeClasses = isPast
    ? 'p-1.5 md:p-2 min-h-[40px] md:min-h-[56px]'
    : 'p-2.5 md:p-3 min-h-[68px] md:min-h-[148px]';

  const themeClasses = isPast
    ? 'bg-slate-50/70 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800/60 opacity-40'
    : isToday
    ? 'bg-white dark:bg-[#111827] border-indigo-400 dark:border-indigo-500'
    : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600';

  return (
    <div
      onClick={clickable ? () => onOpenDetail(dateObj, items) : undefined}
      className={`hc-cell relative rounded-md border overflow-hidden ${sizeClasses} ${themeClasses} ${clickable ? 'hc-clickable cursor-pointer md:cursor-default' : ''}`}
    >
      {/* 데스크탑: 날짜 숫자 */}
      <div className="hidden md:flex items-center gap-1.5 mb-2">
        {isToday ? (
          <span className="flex items-center justify-center w-6 h-6 rounded-full text-[12.5px] font-semibold text-white bg-indigo-500">
            {dateObj.getDate()}
          </span>
        ) : (
          <span className={`font-medium ${isPast ? 'text-[11.5px] text-slate-300 dark:text-slate-600 line-through' : 'text-[14px] text-slate-800 dark:text-slate-100'}`}>
            {dateObj.getDate()}
          </span>
        )}
      </div>

      {/* 데스크탑: 전체 리스트 — 더보기 없이 전부 표시 */}
      <div className="hidden md:flex md:flex-col gap-0.5">
        {!isPast && items.map((item) => <ListingRow key={item.id} item={item} dense />)}
      </div>

      {/* 모바일: 날짜 + 건수 필 (탭하면 하단 시트로 리스트 오픈) */}
      <div className="md:hidden w-full flex flex-col items-center justify-center gap-1 py-0.5">
        <span
          className={`flex items-center justify-center rounded-full font-medium ${
            isPast ? 'w-5 h-5 text-[10.5px]' : 'w-6 h-6 text-[12px]'
          } ${
            isToday ? 'text-white bg-indigo-500' : isPast ? 'text-slate-300 dark:text-slate-600 line-through' : 'text-slate-800 dark:text-slate-100'
          }`}
        >
          {dateObj.getDate()}
        </span>
        {!isPast && items.length > 0 && (
          <span className="text-[9.5px] font-medium text-white px-1.5 py-0.5 rounded-full bg-indigo-500">
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
      className="md:hidden fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-h-[75vh] bg-white dark:bg-[#0F1B2E] rounded-t-lg px-4 pt-3 pb-5 overflow-y-auto shadow-[0_-16px_40px_-16px_rgba(0,0,0,0.35)]"
        style={{ animation: 'hcFadeInUpSheet 0.22s cubic-bezier(0.22,1,0.36,1)' }}
      >
        <div className="w-9 h-1 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto mb-4" />
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-[14.5px] font-semibold text-slate-800 dark:text-slate-100">
            {dateObj.getMonth() + 1}월 {dateObj.getDate()}일{' '}
            <span className="text-indigo-500 font-medium">{items.length}건</span>
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400"
          >
            <X size={14} strokeWidth={2.5} />
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
// 로딩 스켈레톤
// =========================================================================
function CalendarSkeleton() {
  return (
    <div className="grid grid-cols-5 gap-2 md:gap-3">
      {Array.from({ length: 25 }).map((_, i) => (
        <div key={i} className="hc-shimmer rounded-md min-h-[68px] md:min-h-[148px]" style={{ animationDelay: `${(i % 5) * 80}ms` }} />
      ))}
    </div>
  );
}

// =========================================================================
// 빈 상태
// =========================================================================
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3">
      <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="30" className="fill-slate-100 dark:fill-slate-800" />
        <rect x="18" y="20" width="28" height="24" rx="5" className="fill-white dark:fill-[#111827] stroke-slate-300 dark:stroke-slate-600" strokeWidth="2" />
        <path d="M18 27H46" className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="2" />
        <circle cx="38" cy="38" r="9" className="fill-white dark:fill-[#111827] stroke-indigo-400" strokeWidth="2" />
        <path d="M44 44L48 48" className="stroke-indigo-400" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <p className="text-[12.5px] text-slate-400">이번 달 등록된 공고가 없습니다.</p>
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
  const { callApi, ServerWakeupOverlay } = useRenderApi();
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

  return (
    <div className="w-full pb-16">
      <style>{GLOBAL_STYLES}</style>

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <HeaderIcon />
          <div>
            <h2 className="text-[17px] font-semibold text-slate-900 dark:text-white tracking-tight">
              {year}년 {month}월 청약 캘린더
            </h2>
            <p className="text-[12px] text-slate-500 mt-0.5">청약홈 · LH 분양 통합 일정</p>
          </div>
        </div>
        {loading && <RefreshCcw size={16} className="animate-spin text-slate-400" strokeWidth={1.75} />}
      </div>

      {/* 필터 칩 */}
      <FilterChips activeFilters={activeFilters} onToggle={handleToggleFilter} />

      {/* 캘린더 본체 */}
      <div className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120] p-3 md:p-5">

        {/* 요일 헤더 */}
        <div className="grid grid-cols-5 mb-2 md:mb-3">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="text-center text-[11.5px] font-medium py-2 text-slate-500 dark:text-slate-400">
              {label}
            </div>
          ))}
        </div>

        {/* 주 단위 렌더링 */}
        <div>
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

                    return (
                      <DayCell
                        key={dIdx}
                        dateObj={dateObj}
                        items={items}
                        isPast={isPast}
                        isToday={isToday}
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

      {/* 서버 콜드스타트 대기 오버레이 — 여기서 실제로 렌더링해야 화면에 나타남 */}
      <ServerWakeupOverlay />
    </div>
  );
}
