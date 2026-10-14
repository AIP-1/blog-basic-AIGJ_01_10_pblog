import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostDetail } from '../api/types';
import { mockFetch, renderWithProviders, type MockRoute } from '../test/utils';
import { PostDetailPage } from './PostDetailPage';

const me = { member: { id: 3, nickname: '서연', email: 's@b.com' }, blog: { id: 5, name: '서연의 블로그' }, newCommentCount: 0 };
const post: PostDetail = {
  id: 7,
  blog: { id: 1, name: '떠나는 고양이', description: '여행을 기록하는 블로그', owner: { nickname: '준호' } },
  topic: { code: 'travel', name: '여행' },
  category: { id: 2, name: '국내여행' },
  title: '단풍 명소',
  body: '설악산 **단풍**이 한창이에요',
  createdAt: '2026-10-01T10:00:00+09:00',
  contentUpdatedAt: '2026-10-02T09:30:00+09:00',
  visibility: 'PUBLIC',
  coverImageUrl: '/img/cover.jpg',
  tags: ['단풍', '가을'],
  viewCount: 1234,
  likeCount: 3,
  likedByMe: false,
  bookmarkedByMe: false,
  commentCount: 0,
  prev: { id: 6, title: '여름 바다' },
  next: { id: 8, title: '겨울 산행' },
  otherPosts: [{ id: 6, title: '여름 바다', likeCount: 2, commentCount: 1, createdAt: '2026-08-01T10:00:00+09:00' }],
  isAuthor: false,
} as PostDetail;
const mine: PostDetail = { ...post, isAuthor: true, pinned: false };

function renderAt(routes: MockRoute[], path = '/posts/7') {
  const fetchMock = mockFetch([{ path: '/api/posts/7/comments', body: [] }, ...routes]);
  const utils = renderWithProviders(
    <Routes>
      <Route path="/posts/:postId" element={<PostDetailPage />} />
      <Route path="/blogs/:blogId" element={<p>블로그 화면</p>} />
    </Routes>,
    { path },
  );
  return { fetchMock, ...utils };
}

describe('글 상세 (CF-09, CF-18~21)', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=t; path=/';
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('남의 글: 분야·다이어리·작성자·수정 시각·조회수·태그·이전/다음 글·다른 글을 보여 주고, 읽은 글로 기록한다', async () => {
    renderAt([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/posts/7', body: post },
    ]);
    expect(await screen.findByRole('heading', { level: 1, name: '단풍 명소' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '여행' })).toHaveAttribute('href', '/topics/travel');
    expect(screen.getByRole('link', { name: '국내여행' })).toHaveAttribute('href', '/blogs/1?category=2');
    expect(screen.getByText('준호')).toBeInTheDocument();
    expect(screen.getByText(/^수정/)).toBeInTheDocument();
    expect(screen.getByText('조회 1,234')).toBeInTheDocument();
    expect(screen.getByText('단풍', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /이전 글.*여름 바다/ })).toHaveAttribute('href', '/posts/6');
    expect(screen.getByRole('link', { name: /다음 글.*겨울 산행/ })).toHaveAttribute('href', '/posts/8');
    expect(screen.getByText('여행을 기록하는 블로그')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '신고' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '삭제' })).toBeNull();
    expect(screen.queryByRole('link', { name: '수정' })).toBeNull();
    await waitFor(() => expect(localStorage.getItem('sagak.reads.v1')).toContain('"id":7'));
  });

  it('없는 글이면 "존재하지 않는 글", 다른 오류면 다시 시도 상자를 보여 준다', async () => {
    const first = renderAt([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/posts/7', status: 404, body: { error: { code: 'POST_NOT_FOUND', message: '' } } },
    ]);
    expect(await screen.findByText('존재하지 않는 글입니다')).toBeInTheDocument();
    first.unmount();
    vi.unstubAllGlobals();

    const { fetchMock } = renderAt(
      [
        { path: '/api/auth/me', status: 204 },
        { path: '/api/posts/9', status: 500, body: { error: { code: 'INTERNAL', message: '글을 불러오지 못했습니다' } } },
      ],
      '/posts/9',
    );
    expect(await screen.findByText('글을 불러오지 못했습니다')).toBeInTheDocument();
    const before = fetchMock.mock.calls.filter(([u]) => u === '/api/posts/9').length;
    fireEvent.click(screen.getByRole('button', { name: /다시/ }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => u === '/api/posts/9').length).toBe(before + 1));
  });

  it('로그인한 회원이 신고를 누르면 신고 창이 열리고 취소로 닫힌다', async () => {
    const user = userEvent.setup();
    renderAt([
      { path: '/api/auth/me', body: me },
      { path: '/api/posts/7', body: post },
    ]);
    await screen.findByRole('heading', { level: 1 });
    await screen.findByLabelText('댓글 입력'); // 로그인 상태가 반영될 때까지
    await user.click(screen.getByRole('button', { name: '신고' }));
    const dialog = screen.getByRole('dialog', { name: '신고하기' });
    await user.click(within(dialog).getByRole('button', { name: '취소' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('공유: 공유 창이 없으면 주소를 복사하고 알려 준다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderAt([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/posts/7', body: post },
    ]);
    fireEvent.click(await screen.findByRole('button', { name: '공유' }));
    expect(await screen.findByText('글 주소를 복사했어요')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/posts/7`);
  });

  it('공유: 공유 창이 있으면 그것을 쓰고, 복사도 실패하면 주소를 직접 복사하도록 보여 준다', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    renderAt([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/posts/7', body: post },
    ]);
    fireEvent.click(await screen.findByRole('button', { name: '공유' }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ title: '단풍 명소', url: `${window.location.origin}/posts/7` }));

    share.mockRejectedValueOnce(new Error('denied'));
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue(null);
    fireEvent.click(screen.getByRole('button', { name: '공유' }));
    await waitFor(() => expect(prompt).toHaveBeenCalledWith('글 주소를 복사해 주세요', `${window.location.origin}/posts/7`));

    // 사용자가 공유 창을 닫은 것(AbortError)은 조용히 넘긴다
    prompt.mockClear();
    share.mockRejectedValueOnce(new DOMException('cancel', 'AbortError'));
    fireEvent.click(screen.getByRole('button', { name: '공유' }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(3));
    expect(prompt).not.toHaveBeenCalled();
    delete (navigator as { share?: unknown }).share;
  });

  it('내 글: 대표글로 고정하면 버튼이 해제로 바뀌고 알림을 띄운다', async () => {
    const { fetchMock } = renderAt([
      { path: '/api/auth/me', body: me },
      { path: '/api/posts/7', body: mine },
      { method: 'PUT', path: '/api/posts/7/pin', body: { pinned: true } },
    ]);
    expect(await screen.findByRole('link', { name: '수정' })).toHaveAttribute('href', '/posts/7/edit');
    expect(screen.queryByRole('button', { name: '신고' })).toBeNull();
    const pin = screen.getByRole('button', { name: /대표글로 고정/ });
    expect(pin).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(pin);
    expect(await screen.findByText('대표글로 고정했습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /대표글 해제/ })).toHaveAttribute('aria-pressed', 'true');
    expect(fetchMock.mock.calls.some(([u, init]) => u === '/api/posts/7/pin' && init?.method === 'PUT')).toBe(true);
  });

  it('내 글: 고정 해제와 고정 실패도 알려 준다', async () => {
    renderAt([
      { path: '/api/auth/me', body: me },
      { path: '/api/posts/7', body: { ...mine, pinned: true } },
      { method: 'PUT', path: '/api/posts/7/pin', body: { pinned: false } },
    ]);
    fireEvent.click(await screen.findByRole('button', { name: /대표글 해제/ }));
    expect(await screen.findByText('대표글 고정을 풀었습니다')).toBeInTheDocument();
    vi.unstubAllGlobals();

    mockFetch([
      { path: '/api/auth/me', body: me },
      { method: 'PUT', path: '/api/posts/7/pin', status: 409, body: { error: { code: 'PIN_LIMIT', message: '대표글은 3개까지입니다' } } },
    ]);
    fireEvent.click(screen.getByRole('button', { name: /대표글로 고정/ }));
    expect(await screen.findByText('대표글은 3개까지입니다')).toBeInTheDocument();
  });

  it('내 글 삭제: 취소하면 그대로, 확인하면 지우고 블로그로 간다', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { fetchMock } = renderAt([
      { path: '/api/auth/me', body: me },
      { path: '/api/posts/7', body: mine },
      { method: 'DELETE', path: '/api/posts/7', status: 204 },
    ]);
    const del = await screen.findByRole('button', { name: '삭제' });
    fireEvent.click(del);
    expect(confirm).toHaveBeenCalledWith('삭제하면 되돌릴 수 없습니다. 삭제할까요?');
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    fireEvent.click(del);
    expect(await screen.findByText('블로그 화면')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u, init]) => u === '/api/posts/7' && init?.method === 'DELETE')).toBe(true);
  });

  it('내 글 삭제에 실패하면 알림을 띄우고 화면에 남는다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAt([
      { path: '/api/auth/me', body: me },
      { path: '/api/posts/7', body: mine },
      { method: 'DELETE', path: '/api/posts/7', status: 500, body: { error: { code: 'INTERNAL', message: '삭제하지 못했습니다' } } },
    ]);
    fireEvent.click(await screen.findByRole('button', { name: '삭제' }));
    expect(await screen.findByText('삭제하지 못했습니다')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: '단풍 명소' })).toBeInTheDocument();
  });

  it('주제·이전/다음·다른 글·커버가 없는 비공개 글도 그린다', async () => {
    renderAt([
      { path: '/api/auth/me', status: 204 },
      {
        path: '/api/posts/7',
        body: {
          ...post,
          topic: null,
          visibility: 'PRIVATE',
          coverImageUrl: null,
          contentUpdatedAt: null,
          viewCount: undefined,
          blog: { id: 1, name: '떠나는 고양이', ownerNickname: '고양이' },
          prev: null,
          next: null,
          otherPosts: [],
        },
      },
    ]);
    expect(await screen.findByText('비공개')).toBeInTheDocument();
    expect(screen.getByText('고양이')).toBeInTheDocument();
    expect(screen.queryByText(/이전 글/)).toBeNull();
    expect(screen.queryByText(/의 다른 글/)).toBeNull();
    expect(screen.queryByText(/^조회/)).toBeNull();
  });
});
