import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithProviders, type MockRoute } from '../test/utils';
import { BookmarksPage } from './BookmarksPage';

const ME = { member: { id: 3, nickname: '끄적이', email: 'd@b.com' }, blog: { id: 9, name: '내 서랍' }, newCommentCount: 0 };
const folders = { total: 3, none: 1, folders: [{ id: 5, name: '여행', createdAt: '2026-09-01T00:00:00Z', count: 2 }] };
const saved = (id: number, folderId: number | null) => ({
  id,
  title: `저장한 글 ${id}`,
  excerpt: '',
  createdAt: '2026-10-01T10:00:00+09:00',
  blog: { id: 1, name: '생각 서랍' },
  savedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  folderId,
});
const pageOf = (items: unknown[], totalPages = 1, page = 1) => ({ items, page, size: 10, totalItems: items.length, totalPages });

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname + loc.search}</p>;
}

function setup(routes: MockRoute[], path = '/bookmarks') {
  const fetchMock = mockFetch([
    { path: '/api/auth/me', body: ME },
    { path: '/api/csrf', body: {} },
    { path: '/api/me/bookmark-folders', body: folders },
    ...routes,
  ]);
  renderWithProviders(
    <>
      <BookmarksPage />
      <Where />
    </>,
    { path },
  );
  return fetchMock;
}
const call = (f: ReturnType<typeof mockFetch>, method: string, url: string) =>
  f.mock.calls.find(([u, i]) => u === url && (i?.method ?? 'GET') === method);

describe('내 책갈피', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=t; path=/';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('폴더 탭(전체 · 미분류 · 폴더별 개수)과 저장한 글, 저장 시각을 보여 준다', async () => {
    const fetchMock = setup([{ path: '/api/me/bookmarks', body: pageOf([saved(11, null), saved(12, 5)]) }]);
    expect(await screen.findByText('저장한 글 11')).toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: '폴더' });
    expect(within(tabs).getByRole('link', { name: '전체 3' })).toHaveClass('is-on');
    expect(within(tabs).getByRole('link', { name: '미분류 1' })).toHaveAttribute('href', '/bookmarks?folder=none');
    expect(within(tabs).getByRole('link', { name: '여행 2' })).toHaveAttribute('href', '/bookmarks?folder=5');
    expect(screen.getAllByText('3시간 전에 저장')).toHaveLength(2);
    const selects = screen.getAllByRole('combobox', { name: '폴더 옮기기' });
    expect(selects[0]).toHaveValue('');
    expect(selects[1]).toHaveValue('5');
    expect(screen.queryByRole('button', { name: '이름 바꾸기' })).not.toBeInTheDocument();
    expect(call(fetchMock, 'GET', '/api/me/bookmarks?folder=all&page=1')).toBeDefined();
  });

  it('비어 있으면 안내를 보여 주고, 폴더를 고른 상태면 폴더 빈 안내를 보여 준다', async () => {
    setup([{ path: '/api/me/bookmarks', body: pageOf([]) }], '/bookmarks?folder=none');
    expect(await screen.findByText('이 폴더에는 아직 글이 없어요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '미분류 1' })).toHaveClass('is-on');
  });

  it('전체 폴더가 비어 있으면 "아직 책갈피한 글이 없어요", 없는 폴더를 가리키면 전체로 본다', async () => {
    const fetchMock = setup([{ path: '/api/me/bookmarks', body: pageOf([]) }], '/bookmarks?folder=777');
    expect(await screen.findByText('아직 책갈피한 글이 없어요')).toBeInTheDocument();
    expect(call(fetchMock, 'GET', '/api/me/bookmarks?folder=all&page=1')).toBeDefined();
  });

  it('줄마다 폴더를 옮기거나 책갈피를 뺄 수 있다', async () => {
    const fetchMock = setup([
      { path: '/api/me/bookmarks', body: pageOf([saved(11, null)]) },
      { method: 'PUT', path: '/api/posts/11/bookmark', body: { folderId: 5 } },
      { method: 'DELETE', path: '/api/posts/11/bookmark', status: 204 },
    ]);
    fireEvent.change(await screen.findByRole('combobox', { name: '폴더 옮기기' }), { target: { value: '5' } });
    await waitFor(() => expect(call(fetchMock, 'PUT', '/api/posts/11/bookmark')).toBeDefined());
    expect(JSON.parse(String(call(fetchMock, 'PUT', '/api/posts/11/bookmark')?.[1]?.body))).toEqual({ folderId: 5 });
    fireEvent.click(screen.getByRole('button', { name: '‘저장한 글 11’ 책갈피 빼기' }));
    await waitFor(() => expect(call(fetchMock, 'DELETE', '/api/posts/11/bookmark')).toBeDefined());
  });

  it('옮기기에 실패하면 오류 문구를 보여 준다', async () => {
    setup([
      { path: '/api/me/bookmarks', body: pageOf([saved(11, 5)]) },
      { method: 'PUT', path: '/api/posts/11/bookmark', status: 400, body: { error: { code: 'BAD', message: '옮기지 못했어요' } } },
    ]);
    fireEvent.change(await screen.findByRole('combobox', { name: '폴더 옮기기' }), { target: { value: '' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('옮기지 못했어요');
  });

  it('새 폴더를 만들면 그 폴더로 이동하고, 취소하면 창이 닫힌다', async () => {
    const fetchMock = setup([
      { path: '/api/me/bookmarks', body: pageOf([]) },
      { method: 'POST', path: '/api/me/bookmark-folders', body: { id: 8, name: '레시피', createdAt: '2026-10-14T00:00:00Z', count: 0 } },
    ]);
    fireEvent.click(await screen.findByRole('button', { name: '+ 새 폴더' }));
    let dialog = screen.getByRole('dialog', { name: '새 폴더' });
    fireEvent.click(within(dialog).getByRole('button', { name: '취소' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+ 새 폴더' }));
    dialog = screen.getByRole('dialog', { name: '새 폴더' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: '폴더 이름' }), { target: { value: '레시피' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/bookmarks?folder=8'));
    expect(JSON.parse(String(call(fetchMock, 'POST', '/api/me/bookmark-folders')?.[1]?.body))).toEqual({ name: '레시피' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('새 폴더 만들기에 실패하면 창 안에 오류를 보여 준다', async () => {
    setup([
      { path: '/api/me/bookmarks', body: pageOf([]) },
      { method: 'POST', path: '/api/me/bookmark-folders', status: 409, body: { error: { code: 'DUP', message: '같은 이름의 폴더가 있어요' } } },
    ]);
    fireEvent.click(await screen.findByRole('button', { name: '+ 새 폴더' }));
    const dialog = screen.getByRole('dialog', { name: '새 폴더' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: '폴더 이름' }), { target: { value: '여행' } });
    fireEvent.submit(within(dialog).getByRole('textbox', { name: '폴더 이름' }).closest('form') as HTMLFormElement);
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('같은 이름의 폴더가 있어요');
    expect(within(dialog).getByRole('button', { name: '저장' })).not.toBeDisabled();
  });

  it('고른 폴더의 이름을 바꾼다', async () => {
    const fetchMock = setup(
      [
        { path: '/api/me/bookmarks', body: pageOf([saved(12, 5)]) },
        { method: 'PATCH', path: '/api/me/bookmark-folders/5', status: 204 },
      ],
      '/bookmarks?folder=5',
    );
    fireEvent.click(await screen.findByRole('button', { name: '이름 바꾸기' }));
    const dialog = screen.getByRole('dialog', { name: '폴더 이름 바꾸기' });
    const input = within(dialog).getByRole('textbox', { name: '폴더 이름' });
    expect(input).toHaveValue('여행');
    fireEvent.change(input, { target: { value: '여행 2026' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(JSON.parse(String(call(fetchMock, 'PATCH', '/api/me/bookmark-folders/5')?.[1]?.body))).toEqual({ name: '여행 2026' });
  });

  it('고른 폴더를 한 번 더 묻고 지운 뒤 전체로 돌아간다', async () => {
    const fetchMock = setup(
      [
        { path: '/api/me/bookmarks', body: pageOf([saved(12, 5)]) },
        { method: 'DELETE', path: '/api/me/bookmark-folders/5', status: 204 },
      ],
      '/bookmarks?folder=5',
    );
    fireEvent.click(await screen.findByRole('button', { name: '폴더 삭제' }));
    const dialog = screen.getByRole('dialog', { name: '‘여행’ 폴더를 지울까요?' });
    expect(within(dialog).getByText('안에 있는 글 2개는 미분류로 옮겨져요. 글이 지워지지는 않아요.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '폴더 삭제' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/bookmarks$/));
    expect(call(fetchMock, 'DELETE', '/api/me/bookmark-folders/5')).toBeDefined();
  });

  it('폴더 삭제에 실패하면 창 안에 오류를 보여 주고, 취소로 닫는다', async () => {
    setup(
      [
        { path: '/api/me/bookmarks', body: pageOf([]) },
        { method: 'DELETE', path: '/api/me/bookmark-folders/5', status: 500, body: { error: { code: 'X', message: '지우지 못했어요' } } },
      ],
      '/bookmarks?folder=5',
    );
    fireEvent.click(await screen.findByRole('button', { name: '폴더 삭제' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '폴더 삭제' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('지우지 못했어요');
    fireEvent.click(within(dialog).getByRole('button', { name: '취소' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('여러 페이지면 페이지를 넘기고, 1페이지로 오면 page를 뺀다', async () => {
    const fetchMock = setup(
      [
        { path: /^\/api\/me\/bookmarks\?.*page=2/, body: pageOf([saved(13, null)], 2, 2) },
        { path: '/api/me/bookmarks', body: pageOf([saved(11, null)], 2) },
      ],
      '/bookmarks?folder=none',
    );
    await screen.findByText('저장한 글 11');
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/bookmarks?folder=none&page=2'));
    expect(call(fetchMock, 'GET', '/api/me/bookmarks?folder=none&page=2')).toBeDefined();
    expect(await screen.findByText('저장한 글 13')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/bookmarks\?folder=none$/));
  });

  it('폴더나 목록을 불러오지 못하면 오류와 다시 시도 버튼을 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', body: ME },
      { path: '/api/me/bookmark-folders', status: 500, body: { error: { code: 'X', message: '폴더 오류' } } },
    ]);
    renderWithProviders(<BookmarksPage />, { path: '/bookmarks' });
    expect(await screen.findByText('폴더 오류')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('목록만 실패하면 폴더 탭은 두고 목록 자리에 오류를 보여 준다', async () => {
    const fetchMock = setup([{ path: '/api/me/bookmarks', status: 500, body: { error: { code: 'X', message: '목록 오류' } } }]);
    expect(await screen.findByText('목록 오류')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '폴더' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => String(u).startsWith('/api/me/bookmarks?'))).toHaveLength(2));
  });
});
