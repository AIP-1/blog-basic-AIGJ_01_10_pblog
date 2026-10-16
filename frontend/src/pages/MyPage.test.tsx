import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT, AUTH } from '../messages';
import { mockFetch, type MockRoute, renderWithProviders } from '../test/utils';
import { MyPage } from './MyPage';

const me = { member: { id: 1, nickname: '수연', email: 'suyeon@example.com' }, blog: { id: 3, name: '생각 서랍' }, newCommentCount: 0 };
const profile = {
  email: 'suyeon@example.com',
  nickname: '수연',
  bio: '안녕하세요',
  createdAt: '2026-01-02T10:00:00+09:00',
  blogId: 3,
  passwordSet: true,
  socialAccounts: [] as string[],
};
const base = (p: object = profile): MockRoute[] => [
  { path: '/api/auth/me', body: me },
  { path: '/api/me', body: p },
];
const err = (status: number, code: string, message: string, extra: object = {}) => ({
  status,
  body: { error: { code, message, ...extra } },
});

function LocationProbe() {
  const { pathname } = useLocation();
  return <output data-testid="path">{pathname}</output>;
}

function renderPage() {
  document.cookie = 'XSRF-TOKEN=t; path=/';
  return renderWithProviders(
    <>
      <MyPage />
      <LocationProbe />
    </>,
    { path: '/me' },
  );
}

const bodyOf = (fetchMock: ReturnType<typeof mockFetch>, url: string, method: string) => {
  const call = fetchMock.mock.calls.find(([u, init]) => u === url && init?.method === method);
  return call ? JSON.parse((call[1] as RequestInit).body as string) : undefined;
};

describe('내 정보 (CF-15)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('비로그인이면 로그인이 필요하다고 안내한다', async () => {
    mockFetch([{ path: '/api/auth/me', status: 204 }]);
    renderPage();
    expect(await screen.findByText(AUTH.loginRequired)).toBeInTheDocument();
  });

  it('프로필을 못 불러오면 오류와 다시 시도 버튼을 보여 준다', async () => {
    const fetchMock = mockFetch([{ path: '/api/auth/me', body: me }, { path: '/api/me', ...err(500, 'INTERNAL', '불러오지 못했어요') }]);
    renderPage();
    expect(await screen.findByText('불러오지 못했어요')).toBeInTheDocument();
    const before = fetchMock.mock.calls.filter(([u]) => u === '/api/me').length;
    fireEvent.click(screen.getByRole('button', { name: /다시/ }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => u === '/api/me').length).toBe(before + 1));
  });

  it('이메일(잠김)·닉네임·소개·가입일과 바로가기를 보여 주고, 바꾸지 않으면 저장을 막는다', async () => {
    mockFetch(base());
    renderPage();
    expect(await screen.findByLabelText('이메일')).toHaveValue('suyeon@example.com');
    expect(screen.getByLabelText('이메일')).toBeDisabled();
    expect(screen.getByLabelText('닉네임')).toHaveValue('수연');
    expect(screen.getByLabelText('소개')).toHaveValue('안녕하세요');
    expect(screen.getByText('5/100')).toBeInTheDocument();
    expect(screen.getByText('가입일 2026.01.02')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '내 블로그' })).toHaveAttribute('href', '/blogs/3');
    expect(screen.getByRole('link', { name: '블로그 관리' })).toHaveAttribute('href', '/manage');
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.queryByText(/계정으로 로그인해요/)).toBeNull();
  });

  it('바뀐 칸만 보내 저장하고 알림을 띄운다', async () => {
    const fetchMock = mockFetch([...base(), { method: 'PATCH', path: '/api/me', status: 204 }]);
    renderPage();
    fireEvent.change(await screen.findByLabelText('소개'), { target: { value: '새 소개' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText(ACCOUNT.saved)).toBeInTheDocument();
    expect(bodyOf(fetchMock, '/api/me', 'PATCH')).toEqual({ bio: '새 소개' });
  });

  it('닉네임·소개 규칙을 어기면 저장하지 않고 칸 아래에 알린다', async () => {
    const fetchMock = mockFetch(base());
    renderPage();
    fireEvent.change(await screen.findByLabelText('닉네임'), { target: { value: '!' } });
    fireEvent.change(screen.getByLabelText('소개'), { target: { value: 'ㄱ'.repeat(101) } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText(AUTH.nicknameRule)).toBeInTheDocument();
    expect(screen.getByText(ACCOUNT.bioTooLong(100))).toBeInTheDocument();
    expect(screen.getByLabelText('닉네임')).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
    fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: '수연이' } });
    expect(screen.queryByText(AUTH.nicknameRule)).toBeNull();
  });

  it('저장 오류: 닉네임 중복·칸별 오류·그 밖의 오류를 각각 알맞은 자리에 보여 준다', async () => {
    const run = async (route: MockRoute, expected: string) => {
      const fetchMock = mockFetch([...base(), route]);
      const view = renderPage();
      fireEvent.change(await screen.findByLabelText('닉네임'), { target: { value: ' 새이름 ' } });
      fireEvent.click(screen.getByRole('button', { name: '저장' }));
      expect(await screen.findByText(expected)).toBeInTheDocument();
      expect(bodyOf(fetchMock, '/api/me', 'PATCH')).toEqual({ nickname: '새이름' });
      view.unmount();
    };
    await run({ method: 'PATCH', path: '/api/me', ...err(409, 'NICKNAME_TAKEN', AUTH.nicknameTaken) }, AUTH.nicknameTaken);
    await run(
      { method: 'PATCH', path: '/api/me', ...err(400, 'VALIDATION_FAILED', '확인', { fields: { bio: '소개가 이상해요' } }) },
      '소개가 이상해요',
    );
    await run({ method: 'PATCH', path: '/api/me', ...err(500, 'INTERNAL', '저장하지 못했어요') }, '저장하지 못했어요');
  });

  it('비밀번호 변경: 빈 칸·규칙·같은 비밀번호·불일치를 막는다', async () => {
    const fetchMock = mockFetch(base());
    renderPage();
    const submit = await screen.findByRole('button', { name: '비밀번호 변경' });
    fireEvent.click(submit);
    expect(await screen.findAllByText(AUTH.required)).toHaveLength(3);

    fireEvent.change(screen.getByLabelText('현재 비밀번호'), { target: { value: 'abcd123!' } });
    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'other' } });
    fireEvent.click(submit);
    expect(await screen.findByText(AUTH.passwordRule)).toBeInTheDocument();
    expect(screen.getByText(AUTH.passwordMismatch)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'abcd123!' } });
    fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'abcd123!' } });
    fireEvent.click(submit);
    expect(await screen.findByText(ACCOUNT.sameAsCurrent)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u]) => u === '/api/me/password')).toBe(false);
  });

  it('비밀번호를 바꾸면 칸을 비우고 완료를 알린다', async () => {
    const fetchMock = mockFetch([...base(), { method: 'PUT', path: '/api/me/password', status: 204 }]);
    renderPage();
    fireEvent.change(await screen.findByLabelText('현재 비밀번호'), { target: { value: 'old123!!' } });
    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'new123!!' } });
    fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'new123!!' } });
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }));
    expect(await screen.findByText(ACCOUNT.passwordChanged)).toBeInTheDocument();
    expect(screen.getByLabelText('현재 비밀번호')).toHaveValue('');
    expect(screen.getByLabelText('새 비밀번호')).toHaveValue('');
    expect(bodyOf(fetchMock, '/api/me/password', 'PUT')).toEqual({
      currentPassword: 'old123!!',
      newPassword: 'new123!!',
      newPasswordConfirm: 'new123!!',
    });
  });

  it('비밀번호 변경 오류: 현재 비밀번호 불일치·같은 값·칸별 오류·잠김을 보여 준다', async () => {
    const run = async (route: MockRoute, expected: string | RegExp) => {
      mockFetch([...base(), route]);
      const view = renderPage();
      fireEvent.change(await screen.findByLabelText('현재 비밀번호'), { target: { value: 'old123!!' } });
      fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'new123!!' } });
      fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'new123!!' } });
      fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }));
      expect(await screen.findByText(expected)).toBeInTheDocument();
      expect(screen.getByLabelText('현재 비밀번호')).toHaveValue('');
      view.unmount();
    };
    const put = { method: 'PUT', path: '/api/me/password' };
    await run({ ...put, ...err(400, 'CURRENT_PASSWORD_MISMATCH', ACCOUNT.currentPasswordMismatch) }, ACCOUNT.currentPasswordMismatch);
    await run({ ...put, ...err(400, 'SAME_AS_CURRENT', ACCOUNT.sameAsCurrent) }, ACCOUNT.sameAsCurrent);
    await run({ ...put, ...err(400, 'VALIDATION_FAILED', '확인', { fields: { newPasswordConfirm: '확인 칸 오류' } }) }, '확인 칸 오류');
    const unlockAt = new Date(Date.now() + 9.5 * 60_000).toISOString();
    await run({ ...put, ...err(423, 'ACCOUNT_LOCKED', '잠김', { unlockAt }) }, AUTH.accountLocked(10));
  });

  it('탈퇴: 안내 확인과 비밀번호가 있어야 누를 수 있고, 확인하면 탈퇴 후 홈으로 가서 알린다', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchMock = mockFetch([
      ...base(),
      { method: 'DELETE', path: '/api/me', status: 204 },
      { method: 'POST', path: '/api/auth/logout', status: 204 },
    ]);
    renderPage();
    const button = await screen.findByRole('button', { name: '탈퇴하기' });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByLabelText('위 안내를 모두 확인했습니다'));
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText('비밀번호 확인'), { target: { value: 'pw123!!!' } });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(confirm).toHaveBeenCalledWith(ACCOUNT.withdrawConfirm(30));
    expect(await screen.findByText(ACCOUNT.withdrawn)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent(/^\/$/));
    expect(bodyOf(fetchMock, '/api/me', 'DELETE')).toEqual({ password: 'pw123!!!', acknowledged: true });
  });

  it('탈퇴: 확인 창에서 취소하면 요청하지 않고, 서버 오류면 비밀번호를 비우고 보여 준다', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const fetchMock = mockFetch([
      ...base(),
      { method: 'DELETE', path: '/api/me', ...err(400, 'PASSWORD_MISMATCH', '비밀번호가 올바르지 않습니다') },
    ]);
    renderPage();
    fireEvent.click(await screen.findByLabelText('위 안내를 모두 확인했습니다'));
    fireEvent.change(screen.getByLabelText('비밀번호 확인'), { target: { value: 'pw123!!!' } });
    fireEvent.click(screen.getByRole('button', { name: '탈퇴하기' }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: '탈퇴하기' }));
    expect(await screen.findByText('비밀번호가 올바르지 않습니다')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호 확인')).toHaveValue('');
  });

  it('탈퇴: 폼을 바로 제출하면 안내 확인·비밀번호를 먼저 요구한다', async () => {
    mockFetch(base());
    renderPage();
    const form = (await screen.findByRole('button', { name: '탈퇴하기' })).closest('form') as HTMLFormElement;
    fireEvent.submit(form);
    expect(await screen.findByText(ACCOUNT.acknowledgeRequired)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('위 안내를 모두 확인했습니다'));
    fireEvent.submit(form);
    expect(await screen.findByText(AUTH.required)).toBeInTheDocument();
  });

  it('소셜 가입 회원은 비밀번호 변경을 숨기고, 가입한 제공자로 확인하러 보낸다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchMock = mockFetch([
      ...base({ ...profile, passwordSet: false, socialAccounts: ['kakao', 'google'] }),
      { method: 'POST', path: '/api/me/withdraw/social', body: { redirectUrl: '#kakao-withdraw' } },
    ]);
    renderPage();
    expect(await screen.findByText('카카오 · 구글 계정으로 로그인해요')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '비밀번호 변경' })).toBeNull();
    expect(screen.queryByLabelText('비밀번호 확인')).toBeNull();
    expect(screen.getByText(ACCOUNT.socialWithdrawHint('카카오'))).toBeInTheDocument();
    const button = screen.getByRole('button', { name: ACCOUNT.socialWithdrawButton('카카오') });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByLabelText('위 안내를 모두 확인했습니다'));
    fireEvent.click(button);
    await waitFor(() => expect(window.location.hash).toBe('#kakao-withdraw'));
    expect(bodyOf(fetchMock, '/api/me/withdraw/social', 'POST')).toEqual({ acknowledged: true });
    window.location.hash = '';
  });
});
