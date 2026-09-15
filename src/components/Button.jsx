import { cn } from './cn';

// 세 페이지(NewsDesk/QuantScreener/QuantDesk)에서 반복되던 버튼 3형태를 정리.
//  - secondary: "더 보기"/새로고침처럼 흰 배경 + 테두리의 기본 액션 버튼
//  - ghost    : 모달 닫기/이전-다음 뉴스처럼 텍스트 위주, 배경 없는 버튼
//  - pill     : 전략 프리셋/필터 칩처럼 알약형 토글 버튼 (active prop으로 on/off)
//  - primary  : 페이지에 하나뿐인 핵심 액션(예: RealEstate의 "빌드 시작")용 강조 버튼.
//               [2026-09-16] 흑백 반전 톤 → --brand(금색) 토큰으로 교체. 가격방향
//               의미축(positive=빨강/negative=파랑)과 겹치지 않는 색이라 안전하게 공용.
const VARIANT_CLASSES = {
  secondary:
    'bg-white dark:bg-panel border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 rounded-md',
  ghost:
    'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded',
  primary:
    'bg-brand text-white dark:text-slate-900 hover:opacity-90 rounded-md',
  pill: 'rounded-full border font-medium',
};

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-[12px]',
  md: 'px-3.5 py-2 text-[13px]',
};

const PILL_SIZE_CLASSES = {
  sm: 'px-2.5 py-1 text-[11px]',
  md: 'px-3 py-1.5 text-[12px]',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  active = false,
  className,
  children,
  ...rest
}) {
  const isPill = variant === 'pill';

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 font-medium transition-colors cursor-pointer',
        'disabled:opacity-30 disabled:cursor-not-allowed',
        !isPill && VARIANT_CLASSES[variant],
        !isPill && SIZE_CLASSES[size],
        isPill && VARIANT_CLASSES.pill,
        isPill && PILL_SIZE_CLASSES[size],
        isPill &&
          (active
            ? 'bg-brand border-brand text-white dark:text-slate-900'
            : 'bg-white dark:bg-panel border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'),
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
