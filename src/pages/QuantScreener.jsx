import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { RefreshCcw, X, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useRenderApi } from '../hooks/useRenderApi';

// =========================================================================
// 🌟 6축(Snowflake) 정의 — quant_screener_scores 테이블 컬럼명과 1:1 매칭
//    quant_screener.py의 compute_screener_scores()가 이 6개 컬럼을 계산해서 저장한다.
//    ⚠️ track_record_score는 v3부터 의미가 바뀌었다: 가격 게이트 통과 개수(구 Track
//    Record) 대신 최근 60일 일간수익률 표준편차 기반 "저변동성" 점수를 담는다
//    (컬럼명은 DB 마이그레이션을 피하려고 그대로 재사용 — 실제 의미는 Low Volatility).
// =========================================================================
const AXES = [
  { key: 'growth_score', label: 'Growth', short: '성장', color: '#FF4B4B' },
  { key: 'quality_score', label: 'Quality', short: '수익성', color: '#F8B12A' },
  { key: 'health_score', label: 'Health', short: '재무건전성', color: '#20C997' },
  { key: 'value_score', label: 'Value', short: '가치', color: '#3B82F6' },
  { key: 'momentum_score', label: 'Momentum', short: '모멘텀', color: '#A78BFA' },
  { key: 'track_record_score', label: 'Low Volatility', short: '저변동성', color: '#F472B6' },
];
const AXIS_COUNT = AXES.length;
const PRESET_VALUES = [50, 60, 70, 80];
const PAGE_SIZE = 50;

// 한 번에 여러 축을 채우는 "전략 프리셋" — 육각형이 시그니처 요소인 만큼,
// 이 버튼들이 "누르면 반응해서 채워지는" 재미를 가장 잘 보여주는 진입점.
//
// 🌟 설계 원칙: 프리셋 이름이 약속하는 것(예: "우량주")과 실제 threshold 조합이
//    항상 일치해야 한다. "우량주"라면서 재무건전성 조건이 없거나, "저평가"라면서
//    퀄리티 조건이 전혀 없으면(밸류 트랩 위험) 이름-필터 불일치가 생긴다. 아래는
//    그 기준으로 검증 후 최소 안전장치(floor)를 넣은 버전이다.
const STRATEGY_PRESETS = [
  // 성장 + 수익성 + 최소한의 재무 안전판(health 50) — "우량주" 표기에 맞게 부채 리스크 배제
  { label: '고성장 우량주', icon: '🚀', values: { growth_score: 70, quality_score: 70, health_score: 50 } },
  // 저평가 + 안전 + 최소 퀄리티 40 — 밸류 트랩(싸기만 하고 계속 나빠지는 종목) 방지용 하한선
  { label: '저평가 방어주', icon: '🛡️', values: { value_score: 70, health_score: 70, quality_score: 40 } },
  // 순수 기술적 스타일(모멘텀+저변동) — 펀더멘털 조건 의도적으로 없음
  { label: '안정적 상승', icon: '🌊', values: { momentum_score: 70, track_record_score: 60 } },
  // 올라운드 + 최소 모멘텀 40 — 펀더멘털은 좋은데 주가만 계속 빠지는 "떨어지는 칼날" 배제
  { label: '올라운드 우량주', icon: '💎', values: { growth_score: 60, quality_score: 60, health_score: 60, value_score: 50, momentum_score: 40 } },
  // Buffett/Munger식 컴파운더 — 가격보다 퀄리티와 안전성, 성장은 완만해도 OK
  { label: '퀄리티 컴파운더', icon: '🏛️', values: { quality_score: 75, health_score: 65, growth_score: 50 } },
  // Graham Net-Net식 — 극단적으로 싼 대신 퀄리티는 요구하지 않음 (의도된 트레이드오프)
  { label: '딥 밸류 컨트래리언', icon: '🔻', values: { value_score: 80, health_score: 50 } },
  // O'Neil/Zweig식 순수 추세추종 — 펀더멘털 무시, 가격 강도만
  { label: '순수 모멘텀', icon: '⚡', values: { momentum_score: 80 } },
  // Robeco 저변동성 이상현상 기반 방어적 배분용
  { label: '저변동 방어주', icon: '🧊', values: { track_record_score: 75, health_score: 60 } },
  // 실적 개선이 막 시작되고 주가가 반응하기 시작했지만 아직 안 비싼 구간
  { label: '턴어라운드 후보', icon: '🔄', values: { growth_score: 70, momentum_score: 60, value_score: 50 } },
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
// 🌟 부채꼴(wedge) 경계선/클릭 좌표 계산용 — hexPoint과 달리 임의의 각도를 받는다
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

// 🌟 리포트 모달 게이지용 숫자 카운트업 (QuantDesk와 동일 원리)
function useCountUp(target, duration = 1100) {
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

// 🌟 반원 게이지 위 특정 percent 지점 좌표 계산 (M 20 100 A 80 80 0 0 1 180 100 기준)
function getGaugePoint(percent) {
  const clamped = Math.max(0, Math.min(100, percent || 0));
  const t = (180 - 1.8 * clamped) * (Math.PI / 180);
  const x = 100 + 80 * Math.cos(t);
  const y = 100 - 80 * Math.sin(t);
  return { x, y };
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

  .qs-gauge-glow { filter: drop-shadow(0 0 6px currentColor); animation: qsGaugePulse 1.8s ease-in-out infinite; }
  @keyframes qsGaugePulse {
    0%, 100% { opacity: 0.85; r: 5; }
    50% { opacity: 1; r: 6.5; }
  }

  .qs-sector-select {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
    background-size: 14px;
  }
`;

// 🌟 현재가 마스킹 — 정확한 원 단위 대신 천원 단위로 반올림해서 표시
function formatPriceMasked(v) {
  if (v === null || v === undefined || isNaN(v)) return "N/A";
  return `₩${Number(v).toLocaleString()}`;
}

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
// 🌟 원 단위 금액용 — 천 단위 콤마 표시 (QuantDesk의 formatNumber와 동일 규칙)
function formatWon(v) {
  if (v === null || v === undefined || isNaN(v)) return "N/A";
  return Math.round(Number(v)).toLocaleString();
}

// 🌟 data_coverage_pct(6축 계산에 실제 쓰인 원자료 비율) → 신뢰도 배지 색상.
//    낮은 커버리지는 결측 축이 많아 50점(중립)으로 채워졌을 가능성이 크다는 신호.
function getCoverageMeta(pct) {
  if (pct === null || pct === undefined || isNaN(pct)) return null;
  if (pct >= 80) return { color: '#00B464' };
  if (pct >= 50) return { color: '#F8B12A' };
  return { color: '#EF4444' };
}

// =========================================================================
// 🌟 미니 Snowflake 아이콘 — 왼쪽 사이드바의 육각형과 동일한 시각 언어(모양)를
//    리스트 뷰에 축소 재사용한다 (Simply Wall St 리스트 뷰 패턴).
//    - 모양(폴리곤 형태): 어느 축이 강하고 약한지 한눈에 파악
//    - 숫자(평균): 전반적인 크기감(좋다/나쁘다)을 즉시 전달
//    - 정확한 축별 값: title 툴팁으로만 노출 (표를 숫자로 뒤덮지 않기 위함)
// =========================================================================
function MiniSnowflake({ row }) {
  const size = 34;
  const maxR = 14;
  const cx = 17, cy = 17;

  const pt = (i, frac) => {
    const angle = (-90 + i * (360 / AXIS_COUNT)) * (Math.PI / 180);
    const r = Math.max(0, Math.min(1, frac)) * maxR;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  const validScores = AXES
    .map(ax => row[ax.key])
    .filter(v => v !== null && v !== undefined && !isNaN(v));
  const avg = validScores.length ? validScores.reduce((a, b) => a + b, 0) / validScores.length : null;

  const avgColor = avg === null ? '#94A3B8' : avg >= 70 ? '#00B464' : avg >= 50 ? '#F8B12A' : '#EF4444';

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
      return `${ax.label}: ${has ? v.toFixed(1) : 'N/A'}`;
    })
    .join('\n');

  return (
    <div className="flex items-center gap-2" title={tooltipText}>
      <svg width={size} height={size} viewBox="0 0 34 34" className="shrink-0">
        <polygon points={bgPoints} fill="none" className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" />
        <polygon points={shapePoints} fill={avgColor} fillOpacity="0.32" stroke={avgColor} strokeWidth="1.4" />
      </svg>
      <span className="text-[13px] font-black tabular-nums" style={{ color: avgColor }}>
        {avg !== null ? avg.toFixed(0) : '-'}
      </span>
    </div>
  );
}

// =========================================================================
// 🌟 육각형(Snowflake) 컴포넌트
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

  // 🌟 클릭한 지점의 중심 거리 → 가장 가까운 프리셋 값(50/60/70/80)으로 스냅
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
          <span className="text-[13px] font-black text-slate-700 dark:text-slate-300 tracking-tight">SNOWFLAKE</span>
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
// 🌟 종목 리포트 모달 — QuantDesk의 REPORT MODAL 로직을 그대로 가져온 버전.
//    스크리너 행(row) 자체 데이터를 기본값으로 먼저 보여주고, /api/search/{symbol}로
//    상세(재무/차트/게이트 사유)를 채워 넣는다.
// =========================================================================
function ScreenerReportModal({ selectedStock, reportLoading, onClose }) {
  const animatedScore = useCountUp(selectedStock ? (selectedStock.score || 0) : 0, 1300);
  const passCountTarget = selectedStock
    ? (selectedStock.total_pass !== undefined
        ? selectedStock.total_pass
        : (selectedStock.gates ? Object.values(selectedStock.gates).filter(g => g.pass).length : 0))
    : 0;
  const animatedPassCount = useCountUp(passCountTarget, 1300);
  if (!selectedStock) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 w-full max-w-[1200px] min-h-[60vh] md:min-h-[75vh] max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex gap-2 items-center">
            <span className="text-[14px] md:text-[14.5px] font-black text-slate-500 dark:text-slate-400">{selectedStock.symbol} · {selectedStock.market || "KOSPI"}</span>
            {selectedStock.sector && <span className="text-[12px] md:text-[13.5px] font-extrabold px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{selectedStock.sector}</span>}
          </div>
          <button onClick={onClose} className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full transition-colors cursor-pointer"><X size={20}/></button>
        </div>

        <div className="p-6 md:p-10 overflow-y-auto flex-1">
          {reportLoading || selectedStock.isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <RefreshCcw className="animate-spin mb-4 text-blue-500" size={40} />
              <p className="font-black text-[15px] md:text-lg animate-pulse text-slate-700 dark:text-slate-300 text-center">최신 재무 데이터와 실시간 지표를 융합하여 리포트를 생성 중입니다...</p>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <div className="p-6 md:p-8 bg-slate-50 dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6">⚡ Quant Scores</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">퀀트 랭킹 스코어</p><p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">{animatedScore.toFixed(2)}점</p></div>
                    <div>
                      <p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">생존 필터 통과</p>
                      <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">
                        {animatedPassCount.toFixed(0)} / 6
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] md:text-[12px] font-extrabold text-slate-500 mt-6 p-3 bg-white dark:bg-[#1E293B] rounded-xl border border-slate-200 dark:border-slate-700/50">💡 평가 지표(점수/게이트)는 가장 최근 배치(Cron) 시점을 기준으로 고정 표시됩니다. (재무 및 차트는 최신 반영)</p>
                </div>

                <div className="p-6 md:p-8 bg-slate-50 dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center items-center relative">
                  <div className="relative w-48 md:w-56 h-28 md:h-32 mb-2 flex justify-center items-end">
                    <svg viewBox="0 0 200 110" className="w-full h-full absolute bottom-0 overflow-visible">
                      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="18" strokeLinecap="round" />
                      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#00B464" strokeWidth="18" strokeLinecap="round"
                            strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * animatedScore / 100)} />
                      {(() => {
                        const { x, y } = getGaugePoint(animatedScore);
                        return <circle cx={x} cy={y} r="5" fill="#00B464" className="qs-gauge-glow" style={{ color: '#00B464' }} />;
                      })()}
                    </svg>
                    <div className="absolute bottom-0 w-full flex flex-col items-center justify-end pb-2">
                      <p className="text-4xl md:text-5xl font-black text-[#00B464] tracking-tighter">{animatedScore.toFixed(1)}</p>
                    </div>
                  </div>
                  <p className="text-[13px] md:text-[14px] font-extrabold text-slate-500 mt-2">퀀트 랭킹 스코어</p>
                </div>
              </div>

              <div className="mb-10">
                <h5 className="text-xl font-black text-slate-900 dark:text-white mb-4 md:mb-6">Entry Gates (6 conditions)</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
                  {['A', 'B', 'C', 'D', 'E', 'F'].map((label, idx) => {
                    const gateKeys = selectedStock.gates ? Object.keys(selectedStock.gates) : [];
                    const gate = gateKeys.length > idx ? selectedStock.gates[gateKeys[idx]] : { pass: false, name: '-', reason: '-' };
                    const passed = gate.pass;

                    return (
                    <div key={label} className={`p-4 rounded-2xl border ${passed ? 'bg-[#00B464]/10 border-[#00B464]/50 shadow-sm' : 'bg-slate-50 dark:bg-[#1E2329] border-slate-200 dark:border-slate-800'} flex flex-col justify-between h-24 md:h-28`}>
                        <div className="flex justify-between items-center mb-2">
                            <span className={`font-black text-[15px] md:text-[16px] ${passed ? 'text-[#00B464]' : 'text-slate-400'}`}>{label}</span>
                            <span className="text-[12px]">{passed ? '✔️' : '❌'}</span>
                        </div>
                        <div className={`h-1 md:h-1.5 rounded-full w-full mb-2 md:mb-3 ${passed ? 'bg-[#00B464]' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                        <p className={`text-[11px] md:text-[12px] font-extrabold truncate ${passed ? 'text-[#00B464]' : 'text-slate-500'}`} title={gate.reason || gate.name}>{gate.name}</p>
                    </div>
                  )})}
                </div>
              </div>

              <div className="p-6 md:p-8 bg-slate-50 dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-10">
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6">📊 Financials & Valuation</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 md:gap-y-8 gap-x-4 md:gap-x-6">
                  <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">매출액</p><p className="text-[15px] md:text-[16px] font-black text-slate-900 dark:text-white">{formatMarcap(selectedStock.fundamental?.revenue_cur)}</p></div>
                  <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">영업이익</p><p className="text-[15px] md:text-[16px] font-black text-slate-900 dark:text-white">{formatMarcap(selectedStock.fundamental?.op_profit_cur)}</p></div>
                  <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">영업이익률</p><p className="text-[15px] md:text-[16px] font-black text-slate-900 dark:text-white">{formatPct(selectedStock.fundamental?.op_margin)}</p></div>
                  <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">ROE</p><p className="text-[15px] md:text-[16px] font-black text-[#FF4B4B]">{formatPct(selectedStock.fundamental?.roe)}</p></div>
                  <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">시가총액</p><p className="text-[15px] md:text-[16px] font-black text-slate-900 dark:text-white">{formatMarcap(selectedStock.fundamental?.marcap_억)}</p></div>
                  <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">PER</p><p className="text-[15px] md:text-[16px] font-black text-slate-900 dark:text-white">{formatNum(selectedStock.fundamental?.per)} 배</p></div>
                  <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">PBR</p><p className="text-[15px] md:text-[16px] font-black text-slate-900 dark:text-white">{formatNum(selectedStock.fundamental?.pbr)} 배</p></div>
                  <div><p className="text-[12px] md:text-[13px] font-extrabold text-slate-500 mb-1">부채비율</p><p className="text-[15px] md:text-[16px] font-black text-slate-900 dark:text-white">{formatPct(selectedStock.fundamental?.debt_ratio)}</p></div>
                </div>
              </div>

              <div className="p-6 md:p-8 bg-slate-50 dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6">📈 가격 차트 (최근 120일)</h3>
                <div className="w-full h-[250px] md:h-[300px]">
                  {selectedStock.chart_data && selectedStock.chart_data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={selectedStock.chart_data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />
                        <XAxis dataKey="date" tick={{fill: '#94A3B8', fontSize: 11, fontWeight: '800'}} tickLine={false} axisLine={false} minTickGap={30} tickFormatter={(val) => val ? String(val).substring(5).replace('-', '.') : ''}/>
                        <YAxis domain={['auto', 'auto']} tick={{fill: '#94A3B8', fontSize: 11, fontWeight: '800'}} tickLine={false} axisLine={false} tickFormatter={(value) => value !== undefined && value !== null ? value.toLocaleString() : ''} />
                        <Tooltip contentStyle={{backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', color: 'white', fontWeight: '900'}} itemStyle={{color: '#FF4B4B'}} labelStyle={{color: '#94A3B8', marginBottom: '4px'}} formatter={(value) => [value !== undefined && value !== null ? value.toLocaleString() : '', "종가"]} />
                        <Line type="monotone" dataKey="price" stroke="#FF4B4B" strokeWidth={2.5} dot={false} activeDot={{r: 5, fill: '#FF4B4B', strokeWidth: 0}} isAnimationActive={true} animationDuration={1700} animationEasing="ease-out" />
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

  const [hoverRowIdx, setHoverRowIdx] = useState(null);

  // 🌟 리포트 모달 상태 — QuantDesk의 handleReportClick과 동일한 흐름
  const [selectedStock, setSelectedStock] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const activeAxisCount = AXES.filter(ax => thresholds[ax.key] !== null).length;
  const hasAnyFilter = activeAxisCount > 0 || search.trim().length > 0 || sector !== 'ALL';

  // 🌟 실제 데이터에 존재하는 섹터만 콤보박스에 노출 (가나다순), 'Unknown'은 맨 뒤로
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

    // 🌟 sortKey가 없으면(사용자가 헤더를 클릭하기 전) 정렬하지 않고 원본 순서 그대로 반환
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

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setVisibleCount(PAGE_SIZE);
  };

  // 🌟 종목명 클릭 → 리포트 팝업 오픈 (QuantDesk의 handleReportClick과 동일 로직)
  const handleNameClick = (row) => {
    setReportLoading(true);

    setSelectedStock({
      ...row,
      score: row.factor_score !== undefined ? row.factor_score : row.score,
      isLoading: true,
    });

    callApi(`/api/search/${row.symbol}`)
      .then(result => {
        if (result.status === "success") {
          const fetchedData = result.data;
          const finalScore = row.factor_score !== undefined ? row.factor_score : fetchedData.score;
          const finalGates = fetchedData.gates;
          const finalPass = row.entry_gate_pass_count !== undefined ? row.entry_gate_pass_count : (fetchedData.gates ? Object.values(fetchedData.gates).filter(g => g.pass).length : 0);

          setSelectedStock({
            ...row,
            ...fetchedData,
            name: fetchedData.name || row.name,
            // 🌟 sector는 스코어 축(배치 고정)이 아니라 종목 기본정보 — 재무/차트와 같은
            //    "최신 반영" 범주에 속한다. /api/search가 더 정확한 소스(네이버 등)를 쓰므로
            //    fetchedData를 우선하고, 그마저 없을 때만 배치 데이터(row.sector)로 폴백한다.
            sector: fetchedData.sector || row.sector,
            score: finalScore,
            gates: finalGates,
            total_pass: finalPass,
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

  const columns = [
    { key: 'name', label: '종목', sortable: false },
    { key: 'sector', label: '섹터', sortable: true },
    { key: 'axis_scores', label: '6축 스코어', sortable: false },
    { key: 'current_price', label: '현재가', sortable: true },
    { key: 'per', label: 'PER', sortable: true },
    { key: 'pbr', label: 'PBR', sortable: true },
    { key: 'marcap_억', label: '시총', sortable: true },
    { key: 'ret_1m', label: '1M %', sortable: true },
    { key: 'rs_score', label: 'RS', sortable: true },
    { key: 'op_margin', label: '영업이익률', sortable: true },
    { key: 'roe', label: 'ROE', sortable: true },
    { key: 'debt_ratio', label: '부채비율', sortable: true },
    { key: 'entry_gate_pass_count', label: '관문', sortable: true },
  ];

  return (
    <div className="relative w-full min-w-0 pb-20 font-['Nunito',_ui-rounded,_-apple-system,_system-ui,_sans-serif]">
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

      {/* 검색 + 섹터 필터 */}
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

        {/* 🌟 섹터 콤보박스 — 스크린샷의 "All sectors" 드롭다운과 동일 위치/역할 */}
        <div className="relative md:w-[220px] shrink-0">
          <select
            value={sector}
            onChange={e => handleSectorChange(e.target.value)}
            className="qs-sector-select w-full pl-4 pr-10 py-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl text-[14px] font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-400 dark:focus:border-slate-600 transition-colors cursor-pointer"
          >
            <option value="ALL">전체 섹터</option>
            {sectorOptions.map(s => (
              <option key={s} value={s}>{s === 'Unknown' ? '섹터 미상' : s}</option>
            ))}
          </select>
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

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 min-w-0">
        {/* 왼쪽: Snowflake */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <SnowflakeChart thresholds={thresholds} onAxisChange={handleAxisChange} />
        </div>

        {/* 오른쪽: 결과 */}
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
              <div className="flex items-center justify-between mb-3">
                <p className="text-[14px] font-black text-slate-900 dark:text-white">
                  {totalCount}개 종목 매칭
                </p>
              </div>

              {/* 🌟 데스크톱: 기존 테이블 (md 미만에서는 숨김 — 모바일은 아래 카드 리스트 사용) */}
              <div className="hidden md:block w-full max-w-full min-w-0 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-sm">
                <table className="w-full min-w-[1180px]">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-transparent">
                      {columns.map(col => (
                        <th
                          key={col.key}
                          onClick={() => col.sortable && toggleSort(col.key)}
                          className={`px-3 py-3 text-[11.5px] font-extrabold text-slate-500 whitespace-nowrap text-center ${
                            col.sortable ? 'cursor-pointer hover:text-slate-900 dark:hover:text-white select-none' : ''
                          }`}
                        >
                          {col.label}{sortKey === col.key && (sortDir === 'desc' ? ' ▼' : ' ▲')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.length === 0 ? (
                      <tr><td colSpan={columns.length} className="p-10 text-center text-slate-500 font-extrabold">조건에 맞는 종목이 없습니다.</td></tr>
                    ) : results.map((r, idx) => {
                      const dock = getDockScale(idx, hoverRowIdx);
                      const retColor = (r.ret_1m || 0) > 0 ? 'text-[#FF4B4B]' : (r.ret_1m || 0) < 0 ? 'text-[#3B82F6]' : 'text-slate-500';
                      const gateColor = (r.entry_gate_pass_count || 0) >= 5 ? '#00B464' : (r.entry_gate_pass_count || 0) >= 3 ? '#F8B12A' : '#64748B';
                      const coverageMeta = getCoverageMeta(r.data_coverage_pct);
                      return (
                        <tr
                          key={r.symbol}
                          onMouseEnter={() => setHoverRowIdx(idx)}
                          onMouseLeave={() => setHoverRowIdx(null)}
                          style={{ transform: `translateY(${dock.lift}px) scale(${dock.scale})` }}
                          className="qs-dock-row border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        >
                          {/* 🌟 종목명: 최소폭 확보 + 말줄임 + 클릭 시 리포트 팝업 + 데이터 커버리지 점 */}
                          <td className="px-3 py-3 min-w-[60px] max-w-[120px]">
                            <div className="flex items-center gap-1.5">
                              <div
                                onClick={() => handleNameClick(r)}
                                className="qs-name-link text-[13.5px] font-black text-slate-900 dark:text-white"
                                title={`${r.name} (${r.symbol}) — 클릭해서 리포트 보기`}
                              >
                                {r.name}
                              </div>
                              {coverageMeta && (
                                <span
                                  className="shrink-0 w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: coverageMeta.color }}
                                  title={`데이터 커버리지 ${r.data_coverage_pct}% (6축 계산에 실제 반영된 원자료 비율)`}
                                />
                              )}
                            </div>
                            <div className="text-[10.5px] font-bold text-slate-400 truncate">{r.symbol}</div>
                          </td>
                          {/* 🌟 섹터명 — 없으면 '-' 표시 */}
                          <td className="px-3 py-3 text-center text-[12px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap max-w-[140px] truncate" title={r.sector || ''}>
                            {r.sector && r.sector !== 'Unknown' ? r.sector : '-'}
                          </td>
                          {/* 🌟 6축 스코어 미니 Snowflake — Snowflake로 필터링한 기준이 실제로 몇 점이었는지 바로 확인 */}
                          <td className="px-3 py-3 min-w-[90px]">
                            <MiniSnowflake row={r} />
                          </td>
                          {/* 🌟 현재가: 천원 단위로 마스킹 표시 */}
                          <td className="px-3 py-3 text-right text-[12.5px] font-black text-slate-900 dark:text-white whitespace-nowrap">
                            {formatPriceMasked(r.current_price)}
                          </td>
                          <td className="px-3 py-3 text-right text-[12px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatNum(r.per)}</td>
                          <td className="px-3 py-3 text-right text-[12px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatNum(r.pbr)}</td>
                          <td className="px-3 py-3 text-right text-[12px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatMarcap(r.marcap_억)}</td>
                          <td className={`px-3 py-3 text-right text-[12.5px] font-black whitespace-nowrap ${retColor}`}>{formatPct(r.ret_1m)}</td>
                          <td className="px-3 py-3 text-right text-[12px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatNum(r.rs_score, 1)}</td>
                          <td className="px-3 py-3 text-right text-[12px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatPct(r.op_margin)}</td>
                          <td className="px-3 py-3 text-right text-[12px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatPct(r.roe)}</td>
                          <td className="px-3 py-3 text-right text-[12px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatPct(r.debt_ratio)}</td>
                          <td className="px-3 py-3 text-center whitespace-nowrap">
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

              {/* 🌟 모바일: 카드 리스트 (QuantDesk Portfolio/Watchlist와 동일한 카드 패턴) */}
              <div className="md:hidden space-y-3">
                {results.length === 0 ? (
                  <div className="p-10 text-center text-slate-500 font-extrabold bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-xl">
                    조건에 맞는 종목이 없습니다.
                  </div>
                ) : results.map((r) => {
                  const retColor = (r.ret_1m || 0) > 0 ? 'text-[#FF4B4B]' : (r.ret_1m || 0) < 0 ? 'text-[#3B82F6]' : 'text-slate-500';
                  const gateColor = (r.entry_gate_pass_count || 0) >= 5 ? '#00B464' : (r.entry_gate_pass_count || 0) >= 3 ? '#F8B12A' : '#64748B';
                  const coverageMeta = getCoverageMeta(r.data_coverage_pct);
                  return (
                    <div
                      key={r.symbol}
                      className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0 cursor-pointer" onClick={() => handleNameClick(r)}>
                          <div className="flex items-center gap-1.5">
                            <span className="qs-name-link text-[14.5px] font-black text-slate-900 dark:text-white">{r.name}</span>
                            {coverageMeta && (
                              <span
                                className="shrink-0 w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: coverageMeta.color }}
                                title={`데이터 커버리지 ${r.data_coverage_pct}%`}
                              />
                            )}
                          </div>
                          <div className="text-[11px] font-bold text-slate-400 truncate">
                            {r.symbol}{r.sector && r.sector !== 'Unknown' ? ` · ${r.sector}` : ''}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[14px] font-black text-slate-900 dark:text-white whitespace-nowrap">{formatPriceMasked(r.current_price)}</div>
                          <div className={`text-[12px] font-black whitespace-nowrap ${retColor}`}>{formatPct(r.ret_1m)}</div>
                        </div>
                      </div>

                      <MiniSnowflake row={r} />

                      <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                        <div>
                          <p className="text-[9.5px] font-bold text-slate-400">PER</p>
                          <p className="text-[12px] font-extrabold text-slate-700 dark:text-slate-300">{formatNum(r.per)}</p>
                        </div>
                        <div>
                          <p className="text-[9.5px] font-bold text-slate-400">PBR</p>
                          <p className="text-[12px] font-extrabold text-slate-700 dark:text-slate-300">{formatNum(r.pbr)}</p>
                        </div>
                        <div>
                          <p className="text-[9.5px] font-bold text-slate-400">ROE</p>
                          <p className="text-[12px] font-extrabold text-slate-700 dark:text-slate-300">{formatPct(r.roe)}</p>
                        </div>
                        <div>
                          <p className="text-[9.5px] font-bold text-slate-400">부채비율</p>
                          <p className="text-[12px] font-extrabold text-slate-700 dark:text-slate-300">{formatPct(r.debt_ratio)}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <span className="text-[10.5px] font-bold text-slate-400">시총 {formatMarcap(r.marcap_억)}</span>
                        <span className="text-[11px] font-black px-2 py-0.5 rounded-full" style={{ color: gateColor, backgroundColor: `${gateColor}1A` }}>
                          관문 {r.entry_gate_pass_count ?? 0}/6
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>


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

      {/* 🌟 리포트 모달 */}
      <ScreenerReportModal
        selectedStock={selectedStock}
        reportLoading={reportLoading}
        onClose={() => setSelectedStock(null)}
      />
    </div>
  );
}
