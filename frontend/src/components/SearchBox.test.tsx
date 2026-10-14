import { fireEvent, screen } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithProviders } from '../test/utils';
import { SearchBox } from './SearchBox';

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname + loc.search}</p>;
}

function renderBox(initialQuery?: string) {
  mockFetch([
    { path: '/api/auth/me', status: 204 },
    { path: '/api/search/trending', body: { updatedAt: '2026-10-14T05:30:00Z', items: [{ rank: 1, keyword: '가을 여행', change: 'NEW', delta: 0 }] } },
  ]);
  return renderWithProviders(
    <>
      <button type="button">바깥</button>
      <SearchBox initialQuery={initialQuery} />
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </>,
  );
}

describe('검색창', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('누르면 인기 검색어 상자가 펼쳐지고, Esc 나 바깥을 누르면 닫힌다', async () => {
    renderBox();
    const input = screen.getByRole('searchbox', { name: '검색어' });
    expect(screen.queryByRole('region', { name: '실시간 인기 검색어' })).not.toBeInTheDocument();
    fireEvent.focus(input);
    expect(await screen.findByText('가을 여행')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: '실시간 인기 검색어' })).not.toBeInTheDocument();
    fireEvent.focus(input);
    expect(screen.getByRole('region', { name: '실시간 인기 검색어' })).toBeInTheDocument();
    fireEvent.mouseDown(input);
    expect(screen.getByRole('region', { name: '실시간 인기 검색어' })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('button', { name: '바깥' }));
    expect(screen.queryByRole('region', { name: '실시간 인기 검색어' })).not.toBeInTheDocument();
  });

  it('빈 검색어 · 너무 짧은 검색어는 안내를 보여 주고 이동하지 않으며, 다시 쓰면 안내가 사라진다', () => {
    renderBox();
    const input = screen.getByRole('searchbox', { name: '검색어' });
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    expect(screen.getByRole('alert')).toHaveTextContent('검색어를 입력해 주세요');
    fireEvent.change(input, { target: { value: '가' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.submit(screen.getByRole('search'));
    expect(screen.getByRole('alert')).toHaveTextContent('검색어를 2자 이상 입력해 주세요');
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/$/);
  });

  it('올바른 검색어는 앞뒤 공백을 빼고 검색 화면으로 이동한다', () => {
    renderBox('  가을 산책 ');
    expect(screen.getByRole('searchbox', { name: '검색어' })).toHaveValue('  가을 산책 ');
    fireEvent.submit(screen.getByRole('search'));
    expect(screen.getByTestId('where')).toHaveTextContent(`/search?q=${encodeURIComponent('가을 산책')}&type=all`);
    expect(screen.getByRole('searchbox', { name: '검색어' })).toHaveValue('가을 산책');
  });

  it('인기 검색어를 누르면 그 검색어로 검색하고 상자를 닫는다', async () => {
    renderBox();
    fireEvent.focus(screen.getByRole('searchbox', { name: '검색어' }));
    fireEvent.click(await screen.findByRole('button', { name: /가을 여행/ }));
    expect(screen.getByTestId('where')).toHaveTextContent(`/search?q=${encodeURIComponent('가을 여행')}&type=all`);
    expect(screen.getByRole('searchbox', { name: '검색어' })).toHaveValue('가을 여행');
    expect(screen.queryByRole('region', { name: '실시간 인기 검색어' })).not.toBeInTheDocument();
  });
});
