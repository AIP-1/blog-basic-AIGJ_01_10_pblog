import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithProviders } from '../../test/utils';
import { DashboardPage } from './DashboardPage';
import { ManageLayout } from './ManageLayout';

const me = { member: { id: 3, nickname: '끄적이', email: 'd@b.com' }, blog: { id: 1, name: '생각 서랍' }, newCommentCount: 0 };

const dashboard = {
  views: { today: 1234, yesterday: 50, total: 98765 },
  visitors: { today: 12, yesterday: 9, total: 400 },
  newCommentCount: 3,
  daily: [
    { date: '2026-10-12', views: 10, visitors: 4 },
    { date: '2026-10-13', views: 20, visitors: 6 },
  ],
  popularPosts: [
    { id: 11, title: '가을 산책', viewCount: 1500 },
    { id: 12, title: '커피 기록', viewCount: 300 },
  ],
  recentPosts: [{ id: 13, title: '비밀 메모', createdAt: '2026-10-10T10:00:00+09:00', visibility: 'PRIVATE' }],
};

function renderDashboard() {
  return renderWithProviders(
    <Routes>
      <Route path="/manage" element={<ManageLayout />}>
        <Route index element={<DashboardPage />} />
      </Route>
    </Routes>,
    { path: '/manage' },
  );
}

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('관리 대시보드', () => {
  beforeEach(() => vi.stubGlobal('ResizeObserver', RO));
  afterEach(() => vi.unstubAllGlobals());

  it('오늘·어제·누적 수치, 새 댓글, 인기 글과 최근 글을 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/manage/dashboard', body: dashboard },
    ]);
    const { container } = renderDashboard();
    expect(await screen.findByRole('heading', { name: '대시보드' })).toBeInTheDocument();
    expect(screen.getByText('오늘 조회수')).toBeInTheDocument();
    expect(screen.getByText((1234).toLocaleString())).toBeInTheDocument();
    expect(screen.getByText(`어제 50 · 누적 ${(98765).toLocaleString()}`)).toBeInTheDocument();
    expect(screen.getByText('어제 9 · 누적 400')).toBeInTheDocument();
    expect(container.querySelector('.stat-card--hot')).not.toBeNull();
    expect(screen.getByRole('link', { name: '댓글 보기 →' })).toHaveAttribute('href', '/manage/comments');
    expect(screen.getByRole('link', { name: '통계 더 보기' })).toHaveAttribute('href', '/manage/stats');
    expect(screen.getByRole('link', { name: '가을 산책' })).toHaveAttribute('href', '/posts/11');
    expect(screen.getByText(`${(1500).toLocaleString()}회`)).toBeInTheDocument();
    const recent = screen.getByRole('link', { name: /비밀 메모/ });
    expect(recent).toHaveAttribute('href', '/posts/13');
    expect(recent).toHaveTextContent('비공개');
    expect(screen.getByText('2026.10.10')).toBeInTheDocument();
    expect(container.querySelector('.chart')).not.toBeNull();
    expect(screen.queryByText('아직 기록이 없습니다')).not.toBeInTheDocument();
  });

  it('기록과 글이 없으면 빈 안내를 보여 주고 새 댓글 카드를 강조하지 않는다', async () => {
    mockFetch([
      { path: '/api/auth/me', body: me },
      {
        path: '/api/manage/dashboard',
        body: { ...dashboard, views: null, newCommentCount: 0, daily: [], popularPosts: [], recentPosts: [] },
      },
    ]);
    const { container } = renderDashboard();
    expect(await screen.findByText('아직 기록이 없습니다')).toBeInTheDocument();
    expect(screen.getAllByText('아직 쓴 글이 없습니다')).toHaveLength(2);
    expect(screen.getByText('어제 0 · 누적 0')).toBeInTheDocument();
    expect(container.querySelector('.stat-card--hot')).toBeNull();
    expect(container.querySelector('.chart')).toBeNull();
  });

  it('불러오지 못하면 오류와 다시 시도 버튼을 보여 주고, 누르면 다시 요청한다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/manage/dashboard', status: 500, body: { error: { code: 'INTERNAL', message: '서버 오류가 났어요' } } },
    ]);
    renderDashboard();
    expect(await screen.findByText('서버 오류가 났어요')).toBeInTheDocument();
    const count = () => fetchMock.mock.calls.filter(([u]) => u === '/api/manage/dashboard').length;
    const before = count();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(count()).toBe(before + 1));
  });
});
