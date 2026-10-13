import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { SOCIAL_LOGIN } from '../messages';
import { useToast } from './toastContext';

const NOTICES: Record<string, string> = {
  withdrawn: SOCIAL_LOGIN.withdrawn,
  'no-email': SOCIAL_LOGIN.noEmail,
  failed: SOCIAL_LOGIN.failed,
};

/** 소셜 로그인이 로그인 없이 돌아오면(?social=withdrawn|no-email|failed) 안내를 띄우고 주소에서 지운다. */
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
    if (message && shown.current !== social) toast.show(message, 'error');
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
