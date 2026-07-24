import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCcw, Check, X } from 'lucide-react';
// import { useRenderApi } from '../hooks/useRenderApi'; // 🌟 실제 연동 시 주석 해제

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
// 🌟 더미 데이터 (실제 연동 전 임시) — 이번 달 기준으로 과거/오늘/미래 날짜를 섞어서 생성
//    실제로는 /api/home 이 이 형태(배열)로 내려주면 됨:
//    { id, name, url, badge, source, date: 'YYYY-MM-DD' }
// =========================================================================
function buildDummyData() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  const d = now.getDate();

  const mk = (dayOffset, name, badge, source = 'applyhome') => {
    const dt = new Date(y, m, d + dayOffset);
    return {
      id: `${name}-${badge}-${dayOffset}`,
      name,
      url: 'https://www.applyhome.co.kr',
      badge,
      source,
      date: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`,
    };
  };

  return [
    mk(-3, '드파인 아르티아', '1'),
    mk(-3, '장위 푸르지오 마크원', '1'),
    mk(-2, '김해 신문 센트럴 아이파크', '2'),
    mk(-1, '밀양 수자인 더퍼스트 1단지', '2'),
    mk(0, '양주 회천지구 A-8BL 로제비앙', '특'),
    mk(0, '함안가야 휴니온아르페', '특'),
    mk(0, '이천 서희스타힐스 SKY', '1'),
    mk(0, '한화포레나 유성 1단지', 'LH', 'lh'),
    mk(1, '신제주 동문디이스트 시그니처', '1'),
    mk(1, '이천 서희스타힐스 SKY', '2'),
    mk(1, '시흥 은계 에피트(7차)', '임'),
    mk(2, '울산반구 수자인 더센트럴', '공'),
    mk(2, '의왕 백운밸리 리젠시빌 란트', '공'),
    mk(3, '엘리프 역곡', '무'),
    mk(3, '대방역 여의도 더로드캐슬(4차)', 'LH', 'lh'),
    mk(4, '오목천역 더리브', '임'),
    mk(5, '원종역 해모로 아스트라 3차', '임'),
    mk(7, '군산 세경아파트 우선분양전환', '특'),
    mk(9, '풍무역세권 수자인 그라센트 2차', '임'),
  ];
}

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
// 개별 공고 한 줄 (데스크탑 셀 내부 / 모바일 확장 패널 공용)
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
// 모바일 전용 — 선택된 날짜의 상세 리스트 패널 (해당 주 바로 아래에 삽입됨)
// =========================================================================
function MobileExpandPanel({ dateObj, items, onClose }) {
  return (
    <div className="col-span-5 md:hidden -mt-px mb-2 bg-slate-50 dark:bg-[#0B1120] border-x border-b border-slate-200 dark:border-slate-800 rounded-b-xl px-3 py-3 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[13px] font-black text-slate-900 dark:text-white">
          {dateObj.getMonth() + 1}월 {dateObj.getDate()}일 ({items.length}건)
        </span>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer">
          <X size={16} />
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-[12px] font-bold text-slate-400 px-1 py-2">해당 필터에 맞는 공고가 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {items.map((item) => <ListingRow key={item.id} item={item} dense />)}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 날짜 셀 (데스크탑: 전체 리스트 노출 / 모바일: 날짜 + 건수만, 탭하면 패널 오픈)
// =========================================================================
function DayCell({ dateObj, items, isPast, isToday, isSelected, onSelect }) {
  if (!dateObj) {
    return <div className="hidden md:block border-b border-r border-slate-100 dark:border-slate-800/60 min-h-[64px]" />;
  }

  const dateNumClass = isPast
    ? 'text-slate-300 dark:text-slate-600 line-through'
    : isToday
    ? 'text-white bg-blue-500 rounded-md px-1.5'
    : 'text-slate-800 dark:text-slate-200';

  return (
    <div
      className={`border-b border-r border-slate-100 dark:border-slate-800/60 min-h-[64px] md:min-h-[140px] p-2 md:p-2.5 transition-colors ${
        isSelected ? 'bg-blue-50 dark:bg-blue-500/10' : 'bg-white dark:bg-[#111827]'
      }`}
    >
      {/* 데스크탑: 클릭 불필요, 날짜만 표시 */}
      <div className={`hidden md:inline-flex text-[13px] font-black mb-2 ${dateNumClass}`}>{dateObj.getDate()}</div>

      {/* 데스크탑: 전체 리스트 */}
      <div className="hidden md:flex md:flex-col gap-0.5 overflow-hidden">
        {!isPast && items.slice(0, 6).map((item) => <ListingRow key={item.id} item={item} dense />)}
        {!isPast && items.length > 6 && (
          <span className="text-[11px] font-bold text-slate-400 px-2.5">+{items.length - 6}건 더보기</span>
        )}
      </div>

      {/* 모바일: 날짜 + 건수 버튼 (탭하면 아래에 패널 오픈) */}
      <button
        onClick={() => onSelect(dateObj)}
        className="md:hidden w-full flex flex-col items-center justify-center gap-0.5 py-1 cursor-pointer"
      >
        <span className={`text-[15px] font-black ${dateNumClass}`}>{dateObj.getDate()}</span>
        {!isPast && items.length > 0 && (
          <span className="text-[11px] font-bold text-blue-500 dark:text-blue-400">({items.length}건)</span>
        )}
      </button>
    </div>
  );
}

// =========================================================================
// 메인 컴포넌트
// =========================================================================
export default function HousingCalendar() {
  const [viewDate, setViewDate] = useState(new Date()); // 현재 조회 중인 연/월
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState(new Set(Object.keys(BADGE_CONFIG)));
  const [selectedDate, setSelectedDate] = useState(null); // 모바일 선택 날짜

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth() + 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // -----------------------------------------------------------------------
  // 🌟 데이터 조회 — 실제 연동 시 아래 주석을 해제하고 더미 데이터 fallback 제거
  // -----------------------------------------------------------------------
  useEffect(() => {
    setLoading(true);

    // const { callApi } = useRenderApi(); // 훅은 최상단에서만 호출 가능 — 컴포넌트 상단으로 이동 필요
    // callApi(`/api/home?year=${year}&month=${month}`)
    //   .then((res) => {
    //     if (res.status === 'success') {
    //       setRawData(res.data); // [{ id, name, url, badge, source, date: 'YYYY-MM-DD' }, ...]
    //     } else {
    //       setRawData([]);
    //     }
    //     setLoading(false);
    //   })
    //   .catch(() => {
    //     setRawData([]);
    //     setLoading(false);
    //   });

    // 🌟 임시: 더미 데이터로 대체
    const t = setTimeout(() => {
      setRawData(buildDummyData());
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
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

  const handlePrevMonth = () => {
    setSelectedDate(null);
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setSelectedDate(null);
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleSelectDate = (dateObj) => {
    setSelectedDate((prev) => (isSameDate(prev, dateObj) ? null : dateObj));
  };

  return (
    <div className="w-full pb-16 font-['Nunito',_ui-rounded,_-apple-system,_system-ui,_sans-serif]">

      {/* 헤더: 연월 타이틀 + 이전/다음 월 이동 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={handlePrevMonth} className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {year}년 {month}월 청약 캘린더
          </h2>
          <button onClick={handleNextMonth} className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
            <ChevronRight size={18} />
          </button>
        </div>
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
          {weeks.map((week, wIdx) => {
            const isSelectedWeek = selectedDate && week.some((d) => isSameDate(d, selectedDate));
            return (
              <div key={wIdx} className="contents">
                {week.map((dateObj, dIdx) => {
                  const key = toDateKey(dateObj);
                  const items = key ? (groupedByDate[key] || []) : [];
                  const isPast = dateObj ? dateObj < today : false;
                  const isToday = dateObj ? isSameDate(dateObj, today) : false;
                  const isSelected = dateObj ? isSameDate(dateObj, selectedDate) : false;

                  return (
                    <DayCell
                      key={dIdx}
                      dateObj={dateObj}
                      items={items}
                      isPast={isPast}
                      isToday={isToday}
                      isSelected={isSelected}
                      onSelect={handleSelectDate}
                    />
                  );
                })}

                {/* 🌟 모바일 전용 확장 패널 — 선택된 날짜가 속한 주 바로 아래에 삽입 */}
                {isSelectedWeek && (
                  <MobileExpandPanel
                    dateObj={selectedDate}
                    items={(groupedByDate[toDateKey(selectedDate)] || [])}
                    onClose={() => setSelectedDate(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!loading && rawData.length === 0 && (
        <p className="text-center text-[13px] font-bold text-slate-400 mt-6">이번 달 등록된 공고가 없습니다.</p>
      )}
    </div>
  );
}
