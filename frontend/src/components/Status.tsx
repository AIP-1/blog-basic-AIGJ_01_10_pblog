import type { ReactNode } from 'react';
import { errorMessage } from '../api/client';
import { COMMON } from '../messages';

export function Loading() {
  return (
    <div className="status status--loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only">{COMMON.loading}</span>
    </div>
  );
}

export function ErrorBox({ error, onRetry }: Readonly<{ error: unknown; onRetry?: () => void }>) {
  return (
    <div className="status status--error" role="alert">
      <p>{errorMessage(error)}</p>
      {onRetry && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onRetry}>
          {COMMON.retry}
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="empty">{children}</div>;
}

export function FieldError({ id, message }: Readonly<{ id?: string; message?: string | null }>) {
  if (!message) return null;
  return (
    <p id={id} className="field__error" role="alert">
      {message}
    </p>
  );
}

export function FormMessage({ kind, message }: Readonly<{ kind: 'ok' | 'error' | 'info'; message?: string | null }>) {
  if (!message) return null;
  return (
    <p className={`form-msg form-msg--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {message}
    </p>
  );
}
