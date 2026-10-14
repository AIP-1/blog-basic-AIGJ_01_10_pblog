import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithProviders, type MockRoute } from '../test/utils';
import { SubscriptionsPage } from './SubscriptionsPage';

const ME = { member: { id: 3, nickname: '끄적이', email: 'd@b.com' }, blog: { id: 9, name: '내 서랍' }, newCommentCount: 0 };
const blogs = [{ id: 1, name: '생각 서랍', ownerNickname: '남궁', lastPostAt: null }];
const diaries = [{ id: 4, name: '여행 일기', colorIndex: 2, blog: { id: 2, name: '떠돌이' }, postCount: 1200 }];
const post = (id: number, visibility = 'PUBLIC') => ({ id, title: `새 글 ${id}`, excerpt: '', createdAt: '2026-10-01T10:00:00+09:00', blog: { id: 1, name: '생각 서랍' }, visibility });
const pageOf = (items: unknown[], totalPages = 1) => ({ items, page: 1, size: 10, totalItems: items.length, totalPages });

function setup(routes: MockRoute[], path = '/subscriptions') {
  const fetchMock = mockFetch([{ path: '/api/auth/me', body: ME }, ...routes]);
  renderWithProviders(<SubscriptionsPage />, { path });
  return fetchMock;
}
const postCalls = (f: ReturnType<typeof mockFetch>) => f.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith('/api/me/subscriptions/posts'));

describe('구독 피드', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('비로그인이면 로그인 안내와 로그인 버튼을 보여 준다', async () => {
    mockFetch([{ path: '/api/auth/me', status: 204 }]);
    renderWithProviders(<SubscriptionsPage />, { path: '/subscriptions' });
    expect(await screen.findByRole('button', { name: '로그인' })).toBeInTheDocument();
  });

  it('구독한 곳의 새 글과 탭별 개수, 오른쪽 구독 목록을 보여 준다', async () => {
    setup([
      { path: '/api/me/subscriptions', body: blogs },
      { path: '/api/me/subscriptions/diaries', body: diaries },
      { path: '/api/me/subscriptions/posts', body: pageOf([post(1), post(2, 'SUBSCRIBERS')]) },
    ]);
    expect(await screen.findByText('새 글 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '구독한 다이어리 · 블로그의 새 글' })).toBeInTheDocument();
    expect(screen.getByText('2개')).toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: '구독 종류' });
    expect(tabs).toHaveTextContent('전체다이어리 1블로그 1');
    expect(screen.getByRole('link', { name: '전체' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('구독자 공개')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /여행 일기.*떠돌이 · 글 1,200개/ })).toHaveAttribute('href', '/blogs/2?category=4');
    expect(screen.getByRole('link', { name: /생각 서랍.*남궁 · 모든 공개 다이어리/ })).toHaveAttribute('href', '/blogs/1');
  });

  it('구독한 것이 없으면 둘러보기 안내를 보여 준다', async () => {
    setup([
      { path: '/api/me/subscriptions', body: [] },
      { path: '/api/me/subscriptions/diaries', body: [] },
      { path: '/api/me/subscriptions/posts', body: pageOf([]) },
    ]);
    expect(await screen.findByText('아직 구독한 다이어리나 블로그가 없어요')).toBeInTheDocument();
    expect(screen.getByText('마음에 드는 다이어리나 블로그에서 ‘+ 구독’을 눌러 보세요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '글 둘러보기' })).toHaveAttribute('href', '/');
    expect(screen.getAllByText('아직 없어요.')).toHaveLength(2);
  });

  it('다이어리 탭: kind=diary 로 부르고, 구독한 다이어리가 없으면 다이어리 빈 안내를 보여 준다', async () => {
    const fetchMock = setup(
      [
        { path: '/api/me/subscriptions', body: blogs },
        { path: '/api/me/subscriptions/diaries', body: [] },
        { path: '/api/me/subscriptions/posts', body: pageOf([]) },
      ],
      '/subscriptions?kind=diary',
    );
    expect(await screen.findByText('아직 구독한 다이어리가 없어요')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '구독한 다이어리의 새 글' })).toBeInTheDocument();
    expect(postCalls(fetchMock)[0]).toBe('/api/me/subscriptions/posts?page=1&kind=diary');
  });

  it('구독은 있지만 새 글이 없으면 "아직 공개 글이 없어요"를 보여 준다', async () => {
    setup(
      [
        { path: '/api/me/subscriptions', body: blogs },
        { path: '/api/me/subscriptions/diaries', body: diaries },
        { path: '/api/me/subscriptions/posts', body: pageOf([]) },
      ],
      '/subscriptions?kind=blog',
    );
    expect(await screen.findByText('아직 공개 글이 없어요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /블로그/, current: 'page' })).toBeInTheDocument();
  });

  it('탭을 바꾸거나 페이지를 넘기면 그 조건으로 다시 부른다', async () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    const fetchMock = setup([
      { path: '/api/me/subscriptions', body: blogs },
      { path: '/api/me/subscriptions/diaries', body: diaries },
      { path: '/api/me/subscriptions/posts', body: pageOf([post(1)], 3) },
    ]);
    await screen.findByText('새 글 1');
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(postCalls(fetchMock)).toContain('/api/me/subscriptions/posts?page=2'));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
    fireEvent.click(screen.getByRole('link', { name: /블로그 1/ }));
    await waitFor(() => expect(postCalls(fetchMock)).toContain('/api/me/subscriptions/posts?page=1&kind=blog'));
    fireEvent.click(await screen.findByRole('button', { name: '3' }));
    await waitFor(() => expect(postCalls(fetchMock)).toContain('/api/me/subscriptions/posts?page=3&kind=blog'));
  });

  it('불러오지 못하면 오류를 보여 주고, 다시 시도하면 모두 다시 부른다', async () => {
    const fetchMock = setup([
      { path: '/api/me/subscriptions', status: 500, body: { error: { code: 'INTERNAL', message: '구독 목록 오류' } } },
      { path: '/api/me/subscriptions/diaries', body: diaries },
      { path: '/api/me/subscriptions/posts', body: pageOf([]) },
    ]);
    expect(await screen.findByText('구독 목록 오류')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(postCalls(fetchMock)).toHaveLength(2));
    expect(fetchMock.mock.calls.filter(([u]) => u === '/api/me/subscriptions')).toHaveLength(2);
  });
});
