import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Search, SlidersHorizontal, Sparkles, Check, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

// =========================================================================
// 🌟 미네르비니 트렌드 템플릿 6축
// =========================================================================
const AXES = [
  { key: 'trend_alignment_score', label: 'Trend Alignment', short: '정배열', color: '#FF4B4B', desc: '현재가 > 50일선 > 150일선 > 200일선' },
  { key: 'ma200_trend_score', label: '200MA Uptrend', short: '200일선추세', color: '#F8B12A', desc: '200일선이 1·3개월 전보다 상승 중' },
  { key: 'high_proximity_score', label: 'Near 52W High', short: '신고가근접', color: '#20C997', desc: '52주 신고가 대비 25%/10% 이내' },
  { key: 'low_rise_score', label: 'Off the Low', short: '저점탈출', color: '#3B82F6', desc: '52주 신저가 대비 30%/50% 이상 상승' },
  { key: 'rs_score', label: 'RS Rating', short: 'RS강도', color: '#A78BFA', desc: '전체 종목 대비 가격 모멘텀 백분위' },
  { key: 'ma50_momentum_score', label: '50MA Support', short: '50일선지지', color: '#F472B6', desc: '현재가가 50일선 위, 50일선 상승 중' },
];
const AXIS_COUNT = AXES.length;
const PRESET_VALUES = [50, 60, 70, 80, 100];
const PAGE_SIZE = 50;

const SORT_OPTIONS = [
  { key: 'current_price', label: '현재가' },
  { key: 'ret_1m', label: '1개월 수익률' },
  { key: 'rs_score', label: 'RS(상대강도)' },
  { key: 'pct_from_52w_high', label: '52주 고점과의 거리' },
  { key: 'pct_above_52w_low', label: '52주 저점 대비 상승률' },
  { key: 'entry_gate_pass_count', label: '통과 조건 수' },
  { key: 'roe', label: 'ROE' },
  { key: 'debt_ratio', label: '부채비율' },
  { key: 'op_margin', label: '영업이익률' },
];

const STRATEGY_PRESETS = [
  { label: '완전 정배열 (Stage 2)', icon: '🚀', values: { trend_alignment_score: 100, ma200_trend_score: 50, ma50_momentum_score: 50 } },
  { label: '신고가 임박', icon: '🎯', values: { high_proximity_score: 50, rs_score: 70 } },
  { label: 'RS 강세주', icon: '⚡', values: { rs_score: 80 } },
  { label: '바닥 탈출 초기', icon: '🌱', values: { low_rise_score: 50, ma200_trend_score: 50 } },
  { label: '완벽한 셋업', icon: '💎', values: { trend_alignment_score: 100, high_proximity_score: 50, low_rise_score: 50, rs_score: 70, ma50_momentum_score: 50, ma200_trend_score: 50 } },
  { label: '추세 전환 관찰', icon: '👀', values: { ma200_trend_score: 50, trend_alignment_score: 50 } },
];

function axisAngleRad(index) { return (-90 + index * (360 / AXIS_COUNT)) * (Math.PI / 180); }
function hexPoint(index, radiusFraction, maxR = 88, cx = 120, cy = 120) {
  const angle = axisAngleRad(index);
  const r = Math.max(0, Math.min(1, radiusFraction)) * maxR;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}
function polygonPoints(radiusFractions, maxR = 88, cx = 120, cy = 120) {
  return radiusFractions.map((rf, i) => {
    const { x, y } = hexPoint(i, rf, maxR, cx, cy);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}
function polarPoint(angleDeg, radius, cx = 120, cy = 120) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

function useAnimatedRadii(target, duration = 550) {
  const [values, setValues] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef(null);
  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    cancelAnimationFrame(rafRef.current);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = target.map((tv, i) => {
        const fv = from[i] ?? tv;
        return fv + (tv - fv) * eased;
      });
      setValues(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [JSON.stringify(target), duration]);
  return values;
}

const MICRO_STYLES = `
  .qs-snowflake-fill { transition: fill-opacity 0.25s ease, stroke 0.25s ease; }
  .qs-preset-chip { transition: all 0.18s ease; }
  .qs-preset-chip:hover { transform: translateY(-1px); }
  .qs-vertex-glow { filter: drop-shadow(0 0 5px currentColor); }
  .qs-preset-chip-active {
    color: #fff !important;
    border-color: transparent !important;
    background: linear-gradient(135deg, #3B82F6, #6366F1);
    box-shadow: 0 0 0 2px rgba(59,130,246,0.30), 0 6px 16px rgba(59,130,246,0.35);
  }
  .qs-wedge { cursor: pointer; transition: fill-opacity 0.15s ease; }
  .qs-wedge-pressed { animation: qsWedgeFlash 0.28s ease-out; }
  @keyframes qsWedgeFlash { 0% { fill-opacity: 0.5; } 100% { fill-opacity: 0; } }
  .qs-name-link { display: block; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; transition: color 0.15s ease; }
  .qs-name-link:hover { color: #3B82F6; text-decoration: underline; text-underline-offset: 2px; }
  .qs-select { appearance: none; background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; background-size: 14px; }
  .qs-card { transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.18s ease; }
  .qs-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(15,23,42,0.08); }
  .dark .qs-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.35); }
`;

function formatPriceMasked(v) { return v == null || isNaN(v) ? "N/A" : `₩${Number(v).toLocaleString()}`; }
function formatPct(v, digits = 1) { return v == null || isNaN(v) ? "N/A" : `${v > 0 ? '+' : ''}${Number(v).toFixed(digits)}%`; }
function formatNum(v, digits = 2) { return v == null || isNaN(v) ? "N/A" : Number(v).toFixed(digits); }
function formatWon(v) { return v == null || isNaN(v) ? "N/A" : Math.round(Number(v)).toLocaleString(); }

function MiniSnowflake({ row, size = 34 }) {
  const maxR = size * 0.41;
  const cx = size / 2, cy = size / 2;
  const pt = (i, frac) => {
    const angle = (-90 + i * (360 / AXIS_COUNT)) * (Math.PI / 180);
    const r = Math.max(0, Math.min(1, frac)) * maxR;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };
  const validScores = AXES.map(ax => row[ax.key]).filter(v => v != null && !isNaN(v));
  const avg = validScores.length ? validScores.reduce((a, b) => a + b, 0) / validScores.length : null;
  const avgColor = avg === null ? '#94A3B8' : avg >= 70 ? '#00B464' : avg >= 40 ? '#F8B12A' : '#EF4444';
  const shapePoints = AXES.map((ax, i) => {
    const v = row[ax.key];
    return pt(i, (v == null || isNaN(v)) ? 0.08 : v / 100);
  }).map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const bgPoints = AXES.map((_, i) => pt(i, 1)).map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <polygon points={bgPoints} fill="none" className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" />
        <polygon points={shapePoints} fill={avgColor} fillOpacity="0.32" stroke={avgColor} strokeWidth="1.4" />
      </svg>
      <span className="text-[13px] font-black tabular-nums" style={{ color: avgColor }}>{row.entry_gate_pass_count ?? '-'}/6</span>
    </div>
  );
}

function SnowflakeChart({ thresholds, onAxisChange }) {
  const targetRadii = AXES.map(ax => thresholds[ax.key] == null ? 0.08 : thresholds[ax.key] / 100);
  const animated = useAnimatedRadii(targetRadii);
  const activeCount = AXES.filter(ax => thresholds[ax.key] != null).length;
  const maxR = 88;
  const wedgeAngleStep = 360 / AXIS_COUNT;
  const svgRef = useRef(null);
  const [hoveredAxis, setHoveredAxis] = useState(null);
  const [pressedAxis, setPressedAxis] = useState(null);
  const pressTimerRef = useRef(null);

  const handleWedgeClick = (ax) => (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const localX = (e.clientX - rect.left) * (240 / rect.width);
    const localY = (e.clientY - rect.top) * (240 / rect.height);
    const rawValue = Math.max(0, Math.min(1, Math.hypot(localX - 120, localY - 120) / maxR)) * 100;
    let nextValue = null;
    if (rawValue >= 45) {
      nextValue = PRESET_VALUES.reduce((closest, v) => Math.abs(v - rawValue) < Math.abs(closest - rawValue) ? v : closest, PRESET_VALUES[0]);
    }
    onAxisChange(ax.key, thresholds[ax.key] === nextValue ? null : nextValue);
    setPressedAxis(ax.key);
    clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => setPressedAxis(null), 280);
  };

  return (
    <div className="p-5 bg-white dark:bg-[#0B1120] rounded-2xl border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-slate-500 dark:text-slate-400" />
          <span className="text-[13px] font-black text-slate-700 dark:text-slate-300 tracking-tight">TREND TEMPLATE</span>
          {activeCount > 0 && <span className="text-[11px] font-black text-white bg-[#FF4B4B] rounded-full w-5 h-5 flex items-center justify-center">{activeCount}</span>}
        </div>
        {activeCount > 0 && <button onClick={() => AXES.forEach(ax => onAxisChange(ax.key, null))} className="text-[11px] font-extrabold text-slate-500 hover:text-slate-900 dark:hover:text-white underline underline-offset-2 cursor-pointer">초기화</button>}
      </div>
      <svg ref={svgRef} viewBox="0 0 240 240" className="w-full max-w-[280px] mx-auto select-none">
        {[0.25, 0.5, 0.75, 1.0].map((rf, ri) => <polygon key={ri} points={polygonPoints(Array(AXIS_COUNT).fill(rf))} fill="none" className="stroke-slate-200 dark:stroke-[#1E293B]" strokeWidth="1" />)}
        {AXES.map((ax, i) => {
          const { x, y } = hexPoint(i, 1.0);
          return <line key={ax.key} x1="120" y1="120" x2={x} y2={y} className="stroke-slate-200 dark:stroke-[#1E293B]" strokeWidth="1" />;
        })}
        <polygon className="qs-snowflake-fill" points={polygonPoints(animated)} fill={activeCount > 0 ? "#3B82F6" : "#475569"} fillOpacity={activeCount > 0 ? 0.28 : 0.12} stroke={activeCount > 0 ? "#60A5FA" : "#475569"} strokeWidth="2" />
        {AXES.map((ax, i) => {
          const { x, y } = hexPoint(i, animated[i]);
          const isActive = thresholds[ax.key] != null;
          return <circle key={ax.key} cx={x} cy={y} r={isActive ? 4 : 3} fill={isActive ? ax.color : '#475569'} className={`${isActive ? 'qs-vertex-glow' : ''} ${pressedAxis === ax.key ? 'qs-vertex-pressed' : ''}`} style={{ color: ax.color }} />;
        })}
        {AXES.map((ax, i) => {
          const { x, y } = hexPoint(i, 1.32);
          return <text key={ax.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="10.5" fontWeight="800" fill={thresholds[ax.key] != null ? ax.color : '#64748B'} style={{ pointerEvents: 'none' }}>{ax.short}</text>;
        })}
        {AXES.map((ax, i) => {
          const centerAngle = i * wedgeAngleStep;
          const p1 = polarPoint(centerAngle - wedgeAngleStep / 2, maxR);
          const p2 = polarPoint(centerAngle + wedgeAngleStep / 2, maxR);
          return <path key={ax.key} d={`M120,120 L${p1.x},${p1.y} L${p2.x},${p2.y} Z`} className={`qs-wedge ${pressedAxis === ax.key ? 'qs-wedge-pressed' : ''}`} fill={ax.color} fillOpacity={pressedAxis !== ax.key && hoveredAxis === ax.key ? 0.16 : 0} onMouseEnter={() => setHoveredAxis(ax.key)} onMouseLeave={() => setHoveredAxis(null)} onClick={handleWedgeClick(ax)} />;
        })}
      </svg>
      <div className="mt-3 space-y-2.5">
        {AXES.map(ax => {
          const current = thresholds[ax.key];
          return (
            <div key={ax.key} className="flex items-center gap-2" title={ax.desc}>
              <span className="w-[76px] shrink-0 text-[11px] font-extrabold" style={{ color: ax.color }}>{ax.short}</span>
              <div className="flex gap-[3px] flex-1">
                {PRESET_VALUES.map(v => (
                  <button key={v} onClick={() => onAxisChange(ax.key, current === v ? null : v)} className={`qs-preset-chip flex-1 text-[9.5px] lg:text-[10px] font-black py-1 px-0.5 rounded-md border cursor-pointer ${current === v ? 'text-white border-transparent' : 'text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#151924]'}`} style={current === v ? { backgroundColor: ax.color } : {}}>≥{v}</button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScreenerCard({ r, onNameClick }) {
  const retColor = (r.ret_1m || 0) > 0 ? 'text-[#FF4B4B]' : (r.ret_1m || 0) < 0 ? 'text-[#3B82F6]' : 'text-slate-500';
  const gateColor = (r.entry_gate_pass_count || 0) >= 5 ? '#00B464' : (r.entry_gate_pass_count || 0) >= 3 ? '#F8B12A' : '#64748B';
  return (
    <div className="qs-card bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 cursor-pointer" onClick={() => onNameClick(r.symbol, r)}>
          <span className="qs-name-link text-[15px] font-black text-slate-900 dark:text-white">{r.name}</span>
          <div className="text-[11px] font-bold text-slate-400 truncate">{r.symbol}{r.sector && r.sector !== 'Unknown' ? ` · ${r.sector}` : ''}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[14px] font-black text-slate-900 dark:text-white whitespace-nowrap">{formatPriceMasked(r.current_price)}</div>
          <div className={`text-[12px] font-black whitespace-nowrap ${retColor}`}>{formatPct(r.ret_1m)}</div>
        </div>
      </div>
      <div className="flex items-center justify-between mb-3">
        <MiniSnowflake row={r} />
        <span className="text-[11px] font-black px-2 py-0.5 rounded-full shrink-0" style={{ color: gateColor, backgroundColor: `${gateColor}1A` }}>52주고점 -{formatNum(r.pct_from_52w_high, 1)}%</span>
      </div>
      <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/60">
        <div><p className="text-[9.5px] font-bold text-slate-400">ROE</p><p className="text-[12px] font-extrabold text-slate-700 dark:text-slate-300">{formatPct(r.roe)}</p></div>
        <div><p className="text-[9.5px] font-bold text-slate-400">부채비율</p><p className="text-[12px] font-extrabold text-slate-700 dark:text-slate-300">{formatPct(r.debt_ratio)}</p></div>
        <div><p className="text-[9.5px] font-bold text-slate-400">영업이익</p><p className="text-[12px] font-extrabold text-slate-700 dark:text-slate-300">{formatPct(r.op_margin)}</p></div>
        <div><p className="text-[9.5px] font-bold text-slate-400">RS</p><p className="text-[12px] font-extrabold text-slate-700 dark:text-slate-300">{formatNum(r.rs_score, 0)}</p></div>
        <div className="col-span-2"><p className="text-[9.5px] font-bold text-slate-400">52주 저점 대비</p><p className="text-[12px] font-extrabold text-slate-700 dark:text-slate-300">{formatPct(r.pct_above_52w_low)}</p></div>
        <div className="col-span-2"><p className="text-[9.5px] font-bold text-slate-400">EPS</p><p className="text-[12px] font-extrabold text-slate-700 dark:text-slate-300">{formatWon(r.eps_q)}</p></div>
      </div>
    </div>
  );
}

// =========================================================================
// 🌟 메인 스크리너 화면 (모달은 부모가 처리함)
// =========================================================================
export default function QuantScreener({ screenerData = [], onStockClick }) {
  const [thresholds, setThresholds] = useState(Object.fromEntries(AXES.map(ax => [ax.key, null])));
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('ALL');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('desc');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const activeAxisCount = AXES.filter(ax => thresholds[ax.key] !== null).length;
  const hasAnyFilter = activeAxisCount > 0 || search.trim().length > 0 || sector !== 'ALL';

  const sectorOptions = useMemo(() => {
    const set = new Set();
    (screenerData || []).forEach(r => { if (r.sector) set.add(r.sector); });
    return Array.from(set).sort((a, b) => a === 'Unknown' ? 1 : b === 'Unknown' ? -1 : a.localeCompare(b, 'ko'));
  }, [screenerData]);

  const activePresetLabel = useMemo(() => {
    for (const preset of STRATEGY_PRESETS) {
      if (AXES.every(ax => (preset.values[ax.key] ?? null) === (thresholds[ax.key] ?? null))) return preset.label;
    }
    return null;
  }, [thresholds]);

  const handleAxisChange = useCallback((key, value) => { setThresholds(prev => ({ ...prev, [key]: value })); setVisibleCount(PAGE_SIZE); }, []);
  const handleSectorChange = useCallback((value) => { setSector(value); setVisibleCount(PAGE_SIZE); }, []);

  const applyPreset = (preset) => {
    setThresholds(prev => {
      const next = { ...prev };
      AXES.forEach(ax => { next[ax.key] = null; });
      Object.entries(preset.values).forEach(([k, v]) => { next[k] = v; });
      return next;
    });
    setVisibleCount(PAGE_SIZE);
  };

  const filteredSorted = useMemo(() => {
    if (!hasAnyFilter) return [];
    const q = search.trim().toLowerCase();
    let rows = (screenerData || []).filter(r => {
      for (const ax of AXES) {
        const th = thresholds[ax.key];
        if (th == null) continue;
        if (r[ax.key] == null || r[ax.key] < th) return false;
      }
      if (sector !== 'ALL' && r.sector !== sector) return false;
      if (q && !(r.name || '').toLowerCase().includes(q) && !(r.symbol || '').toLowerCase().includes(q)) return false;
      return true;
    });

    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return sortDir === 'desc' ? bv - av : av - bv;
      });
    }
    return rows;
  }, [screenerData, thresholds, search, sector, sortKey, sortDir, hasAnyFilter]);

  const totalCount = filteredSorted.length;
  const results = filteredSorted.slice(0, visibleCount);
  const hasMore = totalCount > visibleCount;

  // 👇 여기서부터 덮어쓰세요! 👇
  const handleNameClick = async (row) => {
    setReportLoading(true);
    setSelectedStock({ ...row, isLoading: true });

    try {
      // 🌟 [핵심 변경] 방금 파이썬 백엔드에 만든 차트 전용 API를 직접 호출합니다.
      // (포트가 8000번이 아니라면 본인 환경에 맞게 수정해주세요. Proxy 설정이 되어있다면 http://localhost:8000 생략 가능)
      const response = await fetch(`http://localhost:8000/api/stock/chart/${row.symbol}`);
      
      if (!response.ok) {
        throw new Error(`API 통신 에러: ${response.status}`);
      }
      
      const result = await response.json();

      if (result.status === "success") {
        // 파이썬이 계산해준 완벽한 120일치 이동평균선 데이터를 그대로 화면에 꽂아 넣습니다!
        setSelectedStock({
          ...row,
          chart_data: result.data?.chart_data || [],
          isLoading: false,
        });
      } else {
        setSelectedStock(prev => ({ ...prev, isLoading: false, fetchError: true }));
      }
    } catch (error) {
      console.error("차트 데이터 불러오기 실패:", error);
      setSelectedStock(prev => ({ ...prev, isLoading: false, fetchError: true }));
    } finally {
      setReportLoading(false);
    }

    if (onSelectSymbol) onSelectSymbol(row.symbol, row);
  };
  // 👆 여기까지 덮어쓰세요! 👆

  return (
    <div className="relative w-full min-w-0 pb-20 font-['Nunito',_ui-rounded,_-apple-system,_system-ui,_sans-serif]">
      <style>{MICRO_STYLES}</style>
      <div className="mb-6 flex flex-col md:flex-row justify-between md:items-center gap-3">
        <div>
          <h2 className="text-2xl md:text-[28px] font-black text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
            🔎 스크리너 <span className="text-[13px] font-black text-slate-400 tracking-normal">Minervini Trend Template</span>
          </h2>
          <p className="text-[13px] font-bold text-slate-500 mt-1">추세·모멘텀 6조건으로 정배열 구간의 종목을 찾아보세요.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE); }} placeholder="종목명 또는 코드로 검색" className="w-full pl-11 pr-4 py-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl text-[14px] font-bold text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 transition-colors" />
        </div>
        <div className="relative md:w-[220px] shrink-0">
          <select value={sector} onChange={e => handleSectorChange(e.target.value)} className="qs-select w-full pl-4 pr-10 py-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl text-[14px] font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-400 transition-colors cursor-pointer">
            <option value="ALL">전체 섹터</option>
            {sectorOptions.map(s => <option key={s} value={s}>{s === 'Unknown' ? '섹터 미상' : s}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {STRATEGY_PRESETS.map(p => {
          const isActive = activePresetLabel === p.label;
          return (
            <button key={p.label} onClick={() => applyPreset(p)} className={`qs-preset-chip flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12.5px] font-black cursor-pointer shadow-sm border ${isActive ? 'qs-preset-chip-active' : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400'}`}>
              {isActive ? <Check size={13} strokeWidth={3} /> : <span>{p.icon}</span>}{p.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 min-w-0">
        <div className="lg:sticky lg:top-4 lg:self-start"><SnowflakeChart thresholds={thresholds} onAxisChange={handleAxisChange} /></div>
        <div className="min-w-0">
          {(screenerData || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-2xl">
              <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-[#151924] flex items-center justify-center mb-4"><Sparkles className="text-slate-400" size={24} /></div>
              <p className="text-[16px] font-black text-slate-900 dark:text-white mb-1">스크리너 데이터가 없습니다</p>
              <p className="text-[13px] font-bold text-slate-500">다음 배치(Cron) 실행 후 다시 확인해 주세요.</p>
            </div>
          ) : !hasAnyFilter ? (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-2xl">
              <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-[#151924] flex items-center justify-center mb-4"><Sparkles className="text-slate-400" size={24} /></div>
              <p className="text-[16px] font-black text-slate-900 dark:text-white mb-1">조건을 하나 이상 설정해보세요</p>
              <p className="text-[13px] font-bold text-slate-500">축 프리셋을 누르거나 전략 버튼을 선택하세요.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <p className="text-[14px] font-black text-slate-900 dark:text-white">{totalCount}개 종목 매칭</p>
                <div className="flex items-center gap-2">
                  <select value={sortKey || ''} onChange={e => { setSortKey(e.target.value || null); setVisibleCount(PAGE_SIZE); }} className="qs-select pl-3 pr-9 py-2 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg text-[12.5px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-400 cursor-pointer">
                    <option value="">기본 순서</option>
                    {SORT_OPTIONS.map(opt => <option key={opt.key} value={opt.key}>{opt.label} 순</option>)}
                  </select>
                  <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')} disabled={!sortKey} className={`p-2 rounded-lg border transition-colors ${sortKey ? 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 text-slate-600 dark:hover:text-slate-300 cursor-pointer' : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'}`}>
                    {!sortKey ? <ArrowUpDown size={14} /> : sortDir === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                  </button>
                </div>
              </div>
              {results.length === 0 ? (
                <div className="p-10 text-center text-slate-500 font-extrabold bg-white border rounded-2xl">조건에 맞는 종목이 없습니다.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {results.map((r) => <ScreenerCard key={r.symbol} r={r} onNameClick={onStockClick} />)}
                </div>
              )}
              {totalCount > visibleCount && (
                <div className="flex justify-center mt-4">
                  <button onClick={() => setVisibleCount(c => c + PAGE_SIZE)} className="px-5 py-2.5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl text-[13px] font-black text-slate-700 dark:text-slate-300 hover:border-blue-400 cursor-pointer shadow-sm">
                    더 보기 ({totalCount - visibleCount}개 남음)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
