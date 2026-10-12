import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithProviders } from '../test/utils';
import { BlogPage } from './BlogPage';

const blog = {
  id: 1,
  name: '생각 서랍',
  description: '떠오르는 대로 넣어 두는 서랍',
  topic: { code: 'hobby', name: '취미' },
  owner: { nickname: '끄적이', bio: '' },
  postCount: 3,
  lastPostAt: null,
  isOwner: true,
  subscriberCount: 3,
  subscribedByMe: false,
};
const categories = [
  { id: 1, name: '일상', description: '하루하루', visibility: 'PUBLIC', postCount: 2, isDefault: true, colorIndex: 2 },
  { id: 4, name: '비밀 일기', description: '나만 보는 다이어리', visibility: 'PRIVATE', postCount: 1, isDefault: false, colorIndex: 5 },
];
const page = (items: unknown[]) => ({ items, page: 1, size: 10, totalItems: items.length, totalPages: 1 });

function renderAt(path: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/blogs/:blogId" element={<BlogPage />} />
    </Routes>,
    { path },
  );
}

describe('블로그 화면 (데모 다이어리)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('다이어리 책장과 왼쪽 목록·태그를 보여 주고, 비공개 다이어리는 자물쇠로 표시한다', async () => {
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/blogs/1', body: blog },
      { path: '/api/blogs/1/categories', body: categories },
      { path: '/api/blogs/1/tags', body: [{ name: '여행', count: 2 }] },
      { path: '/api/blogs/1/posts', body: page([]) },
    ]);
    renderAt('/blogs/1');
    expect(await screen.findByRole('navigation', { name: '다이어리 책장' })).toBeInTheDocument();
    expect(await screen.findAllByText('비밀 일기')).toHaveLength(2); // 책장 + 왼쪽 목록
    expect(screen.getAllByRole('img', { name: '비공개' }).length).toBeGreaterThan(0);
    expect(screen.getByText('#여행')).toBeInTheDocument();
    expect(screen.getByText(/다이어리 2권/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '인기순' })).toBeInTheDocument();
  });

  it('다이어리를 고르면 다이어리 머리(소개, 주인에게는 쓰기·설정)를, 태그로 거르면 해제 버튼을 보여 준다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/blogs/1', body: blog },
      { path: '/api/blogs/1/categories', body: categories },
      { path: '/api/blogs/1/tags', body: [] },
      { path: '/api/blogs/1/posts', body: page([]) },
    ]);
    renderAt('/blogs/1?category=4&tag=여행&sort=popular');
    expect(await screen.findByText('나만 보는 다이어리')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '이 다이어리에 쓰기' })).toHaveAttribute('href', '/write?category=4');
    expect(screen.getByRole('button', { name: '다이어리 설정' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '✕ 태그 거르기 해제' })).toBeInTheDocument();
    const listCall = fetchMock.mock.calls.map(([u]) => String(u)).find((u) => u.startsWith('/api/blogs/1/posts'));
    expect(listCall).toContain('categoryId=4');
    expect(listCall).toContain('sort=popular');
    expect(decodeURIComponent(listCall ?? '')).toContain('tag=여행');
  });

  it('첫 화면 위쪽에 대표글을 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/blogs/1', body: { ...blog, isOwner: false } },
      { path: '/api/blogs/1/categories', body: categories.slice(0, 1) },
      { path: '/api/blogs/1/tags', body: [] },
      { path: '/api/blogs/1/pinned', body: [{ id: 9, title: '고정한 글', excerpt: '요약', createdAt: '2026-10-01T10:00:00+09:00', blog: { id: 1, name: '생각 서랍' }, category: { id: 1, name: '일상', colorIndex: 2 } }] },
      { path: '/api/blogs/1/posts', body: page([]) },
    ]);
    renderAt('/blogs/1');
    expect(await screen.findByText('고정한 글')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '대표글' })).toBeInTheDocument();
  });

  it('남의 블로그에는 구독 버튼과 구독자 수를 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/blogs/1', body: { ...blog, isOwner: false } },
      { path: '/api/blogs/1/categories', body: categories.slice(0, 1) },
      { path: '/api/blogs/1/tags', body: [] },
      { path: '/api/blogs/1/pinned', body: [] },
      { path: '/api/blogs/1/posts', body: page([]) },
    ]);
    renderAt('/blogs/1');
    const button = await screen.findByRole('button', { name: '+ 블로그 구독' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAttribute('title', '이 블로그의 모든 공개 다이어리를 받아 봐요');
    expect(screen.getByText(/블로그 구독자 3명/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '블로그 관리' })).not.toBeInTheDocument();
  });

  it('남의 다이어리 머리에는 다이어리 구독 버튼과 구독자 수, 구독자 공개 표시를 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/blogs/1', body: { ...blog, isOwner: false, subscribedByMe: true } },
      {
        path: '/api/blogs/1/categories',
        body: [
          { ...categories[0], subscriberCount: 0, subscribedByMe: false },
          { id: 7, name: '구독자 방', description: '', visibility: 'SUBSCRIBERS', postCount: 2, isDefault: false, colorIndex: 1, subscriberCount: 5, subscribedByMe: true },
        ],
      },
      { path: '/api/blogs/1/tags', body: [] },
      { path: '/api/blogs/1/posts', body: page([]) },
    ]);
    renderAt('/blogs/1?category=7');
    expect(await screen.findByRole('button', { name: '✓ 구독 중' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '✓ 블로그 구독 중' })).toBeInTheDocument();
    expect(screen.getByText('글 2개 · 구독자 5명 · 구독자만 볼 수 있어요')).toBeInTheDocument();
    expect(screen.getAllByText('구독자 공개').length).toBeGreaterThan(0);
  });

  it('다이어리 편집: 글을 골라 다른 다이어리로 옮긴다', async () => {
    const posts = [
      { id: 11, category: { id: 1, name: '일상' }, createdAt: '2026-10-01T10:00:00+09:00', title: '첫 글', excerpt: '', visibility: 'PUBLIC' },
      { id: 12, category: { id: 1, name: '일상' }, createdAt: '2026-10-02T10:00:00+09:00', title: '둘째 글', excerpt: '', visibility: 'PUBLIC' },
    ];
    const fetchMock = mockFetch([
      { path: '/api/auth/me', body: { member: { id: 3, nickname: '끄적이', email: 'd@b.com' }, blog: { id: 1, name: '생각 서랍' }, newCommentCount: 0 } },
      { path: '/api/blogs/1', body: blog },
      { path: '/api/blogs/1/categories', body: categories },
      { path: '/api/blogs/1/tags', body: [] },
      { path: '/api/blogs/1/posts', body: page(posts) },
      { method: 'POST', path: '/api/blogs/1/posts/move', body: { moved: 2 } },
      { path: '/api/csrf', body: {} },
    ]);
    vi.stubGlobal('confirm', vi.fn(() => true));
    document.cookie = 'XSRF-TOKEN=t; path=/';
    renderAt('/blogs/1?category=1&edit=1');
    fireEvent.click(await screen.findByLabelText('전체 선택'));
    expect(screen.getByText('2개 선택')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '이동' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u, i]) => u === '/api/blogs/1/posts/move' && i?.method === 'POST')).toBe(true));
    const call = fetchMock.mock.calls.find(([u]) => u === '/api/blogs/1/posts/move');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ postIds: [11, 12], categoryId: 4 });
  });
});
