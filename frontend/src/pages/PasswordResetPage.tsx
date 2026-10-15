import { useId, useRef, useState, type SubmitEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { errorMessage, isApiError } from '../api/client';
import { resetPassword } from '../api/endpoints';
import { useConfig, useMe } from '../api/queries';
import { useAuth } from '../auth/context';
import { useEmailVerification } from '../auth/useEmailVerification';
import { EmailVerificationFields } from '../components/EmailVerificationFields';
import { PasswordRules } from '../components/PasswordRules';
import { FieldError, FormMessage, Loading } from '../components/Status';
import { isValidEmail, isValidPassword, normalizeEmail } from '../lib/validation';
import { AUTH } from '../messages';

/** 비밀번호 찾기: 이메일 → 인증 → 새 비밀번호 → 완료 후 로그인 창 (CF-25) */
export function PasswordResetPage() {
  const { data: me, isPending } = useMe();
  if (isPending) return <Loading />;
  if (me) {
    return (
      <div className="narrow card">
        <h1 className="page-title">비밀번호 찾기</h1>
        <p>{AUTH.resetWhileLoggedIn}</p>
        <Link to="/me" className="btn btn--primary">
          내 정보로
        </Link>
      </div>
    );
  }
  return <PasswordResetForm />;
}

function PasswordResetForm() {
  const navigate = useNavigate();
  const { openLogin } = useAuth();
  const { limits } = useConfig();
  const emailId = useId();
  const pwId = useId();
  const pw2Id = useId();
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [errors, setErrors] = useState<{ newPassword?: string; newPasswordConfirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const v = useEmailVerification('reset');

  const emailOk = isValidEmail(email);
  const pwOk = isValidPassword(pw, limits.passwordMin, limits.passwordMax);
  const confirmOk = pw2.length > 0 && pw === pw2;

  const onSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!pw) next.newPassword = AUTH.required;
    else if (!pwOk) next.newPassword = AUTH.passwordRule;
    if (!pw2) next.newPasswordConfirm = AUTH.required;
    else if (!confirmOk) next.newPasswordConfirm = AUTH.passwordMismatch;
    setErrors(next);
    if (Object.keys(next).length > 0 || busy.current) return;
    busy.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      const normalized = normalizeEmail(email);
      await resetPassword({ email: normalized, newPassword: pw, newPasswordConfirm: pw2 });
      navigate('/', { replace: true });
      openLogin({ tab: 'login', notice: AUTH.resetDone, email: normalized });
    } catch (err) {
      setPw('');
      setPw2('');
      if (isApiError(err) && (err.code === 'NOT_VERIFIED' || err.code === 'VERIFICATION_EXPIRED')) {
        v.cancel({ kind: 'error', text: errorMessage(err) });
      } else if (isApiError(err) && Object.keys(err.fields).length > 0) {
        setErrors({ newPassword: err.fields.newPassword, newPasswordConfirm: err.fields.newPasswordConfirm });
      } else {
        setFormError(errorMessage(err));
      }
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="narrow card">
      <h1 className="page-title">비밀번호 찾기</h1>
      <p className="muted">가입한 이메일로 인증번호를 받아 새 비밀번호를 정합니다.</p>
      <form className="form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor={emailId} className="field__label">
            이메일
          </label>
          <div className="field__row">
            <input
              id={emailId}
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              readOnly={v.verified}
              onChange={(e) => {
                setEmail(e.target.value);
                if (v.sent && !v.verified) v.cancel();
              }}
              onBlur={() => setEmailTouched(true)}
            />
            {v.verified && (
              <button type="button" className="btn btn--ghost" onClick={() => v.cancel()}>
                이메일 변경
              </button>
            )}
          </div>
          <FieldError message={emailTouched && email && !emailOk ? AUTH.emailInvalid : null} />
        </div>

        <EmailVerificationFields
          verification={v}
          canSend={emailOk && !v.verified}
          onSend={() => void v.send(normalizeEmail(email))}
          onConfirm={() => void v.confirm(normalizeEmail(email))}
        />

        {v.verified && (
          <>
            <div className="field">
              <label htmlFor={pwId} className="field__label">
                새 비밀번호
              </label>
              <input id={pwId} className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
              <PasswordRules value={pw} min={limits.passwordMin} max={limits.passwordMax} />
              <FieldError message={errors.newPassword} />
            </div>
            <div className="field">
              <label htmlFor={pw2Id} className="field__label">
                새 비밀번호 확인
              </label>
              <input id={pw2Id} className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
              <FieldError message={errors.newPasswordConfirm ?? (pw2 && !confirmOk ? AUTH.passwordMismatch : null)} />
            </div>
            <FormMessage kind="error" message={formError} />
            <button type="submit" className="btn btn--primary btn--block" disabled={submitting || !pwOk || !confirmOk}>
              {submitting ? '변경하는 중…' : '변경하기'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
