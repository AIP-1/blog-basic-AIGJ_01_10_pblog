import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { errorMessage } from '../api/client';
import { cancelSocialRestore, getSocialRestore, restoreBySocial } from '../api/endpoints';
import { useAuth } from '../auth/context';
import { formatDateTime } from '../lib/format';
import { AUTH, SOCIAL_LOGIN } from '../messages';
import { useToast } from './toastContext';

const NOTICES: Record<string, { text: string; kind?: 'error' }> = {
  withdrawn: { text: SOCIAL_LOGIN.withdrawn, kind: 'error' },
  'no-email': { text: SOCIAL_LOGIN.noEmail, kind: 'error' },
  failed: { text: SOCIAL_LOGIN.failed, kind: 'error' },
  restored: { text: SOCIAL_LOGIN.restored },
  'email-account': { text: SOCIAL_LOGIN.emailAccount, kind: 'error' },
  'kakao-account': { text: SOCIAL_LOGIN.otherProvider(SOCIAL_LOGIN.providerName.kakao), kind: 'error' },
  'google-account': { text: SOCIAL_LOGIN.otherProvider(SOCIAL_LOGIN.providerName.google), kind: 'error' },
  'withdraw-done': { text: SOCIAL_LOGIN.withdrawDone },
  'withdraw-mismatch': { text: SOCIAL_LOGIN.withdrawMismatch, kind: 'error' },
  'withdraw-cancelled': { text: SOCIAL_LOGIN.withdrawCancelled, kind: 'error' },
};

/**
 * 소셜 로그인에서 돌아온 결과(?social=withdrawn|no-email|failed|restored|email-account|kakao-account|google-account)를
 * 안내하고 주소에서 지운다. *-account: 같은 이메일이 다른 방법으로 가입돼 있어 로그인하지 않은 경우.
 * restore-confirm: 비밀번호 없는 소셜 가입 회원이 탈퇴 보관 기간에 다시 로그인한 경우. 이메일 로그인처럼 복구할지 묻는다.
 * withdraw-*: 소셜 가입 회원이 가입한 소셜 계정으로 다시 확인하고 탈퇴한 결과 (done, mismatch, cancelled).
 */
export function SocialLoginNotice() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const { completeLogin } = useAuth();
  const social = params.get('social');
  const shown = useRef<string | null>(null);

  useEffect(() => {
    if (!social) {
      shown.current = null;
      return;
    }
    const message = NOTICES[social];
    // 개발 모드(StrictMode)에서 effect가 두 번 돌아도 안내는 한 번만
    if (shown.current !== social) {
      if (social === 'restore-confirm') void confirmRestore();
      else if (message) toast.show(message.text, message.kind);
    }
    shown.current = social;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('social');
        return next;
      },
      { replace: true },
    );

    async function confirmRestore() {
      try {
        const { restorableUntil } = await getSocialRestore();
        if (!window.confirm(AUTH.restoreConfirm(formatDateTime(restorableUntil)))) {
          await cancelSocialRestore();
          toast.show(AUTH.withdrawnNotRestored, 'error');
          return;
        }
        await restoreBySocial();
        await completeLogin();
        toast.show(SOCIAL_LOGIN.restored);
      } catch (err) {
        toast.show(errorMessage(err), 'error');
      }
    }
  }, [social, setParams, toast, completeLogin]);

  return null;
}
