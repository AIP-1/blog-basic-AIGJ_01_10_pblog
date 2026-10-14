import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithProviders } from '../test/utils';
import { TopicPage } from './TopicPage';

const blog = { id: 1, name: '생각 서랍', description: '떠오르는 대로', topic: { code: 'hobby', name: '취미' }, ownerNickname: '끄적이', postCount: 1200, lastPostAt: null };
const post = (id: number) => ({ id, title: `취미 글 ${id}`, excerpt: '', createdAt: '2026-10-01T10:00:00+09:00', blog: { id: 1, name: '생각 서랍' } });

function renderAt(path: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/topics/:code" element={<TopicPage />} />
    </Routes>,
    { path },
  );
}

describe('주제별 화면', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('주제 이름 · 설명 · 블로그 수 · 글 수와 블로그 카드, 글은 9개까지만 보여 준다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', status: 204 },
      {
        path: '/api/topics/hobby',
        body: {
          topic: { code: 'hobby', name: '취미', description: '좋아하는 것들' },
          blogCount: 1234,
          postCount: 12,
          blogs: [blog],
          posts: Array.from({ length: 12 }, (_, i) => post(i + 1)),
        },
      },
    ]);
    renderAt('/topics/hobby');
    expect(await screen.findByRole('heading', { level: 1, name: '취미' })).toBeInTheDocument();
    expect(screen.getByText('좋아하는 것들')).toBeInTheDocument();
    expect(screen.getByText('블로그 1,234개 · 글 12개')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '취미 블로그' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /생각 서랍.*글 1,200개/ })).toHaveAttribute('href', '/blogs/1');
    expect(screen.getByText('취미 글 9')).toBeInTheDocument();
    expect(screen.queryByText('취미 글 10')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u]) => u === '/api/topics/hobby')).toBe(true);
  });

  it('블로그와 글이 없으면 빈 안내를 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/topics/food', body: { topic: { code: 'food', name: '음식', description: '' }, blogCount: 0, postCount: 0, blogs: [], posts: [] } },
    ]);
    renderAt('/topics/food');
    expect(await screen.findByText('블로그가 없습니다')).toBeInTheDocument();
    expect(screen.getByText('글이 없습니다')).toBeInTheDocument();
  });

  it('없는 주제면 "존재하지 않는 주제입니다"를 보여 준다', async () => {
    mockFetch([{ path: '/api/auth/me', status: 204 }]);
    renderAt('/topics/nope');
    expect(await screen.findByText('존재하지 않는 주제입니다')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/');
  });

  it('서버 오류면 오류 문구와 다시 시도 버튼을 보여 주고, 누르면 다시 부른다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/topics/hobby', status: 500, body: { error: { code: 'INTERNAL', message: '잠시 문제가 생겼어요' } } },
    ]);
    renderAt('/topics/hobby');
    expect(await screen.findByText('잠시 문제가 생겼어요')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => u === '/api/topics/hobby')).toHaveLength(2));
  });
});
