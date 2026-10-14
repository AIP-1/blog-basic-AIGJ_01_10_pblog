import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithProviders, type MockRoute } from '../test/utils';
import { HomePage } from './HomePage';

const ME = { member: { id: 3, nickname: '끄적이', email: 'd@b.com' }, blog: { id: 9, name: '내 서랍' }, newCommentCount: 4 };
const post = (id: number, blogId = 1, extra: Record<string, unknown> = {}) => ({
  id,
  title: `글 ${id}`,
  excerpt: '',
  createdAt: '2026-10-01T10:00:00+09:00',
  blog: { id: blogId, name: blogId === 1 ? '생각 서랍' : `블로그 ${blogId}` },
  category: { id: 1, name: '일상' },
  viewCount: 1234,
  likeCount: 2,
  commentCount: 1,
  ...extra,
});
const blog = { id: 1, name: '생각 서랍', description: '서랍 소개', topic: { code: 'hobby', name: '취미' }, ownerNickname: '끄적이', postCount: 3, lastPostAt: null };
const home = {
  featured: [],
  latestPosts: [],
  blogs: [blog],
  notices: [{ ...post(90), title: 'v1.2 바뀐 점' }],
  weeklyPopular: [post(1), post(2, 2)],
  popularPosts: [post(11), post(12, 2), post(13, 3)],
  popularDiaries: [{ id: 4, name: '여행 일기', colorIndex: 2, blog: { id: 2, name: '떠돌이' }, postCount: 1500, subscriberCount: 7 }],
};
const pageOf = (items: unknown[], totalPages = 1) => ({ items, page: 1, size: 10, totalItems: items.length, totalPages });

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname + loc.search}</p>;
}

function setup(routes: MockRoute[] = [], { me = false, path = '/' } = {}) {
  const fetchMock = mockFetch([
    me ? { path: '/api/auth/me', body: ME } : { path: '/api/auth/me', status: 204 },
    { path: '/api/topics', body: [{ code: 'travel', name: '여행', description: '' }, { code: 'food', name: '음식', description: '' }] },
    { path: '/api/search/trending', body: { updatedAt: '2026-10-14T05:30:00Z', items: [{ rank: 1, keyword: '단풍 명소', change: 'NEW', delta: 0 }] } },
    { path: '/api/diary-stickers', body: {} },
    ...routes,
    { path: '/api/home', body: home },
    { path: '/api/posts', body: pageOf([post(21, 1, { title: '분야 글 21' })], 3) },
  ]);
  const result = renderWithProviders(
    <>
      <HomePage />
      <Where />
    </>,
    { path },
  );
  return { fetchMock, ...result };
}
const feedCalls = (f: ReturnType<typeof mockFetch>) => f.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith('/api/posts'));

describe('홈', () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('공지 띠 · 광고 · 이번 주 인기 글 · 블로그 둘러보기 · 인기 다이어리 · 인기 검색어를 보여 준다', async () => {
    setup();
    const notice = await screen.findByRole('region', { name: '공지사항' });
    expect(within(notice).getByRole('link', { name: 'v1.2 바뀐 점' })).toHaveAttribute('href', '/posts/90');
    expect(within(notice).getByRole('link', { name: '전체 보기 ›' })).toHaveAttribute('href', '/notices');
    expect(screen.getByRole('region', { name: '광고' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '이번 주 인기 글' })).toBeInTheDocument();
    const pop = screen.getByRole('link', { name: /글 1\b.*생각 서랍.*조회 1,234/ });
    expect(pop).toHaveAttribute('href', '/posts/1');
    expect(within(pop).getAllByText('1')[0]).toHaveClass('pop-badge');
    expect(screen.getByRole('link', { name: /생각 서랍.*서랍 소개/ })).toHaveAttribute('href', '/blogs/1');
    expect(screen.getByRole('link', { name: /여행 일기.*떠돌이 · 구독자 7명 · 글 1,500개/ })).toHaveAttribute('href', '/blogs/2?category=4');
    expect(await screen.findByText('단풍 명소')).toBeInTheDocument();
  });

  it('비로그인이면 로그인 · 회원가입 버튼을 보여 준다', async () => {
    setup();
    await screen.findByText('이번 주 인기 글');
    const login = screen.getByRole('button', { name: '로그인' });
    expect(screen.getByRole('button', { name: '회원가입' })).toBeInTheDocument();
    fireEvent.click(login);
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
    expect(screen.queryByRole('link', { name: '글쓰기' })).not.toBeInTheDocument();
  });

  it('로그인하면 내 블로그 요약 · 새 댓글 수 · 바로가기를 보여 주고, 내 블로그 글은 추천에서 뺀다', async () => {
    setup([{ path: '/api/blogs/9', body: { ...blog, id: 9, name: '내 서랍', postCount: 42 } }], { me: true });
    expect(await screen.findByText('끄적이 · 글 42개')).toBeInTheDocument();
    expect(screen.getByText('내 서랍')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '글쓰기' })).toHaveAttribute('href', '/write');
    expect(screen.getByRole('link', { name: '내 블로그' })).toHaveAttribute('href', '/blogs/9');
    expect(screen.getByRole('link', { name: '블로그 관리 4' })).toHaveAttribute('href', '/manage');
    expect(screen.getByRole('link', { name: '내 정보' })).toHaveAttribute('href', '/me');
    expect(screen.queryByRole('button', { name: '로그인' })).not.toBeInTheDocument();
  });

  it('추천 글: 기록이 없으면 인기 글을, 읽은 기록이 있으면 그에 맞춰 고르고, 기록 지우기 · 끄기 · 켜기를 할 수 있다', async () => {
    localStorage.setItem('sagak.reads.v1', JSON.stringify([{ id: 1, blogId: 2, categoryName: '여행', at: Date.now() }]));
    setup();
    expect(await screen.findByText('읽은 글을 바탕으로 골랐어요')).toBeInTheDocument();
    expect(screen.getByText("자주 읽은 '블로그 2'")).toBeInTheDocument();
    expect(screen.getByText(/추천에 이 브라우저에서 읽은 글 1개를 써요/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '기록 지우기' }));
    expect(screen.getByText('글을 읽으면 취향에 맞게 바뀌어요')).toBeInTheDocument();
    expect(screen.getAllByText('인기 글')).toHaveLength(3);
    expect(screen.getByText(/읽은 글 0개를 써요/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '기록 끄기' }));
    expect(screen.getByText('추천 기록을 꺼 두었어요 · 인기 글을 대신 보여 드려요')).toBeInTheDocument();
    expect(screen.getByText(/추천 기록이 꺼져 있어요/)).toBeInTheDocument();
    expect(localStorage.getItem('sagak.reads.off')).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: '켜기' }));
    expect(screen.getByRole('button', { name: '기록 끄기' })).toBeInTheDocument();
    expect(localStorage.getItem('sagak.reads.off')).toBeNull();
  });

  it('분야별 글: 정렬 · 분야 · 페이지를 바꾸면 주소에 남기고 그 조건으로 부른다', async () => {
    const { fetchMock } = setup();
    expect(await screen.findByText('분야 글 21')).toBeInTheDocument();
    expect(feedCalls(fetchMock)[0]).toBe('/api/posts?page=1');
    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: '인기순' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/?sort=popular'));
    await waitFor(() => expect(feedCalls(fetchMock)).toContain('/api/posts?sort=popular&page=1'));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('button', { name: '여행' }));
    await waitFor(() => expect(feedCalls(fetchMock)).toContain('/api/posts?topic=travel&sort=popular&page=1'));
    expect(screen.getByRole('button', { name: '여행' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/?topic=travel&sort=popular&page=2'));

    fireEvent.click(screen.getByRole('button', { name: '최신순' }));
    fireEvent.click(screen.getByRole('button', { name: '전체' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/$/));
  });

  it('인기 검색어를 누르면 검색 화면으로 이동한다', async () => {
    setup();
    fireEvent.click(await screen.findByRole('button', { name: /단풍 명소/ }));
    expect(screen.getByTestId('where')).toHaveTextContent(`/search?q=${encodeURIComponent('단풍 명소')}&type=all`);
  });

  it('보여 줄 것이 없으면 각 구역에 빈 안내를 보여 주고, 공지 띠 · 인기 다이어리는 숨긴다', async () => {
    setup([
      { path: '/api/home', body: { featured: [], latestPosts: [], blogs: [] } },
      { path: '/api/posts', body: pageOf([]) },
    ]);
    expect(await screen.findByText('최근 7일 동안 올라온 공개 글이 없어요.')).toBeInTheDocument();
    expect(screen.getByText('아직 추천할 글이 없어요.')).toBeInTheDocument();
    expect(screen.getByText('블로그가 없습니다')).toBeInTheDocument();
    expect(await screen.findByText('이 분야에는 아직 공개 글이 없어요')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '공지사항' })).not.toBeInTheDocument();
    expect(screen.queryByText('인기 다이어리')).not.toBeInTheDocument();
  });

  it('분야별 글만 실패하면 그 자리에 오류를 보여 준다', async () => {
    setup([{ path: '/api/posts', status: 500, body: { error: { code: 'X', message: '분야 글 오류' } } }]);
    expect(await screen.findByText('분야 글 오류')).toBeInTheDocument();
    expect(screen.getByText('이번 주 인기 글')).toBeInTheDocument();
  });

  it('홈을 불러오지 못하면 오류를 보여 주고, 다시 시도하면 다시 부른다', async () => {
    const { fetchMock } = setup([{ path: '/api/home', status: 500, body: { error: { code: 'X', message: '홈 오류' } } }]);
    expect(await screen.findByText('홈 오류')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => u === '/api/home')).toHaveLength(2));
  });
});
