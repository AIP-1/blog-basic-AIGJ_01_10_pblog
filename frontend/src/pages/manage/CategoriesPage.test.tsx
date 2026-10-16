import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, type MockRoute, renderWithProviders } from '../../test/utils';
import { CategoriesPage } from './CategoriesPage';
import { ManageLayout } from './ManageLayout';

const me = { member: { id: 3, nickname: '끄적이', email: 'd@b.com' }, blog: { id: 1, name: '생각 서랍' }, newCommentCount: 0 };
const cat = (id: number, name: string, postCount: number, isDefault = false) => ({
  id,
  name,
  description: '',
  visibility: 'PUBLIC',
  postCount,
  isDefault,
  colorIndex: id % 8,
  subscriberCount: 0,
  subscribedByMe: false,
});
const categories = [cat(1, '일상', 2, true), cat(4, '여행', 0), cat(5, '독서', 3)];

function setup(extra: MockRoute[] = []) {
  const fetchMock = mockFetch([
    ...extra,
    { path: '/api/auth/me', body: me },
    { path: '/api/blogs/1/categories', body: categories },
  ]);
  renderWithProviders(
    <Routes>
      <Route path="/manage" element={<ManageLayout />}>
        <Route path="categories" element={<CategoriesPage />} />
      </Route>
    </Routes>,
    { path: '/manage/categories' },
  );
  return fetchMock;
}

const sent = (fn: ReturnType<typeof mockFetch>, method: string, url: string) => {
  const call = fn.mock.calls.find(([u, i]) => u === url && i?.method === method);
  return call ? (JSON.parse(String(call[1]?.body ?? 'null')) as unknown) : undefined;
};
const err = (code: string, message = '', more: Record<string, unknown> = {}) => ({ error: { code, message, ...more } });

describe('다이어리 관리', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=t; path=/';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('다이어리 목록과 글 수, 기본 표시를 보여 주고 처음·끝의 위/아래 버튼은 막는다', async () => {
    setup();
    expect(await screen.findByText('독서')).toBeInTheDocument();
    expect(screen.getByText('기본')).toBeInTheDocument();
    expect(screen.getByText('글 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '일상 위로' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '독서 아래로' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '여행 위로' })).toBeEnabled();
    expect(screen.getAllByRole('button', { name: '삭제' })[0]).toBeDisabled();
  });

  it('새 다이어리: 빈 이름·긴 이름은 막고, 올바르면 추가하고 입력칸을 비운다', async () => {
    const fetchMock = setup([{ method: 'POST', path: '/api/blogs/1/categories', body: cat(9, '요리', 0) }]);
    await screen.findByText('독서');
    const input = screen.getByLabelText('새 다이어리 이름');
    fireEvent.click(screen.getByRole('button', { name: '추가' }));
    expect(await screen.findByText('다이어리 이름을 입력해 주세요')).toBeInTheDocument();
    expect(input).toHaveFocus();

    fireEvent.change(input, { target: { value: '가'.repeat(21) } });
    expect(screen.queryByText('다이어리 이름을 입력해 주세요')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '추가' }));
    expect(await screen.findByText('다이어리 이름은 20자 이하로 입력해 주세요')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '  요리 ' } });
    fireEvent.click(screen.getByRole('button', { name: '추가' }));
    await waitFor(() => expect(sent(fetchMock, 'POST', '/api/blogs/1/categories')).toEqual({ name: '요리' }));
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('같은 이름이 있으면 서버 오류를 입력칸 아래에 알린다', async () => {
    setup([{ method: 'POST', path: '/api/blogs/1/categories', status: 409, body: err('CATEGORY_NAME_TAKEN') }]);
    await screen.findByText('독서');
    fireEvent.change(screen.getByLabelText('새 다이어리 이름'), { target: { value: '여행' } });
    fireEvent.click(screen.getByRole('button', { name: '추가' }));
    expect(await screen.findByText('이미 있는 다이어리입니다')).toBeInTheDocument();
  });

  it('이름 변경: Enter로 저장하고, 서버가 필드 오류를 주면 보여 준다. Esc·취소는 편집을 닫는다', async () => {
    const fetchMock = setup([
      { method: 'PATCH', path: '/api/categories/4', status: 400, body: err('VALIDATION', '', { fields: { name: '쓸 수 없는 이름' } }) },
      { method: 'PATCH', path: '/api/categories/5', status: 204 },
    ]);
    await screen.findByText('독서');
    fireEvent.click(screen.getAllByRole('button', { name: '이름 변경' })[1]);
    let edit = screen.getByLabelText('다이어리 이름');
    expect(edit).toHaveValue('여행');
    fireEvent.change(edit, { target: { value: ' ' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('다이어리 이름을 입력해 주세요')).toBeInTheDocument();
    fireEvent.change(edit, { target: { value: '여행기' } });
    fireEvent.keyDown(edit, { key: 'Enter' });
    expect(await screen.findByText('쓸 수 없는 이름')).toBeInTheDocument();
    expect(sent(fetchMock, 'PATCH', '/api/categories/4')).toEqual({ name: '여행기' });
    fireEvent.keyDown(edit, { key: 'Escape' });
    expect(screen.queryByLabelText('다이어리 이름')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: '이름 변경' })[0]);
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.queryByLabelText('다이어리 이름')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: '이름 변경' })[2]);
    edit = screen.getByLabelText('다이어리 이름');
    fireEvent.change(edit, { target: { value: '책 읽기' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.queryByLabelText('다이어리 이름')).not.toBeInTheDocument());
    expect(sent(fetchMock, 'PATCH', '/api/categories/5')).toEqual({ name: '책 읽기' });
  });

  it('위/아래 버튼으로 순서를 옮기고, 실패하면 위쪽에 오류를 알린다', async () => {
    const fetchMock = setup([
      { method: 'POST', path: '/api/categories/4/move', status: 204 },
      { method: 'POST', path: '/api/categories/5/move', status: 500, body: err('INTERNAL', '옮기지 못했어요') },
    ]);
    await screen.findByText('독서');
    fireEvent.click(screen.getByRole('button', { name: '여행 아래로' }));
    await waitFor(() => expect(sent(fetchMock, 'POST', '/api/categories/4/move')).toEqual({ direction: 'down' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '독서 위로' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '독서 위로' }));
    expect(await screen.findByText('옮기지 못했어요')).toBeInTheDocument();
  });

  it('삭제: 글이 있으면 막고, 확인하면 지우며, 서버가 글이 있다고 하면 그 수를 알린다', async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);
    const fetchMock = setup([
      { method: 'DELETE', path: '/api/categories/4', status: 409, body: err('CATEGORY_HAS_POSTS', '', { postCount: 7 }) },
    ]);
    await screen.findByText('독서');
    const deletes = screen.getAllByRole('button', { name: '삭제' });
    fireEvent.click(deletes[2]);
    expect(await screen.findByText(/이 다이어리에 글이 3개 있어 삭제할 수 없습니다/)).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();

    fireEvent.click(deletes[1]);
    expect(confirm).toHaveBeenCalledWith('다이어리를 삭제할까요?');
    expect(await screen.findByText(/이 다이어리에 글이 7개 있어/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u, i]) => u === '/api/categories/4' && i?.method === 'DELETE')).toBe(true);
  });

  it('삭제를 취소하면 요청하지 않고, 성공하면 목록을 새로 받는다', async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    const fetchMock = setup([{ method: 'DELETE', path: '/api/categories/4', status: 204 }]);
    await screen.findByText('독서');
    fireEvent.click(screen.getAllByRole('button', { name: '삭제' })[1]);
    expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'DELETE')).toBe(false);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getAllByRole('button', { name: '삭제' })[1]);
    await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => u === '/api/blogs/1/categories').length).toBeGreaterThan(1));
  });

  it('목록을 못 받으면 오류를 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/blogs/1/categories', status: 500, body: err('INTERNAL', '다이어리 오류') },
    ]);
    renderWithProviders(
      <Routes>
        <Route path="/manage" element={<ManageLayout />}>
          <Route path="categories" element={<CategoriesPage />} />
        </Route>
      </Routes>,
      { path: '/manage/categories' },
    );
    expect(await screen.findByText('다이어리 오류')).toBeInTheDocument();
  });
});
