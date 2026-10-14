import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MeResponse } from '../api/types';
import { mockFetch, renderWithProviders } from '../test/utils';
import { UserMenu } from './UserMenu';

const me: MeResponse = {
  member: { id: 1, nickname: '수연', email: 'suyeon@example.com' },
  blog: { id: 3, name: '생각 서랍' },
  newCommentCount: 3,
};
const ink = { balance: 1200, checkedInToday: true, streak: 1, history: [] };

function LocationProbe() {
  const { pathname } = useLocation();
  return <output data-testid="path">{pathname}</output>;
}

describe('UserMenu', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('이름과 새 댓글 수를 보여 주고, 누르면 이메일·메뉴·잉크 잔액이 펼쳐진다', async () => {
    mockFetch([{ path: '/api/me/ink', body: ink }]);
    renderWithProviders(<UserMenu me={me} />);
    const trigger = screen.getByRole('button', { name: /수연/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByLabelText('새 댓글 3개')).toHaveTextContent('3');
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('suyeon@example.com')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '내 블로그' })).toHaveAttribute('href', '/blogs/3');
    expect(screen.getByRole('menuitem', { name: '책갈피' })).toHaveAttribute('href', '/bookmarks');
    expect(screen.getByRole('menuitem', { name: /블로그 관리/ })).toHaveAttribute('href', '/manage');
    expect(screen.getByRole('menuitem', { name: '내 정보' })).toHaveAttribute('href', '/me');
    expect(await screen.findByText('1,200')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: '책갈피' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('블로그가 없고 새 댓글이 없으면 내 블로그 메뉴와 배지를 숨긴다', () => {
    mockFetch([{ path: '/api/me/ink', body: ink }]);
    renderWithProviders(<UserMenu me={{ ...me, blog: null, newCommentCount: 0 }} />);
    expect(screen.queryByLabelText(/새 댓글/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /수연/ }));
    expect(screen.queryByRole('menuitem', { name: '내 블로그' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: '블로그 관리' })).toBeInTheDocument();
  });

  it('Esc 를 누르거나 바깥을 누르면 메뉴가 닫힌다', () => {
    mockFetch([{ path: '/api/me/ink', body: ink }]);
    renderWithProviders(<UserMenu me={me} />);
    const trigger = screen.getByRole('button', { name: /수연/ });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(trigger);
    fireEvent.mouseDown(screen.getByRole('menu'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('화면 밝기를 고르면 선택이 바뀌고 이 브라우저에 남는다', () => {
    mockFetch([{ path: '/api/me/ink', body: ink }]);
    renderWithProviders(<UserMenu me={me} />);
    fireEvent.click(screen.getByRole('button', { name: /수연/ }));
    expect(screen.getByRole('menuitemradio', { name: '시스템' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('menuitemradio', { name: '어둡게' }));
    expect(screen.getByRole('menuitemradio', { name: '어둡게' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: '시스템' })).toHaveAttribute('aria-checked', 'false');
    expect(Object.values({ ...localStorage })).toContain('dark');
    fireEvent.click(screen.getByRole('menuitemradio', { name: '시스템' }));
    expect(screen.getByRole('menuitemradio', { name: '시스템' })).toHaveAttribute('aria-checked', 'true');
  });

  it('로그인이 필요한 화면에서 로그아웃하면 첫 화면으로 옮기고 로그아웃을 요청한다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/me/ink', body: ink },
      { method: 'POST', path: '/api/auth/logout', status: 204 },
    ]);
    document.cookie = 'XSRF-TOKEN=t; path=/';
    renderWithProviders(
      <>
        <UserMenu me={me} />
        <LocationProbe />
      </>,
      { path: '/me' },
    );
    expect(screen.getByTestId('path')).toHaveTextContent('/me');
    fireEvent.click(screen.getByRole('button', { name: /수연/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: '로그아웃' }));
    expect(screen.queryByRole('menu')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent(/^\/$/));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([u, init]) => u === '/api/auth/logout' && init?.method === 'POST')).toBe(true),
    );
  });

  it('공개 화면에서 로그아웃하면 그 화면에 머문다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/me/ink', body: ink },
      { method: 'POST', path: '/api/auth/logout', status: 204 },
    ]);
    document.cookie = 'XSRF-TOKEN=t; path=/';
    renderWithProviders(
      <>
        <UserMenu me={me} />
        <LocationProbe />
      </>,
      { path: '/blogs/3' },
    );
    fireEvent.click(screen.getByRole('button', { name: /수연/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: '로그아웃' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => u === '/api/auth/logout')).toBe(true));
    expect(screen.getByTestId('path')).toHaveTextContent('/blogs/3');
  });
});
