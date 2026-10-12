import { useId } from 'react';
import type { useEmailVerification } from '../auth/useEmailVerification';
import { FormMessage } from './Status';

type Verification = ReturnType<typeof useEmailVerification>;

interface Props {
  verification: Verification;
  canSend: boolean;
  onSend: () => void;
  onConfirm: () => void;
  /** 받기 버튼을 이메일 칸 옆에 따로 둘 때 (회원가입) */
  hideSendButton?: boolean;
}

/** 인증번호 받기 / 다시 받기 버튼 */
export function SendCodeButton({
  verification: v,
  canSend,
  onSend,
  className = 'btn btn--outline btn--block',
}: Pick<Props, 'verification' | 'canSend' | 'onSend'> & { className?: string }) {
  return (
    <button type="button" className={className} disabled={!canSend || v.sending} onClick={onSend}>
      {v.sending ? '보내는 중…' : v.sent ? '인증번호 다시 받기' : '인증번호 받기'}
    </button>
  );
}

/** 인증번호 받기 / 다시 받기 · 인증번호 입력 · 확인 */
export function EmailVerificationFields({ verification: v, canSend, onSend, onConfirm, hideSendButton = false }: Props) {
  const codeId = useId();
  if (v.verified) {
    return <FormMessage kind="ok" message={v.message?.text} />;
  }
  if (hideSendButton && !v.sent && !v.message) return null;
  return (
    <div className="verify">
      {!hideSendButton && <SendCodeButton verification={v} canSend={canSend} onSend={onSend} />}
      {v.sent && (
        <div className="field">
          <label htmlFor={codeId} className="field__label">
            인증번호
          </label>
          <div className="field__row">
            <input
              id={codeId}
              className="input input--code"
              inputMode="text"
              autoComplete="one-time-code"
              placeholder="6자리"
              value={v.code}
              onChange={(e) => v.setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onConfirm();
                }
              }}
            />
            <button type="button" className="btn btn--primary" disabled={v.confirming || v.code.length === 0} onClick={onConfirm}>
              확인
            </button>
          </div>
        </div>
      )}
      <FormMessage kind={v.message?.kind ?? 'info'} message={v.message?.text} />
    </div>
  );
}
