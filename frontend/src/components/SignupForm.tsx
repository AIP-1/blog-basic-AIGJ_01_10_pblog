import { useId, useRef, useState, type FormEvent } from 'react';
import { errorMessage, isApiError } from '../api/client';
import { signup } from '../api/endpoints';
import { useConfig } from '../api/queries';
import { useEmailVerification } from '../auth/useEmailVerification';
import { normalizeEmail, isValidEmail, isValidNickname, isValidPassword } from '../lib/validation';
import { AUTH } from '../messages';
import { EmailVerificationFields, SendCodeButton } from './EmailVerificationFields';
import { PasswordRules } from './PasswordRules';
import { FieldError, FormMessage } from './Status';

type Field = 'nickname' | 'email' | 'password' | 'passwordConfirm';
const FIELD_ORDER: Field[] = ['nickname', 'email', 'password', 'passwordConfirm'];

/**
 * 회원가입 (CF-01): 닉네임·이메일 → 인증번호 받기 → 확인 → 이메일 잠금 → 비밀번호·확인 → 가입하기
 */
export function SignupForm({ onDone }: { onDone: (email: string) => void }) {
  const { limits } = useConfig();
  const ids = { nickname: useId(), email: useId(), password: useId(), passwordConfirm: useId() };
  const nicknameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordConfirmRef = useRef<HTMLInputElement>(null);
  const focusField = (f: Field) => {
    const target = { nickname: nicknameRef, email: emailRef, password: passwordRef, passwordConfirm: passwordConfirmRef }[f];
    target.current?.focus();
  };
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const v = useEmailVerification('signup');

  const nicknameOk = isValidNickname(nickname, limits.nicknameMin, limits.nicknameMax);
  const emailOk = isValidEmail(email);
  const passwordOk = isValidPassword(password, limits.passwordMin, limits.passwordMax);
  const confirmOk = passwordConfirm.length > 0 && passwordConfirm === password;

  const clientErrors: Partial<Record<Field, string>> = {
    nickname: !nickname.trim() ? AUTH.required : nicknameOk ? undefined : AUTH.nicknameRule,
    email: !email.trim() ? AUTH.required : emailOk ? undefined : AUTH.emailInvalid,
    password: !password ? AUTH.required : passwordOk ? undefined : AUTH.passwordRule,
    passwordConfirm: !passwordConfirm ? AUTH.required : confirmOk ? undefined : AUTH.passwordMismatch,
  };
  const shownError = (f: Field): string | undefined => serverErrors[f] ?? (touched[f] ? clientErrors[f] : undefined);
  // 확인 칸은 입력하는 동안에도 불일치를 바로 알려 준다 (CF-01-5)
  const confirmError =
    serverErrors.passwordConfirm ?? (passwordConfirm.length > 0 && !confirmOk ? AUTH.passwordMismatch : shownError('passwordConfirm'));

  const canSend = nicknameOk && emailOk && !v.verified;
  const canSubmit = v.verified && nicknameOk && emailOk && passwordOk && confirmOk && !submitting;

  const touch = (f: Field) => setTouched((t) => ({ ...t, [f]: true }));
  const clearServer = (f: Field) =>
    setServerErrors((s) => {
      if (!s[f]) return s;
      const next = { ...s };
      delete next[f];
      return next;
    });

  const onSend = async () => {
    setTouched((t) => ({ ...t, nickname: true, email: true }));
    if (!nicknameOk || !emailOk) return;
    const fieldErr = await v.send(normalizeEmail(email), nickname.trim());
    if (fieldErr) setServerErrors((s) => ({ ...s, [fieldErr.field]: fieldErr.message }));
  };

  const failWith = (errors: Partial<Record<Field, string>>) => {
    setServerErrors(errors);
    setPassword('');
    setPasswordConfirm('');
    const first = FIELD_ORDER.find((f) => errors[f]);
    if (first) focusField(first);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ nickname: true, email: true, password: true, passwordConfirm: true });
    if (!canSubmit) {
      const first = FIELD_ORDER.find((f) => clientErrors[f]);
      if (first) focusField(first);
      return;
    }
    if (busy.current) return; // 연타 방지 (CF-01-10)
    busy.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      const normalized = normalizeEmail(email);
      await signup({ nickname: nickname.trim(), email: normalized, password, passwordConfirm });
      onDone(normalized);
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === 'NOT_VERIFIED' || err.code === 'VERIFICATION_EXPIRED') {
          v.cancel({ kind: 'error', text: errorMessage(err) });
          failWith({});
        } else if (err.code === 'EMAIL_TAKEN') {
          v.cancel();
          failWith({ email: errorMessage(err) });
        } else if (err.code === 'NICKNAME_TAKEN') {
          failWith({ nickname: errorMessage(err) });
        } else if (Object.keys(err.fields).length > 0) {
          const mapped: Partial<Record<Field, string>> = {};
          for (const f of FIELD_ORDER) if (err.fields[f]) mapped[f] = err.fields[f];
          failWith(mapped);
          if (Object.keys(mapped).length === 0) setFormError(errorMessage(err));
        } else {
          setFormError(errorMessage(err));
          failWith({});
        }
      } else {
        setFormError(errorMessage(err));
      }
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  return (
    <form className="form" onSubmit={onSubmit} noValidate aria-label="회원가입">
      <div className="field">
        <label htmlFor={ids.nickname} className="field__label">
          닉네임
        </label>
        <input
          id={ids.nickname}
          ref={nicknameRef}
          className="input"
          autoComplete="nickname"
          placeholder={`한글 · 영문 · 숫자 ${limits.nicknameMin}~${limits.nicknameMax}자`}
          value={nickname}
          maxLength={limits.nicknameMax + 5}
          aria-invalid={!!shownError('nickname')}
          onChange={(e) => {
            setNickname(e.target.value);
            clearServer('nickname');
          }}
          onBlur={() => touch('nickname')}
        />
        <FieldError message={shownError('nickname')} />
      </div>

      <div className="field">
        <label htmlFor={ids.email} className="field__label">
          이메일
        </label>
        <div className="field__row">
          <input
            id={ids.email}
            ref={emailRef}
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            readOnly={v.verified}
            aria-invalid={!!shownError('email')}
            onChange={(e) => {
              setEmail(e.target.value);
              clearServer('email');
              if (v.sent && !v.verified) v.cancel();
            }}
            onBlur={() => touch('email')}
          />
          {v.verified ? (
            <button type="button" className="btn btn--ghost" onClick={() => v.cancel()}>
              이메일 변경
            </button>
          ) : (
            <SendCodeButton verification={v} canSend={canSend} onSend={() => void onSend()} className="btn btn--outline" />
          )}
        </div>
        <FieldError message={shownError('email')} />
      </div>

      <EmailVerificationFields
        verification={v}
        canSend={canSend}
        onSend={() => void onSend()}
        onConfirm={() => void v.confirm(normalizeEmail(email))}
        hideSendButton
      />

      <div className="field">
        <label htmlFor={ids.password} className="field__label">
          비밀번호
        </label>
        <input
          id={ids.password}
          ref={passwordRef}
          className="input"
          type="password"
          autoComplete="new-password"
          value={password}
          aria-invalid={!!shownError('password')}
          onChange={(e) => {
            setPassword(e.target.value);
            clearServer('password');
          }}
          onBlur={() => touch('password')}
        />
        <PasswordRules value={password} min={limits.passwordMin} max={limits.passwordMax} />
        <FieldError message={shownError('password')} />
      </div>

      <div className="field">
        <label htmlFor={ids.passwordConfirm} className="field__label">
          비밀번호 확인
        </label>
        <input
          id={ids.passwordConfirm}
          ref={passwordConfirmRef}
          className="input"
          type="password"
          autoComplete="new-password"
          value={passwordConfirm}
          aria-invalid={!!confirmError}
          onChange={(e) => {
            setPasswordConfirm(e.target.value);
            clearServer('passwordConfirm');
          }}
          onBlur={() => touch('passwordConfirm')}
        />
        <FieldError message={confirmError} />
      </div>

      <FormMessage kind="error" message={formError} />
      {!v.verified && <p className="form__hint">{AUTH.notVerified}</p>}
      <button type="submit" className="btn btn--primary btn--block" disabled={!canSubmit}>
        {submitting ? '가입하는 중…' : '가입하기'}
      </button>
      <p className="form__foot-note">{AUTH.signupFoot}</p>
    </form>
  );
}
