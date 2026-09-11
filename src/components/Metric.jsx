import { cn } from './cn';

// StockSearch/QuantScreener/QuantDesk 리포트에서 수십 회 반복되던
// "label 위 + value 아래" 패턴. 관찰된 세 가지 크기를 그대로 옮겼다.
const VALUE_SIZE_CLASSES = {
  sm: 'text-[11.5px] md:text-[14.5px] font-medium',
  md: 'text-[22px] font-semibold',
  lg: 'text-[32px] md:text-[38px] font-semibold tracking-tight',
};

const TONE_CLASSES = {
  positive: 'text-positive',
  negative: 'text-negative',
  success: 'text-success',
  warning: 'text-warning',
  neutral: 'text-neutral',
  default: 'text-slate-900 dark:text-white',
};

export function Metric({ label, value, sub, tone = 'default', size = 'sm', className }) {
  return (
    <div className={className}>
      {label && <p className="text-[9.5px] md:text-[12px] text-slate-400 dark:text-slate-500 mb-1">{label}</p>}
      <p className={cn(VALUE_SIZE_CLASSES[size], TONE_CLASSES[tone], 'tabular-nums')}>{value}</p>
      {sub && <p className="text-[10.5px] md:text-[12px] text-slate-500 dark:text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}
