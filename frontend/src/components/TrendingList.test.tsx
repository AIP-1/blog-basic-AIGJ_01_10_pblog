import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithProviders } from '../test/utils';
import { TrendingList } from './TrendingList';

const trending = {
  updatedAt: '2026-10-14T05:30:00Z',
  items: [
    { rank: 1, keyword: '가을 여행', change: 'UP', delta: 2 },
    { rank: 2, keyword: '단풍', change: 'DOWN', delta: 1 },
    { rank: 3, keyword: '캠핑', change: 'NEW', delta: 0 },
    { rank: 4, keyword: '독서', change: 'SAME', delta: 0 },
  ],
};

describe('실시간 인기 검색어', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('순위 · 검색어 · 순위 변화를 보여 주고, 검색어를 누르면 onSelect로 넘긴다', async () => {
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/search/trending', body: trending },
    ]);
    const onSelect = vi.fn();
    renderWithProviders(<TrendingList onSelect={onSelect} className="box" />);
    const region = screen.getByRole('region', { name: '실시간 인기 검색어' });
    expect(region).toHaveClass('trend', 'box');
    expect(screen.getByText('불러오는 중…')).toBeInTheDocument();
    expect(await screen.findByText('가을 여행')).toBeInTheDocument();
    expect(screen.getByLabelText('2칸 올라감')).toHaveTextContent('▲2');
    expect(screen.getByLabelText('1칸 내려감')).toHaveTextContent('▼1');
    expect(screen.getByText('NEW')).toBeInTheDocument();
    expect(screen.getByLabelText('변화 없음')).toBeInTheDocument();
    expect(screen.getByText(/기준$/)).toBeInTheDocument();
    expect(screen.getByText('1')).toHaveClass('is-top');
    expect(screen.getByText('4')).not.toHaveClass('is-top');
    fireEvent.click(screen.getByRole('button', { name: /단풍/ }));
    expect(onSelect).toHaveBeenCalledWith('단풍');
  });

  it('제목을 바꿀 수 있고, 검색어가 없으면 안내를 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/search/trending', body: { updatedAt: null, items: [] } },
    ]);
    renderWithProviders(<TrendingList onSelect={vi.fn()} title="인기 검색어" />);
    expect(screen.getByRole('heading', { name: '인기 검색어' })).toBeInTheDocument();
    expect(await screen.findByText('아직 인기 검색어가 없습니다')).toBeInTheDocument();
    expect(screen.queryByText(/기준$/)).not.toBeInTheDocument();
  });

  it('불러오지 못하면 오류 안내를 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/search/trending', status: 500, body: { error: { code: 'INTERNAL', message: 'x' } } },
    ]);
    renderWithProviders(<TrendingList onSelect={vi.fn()} />);
    expect(await screen.findByText('순위를 불러오지 못했습니다')).toBeInTheDocument();
  });

  it('순위가 바뀌어 다시 받으면 새 순서로 그리고, 자리가 바뀐 항목은 움직인다', async () => {
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/search/trending', body: trending },
    ]);
    const animate = vi.fn();
    const top = vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) {
      const li = this.closest('li');
      return li?.parentElement ? Array.from(li.parentElement.children).indexOf(li) * 30 : 0;
    });
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
    try {
      const { queryClient } = renderWithProviders(<TrendingList onSelect={vi.fn()} />);
      await screen.findByText('가을 여행');
      act(() => {
        queryClient.setQueryData(['trending'], { ...trending, items: [trending.items[1], trending.items[0], ...trending.items.slice(2)] });
      });
      await waitFor(() => expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('단풍'));
      expect(animate).toHaveBeenCalledTimes(2);
      expect(animate.mock.calls[0][0]).toEqual([{ transform: 'translateY(30px)' }, { transform: 'translateY(0)' }]);
    } finally {
      top.mockRestore();
      delete (HTMLElement.prototype as { animate?: unknown }).animate;
    }
  });
});
