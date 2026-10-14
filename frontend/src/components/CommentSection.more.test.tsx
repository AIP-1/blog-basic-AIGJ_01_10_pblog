import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { qk } from '../api/queries';
import type { PostDetail } from '../api/types';
import { mockFetch, renderWithProviders } from '../test/utils';
import { CommentSection } from './CommentSection';

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
  likeCount: 0,
  likedByMe: false,
  commentCount: 3,
  prev: null,
  next: null,
  otherPosts: [],
  isAuthor: false,
};
const comment = (id: number, body: string, extra: Record<string, unknown> = {}) => ({
  id,
  parentId: null,
  author: { nickname: '준호' },
  body,
  createdAt: '2026-10-01T11:00:00+09:00',
  canDelete: false,
  replies: [],
  ...extra,
});
const bodyOf = (fetchMock: ReturnType<typeof mockFetch>, url: string, method: string) =>
  fetchMock.mock.calls.filter(([u, init]) => u === url && init?.method === method).map(([, init]) => JSON.parse(String(init?.body)) as unknown);

describe('CommentSection 더 (CF-18)', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=t; path=/';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('댓글이 없으면 안내 문구를 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/posts/7/comments', body: [] },
    ]);
    renderWithProviders(<CommentSection post={post} />);
    expect(await screen.findByText('아직 댓글이 없습니다')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('목록을 못 불러오면 다시 시도할 수 있는 오류 상자를 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/posts/7/comments', status: 500, body: { error: { code: 'INTERNAL', message: '댓글을 불러오지 못했습니다' } } },
    ]);
    renderWithProviders(<CommentSection post={post} />);
    expect(await screen.findByText('댓글을 불러오지 못했습니다')).toBeInTheDocument();
  });

  it('빈 댓글은 보내지 않고, 쓴 댓글은 등록한 뒤 입력칸을 비우고 글의 댓글 수를 늘린다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/posts/7/comments', body: [comment(1, '첫 댓글')] },
      { method: 'POST', path: '/api/posts/7/comments', status: 201, body: comment(2, '반가워요') },
    ]);
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(<CommentSection post={post} />);
    queryClient.setQueryData(qk.post(7), post);
    const input = await screen.findByLabelText('댓글 입력');
    await user.click(screen.getByRole('button', { name: '댓글 등록' }));
    expect(await screen.findByText('댓글 내용을 입력해 주세요')).toBeInTheDocument();
    await user.type(input, '반가워요');
    expect(screen.queryByText('댓글 내용을 입력해 주세요')).toBeNull();
    expect(screen.getByText('4/500')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '댓글 등록' }));
    await waitFor(() => expect(input).toHaveValue(''));
    expect(bodyOf(fetchMock, '/api/posts/7/comments', 'POST')).toEqual([{ body: '반가워요' }]);
    expect(queryClient.getQueryData<PostDetail>(qk.post(7))?.commentCount).toBe(4);
  });

  it('너무 긴 댓글은 막고, 서버가 준 칸 오류는 입력칸 아래에 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/posts/7/comments', body: [] },
      {
        method: 'POST',
        path: '/api/posts/7/comments',
        status: 400,
        body: { error: { code: 'VALIDATION_FAILED', message: '입력값 오류', fields: { body: '금지어가 들어 있습니다' } } },
      },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<CommentSection post={post} />);
    const input = await screen.findByLabelText('댓글 입력');
    await user.click(input);
    await user.paste('가'.repeat(501));
    await user.click(screen.getByRole('button', { name: '댓글 등록' }));
    expect(await screen.findByText('댓글은 500자 이하로 입력해 주세요')).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, '나쁜 말');
    await user.click(screen.getByRole('button', { name: '댓글 등록' }));
    expect(await screen.findByText('금지어가 들어 있습니다')).toBeInTheDocument();
    expect(input).toHaveValue('나쁜 말');
  });

  it('답글을 달면 parentId 와 함께 보내고 답글 입력칸을 닫는다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/posts/7/comments', body: [comment(1, '원 댓글')] },
      { method: 'POST', path: '/api/posts/7/comments', status: 201, body: comment(5, '답글', { parentId: 1 }) },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<CommentSection post={post} />);
    await user.click(await screen.findByRole('button', { name: '답글' }));
    await user.type(screen.getByLabelText('답글 입력'), '고마워요');
    await user.click(screen.getByRole('button', { name: '답글 등록' }));
    await waitFor(() => expect(screen.queryByLabelText('답글 입력')).toBeNull());
    expect(bodyOf(fetchMock, '/api/posts/7/comments', 'POST')).toEqual([{ body: '고마워요', parentId: 1 }]);
  });

  it('비회원이 답글을 누르면 입력칸을 열지 않는다', async () => {
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/posts/7/comments', body: [comment(1, '원 댓글')] },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<CommentSection post={post} />);
    expect(await screen.findByText('로그인한 회원만 댓글을 쓸 수 있습니다')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: '답글' }));
    expect(screen.queryByLabelText('답글 입력')).toBeNull();
    await user.click(screen.getByRole('button', { name: '로그인' }));
  });

  it('답글이 달린 댓글을 지우면 답글까지 지운다고 묻고, 확인하면 지운 만큼 댓글 수를 줄인다', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchMock = mockFetch([
      { path: '/api/auth/me', body: me },
      {
        path: '/api/posts/7/comments',
        body: [
          comment(1, '내 원 댓글', {
            canDelete: true,
            author: { nickname: '서연' },
            replies: [{ id: 3, parentId: 1, author: { nickname: '준호' }, body: '답글', createdAt: '2026-10-01T12:00:00+09:00', canDelete: false }],
          }),
        ],
      },
      { method: 'DELETE', path: '/api/comments/1', status: 204 },
    ]);
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(<CommentSection post={post} />);
    queryClient.setQueryData(qk.post(7), post);
    await user.click(await screen.findByRole('button', { name: '삭제' }));
    expect(confirm).toHaveBeenCalledWith('댓글을 삭제할까요? 이 댓글에 달린 답글도 함께 삭제됩니다');
    await waitFor(() => expect(queryClient.getQueryData<PostDetail>(qk.post(7))?.commentCount).toBe(1));
    expect(fetchMock.mock.calls.some(([u, init]) => u === '/api/comments/1' && init?.method === 'DELETE')).toBe(true);
  });

  it('삭제를 취소하면 요청하지 않고, 삭제에 실패하면 알림을 띄운다', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const fetchMock = mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/posts/7/comments', body: [comment(2, '내 댓글', { canDelete: true })] },
      { method: 'DELETE', path: '/api/comments/2', status: 500, body: { error: { code: 'INTERNAL', message: '삭제하지 못했습니다' } } },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<CommentSection post={post} />);
    const del = await screen.findByRole('button', { name: '삭제' });
    await user.click(del);
    expect(confirm).toHaveBeenLastCalledWith('댓글을 삭제할까요?');
    expect(fetchMock.mock.calls.some(([u]) => u === '/api/comments/2')).toBe(false);
    await user.click(del);
    expect(await screen.findByRole('alert')).toHaveTextContent('삭제하지 못했습니다');
  });

  it('#comment-ID 로 들어오면 그 댓글로 스크롤한다', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    window.location.hash = '#comment-1';
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/posts/7/comments', body: [comment(1, '여기')] },
    ]);
    renderWithProviders(<CommentSection post={post} />);
    await screen.findByText('여기');
    await waitFor(() => expect(scroll).toHaveBeenCalledWith({ block: 'center' }));
    window.location.hash = '';
  });
});
