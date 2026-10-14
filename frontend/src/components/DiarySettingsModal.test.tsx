import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category } from '../api/types';
import { mockFetch, type MockRoute, renderWithProviders } from '../test/utils';
import { DiarySettingsModal } from './DiarySettingsModal';

const diary: Category = {
  id: 4,
  name: '여행',
  description: '다닌 곳들',
  visibility: 'PUBLIC',
  postCount: 2,
  isDefault: false,
  colorIndex: 1,
  subscriberCount: 3,
  subscribedByMe: false,
};

function setup(extra: MockRoute[] = [], d: Category = diary) {
  const fetchMock = mockFetch([
    ...extra,
    { path: '/api/auth/me', status: 204 },
    { path: /\/api\/diary-stickers\?categoryIds=4$/, body: { '4': [{ slot: 'TL', code: 'leaf', rotation: 0 }] } },
    { path: '/api/me/stickers', body: [{ code: 'leaf', name: '낙엽', limited: false, packName: null, acquiredAt: '2026-10-01T00:00:00+09:00' }] },
    { method: 'PATCH', path: '/api/categories/4', status: 204 },
  ]);
  const onClose = vi.fn();
  renderWithProviders(<DiarySettingsModal diary={d} onClose={onClose} />);
  return { fetchMock, onClose };
}

const bodyOf = (fn: ReturnType<typeof mockFetch>, method: string, url: string) => {
  const call = fn.mock.calls.find(([u, i]) => u === url && i?.method === method);
  return call ? (JSON.parse(String(call[1]?.body)) as unknown) : undefined;
};

describe('다이어리 설정 창', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=t; path=/';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('지금 이름·소개·색·공개 범위로 채우고 구독자 수 안내를 보여 준다', async () => {
    setup();
    expect(screen.getByRole('dialog', { name: '다이어리 설정' })).toBeInTheDocument();
    expect(screen.getByLabelText('이름')).toHaveValue('여행');
    expect(screen.getByPlaceholderText('이 다이어리를 한 줄로 소개해 주세요')).toHaveValue('다닌 곳들');
    expect(screen.getByText('5/100')).toBeInTheDocument();
    expect(screen.getByLabelText('2번 색')).toBeChecked();
    expect(screen.getByRole('radio', { name: /^공개/ })).toBeChecked();
    expect(screen.getByText('지금 구독자 3명 — 비공개로 바꾸면 구독이 모두 해제돼요.')).toBeInTheDocument();
    // 저장된 표지 스티커를 불러와 보여 준다
    expect(await screen.findByText('1/3')).toBeInTheDocument();
  });

  it('이름이 비거나 길거나 소개가 길면 저장하지 않는다', async () => {
    const { fetchMock } = setup();
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: ' ' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('다이어리 이름을 입력해 주세요')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '가'.repeat(21) } });
    fireEvent.change(screen.getByPlaceholderText('이 다이어리를 한 줄로 소개해 주세요'), { target: { value: '나'.repeat(101) } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('다이어리 이름은 20자 이하로 입력해 주세요')).toBeInTheDocument();
    expect(screen.getByText('다이어리 소개는 100자 이하로 입력해 주세요')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'PATCH')).toBe(false);
  });

  it('바꾼 값을 저장하고 알린 뒤 창을 닫는다 (이름이 같으면 이름은 보내지 않는다)', async () => {
    const { fetchMock, onClose } = setup();
    fireEvent.change(screen.getByPlaceholderText('이 다이어리를 한 줄로 소개해 주세요'), { target: { value: ' 새 소개 ' } });
    fireEvent.click(screen.getByLabelText('5번 색'));
    fireEvent.click(screen.getByRole('radio', { name: /^구독자만/ }));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bodyOf(fetchMock, 'PATCH', '/api/categories/4')).toEqual({ description: '새 소개', colorIndex: 4, visibility: 'SUBSCRIBERS' });
    expect(screen.getByText('다이어리 설정을 저장했습니다')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'PUT')).toBe(false);
  });

  it('표지 스티커를 바꿨으면 함께 저장한다', async () => {
    const { fetchMock, onClose } = setup([{ method: 'PUT', path: '/api/categories/4/stickers', body: [] }]);
    await screen.findByText('1/3');
    fireEvent.click(screen.getByRole('button', { name: '왼쪽 위' }));
    fireEvent.click(screen.getByRole('button', { name: '떼기' }));
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '여행기' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bodyOf(fetchMock, 'PATCH', '/api/categories/4')).toMatchObject({ name: '여행기' });
    expect(bodyOf(fetchMock, 'PUT', '/api/categories/4/stickers')).toEqual({ stickers: [] });
  });

  it('비공개로 바꿀 때 묻고, 취소하면 저장하지 않는다', async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    const { fetchMock, onClose } = setup();
    fireEvent.click(screen.getByRole('radio', { name: /^비공개/ }));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(confirm).toHaveBeenCalledWith('비공개로 바꾸면 이 다이어리의 글은 나만 볼 수 있습니다. 바꿀까요?');
    expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'PATCH')).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('서버가 칸별 오류를 주면 칸 아래에, 그 밖의 오류는 폼 아래에 보여 준다', async () => {
    const { fetchMock } = setup([
      { method: 'PATCH', path: '/api/categories/4', status: 400, body: { error: { code: 'VALIDATION', message: '', fields: { name: '이미 있는 이름' } } } },
    ]);
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('이미 있는 이름')).toBeInTheDocument();
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ error: { code: 'X', message: '저장 실패' } }), { status: 500 }));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('저장 실패')).toBeInTheDocument();
  });

  it('취소 버튼은 창을 닫고, 비공개 다이어리에는 구독자 안내를 숨긴다', () => {
    const { onClose } = setup([], { ...diary, visibility: 'PRIVATE', description: '' });
    expect(screen.queryByText(/지금 구독자/)).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^비공개/ })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onClose).toHaveBeenCalled();
  });
});
