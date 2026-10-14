import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithProviders } from '../../test/utils';
import { ManageLayout } from './ManageLayout';
import { PostsPage } from './PostsPage';

const me = { member: { id: 3, nickname: '끄적이', email: 'd@b.com' }, blog: { id: 1, name: '생각 서랍' }, newCommentCount: 0 };
const categories = [
  { id: 1, name: '일상', description: '', visibility: 'PUBLIC', postCount: 2, isDefault: true, colorIndex: 0, subscriberCount: 0, subscribedByMe: false },
  { id: 4, name: '비밀 일기', description: '', visibility: 'PRIVATE', postCount: 1, isDefault: false, colorIndex: 5, subscriberCount: 0, subscribedByMe: false },
];
const posts = [
  { id: 21, title: '공개 글', category: { id: 1, name: '일상' }, createdAt: '2026-10-01T10:00:00+09:00', visibility: 'PUBLIC', viewCount: 1200, commentCount: 3 },
  { id: 22, title: '구독자 글', category: { id: 4, name: '비밀 일기' }, createdAt: '2026-10-02T10:00:00+09:00', visibility: 'SUBSCRIBERS', viewCount: 5, commentCount: 0 },
];
const page = (items: unknown[], extra: Record<string, number> = {}) => ({ items, page: 1, size: 10, totalItems: items.length, totalPages: 1, ...extra });

function renderAt(path = '/manage/posts') {
  return renderWithProviders(
    <Routes>
      <Route path="/manage" element={<ManageLayout />}>
        <Route path="posts" element={<PostsPage />} />
      </Route>
    </Routes>,
    { path },
  );
}

const urls = (fn: ReturnType<typeof mockFetch>) => fn.mock.calls.map(([u]) => String(u));

describe('글 관리', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=t; path=/';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('글 목록을 표로 보여 준다: 다이어리·작성일·공개 여부·조회·댓글과 보기·수정 링크', async () => {
    mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/blogs/1/categories', body: categories },
      { path: '/api/manage/posts', body: page(posts) },
    ]);
    renderAt();
    const rows = await screen.findAllByRole('row');
    expect(rows).toHaveLength(3);
    const first = within(rows[1]);
    expect(first.getByRole('link', { name: '공개 글' })).toHaveAttribute('href', '/posts/21');
    expect(first.getByText('일상')).toBeInTheDocument();
    expect(first.getByText('2026.10.01')).toBeInTheDocument();
    expect(first.getByText('공개')).toBeInTheDocument();
    expect(first.getByText((1200).toLocaleString())).toBeInTheDocument();
    expect(first.getByRole('link', { name: '수정' })).toHaveAttribute('href', '/posts/21/edit');
    expect(within(rows[2]).getByText('구독자 공개')).toBeInTheDocument();
    // 다이어리 거르기 목록
    expect(await screen.findByRole('option', { name: '비밀 일기' })).toBeInTheDocument();
  });

  it('공개 여부·다이어리를 고르면 조건을 붙여 다시 요청하고, 걸러서 없으면 "글이 없습니다"', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/blogs/1/categories', body: categories },
      { path: '/api/manage/posts', body: page([]) },
    ]);
    renderAt();
    expect(await screen.findByText('아직 쓴 글이 없습니다')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '글쓰기' }).length).toBeGreaterThan(1);

    const [visSelect, catSelect] = screen.getAllByRole('combobox');
    fireEvent.change(visSelect, { target: { value: 'PRIVATE' } });
    await waitFor(() => expect(urls(fetchMock).some((u) => u.startsWith('/api/manage/posts') && u.includes('visibility=PRIVATE'))).toBe(true));
    expect(await screen.findByText('글이 없습니다')).toBeInTheDocument();

    await screen.findByRole('option', { name: '비밀 일기' });
    fireEvent.change(catSelect, { target: { value: '4' } });
    await waitFor(() =>
      expect(urls(fetchMock).some((u) => u.includes('visibility=PRIVATE') && u.includes('categoryId=4'))).toBe(true),
    );

    fireEvent.change(visSelect, { target: { value: '' } });
    await waitFor(() => expect(urls(fetchMock).some((u) => u === '/api/manage/posts?categoryId=4&page=1')).toBe(true));
  });

  it('여러 쪽이면 쪽 번호를 눌러 다음 쪽을 받는다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/blogs/1/categories', body: categories },
      { path: '/api/manage/posts', body: page(posts, { totalPages: 3, totalItems: 25 }) },
    ]);
    renderAt('/manage/posts?visibility=bogus');
    fireEvent.click(await screen.findByRole('button', { name: '2' }));
    await waitFor(() => expect(urls(fetchMock)).toContain('/api/manage/posts?page=2'));
  });

  it('삭제를 확인하면 글을 지우고, 취소하면 요청하지 않는다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/blogs/1/categories', body: categories },
      { path: '/api/manage/posts', body: page(posts) },
      { method: 'DELETE', path: '/api/posts/21', status: 204 },
    ]);
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    renderAt();
    await screen.findByRole('link', { name: '공개 글' });
    const deleteButtons = screen.getAllByRole('button', { name: '삭제' });
    fireEvent.click(deleteButtons[0]);
    expect(confirm).toHaveBeenCalledWith('삭제하면 되돌릴 수 없습니다. 삭제할까요?');
    expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'DELETE')).toBe(false);

    confirm.mockReturnValue(true);
    const before = urls(fetchMock).filter((u) => u.startsWith('/api/manage/posts')).length;
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => expect(fetchMock.mock.calls.some(([u, i]) => u === '/api/posts/21' && i?.method === 'DELETE')).toBe(true));
    // 지운 뒤 목록을 새로 받는다
    await waitFor(() => expect(urls(fetchMock).filter((u) => u.startsWith('/api/manage/posts')).length).toBeGreaterThan(before));
  });

  it('삭제에 실패하면 오류 알림을 띄운다', async () => {
    mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/blogs/1/categories', body: categories },
      { path: '/api/manage/posts', body: page(posts) },
      { method: 'DELETE', path: '/api/posts/22', status: 403, body: { error: { code: 'FORBIDDEN', message: '지울 수 없는 글이에요' } } },
    ]);
    vi.stubGlobal('confirm', vi.fn(() => true));
    renderAt();
    await screen.findByRole('link', { name: '구독자 글' });
    fireEvent.click(screen.getAllByRole('button', { name: '삭제' })[1]);
    expect(await screen.findByText('지울 수 없는 글이에요')).toBeInTheDocument();
  });

  it('목록을 못 받으면 오류를 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/blogs/1/categories', body: categories },
      { path: '/api/manage/posts', status: 500, body: { error: { code: 'INTERNAL', message: '목록 오류' } } },
    ]);
    renderAt();
    expect(await screen.findByText('목록 오류')).toBeInTheDocument();
  });
});
