import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { SOCIAL_LOGIN } from '../messages';
import { useToast } from './toastContext';

const NOTICES: Record<string, { text: string; kind?: 'error' }> = {
  withdrawn: { text: SOCIAL_LOGIN.withdrawn, kind: 'error' },
  'no-email': { text: SOCIAL_LOGIN.noEmail, kind: 'error' },
  failed: { text: SOCIAL_LOGIN.failed, kind: 'error' },
  restored: { text: SOCIAL_LOGIN.restored },
  'email-account': { text: SOCIAL_LOGIN.emailAccount, kind: 'error' },
  'kakao-account': { text: SOCIAL_LOGIN.otherProvider(SOCIAL_LOGIN.providerName.kakao), kind: 'error' },
  'google-account': { text: SOCIAL_LOGIN.otherProvider(SOCIAL_LOGIN.providerName.google), kind: 'error' },
};

/**
 * 소셜 로그인에서 돌아온 결과(?social=withdrawn|no-email|failed|restored|email-account|kakao-account|google-account)를
 * 안내하고 주소에서 지운다. *-account: 같은 이메일이 다른 방법으로 가입돼 있어 로그인하지 않은 경우.
 * restored: 비밀번호 없는 소셜 가입 회원이 탈퇴 보관 기간에 다시 로그인해 복구된 경우.
 */
export function SocialLoginNotice() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const social = params.get('social');
  const shown = useRef<string | null>(null);

  useEffect(() => {
    if (!social) {
      shown.current = null;
      return;
    }
    const message = NOTICES[social];
    // 개발 모드(StrictMode)에서 effect가 두 번 돌아도 안내는 한 번만
    if (message && shown.current !== social) toast.show(message.text, message.kind);
    shown.current = social;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('social');
        return next;
      },
      { replace: true },
    );
  }, [social, setParams, toast]);

  return null;
}
