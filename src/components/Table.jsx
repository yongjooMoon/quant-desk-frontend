import { cn } from './cn';

// QuantDesk 백테스팅 탭의 연도별/반복종목 테이블에서 쓰던 스타일 그대로.
// 데이터 그리드가 아니라 얇은 스타일 래퍼 — 정렬/페이지네이션 등은 호출부 책임.
export function Table({ className, children, ...rest }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full text-[12px]', className)} {...rest}>
        {children}
      </table>
    </div>
  );
}

Table.Head = function TableHead({ children }) {
  return (
    <thead>
      <tr className="text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-800">
        {children}
      </tr>
    </thead>
  );
};

Table.HeadCell = function TableHeadCell({ align = 'left', className, children }) {
  return (
    <th className={cn('py-2', align === 'right' ? 'text-right' : 'text-left', className)}>
      {children}
    </th>
  );
};

Table.Body = function TableBody({ children }) {
  return <tbody>{children}</tbody>;
};

Table.Row = function TableRow({ className, children, ...rest }) {
  return (
    <tr className={cn('border-b border-slate-100 dark:border-slate-800/60 last:border-0', className)} {...rest}>
      {children}
    </tr>
  );
};

Table.Cell = function TableCell({ align = 'left', numeric = false, className, children, ...rest }) {
  return (
    <td
      className={cn(
        'py-2',
        align === 'right' ? 'text-right' : 'text-left',
        numeric && 'tabular-nums',
        className
      )}
      {...rest}
    >
      {children}
    </td>
  );
};
