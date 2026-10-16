import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithProviders } from '../test/utils';
import { NoticesPage } from './NoticesPage';

const notice = (id: number) => ({ id, title: `v1.${id} 바뀐 점`, excerpt: '', createdAt: '2026-10-01T10:00:00+09:00', blog: { id: 99, name: '사각 공지' } });

describe('공지사항 화면', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('제목 · 설명 · 글 수와 공지 목록을 보여 주고, 블로그 이름은 숨긴다', async () => {
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/notices', body: { items: [notice(1), notice(2)], page: 1, size: 10, totalItems: 2, totalPages: 1 } },
    ]);
    renderWithProviders(<NoticesPage />, { path: '/notices' });
    expect(screen.getByRole('heading', { name: '공지사항' })).toBeInTheDocument();
    expect(screen.getByText('서비스 소식과 버전별로 바뀐 점을 알려 드려요.')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'v1.1 바뀐 점' })).toHaveAttribute('href', '/posts/1');
    expect(screen.getByText('2개의 글')).toBeInTheDocument();
    expect(screen.queryByText('사각 공지')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '페이지' })).not.toBeInTheDocument();
  });

  it('공지가 없으면 빈 안내만 보여 주고 글 수는 숨긴다', async () => {
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/notices', body: { items: [], page: 1, size: 10, totalItems: 0, totalPages: 0 } },
    ]);
    renderWithProviders(<NoticesPage />, { path: '/notices' });
    expect(await screen.findByText('아직 공지사항이 없어요')).toBeInTheDocument();
    expect(screen.queryByText('0개의 글')).not.toBeInTheDocument();
  });

  it('페이지 번호를 누르면 그 페이지를 부른다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/notices', body: { items: [notice(1)], page: 1, size: 10, totalItems: 25, totalPages: 3 } },
    ]);
    renderWithProviders(<NoticesPage />, { path: '/notices' });
    await screen.findByText('v1.1 바뀐 점');
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => u === '/api/notices?page=3')).toBe(true));
  });

  it('불러오지 못하면 오류와 다시 시도 버튼을 보여 준다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/notices', status: 503, body: { error: { code: 'UNAVAILABLE', message: '점검 중이에요' } } },
    ]);
    renderWithProviders(<NoticesPage />, { path: '/notices' });
    expect(await screen.findByText('점검 중이에요')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => String(u).startsWith('/api/notices'))).toHaveLength(2));
  });
});
