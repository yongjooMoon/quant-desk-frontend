import { useEffect, useRef, useState } from 'react';
import { cn } from './cn';

/**
 * 두 가지 실제 사용 패턴을 그대로 통합했다.
 *  - variant="sliding" : NewsDesk 섹터 탭. 활성 탭 아래로 밑줄이 부드럽게 이동.
 *  - variant="static"  : QuantDesk 섹션 탭(Overview/Macro/Screener/...). 활성 탭에
 *                        border-b-2만 즉시 적용, 측정/애니메이션 없이 더 가볍다.
 * items: [{ key, label }], value: 현재 선택된 key, onChange(key)
 */
export function Tabs({ items, value, onChange, variant = 'sliding', className, getLabel, containerProps }) {
  const renderLabel = getLabel || ((item) => item.label);
  const tabRefs = useRef({});
  const [underline, setUnderline] = useState({ left: 0, width: 0 });

  useEffect(() => {
    if (variant !== 'sliding') return;
    const el = tabRefs.current[value];
    if (el) setUnderline({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, variant, items]);

  useEffect(() => {
    if (variant !== 'sliding') return;
    const recalc = () => {
      const el = tabRefs.current[value];
      if (el) setUnderline({ left: el.offsetLeft, width: el.offsetWidth });
    };
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [value, variant]);

  if (variant === 'static') {
    return (
      <div className={cn('flex gap-5 border-b border-slate-200 dark:border-slate-800 overflow-x-auto whitespace-nowrap hide-scrollbar', className)} {...containerProps}>
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={cn(
              'pb-2.5 px-0.5 text-[13.5px] font-medium transition-colors cursor-pointer border-b-2 -mb-px',
              value === item.key
                ? 'text-slate-900 dark:text-slate-100 border-slate-900 dark:border-slate-100'
                : 'text-slate-500 dark:text-slate-500 border-transparent hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            {renderLabel(item)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('relative flex gap-5 border-b border-slate-200 dark:border-slate-800 overflow-x-auto whitespace-nowrap hide-scrollbar pb-0', className)} {...containerProps}>
      {items.map((item) => (
        <button
          key={item.key}
          ref={(el) => { tabRefs.current[item.key] = el; }}
          onClick={() => onChange(item.key)}
          className={cn(
            'relative z-10 pb-2.5 px-0.5 text-[13px] md:text-[14.5px] font-medium transition-colors cursor-pointer',
            value === item.key
              ? 'text-slate-900 dark:text-slate-100'
              : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          )}
        >
          {renderLabel(item)}
        </button>
      ))}
      <div
        className="absolute bottom-0 h-[2px] bg-slate-900 dark:bg-slate-100 transition-all duration-200 ease-out pointer-events-none"
        style={{ left: underline.left, width: underline.width }}
      />
    </div>
  );
}
