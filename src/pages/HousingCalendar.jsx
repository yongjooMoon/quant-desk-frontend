import { useEffect, useMemo, useState } from 'react';
import { RefreshCcw, Check } from 'lucide-react';
import { useRenderApi } from '../hooks/useRenderApi';

// =========================================================================
// 배지(공급 유형) 설정 — 기존 파이썬 로직의 badge/color 값과 1:1 매핑
//    + LH 항목을 새로운 배지로 추가
// =========================================================================
const BADGE_CONFIG = {
  '특': { label: '특별공급', color: '#f39c12', solid: true },
  '1': { label: '1순위', color: '#2980b9', solid: true },
  '2': { label: '2순위', color: '#27ae60', solid: true },
  '무': { label: '무순위', color: '#7f8c8d', solid: false },
  '임': { label: '임의공급', color: '#d35400', solid: false },
  '오': { label: '오피스텔/생활숙박/도시형/민간임대', color: '#e84393', solid: false },
  '공': { label: '공공지원민간임대', color: '#8e44ad', solid: false },
  '불': { label: '불법행위재공급', color: '#16a085', solid: false },
  // 🌟 신규 추가 — LH 실 분양 주택
  'LH': { label: 'LH 분양', color: '#1e3799', solid: true },
};

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금'];

// =========================================================================
// 월요일 시작, 평일(월~금)만 담긴 주 단위 그리드 생성
// =========================================================================
function buildWeekdayGrid(year, month) {
  // month: 1~12
  const firstOfMonth = new Date(year, month - 1, 1);
  const lastOfMonth = new Date(year, month, 0);

  // 이번 달 1일이 속한 주의 월요일부터 시작
  const gridStart = new Date(firstOfMonth);
  const firstDow = firstOfMonth.getDay(); // 0=일 ... 6=토
  const diffToMonday = firstDow === 0 ? -6 : 1 - firstDow;
  gridStart.setDate(firstOfMonth.getDate() + diffToMonday);

  const weeks = [];
  let cursor = new Date(gridStart);

  while (cursor <= lastOfMonth || cursor.getMonth() + 1 === month) {
    const week = [];
    for (let i = 0; i < 5; i++) { // 월~금만
      const inMonth = cursor.getMonth() + 1 === month;
      week.push(inMonth ? new Date(cursor) : null);
      cursor.setDate(cursor.getDate() + 1);
    }
    cursor.setDate(cursor.getDate() + 2); // 토, 일 건너뛰기
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-black transition-all cursor-pointer ${
              active
                ? 'shadow-sm'
                : 'opacity-40 grayscale bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-700 text-slate-400'
            }`}
            style={active ? { borderColor: conf.color, color: conf.color, backgroundColor: `${conf.color}14` } : {}}
          >
            {active && <Check size={12} strokeWidth={3} />}
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
  const conf = BADGE_CONFIG[badge] || { label: badge, color: '#7f8c8d', solid: false };
  if (conf.solid) {
    return (
      <span
        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white"
        style={{ backgroundColor: conf.color }}
        title={conf.label}
      >
        {badge === 'LH' ? 'L' : badge}
      </span>
    );
  }
  return (
    <span
      className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border-2 bg-white dark:bg-[#111827]"
      style={{ borderColor: conf.color, color: conf.color }}
      title={conf.label}
    >
      {badge === 'LH' ? 'L' : badge}
    </span>
  );
}

// =========================================================================
// 개별 공고 한 줄 (데스크탑 셀 내부에서 사용)
// =========================================================================
function ListingRow({ item, dense = false }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors ${dense ? 'px-2 py-1.5' : 'px-2.5 py-2'}`}
    >
      <ItemBadge badge={item.badge} />
      <span className={`truncate text-slate-700 dark:text-slate-200 font-bold ${dense ? 'text-[12px]' : 'text-[13px]'}`} title={item.name}>
        {item.name}
      </span>
    </a>
  );
}

// =========================================================================
// 날짜 셀 (데스크탑: 전체 리스트 노출 / 모바일: 날짜 + 건수만 표시, 선택 기능 없음)
// =========================================================================
function DayCell({ dateObj, items, isPast, isToday }) {
  if (!dateObj) {
    return <div className="hidden md:block border-b border-r border-slate-100 dark:border-slate-800/60 min-h-[64px]" />;
  }

  const dateNumClass = isPast
    ? 'text-slate-300 dark:text-slate-600 line-through'
    : isToday
    ? 'text-white bg-blue-500 rounded-md px-1.5'
    : 'text-slate-800 dark:text-slate-200';

  return (
    <div className="border-b border-r border-slate-100 dark:border-slate-800/60 min-h-[64px] md:min-h-[140px] p-2 md:p-2.5 bg-white dark:bg-[#111827] transition-colors">
      {/* 데스크탑: 날짜 숫자 */}
      <div className={`hidden md:inline-flex text-[13px] font-black mb-2 ${dateNumClass}`}>{dateObj.getDate()}</div>

      {/* 데스크탑: 전체 리스트 */}
      <div className="hidden md:flex md:flex-col gap-0.5 overflow-hidden">
        {!isPast && items.slice(0, 6).map((item) => <ListingRow key={item.id} item={item} dense />)}
        {!isPast && items.length > 6 && (
          <span className="text-[11px] font-bold text-slate-400 px-2.5">+{items.length - 6}건 더보기</span>
        )}
      </div>

      {/* 모바일: 날짜 + 건수만 표시 (클릭/확장 없음) */}
      <div className="md:hidden w-full flex flex-col items-center justify-center gap-0.5 py-1">
        <span className={`text-[15px] font-black ${dateNumClass}`}>{dateObj.getDate()}</span>
        {!isPast && items.length > 0 && (
          <span className="text-[11px] font-bold text-blue-500 dark:text-blue-400">({items.length}건)</span>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// 메인 컴포넌트
// =========================================================================
export default function HousingCalendar() {
  const { callApi } = useRenderApi();
  const [viewDate] = useState(new Date()); // 연/월 이동 없음 — 항상 현재 달 고정
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState(new Set(Object.keys(BADGE_CONFIG)));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth() + 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // -----------------------------------------------------------------------
  // 데이터 조회
  // -----------------------------------------------------------------------
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

  // 필터 적용 + 날짜별 그룹화
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

  return (
    <div className="w-full pb-16 font-['Nunito',_ui-rounded,_-apple-system,_system-ui,_sans-serif]">

      {/* 헤더: 연월 타이틀 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          {year}년 {month}월 청약 캘린더
        </h2>
        {loading && <RefreshCcw size={18} className="animate-spin text-blue-500" />}
      </div>

      {/* 필터 칩 */}
      <FilterChips activeFilters={activeFilters} onToggle={handleToggleFilter} />

      {/* 캘린더 본체 */}
      <div className="w-full border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-[#111827]">

        {/* 요일 헤더 (월~금) */}
        <div className="grid grid-cols-5 bg-slate-50 dark:bg-[#0B1120] border-b border-slate-200 dark:border-slate-800">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="text-center text-[12px] md:text-[13px] font-black text-slate-500 dark:text-slate-400 py-3">
              {label}
            </div>
          ))}
        </div>

        {/* 주 단위 렌더링 */}
        <div className="grid grid-cols-5">
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="contents">
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
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {!loading && rawData.length === 0 && (
        <p className="text-center text-[13px] font-bold text-slate-400 mt-6">이번 달 등록된 공고가 없습니다.</p>
      )}
    </div>
  );
}
