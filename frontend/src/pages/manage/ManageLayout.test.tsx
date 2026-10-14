import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithProviders } from '../../test/utils';
import { useManage } from './context';
import { ManageLayout } from './ManageLayout';

const me = { member: { id: 3, nickname: '끄적이', email: 'd@b.com' }, blog: { id: 7, name: '생각 서랍' }, newCommentCount: 4 };

function Probe() {
  const { blogId, blogName } = useManage();
  return <p>관리 대상: {blogName} #{blogId}</p>;
}

function renderAt(path = '/manage') {
  return renderWithProviders(
    <Routes>
      <Route path="/manage" element={<ManageLayout />}>
        <Route index element={<Probe />} />
        <Route path="posts" element={<p>글 관리 내용</p>} />
      </Route>
    </Routes>,
    { path },
  );
}

describe('블로그 관리 틀', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('비로그인이면 로그인이 필요하다는 안내와 로그인 버튼을 보여 준다', async () => {
    mockFetch([{ path: '/api/auth/me', status: 204 }]);
    renderAt();
    expect(await screen.findByText('로그인이 필요합니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '블로그 관리 메뉴' })).not.toBeInTheDocument();
  });

  it('블로그가 없는 회원에게는 블로그가 없다고 알린다', async () => {
    mockFetch([{ path: '/api/auth/me', body: { ...me, blog: null } }]);
    renderAt();
    expect(await screen.findByText('존재하지 않는 블로그입니다')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/');
  });

  it('왼쪽 메뉴, 새 댓글 배지, 내 블로그 링크를 보여 주고 내용에 블로그 정보를 넘긴다', async () => {
    mockFetch([{ path: '/api/auth/me', body: me }]);
    renderAt();
    expect(await screen.findByText('관리 대상: 생각 서랍 #7')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: '블로그 관리 메뉴' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '대시보드' })).toHaveClass('is-current');
    expect(screen.getByRole('link', { name: '글 관리' })).not.toHaveClass('is-current');
    expect(screen.getByLabelText('새 댓글 4개')).toHaveTextContent('4');
    expect(screen.getByRole('link', { name: '내 블로그 보기' })).toHaveAttribute('href', '/blogs/7');
    expect(screen.getByRole('link', { name: '글쓰기' })).toHaveAttribute('href', '/write');
  });

  it('새 댓글이 없으면 배지를 숨기고, 현재 메뉴를 강조한다', async () => {
    mockFetch([{ path: '/api/auth/me', body: { ...me, newCommentCount: 0 } }]);
    renderAt('/manage/posts');
    expect(await screen.findByText('글 관리 내용')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '글 관리' })).toHaveClass('is-current');
    expect(screen.getByRole('link', { name: '댓글 관리' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/새 댓글/)).not.toBeInTheDocument();
  });
});
