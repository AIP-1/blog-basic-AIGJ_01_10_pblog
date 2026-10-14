import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import type { BlogDetail, Category } from '../api/types';
import { mockFetch, renderWithProviders, type MockRoute } from '../test/utils';
import { DiarySubscribeButton, SubscribeButton } from './SubscribeButton';

const ME = { member: { id: 3, nickname: '끄적이', email: 'd@b.com' }, blog: { id: 9, name: '내 서랍' }, newCommentCount: 0 };
const blog: BlogDetail = {
  id: 1,
  name: '생각 서랍',
  description: '',
  topic: { code: 'hobby', name: '취미' },
  owner: { nickname: '남', bio: '' },
  postCount: 3,
  lastPostAt: null,
  isOwner: false,
  subscriberCount: 3,
  subscribedByMe: false,
};
const diary = { id: 4, name: '일상', description: '', visibility: 'PUBLIC', postCount: 2, isDefault: true, colorIndex: 1, subscriberCount: 5, subscribedByMe: true } as Category;

async function renderLoggedIn(ui: ReactElement, routes: MockRoute[]) {
  const fetchMock = mockFetch([{ path: '/api/auth/me', body: ME }, { path: '/api/csrf', body: {} }, ...routes]);
  const result = renderWithProviders(ui);
  await waitFor(() => expect(result.queryClient.getQueryData(['me'])).toEqual(ME));
  return { fetchMock, ...result };
}

describe('구독 버튼', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=t; path=/';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('블로그 구독: 누르면 구독하고, 캐시의 블로그 구독 상태 · 구독자 수를 바꾸고 알림을 띄운다', async () => {
    const { fetchMock, queryClient } = await renderLoggedIn(<SubscribeButton blog={blog} />, [
      { method: 'PUT', path: '/api/blogs/1/subscribe', body: { subscribed: true, subscriberCount: 4 } },
    ]);
    queryClient.setQueryData(['blog', '1'], blog);
    const button = screen.getByRole('button', { name: '+ 블로그 구독' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAttribute('title', '이 블로그의 모든 공개 다이어리를 받아 봐요');
    fireEvent.click(button);
    expect(await screen.findByText('구독했어요')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u, i]) => u === '/api/blogs/1/subscribe' && i?.method === 'PUT')).toBe(true);
    expect(queryClient.getQueryData<BlogDetail>(['blog', '1'])).toMatchObject({ subscribedByMe: true, subscriberCount: 4 });
  });

  it('이미 구독한 블로그는 "구독 중"으로 보이고, 누르면 취소 알림을 띄운다', async () => {
    await renderLoggedIn(<SubscribeButton blog={{ ...blog, subscribedByMe: true }} />, [
      { method: 'PUT', path: '/api/blogs/1/subscribe', body: { subscribed: false, subscriberCount: 2 } },
    ]);
    const button = screen.getByRole('button', { name: '✓ 블로그 구독 중' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveClass('is-on');
    fireEvent.click(button);
    expect(await screen.findByText('구독을 취소했어요')).toBeInTheDocument();
  });

  it('서버가 거절하면 오류 알림을 띄운다', async () => {
    await renderLoggedIn(<SubscribeButton blog={blog} />, [
      { method: 'PUT', path: '/api/blogs/1/subscribe', status: 400, body: { error: { code: 'OWN_BLOG', message: '내 블로그는 구독할 수 없습니다' } } },
    ]);
    fireEvent.click(screen.getByRole('button', { name: '+ 블로그 구독' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('내 블로그는 구독할 수 없습니다');
  });

  it('비로그인이면 구독 요청을 보내지 않는다', async () => {
    const fetchMock = mockFetch([{ path: '/api/auth/me', status: 204 }]);
    const { queryClient } = renderWithProviders(<SubscribeButton blog={blog} />);
    await waitFor(() => expect(queryClient.getQueryData(['me'])).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: '+ 블로그 구독' }));
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/subscribe'))).toBe(false);
  });

  it('다이어리 구독: 누르면 취소하고, 캐시의 다이어리 목록에서 그 다이어리만 바꾼다', async () => {
    const other = { ...diary, id: 5, name: '여행', subscribedByMe: false, subscriberCount: 1 } as Category;
    const { fetchMock, queryClient } = await renderLoggedIn(<DiarySubscribeButton blogId={1} diary={diary} />, [
      { method: 'PUT', path: '/api/categories/4/subscribe', body: { subscribed: false, subscriberCount: 4 } },
    ]);
    queryClient.setQueryData(['blog', '1', 'categories'], [diary, other]);
    const button = screen.getByRole('button', { name: '✓ 구독 중' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(await screen.findByText('구독을 취소했어요')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u, i]) => u === '/api/categories/4/subscribe' && i?.method === 'PUT')).toBe(true);
    expect(queryClient.getQueryData<Category[]>(['blog', '1', 'categories'])).toEqual([
      { ...diary, subscribedByMe: false, subscriberCount: 4 },
      other,
    ]);
  });

  it('구독하지 않은 다이어리는 "+ 다이어리 구독"으로 보인다', async () => {
    await renderLoggedIn(<DiarySubscribeButton blogId={1} diary={{ ...diary, subscribedByMe: false }} />, [
      { method: 'PUT', path: '/api/categories/4/subscribe', body: { subscribed: true, subscriberCount: 6 } },
    ]);
    fireEvent.click(screen.getByRole('button', { name: '+ 다이어리 구독' }));
    expect(await screen.findByText('구독했어요')).toBeInTheDocument();
  });
});
