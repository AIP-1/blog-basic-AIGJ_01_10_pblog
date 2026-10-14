import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shopKeys } from '../api/shop';
import { mockFetch, type MockRoute, renderWithProviders } from '../test/utils';
import { InkWatcher } from './InkWatcher';

const base = {
  balance: 40,
  checkedInToday: true,
  streak: 2,
  earn: { checkin: 10, post: 20, postDailyMax: 3, postsToday: 0, comment: 2, commentDailyMax: 10, commentsToday: 0 },
  history: [{ id: 5, amount: 10, reason: 'CHECKIN', label: null, createdAt: '2026-10-13T09:00:00+09:00' }],
};

function setup(wallet: unknown, extra: MockRoute[] = []) {
  const fetchMock = mockFetch([...extra, { path: '/api/auth/me', status: 204 }, { path: '/api/me/ink', body: wallet }]);
  const view = renderWithProviders(<InkWatcher />);
  return { fetchMock, ...view };
}

const posts = (fn: ReturnType<typeof mockFetch>) => fn.mock.calls.filter(([u, i]) => u === '/api/shop/checkin' && i?.method === 'POST');
const inkCalls = (fn: ReturnType<typeof mockFetch>) => fn.mock.calls.filter(([u]) => u === '/api/me/ink');

describe('잉크 지켜보기', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=t; path=/';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('오늘 출석하지 않았으면 한 번 출석하고 잔액을 새로 받는다', async () => {
    const { fetchMock } = setup({ ...base, checkedInToday: false }, [
      { method: 'POST', path: '/api/shop/checkin', body: { earned: 10, balance: 50, streak: 3 } },
    ]);
    await waitFor(() => expect(posts(fetchMock)).toHaveLength(1));
    await waitFor(() => expect(inkCalls(fetchMock).length).toBe(2));
    // 같은 날에는 다시 출석하지 않는다
    expect(posts(fetchMock)).toHaveLength(1);
  });

  it('출석에 실패해도 조용히 넘어간다', async () => {
    const { fetchMock } = setup({ ...base, checkedInToday: false }, [
      { method: 'POST', path: '/api/shop/checkin', status: 500, body: { error: { code: 'X', message: '실패' } } },
    ]);
    await waitFor(() => expect(posts(fetchMock)).toHaveLength(1));
    expect(screen.queryByText('실패')).not.toBeInTheDocument();
  });

  it('이미 출석했으면 출석하지 않고, 처음 본 내역은 알리지 않는다. 새로 쌓인 적립만 알린다', async () => {
    const { fetchMock, queryClient } = setup(base);
    await waitFor(() => expect(inkCalls(fetchMock)).toHaveLength(1));
    // 첫 응답이 화면에 반영(처음 본 내역 기억)될 때까지 기다린 뒤 다음 응답으로 바꾼다
    await waitFor(() => expect(queryClient.getQueryData(shopKeys.ink)).toBeDefined());
    await act(async () => {
      await Promise.resolve();
    });
    expect(posts(fetchMock)).toHaveLength(0);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    mockFetch([
      { path: '/api/auth/me', status: 204 },
      {
        path: '/api/me/ink',
        body: {
          ...base,
          history: [
            { id: 8, amount: -30, reason: 'PURCHASE', label: '카페 팩', createdAt: '2026-10-13T12:00:00+09:00' },
            { id: 7, amount: 2, reason: 'COMMENT', label: null, createdAt: '2026-10-13T11:00:00+09:00' },
            { id: 6, amount: 20, reason: 'POST', label: null, createdAt: '2026-10-13T10:00:00+09:00' },
            ...base.history,
          ],
        },
      },
    ]);
    await act(() => queryClient.invalidateQueries({ queryKey: shopKeys.ink }));
    expect(await screen.findByText('글쓰기 잉크 +20')).toBeInTheDocument();
    expect(screen.getByText('댓글 잉크 +2')).toBeInTheDocument();
    expect(screen.queryByText(/스티커 팩 잉크/)).not.toBeInTheDocument();
    // 오래된 것부터 차례로 알린다
    const toasts = screen.getAllByRole('status').map((t) => t.textContent);
    expect(toasts).toEqual(['글쓰기 잉크 +20', '댓글 잉크 +2']);
  });
});
