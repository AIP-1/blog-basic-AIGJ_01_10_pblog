import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { qk } from '../api/queries';
import type { PostDetail } from '../api/types';
import { mockFetch, renderWithProviders } from '../test/utils';
import { LikeButton } from './LikeButton';

const me = { member: { id: 3, nickname: '서연', email: 's@b.com' }, blog: { id: 5, name: '서연의 블로그' }, newCommentCount: 0 };
const post: PostDetail = {
  id: 7,
  blog: { id: 1, name: '떠나는 고양이' },
  topic: { code: 'travel', name: '여행' },
  category: { id: 2, name: '국내여행' },
  title: '단풍 명소',
  body: '본문',
  createdAt: '2026-10-01T10:00:00+09:00',
  contentUpdatedAt: null,
  visibility: 'PUBLIC',
  coverImageUrl: null,
  tags: [],
  likeCount: 4,
  likedByMe: false,
  commentCount: 0,
  prev: null,
  next: null,
  otherPosts: [],
  isAuthor: false,
};

describe('좋아요 버튼 (CF-19)', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=t; path=/';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('누르면 PUT 으로 좋아요를 보내고 글 캐시의 좋아요 수와 상태를 바꾼다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', body: me },
      { method: 'PUT', path: '/api/posts/7/like', body: { liked: true, likeCount: 5 } },
    ]);
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(<LikeButton post={post} />);
    queryClient.setQueryData(qk.post(7), post);
    const btn = await screen.findByRole('button', { name: /좋아요/ });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(btn).toHaveTextContent('♡ 좋아요 4');
    await waitFor(() => expect(queryClient.getQueryData(qk.me)).toBeTruthy());
    await user.click(btn);
    await waitFor(() => expect(queryClient.getQueryData<PostDetail>(qk.post(7))).toMatchObject({ likedByMe: true, likeCount: 5 }));
    expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/posts/7/like' && init?.method === 'PUT')).toBe(true);
  });

  it('이미 누른 글은 채운 하트와 눌림 상태로 보인다', async () => {
    mockFetch([{ path: '/api/auth/me', body: me }]);
    renderWithProviders(<LikeButton post={{ ...post, likedByMe: true, likeCount: 9 }} />);
    const btn = await screen.findByRole('button', { name: /좋아요/ });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn).toHaveTextContent('♥ 좋아요 9');
  });

  it('자기 글에는 누를 수 없고 이유를 title 로 알려 준다', async () => {
    mockFetch([{ path: '/api/auth/me', body: me }]);
    renderWithProviders(<LikeButton post={{ ...post, isAuthor: true }} />);
    const btn = await screen.findByRole('button', { name: /좋아요/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', '자기 글에는 할 수 없습니다');
  });

  it('비회원이 누르면 요청을 보내지 않는다', async () => {
    const fetchMock = mockFetch([{ path: '/api/auth/me', status: 204 }]);
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(<LikeButton post={post} />);
    await waitFor(() => expect(queryClient.getQueryState(qk.me)?.status).toBe('success'));
    await user.click(screen.getByRole('button', { name: /좋아요/ }));
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/posts/7/like')).toBe(false);
  });

  it('서버 오류는 알림으로 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', body: me },
      { method: 'PUT', path: '/api/posts/7/like', status: 500, body: { error: { code: 'INTERNAL', message: '잠시 후 다시 시도해 주세요' } } },
    ]);
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(<LikeButton post={post} />);
    await waitFor(() => expect(queryClient.getQueryData(qk.me)).toBeTruthy());
    await user.click(screen.getByRole('button', { name: /좋아요/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('잠시 후 다시 시도해 주세요');
  });
});
