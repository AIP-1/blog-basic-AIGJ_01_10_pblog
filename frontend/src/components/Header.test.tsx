import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/context';
import { mockFetch, renderWithProviders } from '../test/utils';
import { Header } from './Header';

const me = {
  member: { id: 1, nickname: '수연', email: 'a@b.com' },
  blog: { id: 3, name: '생각 서랍' },
  newCommentCount: 0,
};
const ink = { balance: 0, checkedInToday: true, streak: 1, history: [] };

function ModalProbe() {
  const { modal } = useAuth();
  return <output data-testid="modal">{modal.open ? modal.tab : 'closed'}</output>;
}

describe('Header', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('비로그인이면 로그인·회원가입 버튼이 보이고, 누르면 그 탭으로 로그인 창을 연다', async () => {
    mockFetch([{ path: '/api/auth/me', status: 204 }]);
    renderWithProviders(
      <>
        <Header />
        <ModalProbe />
      </>,
    );
    const login = await screen.findByRole('button', { name: '로그인' });
    expect(screen.getByRole('link', { name: '사각 홈' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: '홈' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('link', { name: '내 블로그' })).toBeNull();
    expect(screen.queryByRole('link', { name: '글쓰기' })).toBeNull();
    expect(screen.getByTestId('modal')).toHaveTextContent('closed');

    fireEvent.click(login);
    expect(screen.getByTestId('modal')).toHaveTextContent('login');
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
    expect(screen.getByTestId('modal')).toHaveTextContent('signup');
  });

  it('로그인하면 글쓰기·사용자 메뉴가 보이고, 내 블로그 안에서는 내 블로그를 강조한다', async () => {
    mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/me/ink', body: ink },
    ]);
    renderWithProviders(<Header />, { path: '/blogs/3/about' });
    const myBlog = await screen.findByRole('link', { name: '내 블로그' });
    expect(myBlog).toHaveAttribute('href', '/blogs/3');
    expect(myBlog).toHaveAttribute('aria-current', 'page');
    expect(myBlog).toHaveClass('active');
    expect(screen.getByRole('link', { name: '글쓰기' })).toHaveAttribute('href', '/write');
    expect(screen.getByRole('button', { name: /수연/ })).toHaveAttribute('aria-haspopup', 'menu');
    expect(screen.queryByRole('button', { name: '로그인' })).toBeNull();
  });

  it('다른 화면에서는 내 블로그를 강조하지 않고, 블로그가 없으면 내 블로그 메뉴를 숨긴다', async () => {
    mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/me/ink', body: ink },
    ]);
    const { unmount } = renderWithProviders(<Header />, { path: '/blogs/30' });
    const myBlog = await screen.findByRole('link', { name: '내 블로그' });
    expect(myBlog).not.toHaveAttribute('aria-current');
    unmount();

    mockFetch([
      { path: '/api/auth/me', body: { ...me, blog: null } },
      { path: '/api/me/ink', body: ink },
    ]);
    renderWithProviders(<Header />, { path: '/search?q=여행' });
    expect(await screen.findByRole('link', { name: '글쓰기' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '내 블로그' })).toBeNull();
  });
});
