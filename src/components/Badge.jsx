import { cn } from './cn';

// tone은 index.css @theme의 색상 토큰(--color-positive 등)에 그대로 대응한다.
// positive/negative는 "가격 방향"(빨강=상승/파랑=하락, 국내 증시 관례), success는
// "통과/신뢰"(초록), warning은 "주의", neutral/info는 장식적 구분용.
const TONE_TEXT = {
  positive: 'text-positive',
  negative: 'text-negative',
  success: 'text-success',
  warning: 'text-warning',
  neutral: 'text-neutral',
  info: 'text-sky-600 dark:text-sky-400',
};

const TONE_SOFT_BG = {
  positive: 'bg-[color-mix(in_srgb,var(--positive)_12%,transparent)] border-[color-mix(in_srgb,var(--positive)_35%,transparent)]',
  negative: 'bg-[color-mix(in_srgb,var(--negative)_12%,transparent)] border-[color-mix(in_srgb,var(--negative)_35%,transparent)]',
  success: 'bg-[color-mix(in_srgb,var(--success)_12%,transparent)] border-[color-mix(in_srgb,var(--success)_35%,transparent)]',
  warning: 'bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] border-[color-mix(in_srgb,var(--warning)_35%,transparent)]',
  neutral: 'bg-slate-100 dark:bg-slate-800 border-transparent',
  info: 'bg-sky-500/10 border-sky-500/25',
};

const TONE_SOLID_BG = {
  positive: 'bg-positive',
  negative: 'bg-negative',
  success: 'bg-success',
  warning: 'bg-warning',
  neutral: 'bg-neutral',
  info: 'bg-sky-600',
};

const SIZE_CLASSES = {
  sm: 'text-[10.5px] px-2 py-0.5 gap-1',
  md: 'text-[12px] px-2.5 py-1 gap-1.5',
};

/**
 * 의미 배지. tone(토큰 기반, 다크모드 자동 대응) 또는 color(원본 hex, 축별 커스텀
 * 색상처럼 토큰화되지 않은 값 — QuantScreener의 AXES 색상 등)를 선택적으로 받는다.
 * color를 넘기면 기존 코드의 `${color}1A` 관례와 동일하게 배경 불투명도만 낮춘다.
 */
export function Badge({
  tone = 'neutral',
  color,
  variant = 'soft',
  size = 'md',
  dot = false,
  className,
  children,
  ...rest
}) {
  const useCustomColor = Boolean(color);

  const style = useCustomColor
    ? variant === 'solid'
      ? { backgroundColor: color, color: '#fff' }
      : { color, backgroundColor: `${color}1A` }
    : undefined;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded font-medium whitespace-nowrap',
        SIZE_CLASSES[size],
        !useCustomColor && variant === 'soft' && 'border',
        !useCustomColor && variant === 'soft' && TONE_TEXT[tone],
        !useCustomColor && variant === 'soft' && TONE_SOFT_BG[tone],
        !useCustomColor && variant === 'solid' && cn('text-white', TONE_SOLID_BG[tone]),
        className
      )}
      style={style}
      {...rest}
    >
      {dot && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full shrink-0', !useCustomColor && TONE_SOLID_BG[tone])}
          style={useCustomColor ? { backgroundColor: color } : undefined}
        />
      )}
      {children}
    </span>
  );
}
