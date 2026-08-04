import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { RefreshCcw, X, Search, ChevronDown, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useRenderApi } from '../hooks/useRenderApi';

// =========================================================================
// 🌟 6축(Snowflake) 정의 — quant_screener_scores 테이블 컬럼명과 1:1 매칭
//    quant_screener.py의 compute_screener_scores()가 이 6개 컬럼을 계산해서 저장한다.
// =========================================================================
const AXES = [
  { key: 'growth_score', label: 'Growth', short: '성장', color: '#FF4B4B' },
  { key: 'quality_score', label: 'Quality', short: '수익성', color: '#F8B12A' },
  { key: 'health_score', label: 'Health', short: '재무건전성', color: '#20C997' },
  { key: 'value_score', label: 'Value', short: '가치', color: '#3B82F6' },
  { key: 'momentum_score', label: 'Momentum', short: '모멘텀', color: '#A78BFA' },
  { key: 'track_record_score', label: 'Track Record', short: '신호근접도', color: '#F472B6' },
];
const AXIS_COUNT = AXES.length;
const PRESET_VALUES = [50, 60, 70, 80];

// 한 번에 여러 축을 채우는 "전략 프리셋" — 육각형이 시그니처 요소인 만큼,
// 이 버튼들이 "누르면 반응해서 채워지는" 재미를 가장 잘 보여주는 진입점.
const STRATEGY_PRESETS = [
  { label: '고성장 우량주', icon: '🚀', values: { growth_score: 70, quality_score: 70 } },
  { label: '저평가 방어주', icon: '🛡️', values: { value_score: 70, health_score: 70 } },
  { label: '돌파 임박', icon: '⚡', values: { momentum_score: 70, track_record_score: 60 } },
  { label: '올라운드 우량주', icon: '💎', values: { growth_score: 60, quality_score: 60, health_score: 60, value_score: 50 } },
];

// =========================================================================
// 🌟 육각형 좌표 계산 (12시 방향부터 시계방향 60도 간격)
// =========================================================================
function axisAngleRad(index) {
  return (-90 + index * (360 / AXIS_COUNT)) * (Math.PI / 180);
}
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

// 🌟 값이 바뀔 때 육각형이 스냅되지 않고 부드럽게 채워지도록 하는 보간 훅
//    (기존 QuantDesk의 useCountUp과 같은 ease-out cubic 원리를 배열 전체에 적용)
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
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(target), duration]);

  return values;
}

// 🌟 리스트 행 dock-hover 확대 (QuantDesk와 동일 패턴 재사용)
function getDockScale(index, hoverIndex) {
  if (hoverIndex === null || hoverIndex === undefined) return { scale: 1, lift: 0 };
  const diff = Math.abs(index - hoverIndex);
  if (diff === 0) return { scale: 1.012, lift: -2 };
  return { scale: 1, lift: 0 };
}

const MICRO_STYLES = `
  .qs-snowflake-fill { transition: fill-opacity 0.25s ease, stroke 0.25s ease; }
  .qs-dock-row { transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1); will-change: transform; }
  .qs-preset-chip { transition: all 0.18s ease; }
  .qs-preset-chip:hover { transform: translateY(-1px); }
  .qs-vertex-glow { filter: drop-shadow(0 0 5px currentColor); }
`;

function formatMarcap(val) {
  if (val === null || val === undefined || isNaN(val)) return "N/A";
  const num = Number(val);
  if (num === 0) return "0억";
  if (Math.abs(num) >= 10000) {
    const jo = Math.floor(Math.abs(num) / 10000);
    const eok = Math.floor(Math.abs(num) % 10000);
    return eok > 0 ? `${jo}조 ${eok.toLocaleString()}억` : `${jo}조`;
  }
  return `${num.toLocaleString()}억`;
}
function formatPct(v, digits = 1) {
  if (v === null || v === undefined || isNaN(v)) return "N/A";
  return `${v > 0 ? '+' : ''}${Number(v).toFixed(digits)}%`;
}
function formatNum(v, digits = 2) {
  if (v === null || v === undefined || isNaN(v)) return "N/A";
  return Number(v).toFixed(digits);
}

// =========================================================================
// 🌟 육각형(Snowflake) 컴포넌트
// =========================================================================
function SnowflakeChart({ thresholds, onAxisChange }) {
  const targetRadii = AXES.map(ax => {
    const v = thresholds[ax.key];
    return v === null || v === undefined ? 0.08 : v / 100;   // "any"는 중심 근처 점으로 표시
  });
  const animated = useAnimatedRadii(targetRadii);
  const activeCount = AXES.filter(ax => thresholds[ax.key] !== null && thresholds[ax.key] !== undefined).length;

  const ringFractions = [0.25, 0.5, 0.75, 1.0];

  return (
    <div className="p-5 bg-[#0B1120] rounded-2xl border border-slate-800">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-slate-400" />
          <span className="text-[13px] font-black text-slate-300 tracking-tight">SNOWFLAKE</span>
          {activeCount > 0 && (
            <span className="text-[11px] font-black text-white bg-[#FF4B4B] rounded-full w-5 h-5 flex items-center justify-center">{activeCount}</span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            onClick={() => AXES.forEach(ax => onAxisChange(ax.key, null))}
            className="text-[11px] font-extrabold text-slate-500 hover:text-white transition-colors cursor-pointer underline underline-offset-2"
          >
            초기화
          </button>
        )}
      </div>

      <svg viewBox="0 0 240 240" className="w-full max-w-[280px] mx-auto">
        {/* 배경 동심 육각형 (25/50/75/100%) */}
        {ringFractions.map((rf, ri) => (
          <polygon
            key={ri}
            points={polygonPoints(Array(AXIS_COUNT).fill(rf))}
            fill="none"
            stroke="#1E293B"
            strokeWidth="1"
          />
        ))}
        {/* 중심에서 각 축으로 뻗는 라인 */}
        {AXES.map((ax, i) => {
          const { x, y } = hexPoint(i, 1.0);
          return <line key={ax.key} x1="120" y1="120" x2={x} y2={y} stroke="#1E293B" strokeWidth="1" />;
        })}

        {/* 현재 임계값 채움 폴리곤 */}
        <polygon
          className="qs-snowflake-fill"
          points={polygonPoints(animated)}
          fill={activeCount > 0 ? "#3B82F6" : "#475569"}
          fillOpacity={activeCount > 0 ? 0.28 : 0.12}
          stroke={activeCount > 0 ? "#60A5FA" : "#475569"}
          strokeWidth="2"
        />
        {/* 각 축 꼭짓점 점 */}
        {AXES.map((ax, i) => {
          const { x, y } = hexPoint(i, animated[i]);
          const isActive = thresholds[ax.key] !== null && thresholds[ax.key] !== undefined;
          return (
            <circle
              key={ax.key} cx={x} cy={y} r={isActive ? 4 : 3}
              fill={isActive ? ax.color : '#475569'}
              className={isActive ? 'qs-vertex-glow' : ''}
              style={{ color: ax.color }}
            />
          );
        })}

        {/* 축 라벨 + 현재값 */}
        {AXES.map((ax, i) => {
          const { x, y } = hexPoint(i, 1.32);
          const isActive = thresholds[ax.key] !== null && thresholds[ax.key] !== undefined;
          return (
            <text
              key={ax.key} x={x} y={y}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="10.5" fontWeight="800"
              fill={isActive ? ax.color : '#64748B'}
            >
              {ax.short}
            </text>
          );
        })}
      </svg>

      {/* 축별 임계값 프리셋 버튼 */}
      <div className="mt-3 space-y-2.5">
        {AXES.map(ax => {
          const current = thresholds[ax.key];
          return (
            <div key={ax.key} className="flex items-center gap-2">
              <span className="w-[64px] shrink-0 text-[11px] font-extrabold" style={{ color: ax.color }}>{ax.label}</span>
              <div className="flex gap-1 flex-1">
                {PRESET_VALUES.map(v => {
                  const isSelected = current === v;
                  return (
                    <button
                      key={v}
                      onClick={() => onAxisChange(ax.key, isSelected ? null : v)}
                      className={`qs-preset-chip flex-1 text-[10.5px] font-black py-1 rounded-lg border cursor-pointer ${
                        isSelected
                          ? 'text-white border-transparent'
                          : 'text-slate-400 border-slate-700 bg-[#151924] hover:border-slate-500'
                      }`}
                      style={isSelected ? { backgroundColor: ax.color } : {}}
                    >
                      ≥{v}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =========================================================================
// 🌟 메인 스크리너 화면
// =========================================================================
export default function QuantScreener({ onSelectSymbol }) {
  const { callApi } = useRenderApi();

  const [thresholds, setThresholds] = useState(
    Object.fromEntries(AXES.map(ax => [ax.key, null]))
  );
  const [sector, setSector] = useState('전체');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('marcap_억');
  const [sortDir, setSortDir] = useState('desc');

  const [results, setResults] = useState([]);
  const [sectors, setSectors] = useState(['전체']);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [hoverRowIdx, setHoverRowIdx] = useState(null);

  const activeAxisCount = AXES.filter(ax => thresholds[ax.key] !== null).length;
  const hasAnyFilter = activeAxisCount > 0 || sector !== '전체' || search.trim().length > 0;

  const handleAxisChange = useCallback((key, value) => {
    setThresholds(prev => ({ ...prev, [key]: value }));
  }, []);

  const applyPreset = (preset) => {
    setThresholds(prev => {
      const next = { ...prev };
      AXES.forEach(ax => { next[ax.key] = null; });
      Object.entries(preset.values).forEach(([k, v]) => { next[k] = v; });
      return next;
    });
  };

  // 💡 [백엔드 연동 지점] POST /api/screener
  //    요청 바디: { thresholds: {growth_score:70,...}, sector, search, sort:{key,dir}, page:1, page_size:50 }
  //    기대 응답: { status:"success", data: { count, sectors:[...], results:[ {symbol,name,sector,market,
  //                per,pbr,marcap_억,current_price,ret_1m,rs_score,rev_yoy,op_yoy,np_yoy,op_margin,roe,
  //                debt_ratio,growth_score,quality_score,health_score,value_score,momentum_score,
  //                track_record_score,entry_gate_pass_count,updated_at} ] } }
  //    지금은 백엔드가 없어 자리만 잡아두고, 다음 단계에서 이 fetch 로직만 채운다.
  useEffect(() => {
    if (!hasAnyFilter) {
      setResults([]);
      setTotalCount(0);
      setHasSearched(false);
      return;
    }
    setHasSearched(true);
    const timer = setTimeout(() => {
      setLoading(true);
      callApi('/api/screener', {
        method: 'POST',
        body: {
          thresholds,
          sector: sector === '전체' ? null : sector,
          search: search.trim() || null,
          sort: { key: sortKey, dir: sortDir },
          page: 1, page_size: 50,
        },
      })
        .then(res => {
          if (res?.status === 'success' && res.data) {
            setResults(res.data.results || []);
            setTotalCount(res.data.count || 0);
            if (Array.isArray(res.data.sectors) && res.data.sectors.length > 0) {
              setSectors(['전체', ...res.data.sectors]);
            }
          } else {
            setResults([]);
            setTotalCount(0);
          }
          setLoading(false);
        })
        .catch(() => { setResults([]); setTotalCount(0); setLoading(false); });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thresholds, sector, search, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const columns = [
    { key: 'name', label: '종목', sortable: false, align: 'left' },
    { key: 'sector', label: '업종', sortable: false, align: 'left' },
    { key: 'current_price', label: '현재가', sortable: true, align: 'right' },
    { key: 'per', label: 'PER', sortable: true, align: 'right' },
    { key: 'pbr', label: 'PBR', sortable: true, align: 'right' },
    { key: 'marcap_억', label: '시총', sortable: true, align: 'right' },
    { key: 'ret_1m', label: '1M %', sortable: true, align: 'right' },
    { key: 'rs_score', label: 'RS', sortable: true, align: 'right' },
    { key: 'op_margin', label: '영업이익률', sortable: true, align: 'right' },
    { key: 'roe', label: 'ROE', sortable: true, align: 'right' },
    { key: 'debt_ratio', label: '부채비율', sortable: true, align: 'right' },
    { key: 'entry_gate_pass_count', label: '관문', sortable: true, align: 'center' },
  ];

  return (
    <div className="relative w-full pb-20 font-['Nunito',_ui-rounded,_-apple-system,_system-ui,_sans-serif]">
      <style>{MICRO_STYLES}</style>

      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row justify-between md:items-center gap-3">
        <div>
          <h2 className="text-2xl md:text-[28px] font-black text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
            🔎 스크리너
          </h2>
          <p className="text-[13px] font-bold text-slate-500 mt-1">
            6축 재무·모멘텀 스코어로 원하는 조건의 종목을 찾아보세요.
          </p>
        </div>
      </div>

      {/* 검색 + 업종 */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="종목명 또는 코드로 검색"
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl text-[14px] font-bold text-slate-900 dark:text-white placeholder:text-slate-500 placeholder:font-semibold focus:outline-none focus:border-blue-400 dark:focus:border-slate-600 transition-colors"
          />
        </div>
        <div className="relative">
          <select
            value={sector}
            onChange={e => setSector(e.target.value)}
            className="appearance-none w-full md:w-[180px] pl-4 pr-9 py-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl text-[14px] font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-400 dark:focus:border-slate-600 cursor-pointer"
          >
            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {/* 전략 프리셋 */}
      <div className="flex flex-wrap gap-2 mb-8">
        {STRATEGY_PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => applyPreset(p)}
            className="qs-preset-chip flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-full text-[12.5px] font-black text-slate-700 dark:text-slate-300 hover:border-blue-400 dark:hover:border-slate-500 cursor-pointer shadow-sm"
          >
            <span>{p.icon}</span>{p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* 왼쪽: Snowflake */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <SnowflakeChart thresholds={thresholds} onAxisChange={handleAxisChange} />
        </div>

        {/* 오른쪽: 결과 */}
        <div>
          {!hasSearched ? (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-2xl">
              <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-[#151924] flex items-center justify-center mb-4">
                <Sparkles className="text-slate-400" size={24} />
              </div>
              <p className="text-[16px] font-black text-slate-900 dark:text-white mb-1">조건을 하나 이상 설정해보세요</p>
              <p className="text-[13px] font-bold text-slate-500">축 프리셋을 누르거나, 위의 전략 버튼으로 바로 시작할 수 있어요.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[14px] font-black text-slate-900 dark:text-white">
                  {loading ? '검색 중...' : `${totalCount}개 종목 매칭`}
                </p>
                {loading && <RefreshCcw className="animate-spin text-blue-500" size={16} />}
              </div>

              <div className="w-full bg-white dark:bg-transparent md:border border-slate-200 dark:border-slate-800 md:rounded-2xl overflow-x-auto md:shadow-sm">
                <table className="w-full min-w-[860px]">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-transparent">
                      {columns.map(col => (
                        <th
                          key={col.key}
                          onClick={() => col.sortable && toggleSort(col.key)}
                          className={`px-3 py-3 text-[11.5px] font-extrabold text-slate-500 whitespace-nowrap ${
                            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                          } ${col.sortable ? 'cursor-pointer hover:text-slate-900 dark:hover:text-white select-none' : ''}`}
                        >
                          {col.label}{sortKey === col.key && (sortDir === 'desc' ? ' ▼' : ' ▲')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.length === 0 && !loading ? (
                      <tr><td colSpan={columns.length} className="p-10 text-center text-slate-500 font-extrabold">조건에 맞는 종목이 없습니다.</td></tr>
                    ) : results.map((r, idx) => {
                      const dock = getDockScale(idx, hoverRowIdx);
                      const retColor = (r.ret_1m || 0) > 0 ? 'text-[#FF4B4B]' : (r.ret_1m || 0) < 0 ? 'text-[#3B82F6]' : 'text-slate-500';
                      const gateColor = (r.entry_gate_pass_count || 0) >= 5 ? '#00B464' : (r.entry_gate_pass_count || 0) >= 3 ? '#F8B12A' : '#64748B';
                      return (
                        <tr
                          key={r.symbol}
                          onMouseEnter={() => setHoverRowIdx(idx)}
                          onMouseLeave={() => setHoverRowIdx(null)}
                          onClick={() => onSelectSymbol && onSelectSymbol(r.symbol, r)}
                          style={{ transform: `translateY(${dock.lift}px) scale(${dock.scale})` }}
                          className="qs-dock-row border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                        >
                          <td className="px-3 py-3">
                            <div className="text-[13.5px] font-black text-slate-900 dark:text-white">{r.name}</div>
                            <div className="text-[10.5px] font-bold text-slate-400">{r.symbol}</div>
                          </td>
                          <td className="px-3 py-3 text-[12px] font-bold text-slate-500 whitespace-nowrap">{r.sector || '-'}</td>
                          <td className="px-3 py-3 text-right text-[12.5px] font-black text-slate-900 dark:text-white">₩{formatNum(r.current_price, 0)}</td>
                          <td className="px-3 py-3 text-right text-[12px] font-bold text-slate-600 dark:text-slate-300">{formatNum(r.per)}</td>
                          <td className="px-3 py-3 text-right text-[12px] font-bold text-slate-600 dark:text-slate-300">{formatNum(r.pbr)}</td>
                          <td className="px-3 py-3 text-right text-[12px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatMarcap(r.marcap_억)}</td>
                          <td className={`px-3 py-3 text-right text-[12.5px] font-black ${retColor}`}>{formatPct(r.ret_1m)}</td>
                          <td className="px-3 py-3 text-right text-[12px] font-bold text-slate-600 dark:text-slate-300">{formatNum(r.rs_score, 1)}</td>
                          <td className="px-3 py-3 text-right text-[12px] font-bold text-slate-600 dark:text-slate-300">{formatPct(r.op_margin)}</td>
                          <td className="px-3 py-3 text-right text-[12px] font-bold text-slate-600 dark:text-slate-300">{formatPct(r.roe)}</td>
                          <td className="px-3 py-3 text-right text-[12px] font-bold text-slate-600 dark:text-slate-300">{formatPct(r.debt_ratio)}</td>
                          <td className="px-3 py-3 text-center">
                            <span className="text-[11px] font-black px-2 py-0.5 rounded-full" style={{ color: gateColor, backgroundColor: `${gateColor}1A` }}>
                              {r.entry_gate_pass_count ?? 0}/6
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
