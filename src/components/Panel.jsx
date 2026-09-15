import { cn } from './cn';

// Depth 계층: Background -> Surface -> Panel -> Elevated Panel (DESIGN_GUIDELINES.md 참고)
// 기존 페이지들이 반복해온 표면들을 그대로 옮긴 것 — 새 색을 만들지 않았다.
//   surface  : bg-slate-50 dark:bg-[#0B1120]  (페이지 배경에 가까운 가장 낮은 표면)
//   panel    : bg-white   dark:bg-[#111827]   (페이지에서 가장 흔한 기본 카드) — 48회 반복 확인
//   inset    : bg-slate-50 dark:bg-[#111827]  (Card/Modal "안에" 한 단 더 들어간 서브 카드 —
//              StockSearch/QuantScreener 리포트의 Financials/52주고저가 블록 등에서 반복 확인.
//              라이트값은 surface와, 다크값은 panel과 각각 겹치는 하이브리드라 별도 레벨로 분리)
//   elevated : bg-white   dark:bg-[#0F1B2E]   (모달/드롭다운처럼 떠 있는 표면)
const LEVEL_CLASSES = {
  surface: 'bg-slate-50 dark:bg-surface',
  panel: 'bg-white dark:bg-panel',
  inset: 'bg-slate-50 dark:bg-panel',
  elevated: 'bg-white dark:bg-panel-elevated',
};

const BORDER_CLASSES = {
  surface: 'border-slate-200 dark:border-slate-800',
  // [2026-09-15 2차] 1차(보더 투명도만 살짝 낮춤 + 그림자 약하게)는 눈에 안 띈다는
  // 피드백 — panel/elevated는 평상시 보더를 투명 처리하고 그림자만으로 띄운다(흰 카드
  // vs slate-50 페이지 배경, 다크 패널 vs 더 어두운 배경 둘 다 보더 없이도 구분 가능한
  // 대비라 안전하게 제거 가능함을 스크린샷으로 확인). border 너비 클래스 자체는 유지해서
  // interactive hover 시(아래 hover:border-*) 레이아웃 흔들림 없이 보더 색만 나타난다.
  panel: 'border-transparent',
  inset: 'border-slate-200 dark:border-slate-800',
  elevated: 'border-transparent',
};

const SHADOW_CLASSES = {
  surface: '',
  panel: 'shadow-[0_2px_4px_rgba(15,23,42,0.06),0_16px_32px_-12px_rgba(15,23,42,0.18)] dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),0_20px_40px_-12px_rgba(0,0,0,0.65)]',
  inset: '',
  elevated: 'shadow-[0_4px_8px_rgba(15,23,42,0.08),0_28px_56px_-16px_rgba(15,23,42,0.24)] dark:shadow-[0_4px_8px_rgba(0,0,0,0.35),0_32px_64px_-16px_rgba(0,0,0,0.75)]',
};

const RADIUS_CLASSES = {
  none: '',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
};

const PADDING_CLASSES = {
  none: '',
  sm: 'p-3.5',
  md: 'p-5',
  lg: 'p-6 md:p-8',
};

/**
 * 가장 낮은 단위의 depth 프리미티브. 카드 내부에 한 단 더 들어간 보조 블록
 * (예: StockSearch/QuantScreener 리포트 모달의 "Financials" 서브 카드)에 사용.
 */
export function Panel({
  as: Tag = 'div',
  level = 'panel',
  bordered = true,
  radius = 'md',
  padding = 'none',
  interactive = false,
  className,
  children,
  ...rest
}) {
  return (
    <Tag
      className={cn(
        LEVEL_CLASSES[level],
        bordered && 'border',
        bordered && BORDER_CLASSES[level],
        SHADOW_CLASSES[level],
        RADIUS_CLASSES[radius],
        PADDING_CLASSES[padding],
        interactive &&
          'transition-colors hover:border-slate-300 dark:hover:border-slate-600',
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * 페이지에서 가장 흔히 쓰는 기본 컨테이너 카드. Panel(level="panel")의 편의 래퍼.
 * interactive=true면 ScreenerCard/뉴스 히어로 카드처럼 hover 시 테두리가 진해지고
 * 은은한 그림자가 뜬다(과도한 확대/이동 없음 — DESIGN_GUIDELINES의 "절제된 인터랙션" 원칙).
 */
export function Card({
  padding = 'md',
  radius = 'xl',
  interactive = false,
  className,
  children,
  ...rest
}) {
  return (
    <Panel
      level="panel"
      padding={padding}
      radius={radius}
      interactive={interactive}
      className={cn(
        interactive &&
          'hover:shadow-[0_12px_28px_-12px_rgba(0,0,0,0.35)] dark:hover:shadow-[0_16px_32px_-14px_rgba(0,0,0,0.6)]',
        className
      )}
      {...rest}
    >
      {children}
    </Panel>
  );
}
