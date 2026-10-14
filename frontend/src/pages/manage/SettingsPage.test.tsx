import { fireEvent, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, type MockRoute, renderWithProviders } from '../../test/utils';
import { ManageLayout } from './ManageLayout';
import { SettingsPage } from './SettingsPage';

const me = { member: { id: 3, nickname: '끄적이', email: 'd@b.com' }, blog: { id: 1, name: '생각 서랍' }, newCommentCount: 0 };
const blog = {
  id: 1,
  name: '생각 서랍',
  description: '떠오르는 대로',
  topic: { code: 'hobby', name: '취미' },
  owner: { nickname: '끄적이', bio: '' },
  postCount: 3,
  lastPostAt: null,
  isOwner: true,
  subscriberCount: 0,
  subscribedByMe: false,
};
const topics = [
  { code: 'hobby', name: '취미', description: '' },
  { code: 'travel', name: '여행', description: '' },
];

function setup(extra: MockRoute[] = [], blogBody: unknown = blog) {
  const fetchMock = mockFetch([
    ...extra,
    { path: '/api/auth/me', body: me },
    { path: '/api/blogs/1', body: blogBody },
    { path: '/api/blogs/1/about', body: { ownerNickname: '끄적이', ownerBio: '', about: '안녕하세요' } },
    { path: '/api/topics', body: topics },
  ]);
  renderWithProviders(
    <Routes>
      <Route path="/manage" element={<ManageLayout />}>
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>,
    { path: '/manage/settings' },
  );
  return fetchMock;
}

describe('블로그 설정', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=t; path=/';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('지금 값으로 채우고, 바꾸기 전에는 저장을 막으며 소개 글자 수를 센다', async () => {
    setup();
    const name = await screen.findByLabelText('블로그 이름');
    expect(name).toHaveValue('생각 서랍');
    expect(screen.getByLabelText('소개')).toHaveValue('떠오르는 대로');
    expect(screen.getByLabelText('소개 글 (블로그 소개 화면)')).toHaveValue('안녕하세요');
    expect(screen.getByLabelText('주제')).toHaveValue('hobby');
    expect(screen.getByText('7/200')).toBeInTheDocument();
    expect(screen.getByText('5/5000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('소개'), { target: { value: '새 소개' } });
    expect(screen.getByText('4/200')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();
  });

  it('이름을 비우거나 너무 길게 쓰면 저장하지 않고 알린다', async () => {
    const fetchMock = setup();
    const name = await screen.findByLabelText('블로그 이름');
    fireEvent.change(name, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('블로그 이름을 입력해 주세요')).toBeInTheDocument();
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveFocus();
    fireEvent.change(name, { target: { value: '가'.repeat(31) } });
    expect(screen.queryByText('블로그 이름을 입력해 주세요')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('블로그 이름은 30자 이하로 입력해 주세요')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'PATCH')).toBe(false);
  });

  it('바꾼 칸만 보내고 저장했다고 알린다', async () => {
    const fetchMock = setup([{ method: 'PATCH', path: '/api/blogs/1', status: 204 }]);
    const name = await screen.findByLabelText('블로그 이름');
    fireEvent.change(name, { target: { value: '  새 서랍 ' } });
    fireEvent.change(screen.getByLabelText('주제'), { target: { value: 'travel' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('저장했습니다')).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([u, i]) => u === '/api/blogs/1' && i?.method === 'PATCH');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ name: '새 서랍', topicCode: 'travel' });
  });

  it('서버가 칸별 오류를 주면 칸 아래에, 그 밖의 오류는 폼 아래에 보여 준다', async () => {
    const fetchMock = setup([{ method: 'PATCH', path: '/api/blogs/1', status: 400, body: { error: { code: 'VALIDATION', message: '', fields: { description: '소개가 이상해요' } } } }]);
    await screen.findByLabelText('블로그 이름');
    fireEvent.change(screen.getByLabelText('소개'), { target: { value: '???' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('소개가 이상해요')).toBeInTheDocument();

    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ error: { code: 'INTERNAL', message: '저장하지 못했어요' } }), { status: 500 }),
    );
    fireEvent.change(screen.getByLabelText('소개 글 (블로그 소개 화면)'), { target: { value: '바뀐 소개 글' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('저장하지 못했어요')).toBeInTheDocument();
  });

  it('주제가 없던 블로그에는 "주제 선택"을 보여 준다', async () => {
    setup([], { ...blog, description: null, topic: null });
    expect(await screen.findByRole('option', { name: '주제 선택' })).toBeInTheDocument();
    expect(screen.getByLabelText('주제')).toHaveValue('');
    expect(screen.getByText('0/200')).toBeInTheDocument();
  });

  it('블로그 정보를 못 받으면 오류를 보여 준다', async () => {
    setup([{ path: '/api/blogs/1', status: 500, body: { error: { code: 'INTERNAL', message: '블로그 오류' } } }]);
    expect(await screen.findByText('블로그 오류')).toBeInTheDocument();
  });

  it('소개 글을 못 받으면 오류를 보여 준다', async () => {
    setup([{ path: '/api/blogs/1/about', status: 500, body: { error: { code: 'INTERNAL', message: '소개 오류' } } }]);
    expect(await screen.findByText('소개 오류')).toBeInTheDocument();
  });
});
