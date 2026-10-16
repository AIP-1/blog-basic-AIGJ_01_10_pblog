import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithProviders } from '../../test/utils';
import { ManageLayout } from './ManageLayout';
import { StatsPage } from './StatsPage';

const me = { member: { id: 3, nickname: '끄적이', email: 'd@b.com' }, blog: { id: 1, name: '생각 서랍' }, newCommentCount: 0 };

const daily30 = [
  { date: '2026-10-12', views: 1000, visitors: 40, comments: 3 },
  { date: '2026-10-13', views: 500, visitors: 10, comments: 2 },
];
const daily7 = [{ date: '2026-10-13', views: 7, visitors: 5, comments: 1 }];

function renderStats() {
  return renderWithProviders(
    <Routes>
      <Route path="/manage" element={<ManageLayout />}>
        <Route path="stats" element={<StatsPage />} />
      </Route>
    </Routes>,
    { path: '/manage/stats' },
  );
}

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function statValue(label: string) {
  return screen.getByText(label).nextElementSibling?.textContent;
}

describe('통계', () => {
  beforeEach(() => vi.stubGlobal('ResizeObserver', RO));
  afterEach(() => vi.unstubAllGlobals());

  it('처음에는 30일 합계와 두 그래프를 보여 주고, 7일을 누르면 7일 통계를 받아 합계를 바꾼다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', body: me },
      { path: /\/api\/manage\/stats\?days=30$/, body: { daily: daily30 } },
      { path: /\/api\/manage\/stats\?days=7$/, body: { daily: daily7 } },
    ]);
    const { container } = renderStats();
    expect(await screen.findByText('조회수 합계')).toBeInTheDocument();
    expect(statValue('조회수 합계')).toBe((1500).toLocaleString());
    expect(statValue('방문자 합계')).toBe('50');
    expect(statValue('댓글 합계')).toBe('5');
    expect(screen.getByRole('button', { name: '30일' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: '일별 조회수 · 방문자' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '일별 댓글 수' })).toBeInTheDocument();
    expect(container.querySelectorAll('.chart')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: '7일' }));
    expect(screen.getByRole('button', { name: '7일' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(statValue('조회수 합계')).toBe('7'));
    expect(statValue('댓글 합계')).toBe('1');
    expect(fetchMock.mock.calls.some(([u]) => u === '/api/manage/stats?days=7')).toBe(true);
  });

  it('기록이 없으면 빈 안내를 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', body: me },
      { path: /\/api\/manage\/stats/, body: { daily: [] } },
    ]);
    renderStats();
    expect(await screen.findByText('아직 기록이 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('조회수 합계')).not.toBeInTheDocument();
  });

  it('불러오지 못하면 오류를 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', body: me },
      { path: /\/api\/manage\/stats/, status: 500, body: { error: { code: 'INTERNAL', message: '통계를 못 불러왔어요' } } },
    ]);
    renderStats();
    expect(await screen.findByText('통계를 못 불러왔어요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });
});
