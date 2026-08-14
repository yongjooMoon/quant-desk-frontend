import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { RefreshCcw, X, Search, SlidersHorizontal, Sparkles, Check, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useRenderApi } from '../hooks/useRenderApi';

// =========================================================================
// 🌟 미네르비니 트렌드 템플릿 6축
//    /api/screener(백엔드, stock_daily 기반 계산)가 채워주는 컬럼과 1:1 매칭.
//    ⚠️ 기존 quant_screener_scores와 달리 "가중합 스코어"가 아니라 각 축마다
//    2~4개의 통과/불통과 체크 항목 비율(0/25/50/75/100 또는 0/50/100)이다.
//    RS(상대강도)만 유니버스 대비 백분위(1~99)라서 자연스럽게 연속값.
//    → 필터 로직(≥threshold) 자체는 기존과 동일하게 그대로 쓸 수 있다.
// =========================================================================
const AXES = [
  { key: 'trend_alignment_score', label: 'Trend Alignment', short: '정배열', color: '#FF4B4B',
    desc: '현재가 > 50일선 > 150일선 > 200일선 (4개 조건 통과 비율)' },
  { key: 'ma200_trend_score', label: '200MA Uptrend', short: '200일선추세', color: '#F8B12A',
    desc: '200일선이 1개월·3개월 전보다 상승 중인지' },
  { key: 'high_proximity_score', label: 'Near 52W High', short: '신고가근접', color: '#20C997',
    desc: '52주 신고가 대비 25%/10% 이내' },
  { key: 'low_rise_score', label: 'Off the Low', short: '저점탈출', color: '#3B82F6',
    desc: '52주 신저가 대비 30%/50% 이상 상승' },
  { key: 'rs_score', label: 'RS Rating', short: 'RS강도', color: '#A78BFA',
    desc: '전체 종목 대비 가격 모멘텀 백분위 (IBD 스타일, 1~99)' },
  { key: 'ma50_momentum_score', label: '50MA Support', short: '50일선지지', color: '#F472B6',
    desc: '현재가가 50일선 위, 50일선 자체도 상승 중인지' },
];
const AXIS_COUNT = AXES.length;
const PRESET_VALUES = [50, 60, 70, 80];
const PAGE_SIZE = 50;

// 🌟 카드 목록 정렬 옵션. marcap/per/pbr는 현재 데이터에 없어서 제외,
//    대신 트렌드 템플릿 관련 지표(52주 고저가와의 거리 등)를 추가.
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

// 🌟 전략 프리셋 — 미네르비니 트렌드 템플릿의 대표적인 활용 시나리오들.
//    "완전 정배열"은 원조 Stage 2 셋업, 나머지는 그 하위 신호들.
const STRATEGY_PRESETS = [
  // 미네르비니 8조건의 핵심(정배열 100% + 200일선 상승 + 50일선 지지) — 교과서적 Stage 2
  { label: '완전 정배열 (Stage 2)', icon: '🚀', values: { trend_alignment_score: 100, ma200_trend_score: 50, ma50_momentum_score: 50 } },
  // 신고가 돌파 임박 + RS 상위권 — 브레이크아웃 후보
  { label: '신고가 임박', icon: '🎯', values: { high_proximity_score: 50, rs_score: 70 } },
  // RS만 강한 종목 — 아직 정배열 전이어도 상대강도로 먼저 스크리닝
  { label: 'RS 강세주', icon: '⚡', values: { rs_score: 80 } },
  // 바닥 다지고 막 올라오기 시작 (200일선 상승 전환 + 저점 대비 반등)
  { label: '바닥 탈출 초기', icon: '🌱', values: { low_rise_score: 50, ma200_trend_score: 50 } },
  // 6축 전부 70 이상 — 가장 엄격한 필터
  { label: '완벽한 셋업', icon: '💎', values: { trend_alignment_score: 100, high_proximity_score: 50, low_rise_score: 50, rs_score: 70, ma50_momentum_score: 50, ma200_trend_score: 50 } },
  // 아직 신고가와는 거리 있지만 추세 전환 초입 — 관찰 리스트용
  { label: '추세 전환 관찰', icon: '👀', values: { ma200_trend_score: 50, trend_alignment_score: 50 } },
];

// =========================================================================
// 🌟 육각형 좌표 계산 (12시 방향부터 시계방향 60도 간격) — 기존과 동일
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
function polarPoint(angleDeg, radius, cx = 120, cy = 120) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

// 🌟 값이 바뀔 때 육각형이 스냅되지 않고 부드럽게 채워지도록 하는 보간 훅
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

// 🌟 모달의 "통과 조건" 숫자 카운트업 (합성 스코어가 아니라 0~6 사이의 실제 개수)
function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);
  const fromRef = useRef(0);

  useEffect(() => {
    const safeTarget = Number.isFinite(target) ? target : 0;
    const from = fromRef.current;
    const start = performance.now();
    cancelAnimationFrame(rafRef.current);

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (safeTarget - from) * eased;
      setValue(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = safeTarget;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
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
    animation: qsPresetPop 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  }
  @keyframes qsPresetPop {
    0% { transform: scale(0.94); }
    55% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }

  .qs-wedge { cursor: pointer; transition: fill-opacity 0.15s ease; }
  .qs-wedge-pressed { animation: qsWedgeFlash 0.28s ease-out; }
  @keyframes qsWedgeFlash {
    0% { fill-opacity: 0.5; }
    100% { fill-opacity: 0; }
  }
  .qs-vertex-pressed { animation: qsVertexPop 0.28s cubic-bezier(0.22, 1, 0.36, 1); }
  @keyframes qsVertexPop {
    0% { r: 4; }
    35% { r: 8; }
    100% { r: 4; }
  }

  .qs-name-link {
    display: block;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    transition: color 0.15s ease;
  }
  .qs-name-link:hover { color: #3B82F6; text-decoration: underline; text-underline-offset: 2px; }

  .qs-select {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
    background-size: 14px;
  }

  .qs-card {
    transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.18s ease, border-color 0.18s ease;
  }
  .qs-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(15,23,42,0.08);
  }
  .dark .qs-card:hover {
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  }

  .qs-gate-pass { background: rgba(0,180,100,0.10); border-color: rgba(0,180,100,0.5); }
`;

function formatPriceMasked(v) {
  if (v === null || v === undefined || isNaN(v)) return "N/A";
  return `₩${Number(v).toLocaleString()}`;
}
function formatPct(v, digits = 1) {
  if (v === null || v === undefined || isNaN(v)) return "N/A";
  return `${v > 0 ? '+' : ''}${Number(v).toFixed(digits)}%`;
}
function formatNum(v, digits = 2) {
  if (v === null || v === undefined || isNaN(v)) return "N/A";
  return Number(v).toFixed(digits);
}
function formatWon(v) {
  if (v === null || v === undefined || isNaN(v)) return "N/A";
  return Math.round(Number(v)).toLocaleString();
}
// 🌟 revenue_q/op_profit_q/net_income_q의 실제 저장 단위(원/천원/백만원/억원)를
//    확인하신 뒤 아래 두 값만 맞춰주세요. 기본값은 "단위 변환 없음 + 원본 그대로"입니다.
const FINANCIAL_UNIT_DIVISOR = 1;
const FINANCIAL_UNIT_LABEL = '';
function formatFinancial(v) {
  if (v === null || v === undefined || isNaN(v)) return "N/A";
  return `${(Number(v) / FINANCIAL_UNIT_DIVISOR).toLocaleString(undefined, { maximumFractionDigits: 0 })}${FINANCIAL_UNIT_LABEL}`;
}

// =========================================================================
// 🌟 미니 Snowflake 아이콘 — 카드 그리드용 축소 육각형. AXES를 그대로 순회하므로
//    축 정의만 바뀌면(예: 다른 전략으로 또 바꾸더라도) 이 컴포넌트는 손댈 필요 없음.
// =========================================================================
function MiniSnowflake({ row, size = 34 }) {
  const maxR = size * 0.41;
  const cx = size / 2, cy = size / 2;
  const vb = size;

  const pt = (i, frac) => {
    const angle = (-90 + i * (360 / AXIS_COUNT)) * (Math.PI / 180);
    const r = Math.max(0, Math.min(1, frac)) * maxR;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  const validScores = AXES
    .map(ax => row[ax.key])
    .filter(v => v !== null && v !== undefined && !isNaN(v));
  const avg = validScores.length ? validScores.reduce((a, b) => a + b, 0) / validScores.length : null;

  const avgColor = avg === null ? '#94A3B8' : avg >= 70 ? '#00B464' : avg >= 40 ? '#F8B12A' : '#EF4444';

  const shapePoints = AXES.map((ax, i) => {
    const v = row[ax.key];
    const frac = (v === null || v === undefined || isNaN(v)) ? 0.08 : v / 100;
    const { x, y } = pt(i, frac);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const bgPoints = AXES.map((_, i) => {
    const { x, y } = pt(i, 1);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const tooltipText = AXES
    .map(ax => {
      const v = row[ax.key];
      const has = v !== null && v !== undefined && !isNaN(v);
      return `${ax.label}: ${has ? v.toFixed(0) : 'N/A'}`;
    })
    .join('\n');

  return (
    <div className="flex items-center gap-2" title={tooltipText}>
      <svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} className="shrink-0">
        <polygon points={bgPoints} fill="none" className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" />
        <polygon points={shapePoints} fill={avgColor} fillOpacity="0.32" stroke={avgColor} strokeWidth="1.4" />
      </svg>
      <span className="text-[13px] font-black tabular-nums" style={{ color: avgColor }}>
        {row.entry_gate_pass_count ?? '-'}/6
      </span>
    </div>
  );
}

// =========================================================================
// 🌟 육각형(Snowflake) 필터 컴포넌트 — 인터랙션 로직은 기존과 동일, AXES/의미만 교체됨
// =========================================================================
function SnowflakeChart({ thresholds, onAxisChange }) {
  const targetRadii = AXES.map(ax => {
    const v = thresholds[ax.key];
    return v === null || v === undefined ? 0.08 : v / 100;
  });
  const animated = useAnimatedRadii(targetRadii);
  const activeCount = AXES.filter(ax => thresholds[ax.key] !== null && thresholds[ax.key] !== undefined).length;

  const ringFractions = [0.25, 0.5, 0.75, 1.0];
  const maxR = 88;
  const wedgeAngleStep = 360 / AXIS_COUNT;

  const svgRef = useRef(null);
  const [hoveredAxis, setHoveredAxis] = useState(null);
  const [pressedAxis, setPressedAxis] = useState(null);
  const pressTimerRef = useRef(null);

  const handleWedgeClick = (ax) => (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = 240 / rect.width;
    const scaleY = 240 / rect.height;
    const localX = (e.clientX - rect.left) * scaleX;
    const localY = (e.clientY - rect.top) * scaleY;
    const dist = Math.hypot(localX - 120, localY - 120);
    const frac = Math.max(0, Math.min(1, dist / maxR));
    const rawValue = frac * 100;

    let nextValue = null;
    if (rawValue >= 45) {
      nextValue = PRESET_VALUES.reduce((closest, v) =>
        Math.abs(v - rawValue) < Math.abs(closest - rawValue) ? v : closest,
        PRESET_VALUES[0]
      );
    }

    const current = thresholds[ax.key];
    onAxisChange(ax.key, current === nextValue ? null : nextValue);

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
          {activeCount > 0 && (
            <span className="text-[11px] font-black text-white bg-[#FF4B4B] rounded-full w-5 h-5 flex items-center justify-center">{activeCount}</span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            onClick={() => AXES.forEach(ax => onAxisChange(ax.key, null))}
            className="text-[11px] font-extrabold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer underline underline-offset-2"
          >
            초기화
          </button>
        )}
      </div>

      <svg ref={svgRef} viewBox="0 0 240 240" className="w-full max-w-[280px] mx-auto select-none">
        {ringFractions.map((rf, ri) => (
          <polygon
            key={ri}
            points={polygonPoints(Array(AXIS_COUNT).fill(rf))}
            fill="none"
            className="stroke-slate-200 dark:stroke-[#1E293B]"
            strokeWidth="1"
          />
        ))}
        {AXES.map((ax, i) => {
          const { x, y } = hexPoint(i, 1.0);
          return <line key={ax.key} x1="120" y1="120" x2={x} y2={y} className="stroke-slate-200 dark:stroke-[#1E293B]" strokeWidth="1" />;
        })}

        <polygon
          className="qs-snowflake-fill"
          points={polygonPoints(animated)}
          fill={activeCount > 0 ? "#3B82F6" : "#475569"}
          fillOpacity={activeCount > 0 ? 0.28 : 0.12}
          stroke={activeCount > 0 ? "#60A5FA" : "#475569"}
          strokeWidth="2"
        />

        {AXES.map((ax, i) => {
          const { x, y } = hexPoint(i, animated[i]);
          const isActive = thresholds[ax.key] !== null && thresholds[ax.key] !== undefined;
          const isPressed = pressedAxis === ax.key;
          return (
            <circle
              key={ax.key} cx={x} cy={y} r={isActive ? 4 : 3}
              fill={isActive ? ax.color : '#475569'}
              className={`${isActive ? 'qs-vertex-glow' : ''} ${isPressed ? 'qs-vertex-pressed' : ''}`}
              style={{ color: ax.color }}
            />
          );
        })}

        {AXES.map((ax, i) => {
          const { x, y } = hexPoint(i, 1.32);
          const isActive = thresholds[ax.key] !== null && thresholds[ax.key] !== undefined;
          return (
            <text
              key={ax.key} x={x} y={y}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="10.5" fontWeight="800"
              fill={isActive ? ax.color : '#64748B'}
              style={{ pointerEvents: 'none' }}
            >
              {ax.short}
            </text>
          );
        })}

        {AXES.map((ax, i) => {
          const centerAngle = i * wedgeAngleStep;
          const p1 = polarPoint(centerAngle - wedgeAngleStep / 2, maxR);
          const p2 = polarPoint(centerAngle + wedgeAngleStep / 2, maxR);
          const isHovered = hoveredAxis === ax.key;
          const isPressed = pressedAxis === ax.key;
          return (
            <path
              key={ax.key}
              d={`M120,120 L${p1.x},${p1.y} L${p2.x},${p2.y} Z`}
              className={`qs-wedge ${isPressed ? 'qs-wedge-pressed' : ''}`}
              fill={ax.color}
              fillOpacity={isPressed ? undefined : (isHovered ? 0.16 : 0)}
              onMouseEnter={() => setHoveredAxis(ax.key)}
              onMouseLeave={() => setHoveredAxis(null)}
              onClick={handleWedgeClick(ax)}
            />
          );
        })}
      </svg>

      <div className="mt-3 space-y-2.5">
        {AXES.map(ax => {
          const current = thresholds[ax.key];
          return (
            <div key={ax.key} className="flex items-center gap-2" title={ax.desc}>
              <span className="w-[76px] shrink-0 text-[11px] font-extrabold" style={{ color: ax.color }}>{ax.short}</span>
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
                          : 'text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#151924] hover:border-slate-400 dark:hover:border-slate-500'
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
// 🌟 종목 카드 — PER/PBR/시가총액(원본 데이터에 없음) 대신 실제 보유 재무 필드로 교체
// =========================================================================
function ScreenerCard({ r, onNameClick }) {
  const retColor = (r.ret_1m || 0) > 0 ? 'text-[#FF4B4B]' : (r.ret_1m || 0) < 0 ? 'text-[#3B82F6]' : 'text-slate-500';
  const gateColor = (r.entry_gate_pass_count || 0) >= 5 ? '#00B464' : (r.entry_gate_pass_count || 0) >= 3 ? '#F8B12A' : '#64748B';

  return (
    <div className="qs-card bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
      {/* 상단: 종목명/섹터 + 현재가/수익률 */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 cursor-pointer" onClick={() => onNameClick(r)}>
          <span className="qs-name-link text-[15px] font-black text-slate-900 dark:text-white">{r.name}</span>
          <div className="text-[11px] font-bold text-slate-400 truncate">
            {r.symbol}{r.sector && r.sector !== 'Unknown' ? ` · ${r.sector}` : ''}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[14px] font-black text-slate-900 dark:text-white whitespace-nowrap">{formatPriceMasked(r.current_price)}</div>
          <div className={`text-[12px] font-black whitespace-nowrap ${retColor}`}>{formatPct(r.ret_1m)}</div>
        </div>
      </div>

      {/* 중단: 6축 미니 Snowflake + 통과 조건 배지 */}
      <div className="flex items-center justify-between mb-3">
        <MiniSnowflake row={r} />
        <span className="text-[11px] font-black px-2 py-0.5 rounded-full shrink-0" style={{ color: gateColor, backgroundColor: `${gateColor}1A` }}>
          52주고점 -{formatNum(r.pct_from_52w_high, 1)}%
        </span>
      </div>

      {/* 하단: 참고용 재무 지표 (스코어 축 아님) */}
      <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/60">
        <div>
          <p className="text-[9.5px] font-bold text-slate-400">ROE</p>
          <p className="text-[12px] font-extrabold text-slate-700 dark:text-slate-300">{formatPct(r.roe)}</p>
        </div>
        <div>
          <p className="text-[9.5px] font-bold text-slate-400">부채비율</p>
          <p className="text-[12px] font-extrabold text-slate-700 dark:text-slate-300">{formatPct(r.debt_ratio)}</p>
        </div>
        <div>
          <p className="text-[9.5px] font-bold text-slate-400">영업이익</p>
          <p className="text-[12px] font-extrabold text-slate-700 dark:text-slate-300">{formatPct(r.op_margin)}</p>
        </div>
        <div>
          <p className="text-[9.5px] font-bold text-slate-400">RS</p>
          <p className="text-[12px] font-extrabold text-slate-700 dark:text-slate-300">{formatNum(r.rs_score, 0)}</p>
        </div>
        <div className="col-span-2">
          <p className="text-[9.5px] font-bold text-slate-400">52주 저점 대비</p>
          <p className="text-[12px] font-extrabold text-slate-700 dark:text-slate-300">{formatPct(r.pct_above_52w_low)}</p>
        </div>
        <div className="col-span-2">
          <p className="text-[9.5px] font-bold text-slate-400">EPS</p>
          <p className="text-[12px] font-extrabold text-slate-700 dark:text-slate-300">{formatWon(r.eps_q)}</p>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 🌟 종목 리포트 모달 — 합성 스코어 게이지 대신 "6조건 중 통과 개수" + 조건별 체크리스트.
//    /api/search/{symbol}은 이제 gates/score를 내려줄 필요 없이 chart_data
//    (이동평균 포함)만 채워주면 된다. gates는 screenerData의 row(6축 점수)로 프론트에서 계산.
// =========================================================================
function ScreenerReportModal({ selectedStock, reportLoading, onClose }) {
  const passCount = selectedStock ? (selectedStock.entry_gate_pass_count ?? 0) : 0;
  const animatedPassCount = useCountUp(passCount, 900);
  if (!selectedStock) return null;

  // 🌟 배치(screenerData)에서 이미 계산된 6축 점수로 게이트 통과 여부를 그 자리에서 판정.
  //    /api/search 응답에 별도 gates 필드가 없어도 항상 일관된 값을 보여줄 수 있음.
  const gates = AXES.map(ax => {
    const score = selectedStock[ax.key];
    return {
      key: ax.key,
      label: ax.short,
      desc: ax.desc,
      score: score ?? null,
      pass: score !== null && score !== undefined && score >= 70,
    };
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 w-full max-w-[1200px] min-h-[60vh] md:min-h-[75vh] max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex gap-2 items-center">
            <span className="text-[14px] md:text-[14.5px] font-black text-slate-500 dark:text-slate-400">{selectedStock.symbol} · {selectedStock.market || "KOSPI"}</span>
            {selectedStock.sector && selectedStock.sector !== 'Unknown' && <span className="text-[12px] md:text-[13.5px] font-extrabold px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{selectedStock.sector}</span>}
          </div>
          <button onClick={onClose} className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full transition-colors cursor-pointer"><X size={20}/></button>
        </div>

        <div className="p-6 md:p-10 overflow-y-auto flex-1">
          {reportLoading || selectedStock.isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <RefreshCcw className="animate-spin mb-4 text-blue-500" size={40} />
              <p className="font-black text-[15px] md:text-lg animate-pulse text-slate-700 dark:text-slate-300 text-center">최신 가격/이동평균 데이터를 불러오는 중입니다...</p>
            </div>
          ) : selectedStock.fetchError ? (
            <div className="flex flex-col items-center justify-center h-full text-[#FF4B4B]">
              <X size={40} className="mb-4" />
              <p className="font-black text-[15px] md:text-lg text-center">해당 종목의 데이터(API)를 불러오는데 실패했습니다.</p>
            </div>
          ) : (
            <>
              <div className="mb-8 md:mb-10">
                <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-2 md:mb-4 leading-tight tracking-tight">
                  {selectedStock.name}
                </h2>
                <h1 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-baseline">
                  {formatWon(selectedStock.current_price)} 원 <span className={`text-[16px] md:text-[24px] ml-2 md:ml-3 ${(selectedStock.ret_1m || 0) > 0 ? 'text-[#FF4B4B]' : 'text-[#3B82F6]'}`}>{(selectedStock.ret_1m || 0) > 0 ? '+' : ''}{formatPct(selectedStock.ret_1m || 0)} (1M)</span>
                </h1>
              </div>

              {/* 통과 조건 요약 + 52주 고저가 위치 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <div className="p-6 md:p-8 bg-slate-50 dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6">📋 Trend Template 요약</h3>
                  <div>
                    <p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">통과 조건</p>
                    <p className="text-4xl md:text-5xl font-black text-[#00B464]">{animatedPassCount.toFixed(0)} <span className="text-2xl text-slate-400">/ 6</span></p>
                  </div>
                  <p className="text-[11px] md:text-[12px] font-extrabold text-slate-500 mt-6 p-3 bg-white dark:bg-[#1E293B] rounded-xl border border-slate-200 dark:border-slate-700/50">💡 6축은 가중합 점수가 아니라 각 조건별 통과 비율입니다. 70점 이상이면 해당 축을 "통과"로 표시합니다.</p>
                </div>

                <div className="p-6 md:p-8 bg-slate-50 dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6">📍 52주 고저가 위치</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">52주 신고가</p><p className="text-[16px] md:text-[18px] font-black text-slate-900 dark:text-white">{formatWon(selectedStock.week52_high)}원</p></div>
                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">52주 신저가</p><p className="text-[16px] md:text-[18px] font-black text-slate-900 dark:text-white">{formatWon(selectedStock.week52_low)}원</p></div>
                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">고점과의 거리</p><p className="text-[16px] md:text-[18px] font-black text-[#3B82F6]">-{formatNum(selectedStock.pct_from_52w_high, 1)}%</p></div>
                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">저점 대비 상승</p><p className="text-[16px] md:text-[18px] font-black text-[#FF4B4B]">+{formatNum(selectedStock.pct_above_52w_low, 1)}%</p></div>
                  </div>
                </div>
              </div>

              {/* Trend Template 6조건 체크리스트 */}
              <div className="mb-10">
                <h5 className="text-xl font-black text-slate-900 dark:text-white mb-4 md:mb-6">Minervini Trend Template (6 conditions)</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                  {gates.map(gate => (
                    <div key={gate.key} className={`p-4 rounded-2xl border flex flex-col justify-between h-28 ${gate.pass ? 'qs-gate-pass' : 'bg-slate-50 dark:bg-[#1E2329] border-slate-200 dark:border-slate-800'}`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className={`font-black text-[14px] md:text-[15px] ${gate.pass ? 'text-[#00B464]' : 'text-slate-400'}`}>{gate.label}</span>
                        <span className="text-[12px]">{gate.pass ? '✔️' : '❌'}</span>
                      </div>
                      <div className={`h-1.5 rounded-full w-full mb-2 ${gate.pass ? 'bg-[#00B464]' : 'bg-slate-200 dark:bg-slate-700'}`} style={{ width: `${gate.score ?? 0}%` }}></div>
                      <p className={`text-[10.5px] md:text-[11.5px] font-extrabold ${gate.pass ? 'text-[#00B464]' : 'text-slate-500'}`} title={gate.desc}>{gate.score !== null ? `${gate.score.toFixed(0)}점` : 'N/A'}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 재무 (참고 정보) */}
              <div className="p-6 md:p-8 bg-slate-50 dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-10">
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6">📊 Financials (최근 분기, 참고용)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 md:gap-y-8 gap-x-4 md:gap-x-6">
                  <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">매출액</p><p className="text-[15px] md:text-[16px] font-black text-slate-900 dark:text-white">{formatFinancial(selectedStock.revenue_q)}</p></div>
                  <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">영업이익</p><p className="text-[15px] md:text-[16px] font-black text-slate-900 dark:text-white">{formatFinancial(selectedStock.op_profit_q)}</p></div>
                  <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">순이익</p><p className="text-[15px] md:text-[16px] font-black text-slate-900 dark:text-white">{formatFinancial(selectedStock.net_income_q)}</p></div>
                  <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">EPS</p><p className="text-[15px] md:text-[16px] font-black text-slate-900 dark:text-white">{formatWon(selectedStock.eps_q)}</p></div>
                  <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">ROE</p><p className="text-[15px] md:text-[16px] font-black text-[#FF4B4B]">{formatPct(selectedStock.roe)}</p></div>
                  <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">부채비율</p><p className="text-[15px] md:text-[16px] font-black text-slate-900 dark:text-white">{formatPct(selectedStock.debt_ratio)}</p></div>
                  <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">유동비율</p><p className="text-[15px] md:text-[16px] font-black text-slate-900 dark:text-white">{formatPct(selectedStock.current_ratio)}</p></div>
                  <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">이자보상배율</p><p className="text-[15px] md:text-[16px] font-black text-slate-900 dark:text-white">{formatNum(selectedStock.interest_coverage, 1)}</p></div>
                </div>
              </div>

              {/* 가격 차트 + 이동평균선 */}
              <div className="p-6 md:p-8 bg-slate-50 dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6">📈 가격 차트 & 이동평균선</h3>
                <div className="w-full h-[280px] md:h-[340px]">
                  {selectedStock.chart_data && selectedStock.chart_data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={selectedStock.chart_data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />
                        <XAxis dataKey="date" tick={{fill: '#94A3B8', fontSize: 11, fontWeight: '800'}} tickLine={false} axisLine={false} minTickGap={30} tickFormatter={(val) => val ? String(val).substring(5).replace('-', '.') : ''}/>
                        <YAxis domain={['auto', 'auto']} tick={{fill: '#94A3B8', fontSize: 11, fontWeight: '800'}} tickLine={false} axisLine={false} tickFormatter={(value) => value !== undefined && value !== null ? value.toLocaleString() : ''} />
                        <Tooltip contentStyle={{backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', color: 'white', fontWeight: '900'}} labelStyle={{color: '#94A3B8', marginBottom: '4px'}} formatter={(value, name) => [value !== undefined && value !== null ? value.toLocaleString() : '', name]} />
                        <Legend wrapperStyle={{ fontSize: 11, fontWeight: 800 }} />
                        <Line type="monotone" dataKey="price" name="종가" stroke="#FF4B4B" strokeWidth={2.5} dot={false} activeDot={{r: 5, fill: '#FF4B4B', strokeWidth: 0}} isAnimationActive={true} animationDuration={1200} animationEasing="ease-out" />
                        <Line type="monotone" dataKey="ma50" name="50일선" stroke="#F8B12A" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="ma150" name="150일선" stroke="#3B82F6" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="ma200" name="200일선" stroke="#A78BFA" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-extrabold text-slate-500">차트 데이터가 없습니다.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 🌟 메인 스크리너 화면
// =========================================================================
export default function QuantScreener({ screenerData = [], onSelectSymbol }) {
  const { callApi } = useRenderApi();

  const [thresholds, setThresholds] = useState(
    Object.fromEntries(AXES.map(ax => [ax.key, null]))
  );
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('ALL');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('desc');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [selectedStock, setSelectedStock] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const activeAxisCount = AXES.filter(ax => thresholds[ax.key] !== null).length;
  const hasAnyFilter = activeAxisCount > 0 || search.trim().length > 0 || sector !== 'ALL';

  // 🌟 stock_sector 조인 덕분에 실제 데이터에 존재하는 섹터만 콤보박스에 노출
  const sectorOptions = useMemo(() => {
    const set = new Set();
    (screenerData || []).forEach(r => {
      if (r.sector) set.add(r.sector);
    });
    const list = Array.from(set).sort((a, b) => {
      if (a === 'Unknown') return 1;
      if (b === 'Unknown') return -1;
      return a.localeCompare(b, 'ko');
    });
    return list;
  }, [screenerData]);

  const activePresetLabel = useMemo(() => {
    for (const preset of STRATEGY_PRESETS) {
      const matches = AXES.every(ax => {
        const expected = preset.values[ax.key] ?? null;
        const actual = thresholds[ax.key] ?? null;
        return expected === actual;
      });
      if (matches) return preset.label;
    }
    return null;
  }, [thresholds]);

  const handleAxisChange = useCallback((key, value) => {
    setThresholds(prev => ({ ...prev, [key]: value }));
    setVisibleCount(PAGE_SIZE);
  }, []);

  const handleSectorChange = useCallback((value) => {
    setSector(value);
    setVisibleCount(PAGE_SIZE);
  }, []);

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
        if (th === null || th === undefined) continue;
        const v = r[ax.key];
        if (v === null || v === undefined || v < th) return false;
      }
      if (sector !== 'ALL' && r.sector !== sector) return false;
      if (q) {
        const nameMatch = (r.name || '').toLowerCase().includes(q);
        const symbolMatch = (r.symbol || '').toLowerCase().includes(q);
        if (!nameMatch && !symbolMatch) return false;
      }
      return true;
    });

    if (!sortKey) return rows;

    rows = [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const aNull = av === null || av === undefined || isNaN(av);
      const bNull = bv === null || bv === undefined || isNaN(bv);
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      return sortDir === 'desc' ? bv - av : av - bv;
    });

    return rows;
  }, [screenerData, thresholds, search, sector, sortKey, sortDir, hasAnyFilter]);

  const totalCount = filteredSorted.length;
  const results = filteredSorted.slice(0, visibleCount);
  const hasMore = totalCount > visibleCount;

  // 🌟 종목명 클릭 → 리포트 팝업. 6축 점수/통과개수는 이미 screenerData(row)에 있으므로
  //    /api/search는 이제 chart_data(이동평균 포함)만 채워주면 됨.
  const handleNameClick = (row) => {
    setReportLoading(true);
    setSelectedStock({ ...row, isLoading: true });

    callApi(`/api/search/${row.symbol}`)
      .then(result => {
        if (result.status === "success") {
          setSelectedStock({
            ...row,
            chart_data: result.data?.chart_data || [],
            isLoading: false,
          });
        } else {
          setSelectedStock(prev => ({ ...prev, isLoading: false, fetchError: true }));
        }
        setReportLoading(false);
      })
      .catch(() => {
        setSelectedStock(prev => ({ ...prev, isLoading: false, fetchError: true }));
        setReportLoading(false);
      });

    if (onSelectSymbol) onSelectSymbol(row.symbol, row);
  };

  return (
    <div className="relative w-full min-w-0 pb-20 font-['Nunito',_ui-rounded,_-apple-system,_system-ui,_sans-serif]">
      <style>{MICRO_STYLES}</style>

      <div className="mb-6 flex flex-col md:flex-row justify-between md:items-center gap-3">
        <div>
          <h2 className="text-2xl md:text-[28px] font-black text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
            🔎 스크리너 <span className="text-[13px] font-black text-slate-400 tracking-normal">Minervini Trend Template</span>
          </h2>
          <p className="text-[13px] font-bold text-slate-500 mt-1">
            추세·모멘텀 6조건으로 정배열 구간의 종목을 찾아보세요.
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE); }}
            placeholder="종목명 또는 코드로 검색"
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl text-[14px] font-bold text-slate-900 dark:text-white placeholder:text-slate-500 placeholder:font-semibold focus:outline-none focus:border-blue-400 dark:focus:border-slate-600 transition-colors"
          />
        </div>

        <div className="relative md:w-[220px] shrink-0">
          <select
            value={sector}
            onChange={e => handleSectorChange(e.target.value)}
            className="qs-select w-full pl-4 pr-10 py-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl text-[14px] font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-400 dark:focus:border-slate-600 transition-colors cursor-pointer"
          >
            <option value="ALL">전체 섹터</option>
            {sectorOptions.map(s => (
              <option key={s} value={s}>{s === 'Unknown' ? '섹터 미상' : s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {STRATEGY_PRESETS.map(p => {
          const isActive = activePresetLabel === p.label;
          return (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className={`qs-preset-chip flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12.5px] font-black cursor-pointer shadow-sm border ${
                isActive
                  ? 'qs-preset-chip-active'
                  : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400 dark:hover:border-slate-500'
              }`}
            >
              {isActive ? <Check size={13} strokeWidth={3} /> : <span>{p.icon}</span>}
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 min-w-0">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <SnowflakeChart thresholds={thresholds} onAxisChange={handleAxisChange} />
        </div>

        <div className="min-w-0">
          {(screenerData || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-2xl">
              <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-[#151924] flex items-center justify-center mb-4">
                <Sparkles className="text-slate-400" size={24} />
              </div>
              <p className="text-[16px] font-black text-slate-900 dark:text-white mb-1">스크리너 데이터가 없습니다</p>
              <p className="text-[13px] font-bold text-slate-500">다음 배치(Cron) 실행 후 다시 확인해 주세요.</p>
            </div>
          ) : !hasAnyFilter ? (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-2xl">
              <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-[#151924] flex items-center justify-center mb-4">
                <Sparkles className="text-slate-400" size={24} />
              </div>
              <p className="text-[16px] font-black text-slate-900 dark:text-white mb-1">조건을 하나 이상 설정해보세요</p>
              <p className="text-[13px] font-bold text-slate-500">축 프리셋을 누르거나, 위의 전략 버튼 또는 섹터 필터로 바로 시작할 수 있어요.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <p className="text-[14px] font-black text-slate-900 dark:text-white">
                  {totalCount}개 종목 매칭
                </p>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <select
                      value={sortKey || ''}
                      onChange={e => { setSortKey(e.target.value || null); setVisibleCount(PAGE_SIZE); }}
                      className="qs-select pl-3 pr-9 py-2 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg text-[12.5px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-400 dark:focus:border-slate-600 cursor-pointer"
                    >
                      <option value="">기본 순서</option>
                      {SORT_OPTIONS.map(opt => (
                        <option key={opt.key} value={opt.key}>{opt.label} 순</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                    disabled={!sortKey}
                    title={sortDir === 'desc' ? '내림차순' : '오름차순'}
                    className={`p-2 rounded-lg border transition-colors ${
                      sortKey
                        ? 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-blue-400 dark:hover:border-slate-500 cursor-pointer'
                        : 'bg-slate-50 dark:bg-[#0B1120] border-slate-100 dark:border-slate-800/60 text-slate-300 dark:text-slate-700 cursor-not-allowed'
                    }`}
                  >
                    {!sortKey ? <ArrowUpDown size={14} /> : sortDir === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                  </button>
                </div>
              </div>

              {results.length === 0 ? (
                <div className="p-10 text-center text-slate-500 font-extrabold bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-2xl">
                  조건에 맞는 종목이 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {results.map((r) => (
                    <ScreenerCard key={r.symbol} r={r} onNameClick={handleNameClick} />
                  ))}
                </div>
              )}

              {hasMore && (
                <div className="flex justify-center mt-4">
                  <button
                    onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                    className="px-5 py-2.5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl text-[13px] font-black text-slate-700 dark:text-slate-300 hover:border-blue-400 dark:hover:border-slate-500 cursor-pointer shadow-sm"
                  >
                    더 보기 ({totalCount - visibleCount}개 남음)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ScreenerReportModal
        selectedStock={selectedStock}
        reportLoading={reportLoading}
        onClose={() => setSelectedStock(null)}
      />
    </div>
  );
}
