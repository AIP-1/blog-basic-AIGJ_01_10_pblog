import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithProviders } from '../test/utils';
import { TagPostsPage } from './TagPostsPage';

const post = (id: number) => ({ id, title: `여행 글 ${id}`, excerpt: '바다 이야기', createdAt: '2026-10-01T10:00:00+09:00', blog: { id: 2, name: '떠돌이' } });
const TAG_PATH = /^\/api\/tags\/%EC%97%AC%ED%96%89\/posts/;

function renderAt(path: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/tags/:name" element={<TagPostsPage />} />
    </Routes>,
    { path },
  );
}

describe('태그별 글 목록', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('#태그 제목과 글 수, 글 목록을 보여 주고, 다음 페이지를 누르면 page=2로 다시 부른다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: TAG_PATH, body: { items: [post(1), post(2)], page: 1, size: 10, totalItems: 1500, totalPages: 3 } },
    ]);
    renderAt('/tags/여행');
    expect(screen.getByRole('heading', { name: '#여행' })).toBeInTheDocument();
    expect(await screen.findByText('여행 글 1')).toBeInTheDocument();
    expect(screen.getByText('1,500개의 글')).toBeInTheDocument();
    expect(screen.getAllByText('바다 이야기')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => TAG_PATH.test(String(u)) && String(u).includes('page=2'))).toBe(true));
  });

  it('글이 없으면 "글이 없습니다"를 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: TAG_PATH, body: { items: [], page: 1, size: 10, totalItems: 0, totalPages: 0 } },
    ]);
    renderAt('/tags/여행');
    expect(await screen.findByText('글이 없습니다')).toBeInTheDocument();
    expect(screen.getByText('0개의 글')).toBeInTheDocument();
  });

  it('주소의 page를 읽어 그 페이지를 부르고, 1페이지로 돌아가면 page를 뺀다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: TAG_PATH, body: { items: [post(3)], page: 2, size: 10, totalItems: 11, totalPages: 2 } },
    ]);
    renderAt('/tags/여행?page=2');
    expect(await screen.findByText('여행 글 3')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('page=2'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '이전 페이지' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => TAG_PATH.test(String(u)) && String(u).includes('page=1'))).toBe(true));
  });

  it('불러오지 못하면 오류 문구를 보여 주고, 다시 시도하면 다시 부른다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: TAG_PATH, status: 500, body: { error: { code: 'INTERNAL', message: '목록을 못 읽었어요' } } },
    ]);
    renderAt('/tags/여행');
    expect(await screen.findByRole('alert')).toHaveTextContent('목록을 못 읽었어요');
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => TAG_PATH.test(String(u)))).toHaveLength(2));
  });
});
