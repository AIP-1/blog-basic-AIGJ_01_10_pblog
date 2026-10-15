import { useEffect, useId, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** 제목을 화면에서 숨긴다 (탭으로 대신할 때) */
  hideTitle?: boolean;
  width?: 'sm' | 'md';
}

/** 바깥을 누르거나 × · Esc 로 닫히는 창 (요구사항.md 3.9) */
export function Modal({ title, onClose, children, hideTitle, width = 'sm' }: Readonly<ModalProps>) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal modal--${width}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal__head">
          <h2 id={titleId} className={hideTitle ? 'sr-only' : 'modal__title'}>
            {title}
          </h2>
          <button type="button" className="modal__close" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
