import { useEffect, type ReactNode } from 'react';
import { useMe } from '../api/queries';
import type { MeResponse } from '../api/types';
import { useAuth } from '../auth/context';
import { AUTH } from '../messages';
import { Loading } from './Status';

/** 로그인한 회원만 보는 화면. 비로그인이면 로그인 창을 띄운다 (CF-16-1, CF-15-2, BM-01-2). */
export function RequireLogin({ children }: Readonly<{ children: (me: MeResponse) => ReactNode }>) {
  const { data: me, isPending } = useMe();
  const { openLogin } = useAuth();
  const loggedOut = !isPending && !me;

  useEffect(() => {
    if (loggedOut) openLogin();
  }, [loggedOut, openLogin]);

  if (isPending) return <Loading />;
  if (!me) {
    return (
      <div className="notfound">
        <p className="notfound__msg">{AUTH.loginRequired}</p>
        <button type="button" className="btn btn--primary" onClick={() => openLogin()}>
          로그인
        </button>
      </div>
    );
  }
  return <>{children(me)}</>;
}
