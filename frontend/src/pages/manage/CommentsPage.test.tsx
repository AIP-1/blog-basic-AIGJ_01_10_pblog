import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithProviders } from '../../test/utils';
import { CommentsPage } from './CommentsPage';
import { ManageLayout } from './ManageLayout';

const me = { member: { id: 3, nickname: '끄적이', email: 'd@b.com' }, blog: { id: 1, name: '생각 서랍' }, newCommentCount: 2 };
const comments = [
  { id: 31, author: { nickname: '손님' }, createdAt: '2026-10-13T09:05:00+09:00', preview: '좋은 글이네요', post: { id: 21, title: '가을 산책' }, reply: false, isNew: true },
  { id: 32, author: null, createdAt: '2026-10-12T20:00:00+09:00', preview: '답글입니다', post: { id: 21, title: '가을 산책' }, reply: true, isNew: false },
];
const page = (items: unknown[], extra: Record<string, number> = {}) => ({ items, page: 1, size: 10, totalItems: items.length, totalPages: 1, ...extra });

function renderAt(path = '/manage/comments') {
  return renderWithProviders(
    <Routes>
      <Route path="/manage" element={<ManageLayout />}>
        <Route path="comments" element={<CommentsPage />} />
      </Route>
    </Routes>,
    { path },
  );
}

describe('댓글 관리', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=t; path=/';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('NEW·답글 표시, 탈퇴한 작성자, 글 제목 링크(댓글 위치)를 보여 주고 읽음 처리 뒤 내 정보를 새로 받는다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/manage/comments', body: page(comments) },
    ]);
    renderAt();
    expect(await screen.findByText('좋은 글이네요')).toBeInTheDocument();
    expect(screen.getByText('NEW')).toBeInTheDocument();
    expect(screen.getByText('답글')).toBeInTheDocument();
    expect(screen.getByText('손님')).toBeInTheDocument();
    expect(screen.getByText('2026.10.13 09:05')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: '가을 산책' });
    expect(links[0]).toHaveAttribute('href', '/posts/21#comment-31');
    expect(links[1]).toHaveAttribute('href', '/posts/21#comment-32');
    await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => u === '/api/auth/me').length).toBeGreaterThan(1));
  });

  it('삭제를 확인하면 그 댓글만 목록에서 뺀다 (답글이 아니면 답글도 지워질 수 있다고 묻는다)', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/manage/comments', body: page(comments) },
      { method: 'DELETE', path: '/api/comments/31', status: 204 },
    ]);
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);
    renderAt();
    await screen.findByText('좋은 글이네요');
    fireEvent.click(screen.getAllByRole('button', { name: '삭제' })[0]);
    await waitFor(() => expect(screen.queryByText('좋은 글이네요')).not.toBeInTheDocument());
    expect(screen.getByText('답글입니다')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u, i]) => u === '/api/comments/31' && i?.method === 'DELETE')).toBe(true);
    const firstMsg = confirm.mock.calls[0] as unknown as [string];

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    const secondMsg = confirm.mock.calls[1] as unknown as [string];
    expect(firstMsg[0]).not.toBe(secondMsg[0]);
  });

  it('삭제를 취소하면 요청하지 않고, 실패하면 오류 알림을 띄운다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/manage/comments', body: page(comments) },
      { method: 'DELETE', path: '/api/comments/32', status: 500, body: { error: { code: 'INTERNAL', message: '삭제 실패' } } },
    ]);
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    renderAt();
    await screen.findByText('답글입니다');
    fireEvent.click(screen.getAllByRole('button', { name: '삭제' })[1]);
    expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'DELETE')).toBe(false);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getAllByRole('button', { name: '삭제' })[1]);
    expect(await screen.findByText('삭제 실패')).toBeInTheDocument();
    expect(screen.getByText('답글입니다')).toBeInTheDocument();
  });

  it('댓글이 없으면 빈 안내, 오류면 오류를 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/manage/comments', body: page([]) },
    ]);
    const first = renderAt();
    expect(await screen.findByText('아직 달린 댓글이 없습니다')).toBeInTheDocument();
    first.unmount();

    mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/manage/comments', status: 500, body: { error: { code: 'INTERNAL', message: '댓글 오류' } } },
    ]);
    renderAt();
    expect(await screen.findByText('댓글 오류')).toBeInTheDocument();
  });

  it('여러 쪽이면 쪽을 바꿔 그 쪽 댓글을 받는다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/manage/comments', body: page(comments, { totalPages: 2, totalItems: 12 }) },
    ]);
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: '2' }));
    await waitFor(() => expect(fetchMock.mock.calls.map(([u]) => u)).toContain('/api/manage/comments?page=2'));
  });
});
