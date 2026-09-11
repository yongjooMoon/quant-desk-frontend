import { cn } from './cn';

// App.jsx 사이드바가 접혔을 때 쓰던 hover 툴팁(그룹호버 + 절대배치 dark pill)을
// 재사용 가능한 형태로 뽑았다. 주의: recharts도 `Tooltip`을 export하므로 두 컴포넌트를
// 한 파일에서 함께 쓸 때는 `import { Tooltip as UiTooltip } from '../components'`처럼
// 별칭을 붙여 recharts의 Tooltip과 구분할 것.
const POSITION_CLASSES = {
  right: 'left-full ml-3 top-1/2 -translate-y-1/2',
  top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
  bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
  left: 'right-full mr-3 top-1/2 -translate-y-1/2',
};

export function Tooltip({ label, position = 'top', className, children }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        className={cn(
          'absolute px-2.5 py-1.5 bg-slate-800 dark:bg-slate-700 text-white text-[12.5px] font-medium rounded',
          'opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity',
          'whitespace-nowrap z-50 shadow-lg pointer-events-none',
          POSITION_CLASSES[position],
          className
        )}
      >
        {label}
      </span>
    </span>
  );
}
