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
  panel: 'border-slate-200 dark:border-slate-800',
  inset: 'border-slate-200 dark:border-slate-800',
  elevated: 'border-slate-200 dark:border-slate-700/60',
};

const RADIUS_CLASSES = {
  none: '',
  md: 'rounded-md',
  lg: 'rounded-lg',
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
  interactive = false,
  className,
  children,
  ...rest
}) {
  return (
    <Panel
      level="panel"
      padding={padding}
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
