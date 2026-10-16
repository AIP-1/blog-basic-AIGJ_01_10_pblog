import { screen, waitFor } from '@testing-library/react';
import { useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTH, SOCIAL_LOGIN } from '../messages';
import { mockFetch, renderWithProviders } from '../test/utils';
import { SocialLoginNotice } from './SocialLoginNotice';

function LocationProbe() {
  const { search } = useLocation();
  return <output data-testid="search">{search || '(none)'}</output>;
}

function renderAt(path: string) {
  return renderWithProviders(
    <>
      <SocialLoginNotice />
      <LocationProbe />
    </>,
    { path },
  );
}

describe('SocialLoginNotice', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('소셜 로그인 결과를 오류 알림으로 보여 주고 주소에서 social 만 지운다', async () => {
    mockFetch([{ path: '/api/auth/me', status: 204 }]);
    renderAt('/?social=withdrawn&tab=x');
    expect(await screen.findByRole('alert')).toHaveTextContent(SOCIAL_LOGIN.withdrawn);
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('?tab=x'));
  });

  it('다른 제공자로 가입한 이메일이면 그 제공자로 로그인하라고 알린다', async () => {
    mockFetch([{ path: '/api/auth/me', status: 204 }]);
    renderAt('/?social=google-account');
    expect(await screen.findByRole('alert')).toHaveTextContent('구글로 가입한 이메일입니다. 구글로 로그인해 주세요');
  });

  it('성공 안내(탈퇴 완료)는 일반 알림으로 보여 준다', async () => {
    mockFetch([{ path: '/api/auth/me', status: 204 }]);
    renderAt('/?social=withdraw-done');
    const toast = await screen.findByText(SOCIAL_LOGIN.withdrawDone);
    expect(toast).toHaveAttribute('role', 'status');
    expect(toast).toHaveClass('toast--info');
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('(none)'));
  });

  it('알 수 없는 값이면 알림 없이 주소만 정리한다', async () => {
    mockFetch([{ path: '/api/auth/me', status: 204 }]);
    renderAt('/?social=whatever');
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('(none)'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('restore-confirm: 복구하겠다고 하면 복구 요청 뒤 로그인하고 환영 알림을 띄운다', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchMock = mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/auth/social/restore', body: { restorableUntil: '2026-11-01T10:00:00+09:00' } },
      { method: 'POST', path: '/api/auth/social/restore', body: { member: { id: 1, nickname: '수연', email: 'a@b.com' } } },
    ]);
    document.cookie = 'XSRF-TOKEN=t; path=/';
    renderAt('/?social=restore-confirm');
    expect(await screen.findByText(SOCIAL_LOGIN.restored)).toBeInTheDocument();
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('2026.11.01'));
    expect(fetchMock.mock.calls.some(([u, init]) => u === '/api/auth/social/restore' && init?.method === 'POST')).toBe(true);
  });

  it('restore-confirm: 복구하지 않겠다고 하면 대기를 지우고 안내한다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const fetchMock = mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/auth/social/restore', body: { restorableUntil: '2026-11-01T10:00:00+09:00' } },
      { method: 'DELETE', path: '/api/auth/social/restore', status: 204 },
    ]);
    document.cookie = 'XSRF-TOKEN=t; path=/';
    renderAt('/?social=restore-confirm');
    expect(await screen.findByRole('alert')).toHaveTextContent(AUTH.withdrawnNotRestored);
    expect(fetchMock.mock.calls.some(([u, init]) => u === '/api/auth/social/restore' && init?.method === 'DELETE')).toBe(true);
    expect(fetchMock.mock.calls.some(([u, init]) => u === '/api/auth/social/restore' && init?.method === 'POST')).toBe(false);
  });

  it('restore-confirm: 복구 정보를 못 받으면 서버 오류 문구를 알린다', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      {
        path: '/api/auth/social/restore',
        status: 404,
        body: { error: { code: 'SOCIAL_RESTORE_NOT_FOUND', message: '복구할 정보가 없습니다' } },
      },
    ]);
    renderAt('/?social=restore-confirm');
    expect(await screen.findByRole('alert')).toHaveTextContent('복구할 정보가 없습니다');
    expect(confirm).not.toHaveBeenCalled();
  });
});
