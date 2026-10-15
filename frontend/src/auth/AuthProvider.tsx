import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { UNAUTHENTICATED_EVENT, refreshCsrf } from '../api/client';
import { logout } from '../api/endpoints';
import { qk } from '../api/queries';
import { AUTH } from '../messages';
import { AuthContext, type AuthContextValue, type AuthModalState, type OpenLoginOptions, type PendingAction } from './context';

const CLOSED: AuthModalState = { open: false, tab: 'login', notice: null, email: '' };

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<AuthModalState>(CLOSED);
  const pending = useRef<PendingAction | null>(null);

  const openLogin = useCallback((opts: OpenLoginOptions = {}) => {
    if (opts.action) pending.current = opts.action;
    setModal((m) => ({
      open: true,
      tab: opts.tab ?? (m.open ? m.tab : 'login'),
      notice: opts.notice ?? (m.open ? m.notice : null),
      email: opts.email ?? m.email,
    }));
  }, []);

  const closeModal = useCallback(() => {
    pending.current = null;
    setModal(CLOSED);
  }, []);

  const setTab = useCallback((tab: 'login' | 'signup') => {
    setModal((m) => ({ ...m, tab, notice: null }));
  }, []);

  const completeLogin = useCallback(async () => {
    await refreshCsrf();
    await queryClient.invalidateQueries();
    await queryClient.refetchQueries({ queryKey: qk.me });
    const action = pending.current;
    pending.current = null;
    setModal(CLOSED);
    if (action) action();
  }, [queryClient]);

  const completeSignup = useCallback((email: string) => {
    setModal({ open: true, tab: 'login', notice: AUTH.signupDone, email });
  }, []);

  const doLogout = useCallback(async () => {
    try {
      await logout();
    } catch {
      /* 이미 끊긴 세션이어도 화면은 로그아웃 상태로 */
    }
    queryClient.setQueryData(qk.me, null);
    await refreshCsrf();
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' && q.queryKey[0] !== 'config' && q.queryKey[0] !== 'topics' });
  }, [queryClient]);

  useEffect(() => {
    const onUnauthenticated = () => {
      // 세션이 끝났으면 화면도 비로그인 상태로 바꾼다.
      queryClient.setQueryData(qk.me, null);
      openLogin();
    };
    window.addEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
  }, [openLogin, queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({ modal, openLogin, setTab, closeModal, completeLogin, completeSignup, doLogout }),
    [modal, openLogin, setTab, closeModal, completeLogin, completeSignup, doLogout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
