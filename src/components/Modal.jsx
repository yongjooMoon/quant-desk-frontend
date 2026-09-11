import { useEffect } from 'react';
import { cn } from './cn';

// NewsDesk/QuantScreener/QuantDesk에 거의 동일하게 3번 중복돼 있던 모달 뼈대
// (backdrop + elevated panel + header/body/footer)를 그대로 옮긴 것.
// 애니메이션 이름은 기존 페이지의 newsModalIn/qsModalIn/qdModalIn과 겹치지 않도록
// uiModalIn으로 새로 지었다 — 마이그레이션 전까지 두 스타일이 공존해도 안전하다.
const MODAL_STYLES = `
  @keyframes uiModalIn {
    from { opacity: 0; transform: translateY(16px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .ui-modal-panel { animation: uiModalIn 0.28s cubic-bezier(0.22, 1, 0.36, 1) both; }
  @media (prefers-reduced-motion: reduce) {
    .ui-modal-panel { animation: none !important; }
  }
`;

const SIZE_CLASSES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-[720px]',
  xl: 'max-w-[900px] lg:max-w-[1160px]',
};

export function Modal({
  open,
  onClose,
  size = 'lg',
  closeOnBackdrop = true,
  className,
  children,
}) {
  useEffect(() => {
    if (!open || !onClose) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-[2px] p-4"
      onMouseDown={closeOnBackdrop ? (e) => { if (e.target === e.currentTarget) onClose?.(); } : undefined}
    >
      <style>{MODAL_STYLES}</style>
      <div
        className={cn(
          'ui-modal-panel bg-white dark:bg-panel-elevated border border-slate-200 dark:border-slate-700/60 w-full rounded-lg',
          'shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)] dark:shadow-[0_32px_70px_-16px_rgba(0,0,0,0.75)]',
          'max-h-[92vh] flex flex-col overflow-hidden',
          SIZE_CLASSES[size],
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

Modal.Header = function ModalHeader({ className, children }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-5 md:px-8 py-4 md:py-5 border-b border-slate-100 dark:border-slate-800 shrink-0',
        className
      )}
    >
      {children}
    </div>
  );
};

Modal.Body = function ModalBody({ className, children, ...rest }) {
  return (
    <div className={cn('overflow-y-auto flex-1', className)} {...rest}>
      {children}
    </div>
  );
};

Modal.Footer = function ModalFooter({ className, children }) {
  return (
    <div
      className={cn(
        'px-5 md:px-8 py-3.5 md:py-4 border-t border-slate-100 dark:border-slate-800 flex justify-between bg-slate-50 dark:bg-surface shrink-0',
        className
      )}
    >
      {children}
    </div>
  );
};
