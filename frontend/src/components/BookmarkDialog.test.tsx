import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { qk } from '../api/queries';
import type { PostDetail } from '../api/types';
import { mockFetch, renderWithProviders } from '../test/utils';
import { BookmarkDialog } from './BookmarkDialog';

const post: PostDetail = {
  id: 7,
  blog: { id: 1, name: '떠나는 고양이' },
  topic: { code: 'travel', name: '여행' },
  category: { id: 2, name: '국내여행' },
  title: '단풍 명소',
  body: '본문',
  createdAt: '2026-10-01T10:00:00+09:00',
  contentUpdatedAt: null,
  visibility: 'PUBLIC',
  coverImageUrl: null,
  tags: [],
  likeCount: 0,
  likedByMe: false,
  bookmarkedByMe: false,
  bookmark: null,
  commentCount: 0,
  prev: null,
  next: null,
  otherPosts: [],
  isAuthor: false,
};
const folders = {
  total: 3,
  none: 1,
  folders: [
    { id: 11, name: '가을 여행', createdAt: '2026-09-01T10:00:00+09:00', count: 2 },
    { id: 12, name: '맛집', createdAt: '2026-09-02T10:00:00+09:00', count: 0 },
  ],
};
const bodyOf = (fetchMock: ReturnType<typeof mockFetch>, url: string, method: string) => {
  const call = fetchMock.mock.calls.find(([u, init]) => u === url && init?.method === method);
  return call ? (JSON.parse(String(call[1]?.body)) as unknown) : undefined;
};

describe('책갈피 창', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=t; path=/';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('처음 꽂는 글: 폴더 목록을 보여 주고, 고른 폴더로 저장한 뒤 캐시를 바꾸고 닫는다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/me/bookmark-folders', body: folders },
      { method: 'PUT', path: '/api/posts/7/bookmark', body: { folderId: 11, folderName: '가을 여행' } },
    ]);
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(<BookmarkDialog post={post} onClose={onClose} />);
    queryClient.setQueryData(qk.post(7), post);
    expect(screen.getByRole('dialog', { name: '어디에 저장할까요?' })).toBeInTheDocument();
    expect(screen.getByText('‘단풍 명소’')).toBeInTheDocument();
    expect(screen.getByLabelText('미분류')).toBeChecked();
    expect(screen.queryByRole('button', { name: '책갈피 빼기' })).toBeNull();

    await user.click(await screen.findByLabelText(/가을 여행/));
    await user.click(screen.getByRole('button', { name: '책갈피' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bodyOf(fetchMock, '/api/posts/7/bookmark', 'PUT')).toEqual({ folderId: 11 });
    expect(queryClient.getQueryData<PostDetail>(qk.post(7))).toMatchObject({
      bookmarkedByMe: true,
      bookmark: { folderId: 11, folderName: '가을 여행' },
    });
  });

  it('새 폴더를 Enter 로 만들면 목록에 붙고 그 폴더가 골라진다', async () => {
    // 서버처럼: 폴더를 만든 뒤 다시 불러오면 새 폴더가 들어 있다
    const created = { id: 13, name: '읽을 거리', createdAt: '2026-10-01T10:00:00+09:00', count: 0 };
    let made = false;
    const fetchMock = mockFetch([
      { path: '/api/auth/me', status: 204 },
      {
        path: '/api/me/bookmark-folders',
        get body() {
          return made ? { ...folders, folders: [...folders.folders, created] } : folders;
        },
      },
      {
        method: 'POST',
        path: '/api/me/bookmark-folders',
        status: 201,
        get body() {
          made = true;
          return created;
        },
      },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<BookmarkDialog post={post} onClose={vi.fn()} />);
    await screen.findByLabelText(/맛집/);
    const input = screen.getByLabelText('새 폴더 이름');
    await user.type(input, '읽을 거리{Enter}');
    expect(await screen.findByLabelText(/읽을 거리/)).toBeChecked();
    expect(input).toHaveValue('');
    expect(bodyOf(fetchMock, '/api/me/bookmark-folders', 'POST')).toEqual({ name: '읽을 거리' });
  });

  it('폴더를 만들다 실패하면 오류 문구를 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/me/bookmark-folders', body: folders },
      { method: 'POST', path: '/api/me/bookmark-folders', status: 409, body: { error: { code: 'FOLDER_NAME_TAKEN', message: '이미 있는 폴더입니다' } } },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<BookmarkDialog post={post} onClose={vi.fn()} />);
    await user.type(screen.getByLabelText('새 폴더 이름'), '맛집');
    await user.click(screen.getByRole('button', { name: '+ 폴더' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('이미 있는 폴더입니다');
  });

  it('이미 꽂은 글: 제목이 바뀌고, 옮기기와 책갈피 빼기를 할 수 있다', async () => {
    const saved = { ...post, bookmarkedByMe: true, bookmark: { folderId: 12, folderName: '맛집' } };
    const fetchMock = mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/me/bookmark-folders', body: folders },
      { method: 'DELETE', path: '/api/posts/7/bookmark', status: 204 },
    ]);
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(<BookmarkDialog post={saved} onClose={onClose} />);
    queryClient.setQueryData(qk.post(7), saved);
    expect(screen.getByRole('dialog', { name: '책갈피' })).toBeInTheDocument();
    expect(await screen.findByLabelText(/맛집/)).toBeChecked();
    expect(screen.getByRole('button', { name: '옮기기' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '책갈피 빼기' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fetchMock.mock.calls.some(([u, init]) => u === '/api/posts/7/bookmark' && init?.method === 'DELETE')).toBe(true);
    expect(queryClient.getQueryData<PostDetail>(qk.post(7))).toMatchObject({ bookmarkedByMe: false, bookmark: null });
  });

  it('저장에 실패하면 창을 닫지 않고 오류를 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/me/bookmark-folders', body: folders },
      { method: 'PUT', path: '/api/posts/7/bookmark', status: 500, body: { error: { code: 'INTERNAL', message: '저장하지 못했습니다' } } },
    ]);
    const onClose = vi.fn();
    renderWithProviders(<BookmarkDialog post={post} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '책갈피' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('저장하지 못했습니다');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('책갈피 빼기에 실패해도 오류를 보여 준다. 취소는 그냥 닫는다', async () => {
    const saved = { ...post, bookmarkedByMe: true, bookmark: undefined };
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/me/bookmark-folders', body: folders },
      { method: 'DELETE', path: '/api/posts/7/bookmark', status: 500, body: { error: { code: 'INTERNAL', message: '빼지 못했습니다' } } },
    ]);
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<BookmarkDialog post={saved} onClose={onClose} />);
    expect(screen.getByLabelText('미분류')).toBeChecked();
    await user.click(screen.getByRole('button', { name: '책갈피 빼기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('빼지 못했습니다');
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
