import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithProviders } from '../test/utils';
import { PostEditorPage } from './PostEditorPage';

const me = { member: { id: 3, nickname: '서연', email: 's@b.com' }, blog: { id: 5, name: '서연의 블로그' }, newCommentCount: 0 };
const categories = [{ id: 9, name: '미분류', postCount: 0, isDefault: true, colorIndex: 0 }];

describe('글쓰기 임시저장 (CF-05)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('제목도 본문도 없으면 저장하지 않고, 쓰고 나서 누르면 임시저장하고 시각을 보여 준다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/blogs/5/categories', body: categories },
      { path: '/api/me/last-category', body: { categoryId: null } },
      { path: '/api/me/drafts', body: { items: [], limit: 20 } },
      { method: 'POST', path: '/api/me/drafts', status: 201, body: { id: 41, updatedAt: '2026-10-08T15:42:00+09:00' } },
      { path: '/api/csrf', body: {} },
    ]);
    document.cookie = 'XSRF-TOKEN=t; path=/';
    renderWithProviders(<PostEditorPage />, { path: '/write' });

    fireEvent.click(await screen.findByRole('button', { name: '임시저장' }));
    expect(await screen.findByText('제목이나 본문을 입력하면 임시저장할 수 있습니다')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('제목 (필수)'), { target: { value: '쓰다 만 글' } });
    fireEvent.click(screen.getByRole('button', { name: '임시저장' }));
    expect(await screen.findByText('임시저장 15:42')).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([url, init]) => url === '/api/me/drafts' && init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ title: '쓰다 만 글', categoryId: 9, visibility: 'PUBLIC' });
  });

  it('?draft=ID 로 들어오면 그 임시저장 글을 불러와 이어 쓴다', async () => {
    mockFetch([
      { path: '/api/auth/me', body: me },
      { path: '/api/blogs/5/categories', body: categories },
      { path: '/api/me/last-category', body: { categoryId: null } },
      { path: '/api/me/drafts', body: { items: [{ id: 41, title: '쓰다 만 글', preview: '본문', updatedAt: '2026-10-08T15:42:00+09:00' }], limit: 20 } },
      {
        path: '/api/me/drafts/41',
        body: { id: 41, title: '쓰다 만 글', body: '본문 조금', categoryId: null, visibility: 'PRIVATE', tags: ['여행'], images: [], coverImageId: null, updatedAt: '2026-10-08T15:42:00+09:00' },
      },
    ]);
    renderWithProviders(<PostEditorPage />, { path: '/write?draft=41' });
    expect(await screen.findByDisplayValue('쓰다 만 글')).toBeInTheDocument();
    expect(screen.getByDisplayValue('본문 조금')).toBeInTheDocument();
    expect(screen.getByText('#여행')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /임시저장 글/ })).toHaveTextContent('1'));
  });
});
