import type { ReactElement } from 'react';
import { useConfig } from '../api/queries';
import type { SocialProvider } from '../api/types';
import { SOCIAL_LOGIN } from '../messages';

function KakaoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3C6.48 3 2 6.53 2 10.88c0 2.8 1.86 5.26 4.66 6.65l-.95 3.48c-.08.3.26.54.52.37l4.12-2.73c.54.06 1.09.1 1.65.1 5.52 0 10-3.53 10-7.87S17.52 3 12 3z"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.28A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.28v-3.1H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.38l4.01-3.1z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77z" />
    </svg>
  );
}

const ICONS: Record<SocialProvider, () => ReactElement> = { kakao: KakaoIcon, google: GoogleIcon };
const ORDER: SocialProvider[] = ['kakao', 'google'];

/**
 * 카카오 · 구글로 로그인. 누르면 서버의 OAuth2 시작 주소로 이동한다.
 * 서버에 키가 설정된 제공자만 보이고(/api/config 의 socialLogin), 하나도 없으면 '또는' 줄까지 아무것도 그리지 않는다.
 */
export function SocialLoginButtons() {
  const { socialLogin } = useConfig();
  const providers = ORDER.filter((p) => socialLogin.includes(p));
  if (providers.length === 0) return null;
  return (
    <div className="social-login">
      <p className="social-login__divider">
        <span>{SOCIAL_LOGIN.divider}</span>
      </p>
      {providers.map((p) => {
        const Icon = ICONS[p];
        return (
          <a key={p} className={`btn btn--block social-login__btn social-login__btn--${p}`} href={`/oauth2/authorization/${p}`}>
            <Icon />
            {SOCIAL_LOGIN.start(SOCIAL_LOGIN.providerName[p])}
          </a>
        );
      })}
    </div>
  );
}
