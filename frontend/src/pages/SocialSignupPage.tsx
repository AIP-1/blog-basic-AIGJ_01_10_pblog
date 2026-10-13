import { useQuery } from '@tanstack/react-query';
import { useId, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { errorMessage, isApiError, isNotFound } from '../api/client';
import { getSocialPending, socialSignup } from '../api/endpoints';
import { useConfig } from '../api/queries';
import type { SocialPending } from '../api/types';
import { useAuth } from '../auth/context';
import { FieldError, FormMessage, Loading } from '../components/Status';
import { useToast } from '../components/toastContext';
import { isValidNickname } from '../lib/validation';
import { AUTH, SOCIAL_LOGIN } from '../messages';

/**
 * 소셜 가입 마무리: 카카오·구글 로그인 뒤 처음 온 사람이 닉네임을 정한다.
 * 이메일은 제공자가 인증한 값이라 바꿀 수 없다. 가입하면 바로 로그인돼 홈으로 간다.
 */
export function SocialSignupPage() {
  const { data, isPending, error } = useQuery({
    queryKey: ['socialPending'],
    queryFn: getSocialPending,
    retry: false,
    staleTime: Infinity,
  });
  if (isPending) return <Loading />;
  if (error || !data) {
    return (
      <div className="narrow card">
        <h1 className="page-title">소셜 가입</h1>
        <p>{isNotFound(error) ? SOCIAL_LOGIN.pendingMissing : errorMessage(error)}</p>
        <Link to="/" className="btn btn--primary">
          {SOCIAL_LOGIN.backHome}
        </Link>
      </div>
    );
  }
  return <SocialSignupForm pending={data} />;
}

function SocialSignupForm({ pending }: { pending: SocialPending }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { completeLogin } = useAuth();
  const { limits } = useConfig();
  const emailId = useId();
  const nicknameId = useId();
  const nicknameRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState(pending.nickname ?? '');
  const [touched, setTouched] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);

  const providerName = SOCIAL_LOGIN.providerName[pending.provider] ?? pending.provider;
  const nicknameOk = isValidNickname(nickname, limits.nicknameMin, limits.nicknameMax);
  const clientError = !nickname.trim() ? AUTH.required : nicknameOk ? null : AUTH.nicknameRule;
  const shownError = nicknameError ?? (touched ? clientError : null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (clientError) {
      nicknameRef.current?.focus();
      return;
    }
    if (busy.current) return;
    busy.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      await socialSignup({ nickname: nickname.trim() });
      await completeLogin();
      toast.show(SOCIAL_LOGIN.signupDone);
      navigate('/', { replace: true });
    } catch (err) {
      if (isApiError(err) && (err.code === 'NICKNAME_TAKEN' || err.fields.nickname)) {
        setNicknameError(err.fields.nickname ?? errorMessage(err));
        nicknameRef.current?.focus();
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
      <h1 className="page-title">{SOCIAL_LOGIN.signupTitle(providerName)}</h1>
      <p className="muted">{SOCIAL_LOGIN.signupIntro}</p>
      <form className="form" onSubmit={onSubmit} noValidate aria-label={SOCIAL_LOGIN.signupTitle(providerName)}>
        <div className="field">
          <label htmlFor={emailId} className="field__label">
            이메일
          </label>
          <input id={emailId} className="input" type="email" value={pending.email} readOnly />
          <p className="form__hint">{SOCIAL_LOGIN.emailHint}</p>
        </div>
        <div className="field">
          <label htmlFor={nicknameId} className="field__label">
            닉네임
          </label>
          <input
            id={nicknameId}
            ref={nicknameRef}
            className="input"
            autoComplete="nickname"
            placeholder={`한글 · 영문 · 숫자 ${limits.nicknameMin}~${limits.nicknameMax}자`}
            value={nickname}
            maxLength={limits.nicknameMax + 5}
            aria-invalid={!!shownError}
            onChange={(e) => {
              setNickname(e.target.value);
              setNicknameError(null);
            }}
            onBlur={() => setTouched(true)}
          />
          <FieldError message={shownError} />
        </div>
        <FormMessage kind="error" message={formError} />
        <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
          {submitting ? SOCIAL_LOGIN.signupSubmitting : SOCIAL_LOGIN.signupSubmit}
        </button>
        <p className="form__foot-note">{AUTH.signupFoot}</p>
      </form>
    </div>
  );
}
