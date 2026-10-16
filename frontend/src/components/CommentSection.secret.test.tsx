import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostDetail } from '../api/types';
import { mockFetch, renderWithProviders } from '../test/utils';
import { CommentSection } from './CommentSection';

const me = { member: { id: 3, nickname: '서연', email: 's@b.com' }, blog: { id: 5, name: '서연의 블로그' }, newCommentCount: 0 };
const post = { id: 7, commentCount: 2 } as PostDetail;
const comment = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  parentId: null,
  author: { nickname: '준호' },
  body: `댓글 ${id}`,
  createdAt: '2026-10-01T11:00:00+09:00',
  canDelete: false,
  secret: false,
  hidden: false,
  replies: [],
  ...extra,
});
const hidden = (id: number) => comment(id, { author: null, body: null, secret: true, hidden: true });
const bodyOf = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.mock.calls
    .filter(([u, init]) => u === '/api/posts/7/comments' && init?.method === 'POST')
    .map(([, init]) => JSON.parse(String(init?.body)) as unknown);

describe('비밀 댓글', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=t; path=/';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('볼 수 없는 비밀 댓글은 내용 · 작성자 대신 안내만 보이고 답글 버튼이 없다', async () => {
    mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/posts/7/comments', body: [hidden(1), comment(2)] },
    ]);
    renderWithProviders(<CommentSection post={post} />);
    const item = await screen.findByText('🔒 비밀 댓글입니다');
    const li = item.closest('li') as HTMLElement;
    expect(within(li).getByText('비밀 댓글')).toBeInTheDocument();
    expect(within(li).queryByText('탈퇴한 사용자')).toBeNull();
    expect(within(li).queryByRole('button', { name: '답글' })).toBeNull();
    // 공개 댓글에는 그대로 답글을 단다
    expect(screen.getAllByRole('button', { name: '답글' })).toHaveLength(1);
  });

  it('볼 수 있는 비밀 댓글은 내용과 비밀 표시를 함께 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/posts/7/comments', body: [comment(1, { secret: true, body: '주인만 보세요' })] },
    ]);
    renderWithProviders(<CommentSection post={post} />);
    expect(await screen.findByText('주인만 보세요')).toBeInTheDocument();
    expect(screen.getByText('🔒 비밀 댓글')).toBeInTheDocument();
  });

  it('비밀 댓글을 고르면 secret 을 함께 보내고, 등록하면 선택을 푼다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/posts/7/comments', body: [] },
      { method: 'POST', path: '/api/posts/7/comments', status: 201, body: comment(9, { secret: true }) },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<CommentSection post={post} />);
    const box = await screen.findByRole('checkbox', { name: '비밀 댓글' });
    expect(box).not.toBeChecked();
    await user.click(box);
    await user.type(screen.getByLabelText('댓글 입력'), '몰래 남겨요');
    await user.click(screen.getByRole('button', { name: '댓글 등록' }));
    await waitFor(() => expect(screen.getByLabelText('댓글 입력')).toHaveValue(''));
    expect(bodyOf(fetchMock)).toEqual([{ body: '몰래 남겨요', secret: true }]);
    expect(box).not.toBeChecked();
  });

  it('비밀 댓글에 다는 답글은 비밀로 고정되어 secret 을 보낸다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/posts/7/comments', body: [comment(1, { secret: true })] },
      { method: 'POST', path: '/api/posts/7/comments', status: 201, body: comment(5, { parentId: 1, secret: true }) },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<CommentSection post={post} />);
    await user.click(await screen.findByRole('button', { name: '답글' }));
    const replyForm = screen.getByLabelText('답글 입력').closest('form') as HTMLElement;
    const box = within(replyForm).getByRole('checkbox', { name: '비밀 댓글' });
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
    await user.type(screen.getByLabelText('답글 입력'), '답해요');
    await user.click(screen.getByRole('button', { name: '답글 등록' }));
    await waitFor(() => expect(screen.queryByLabelText('답글 입력')).toBeNull());
    expect(bodyOf(fetchMock)).toEqual([{ body: '답해요', parentId: 1, secret: true }]);
  });
});
