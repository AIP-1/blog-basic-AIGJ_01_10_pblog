import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithProviders, type MockRoute } from '../test/utils';
import { SearchPage } from './SearchPage';

const blog = (id: number) => ({ id, name: `가을 블로그 ${id}`, description: '', topic: { code: 'travel', name: '여행' }, ownerNickname: '끄적이', postCount: 3, lastPostAt: null });
const post = (id: number) => ({ id, title: `가을 글 ${id}`, excerpt: '', createdAt: '2026-10-01T10:00:00+09:00', blog: { id: 1, name: '가을 블로그 1' } });
const pageOf = <T,>(items: T[], totalItems = items.length, totalPages = 1, page = 1) => ({ items, page, size: 10, totalItems, totalPages });
const trending = { updatedAt: '2026-10-14T05:30:00Z', items: [{ rank: 1, keyword: '단풍', change: 'NEW', delta: 0 }] };

function setup(search: unknown, path: string, extra: MockRoute[] = []) {
  const fetchMock = mockFetch([
    { path: '/api/auth/me', status: 204 },
    { path: '/api/search/trending', body: trending },
    { path: '/api/search', body: search },
    ...extra,
  ]);
  renderWithProviders(<SearchPage />, { path });
  return fetchMock;
}
const searchCalls = (f: ReturnType<typeof mockFetch>) => f.mock.calls.map(([u]) => decodeURIComponent(String(u)).replace(/\+/g, ' ')).filter((u) => u.startsWith('/api/search?'));

describe('검색 결과 화면', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('검색어가 없으면 시작 안내를 보여 주고 검색하지 않는다', async () => {
    const fetchMock = setup(pageOf([]), '/search');
    expect(screen.getByText('찾을 단어를 넣어 주세요')).toBeInTheDocument();
    expect(await screen.findByText('단풍')).toBeInTheDocument();
    expect(searchCalls(fetchMock)).toHaveLength(0);
  });

  it('너무 짧은 검색어는 안내를 보여 준다', () => {
    setup(pageOf([]), '/search?q=가');
    expect(screen.getByText('검색어를 2자 이상 입력해 주세요')).toBeInTheDocument();
  });

  it('모두: 블로그 · 글 구역과 총 건수, 페이지가 더 있으면 "더 보기" 링크를 보여 준다', async () => {
    const fetchMock = setup(
      { query: '가을', total: 25, blogs: pageOf([blog(1), blog(2)], 15, 2), posts: pageOf([post(1)], 10, 1) },
      '/search?q=가을',
    );
    expect(await screen.findByText('가을 글 1')).toBeInTheDocument();
    expect(screen.getByText('‘가을’')).toBeInTheDocument();
    expect(screen.getByText(/모두 · 검색 결과 25건/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '블로그 15' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '글 10' })).toBeInTheDocument();
    const more = screen.getAllByRole('link', { name: '더 보기' });
    expect(more).toHaveLength(1);
    expect(more[0]).toHaveAttribute('href', `/search?q=${encodeURIComponent('가을')}&type=blog`);
    expect(screen.queryByRole('navigation', { name: '페이지' })).not.toBeInTheDocument();
    expect(searchCalls(fetchMock)[0]).toBe('/api/search?q=가을&type=all&page=1');
  });

  it('결과가 없으면 "검색 결과가 없습니다"를 보여 준다', async () => {
    setup({ query: '없음', total: 0, blogs: pageOf([]), posts: pageOf([]) }, '/search?q=없음없음&type=all');
    expect(await screen.findByText('검색 결과가 없습니다')).toBeInTheDocument();
  });

  it('블로그만: 블로그 구역만 보여 주고 페이지를 넘기면 page를 붙여 다시 검색한다', async () => {
    const fetchMock = setup(
      { query: '가을', total: 15, blogs: pageOf([blog(1)], 15, 2), posts: pageOf([post(1)], 3, 1) },
      '/search?q=가을&type=blog',
    );
    expect(await screen.findByText('가을 블로그 1')).toBeInTheDocument();
    expect(screen.queryByText('가을 글 1')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '더 보기' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(searchCalls(fetchMock)).toContain('/api/search?q=가을&type=blog&page=2'));
  });

  it('글만: 글이 없으면 글 구역 안에 빈 안내를 보여 주고, 페이지를 넘길 수 있다', async () => {
    const fetchMock = setup(
      { query: '가을', total: 2, blogs: pageOf([blog(1)], 2), posts: pageOf([], 0, 0) },
      '/search?q=가을&type=post',
    );
    expect(await screen.findByRole('heading', { name: '글 0' })).toBeInTheDocument();
    expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('가을 블로그 1')).not.toBeInTheDocument();
    expect(searchCalls(fetchMock)[0]).toContain('type=post');
  });

  it('글만 검색해 여러 페이지면 글 페이지 버튼이 다음 페이지를 부른다', async () => {
    const fetchMock = setup(
      { query: '가을', total: 30, blogs: pageOf([], 0, 0), posts: pageOf([post(1)], 30, 3) },
      '/search?q=가을&type=post',
    );
    await screen.findByText('가을 글 1');
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    await waitFor(() => expect(searchCalls(fetchMock)).toContain('/api/search?q=가을&type=post&page=3'));
  });

  it('검색 범위와 검색어를 바꿔 제출하면 새 조건으로 검색한다', async () => {
    const fetchMock = setup({ query: '가을', total: 0, blogs: pageOf([]), posts: pageOf([]) }, '/search?q=가을');
    await screen.findByText('검색 결과가 없습니다');
    fireEvent.change(screen.getByRole('combobox', { name: '검색 범위' }), { target: { value: 'post' } });
    fireEvent.change(screen.getByRole('searchbox', { name: '검색어' }), { target: { value: '  겨울 바다 ' } });
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    await waitFor(() => expect(searchCalls(fetchMock)).toContain('/api/search?q=겨울 바다&type=post&page=1'));
    expect(screen.getByRole('searchbox', { name: '검색어' })).toHaveValue('겨울 바다');
  });

  it('인기 검색어를 누르면 그 검색어로 검색한다', async () => {
    const fetchMock = setup({ query: '가을', total: 0, blogs: pageOf([]), posts: pageOf([]) }, '/search?q=가을');
    fireEvent.click(await screen.findByRole('button', { name: /단풍/ }));
    await waitFor(() => expect(searchCalls(fetchMock)).toContain('/api/search?q=단풍&type=all&page=1'));
  });

  it('검색에 실패하면 오류를 보여 주고, 다시 시도하면 다시 검색한다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/search', status: 500, body: { error: { code: 'INTERNAL', message: '검색 서버가 바빠요' } } },
    ]);
    renderWithProviders(<SearchPage />, { path: '/search?q=가을' });
    expect(await screen.findByText('검색 서버가 바빠요')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(searchCalls(fetchMock)).toHaveLength(2));
  });
});
