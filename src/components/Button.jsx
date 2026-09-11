import { cn } from './cn';

// 세 페이지(NewsDesk/QuantScreener/QuantDesk)에서 반복되던 버튼 3형태를 정리.
//  - secondary: "더 보기"/새로고침처럼 흰 배경 + 테두리의 기본 액션 버튼
//  - ghost    : 모달 닫기/이전-다음 뉴스처럼 텍스트 위주, 배경 없는 버튼
//  - pill     : 전략 프리셋/필터 칩처럼 알약형 토글 버튼 (active prop으로 on/off)
const VARIANT_CLASSES = {
  secondary:
    'bg-white dark:bg-panel border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 rounded-md',
  ghost:
    'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded',
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
            ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900'
            : 'bg-white dark:bg-panel border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'),
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
