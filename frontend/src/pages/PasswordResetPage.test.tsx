import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/context';
import { AUTH } from '../messages';
import { mockFetch, type MockRoute, renderWithProviders } from '../test/utils';
import { PasswordResetPage } from './PasswordResetPage';

const verifyRoutes: MockRoute[] = [
  { path: '/api/auth/me', status: 204 },
  { method: 'POST', path: '/api/auth/verifications', status: 202, body: { expiresAt: '2026-10-08T10:10:00+09:00' } },
  { method: 'POST', path: '/api/auth/verifications/confirm', body: { verifiedUntil: '2026-10-08T10:40:00+09:00' } },
];

function Probe() {
  const { pathname } = useLocation();
  const { modal } = useAuth();
  return (
    <>
      <output data-testid="path">{pathname}</output>
      <output data-testid="modal">{modal.open ? `${modal.tab}|${modal.notice}|${modal.email}` : 'closed'}</output>
    </>
  );
}

function renderPage() {
  document.cookie = 'XSRF-TOKEN=t; path=/';
  return renderWithProviders(
    <>
      <PasswordResetPage />
      <Probe />
    </>,
    { path: '/password-reset' },
  );
}

async function verifyEmail(email = ' A@B.com ') {
  fireEvent.change(await screen.findByLabelText('이메일'), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: '인증번호 받기' }));
  expect(await screen.findByText(AUTH.resetSent)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('인증번호'), { target: { value: 'abc234' } });
  fireEvent.click(screen.getByRole('button', { name: '확인' }));
  expect(await screen.findByText(AUTH.verified)).toBeInTheDocument();
}

function fillPasswords(pw: string, pw2 = pw) {
  fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: pw } });
  fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: pw2 } });
}

describe('비밀번호 찾기 (CF-25)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('로그인한 상태면 내 정보에서 바꾸라고 안내한다', async () => {
    mockFetch([{ path: '/api/auth/me', body: { member: { id: 1, nickname: '수연', email: 'a@b.com' }, blog: null, newCommentCount: 0 } }]);
    renderPage();
    expect(await screen.findByText(AUTH.resetWhileLoggedIn)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '내 정보로' })).toHaveAttribute('href', '/me');
    expect(screen.queryByLabelText('이메일')).toBeNull();
  });

  it('이메일 형식이 틀리면 칸 아래에 알려 주고 인증번호 받기를 막는다', async () => {
    mockFetch([{ path: '/api/auth/me', status: 204 }]);
    renderPage();
    const email = await screen.findByLabelText('이메일');
    const send = screen.getByRole('button', { name: '인증번호 받기' });
    expect(send).toBeDisabled();
    fireEvent.change(email, { target: { value: 'nope' } });
    fireEvent.blur(email);
    expect(screen.getByText(AUTH.emailInvalid)).toBeInTheDocument();
    expect(send).toBeDisabled();
    expect(screen.queryByLabelText('새 비밀번호')).toBeNull();
  });

  it('인증을 마치면 새 비밀번호를 정하고, 바꾸면 홈으로 가서 로그인 창에 안내와 이메일을 채운다', async () => {
    const fetchMock = mockFetch([...verifyRoutes, { method: 'POST', path: '/api/auth/password-reset', status: 204 }]);
    renderPage();
    await verifyEmail();
    const sendCall = fetchMock.mock.calls.find(([u]) => u === '/api/auth/verifications');
    expect(JSON.parse((sendCall?.[1] as RequestInit).body as string)).toEqual({ purpose: 'reset', email: 'a@b.com' });
    expect(screen.getByLabelText('이메일')).toHaveAttribute('readonly');

    const submit = screen.getByRole('button', { name: '변경하기' });
    expect(submit).toBeDisabled();
    fillPasswords('abcd123!', 'abcd123?');
    expect(screen.getByText(AUTH.passwordMismatch)).toBeInTheDocument();
    expect(submit).toBeDisabled();
    fillPasswords('abcd123!');
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent(/^\/$/));
    expect(screen.getByTestId('modal')).toHaveTextContent(`login|${AUTH.resetDone}|a@b.com`);
    const call = fetchMock.mock.calls.find(([u]) => u === '/api/auth/password-reset');
    expect(JSON.parse((call?.[1] as RequestInit).body as string)).toEqual({
      email: 'a@b.com',
      newPassword: 'abcd123!',
      newPasswordConfirm: 'abcd123!',
    });
  });

  it('빈 칸으로 제출하면 필수 입력이라고 알린다', async () => {
    mockFetch(verifyRoutes);
    renderPage();
    await verifyEmail();
    fireEvent.submit(screen.getByRole('button', { name: '변경하기' }).closest('form') as HTMLFormElement);
    expect(await screen.findAllByText(AUTH.required)).toHaveLength(2);
    fillPasswords('short');
    fireEvent.submit(screen.getByRole('button', { name: '변경하기' }).closest('form') as HTMLFormElement);
    expect(await screen.findByText(AUTH.passwordRule)).toBeInTheDocument();
  });

  it('인증 유효 시간이 지났으면 인증을 취소하고 다시 받으라고 한다', async () => {
    mockFetch([
      ...verifyRoutes,
      {
        method: 'POST',
        path: '/api/auth/password-reset',
        status: 400,
        body: { error: { code: 'VERIFICATION_EXPIRED', message: AUTH.verificationExpired } },
      },
    ]);
    renderPage();
    await verifyEmail();
    fillPasswords('abcd123!');
    fireEvent.click(screen.getByRole('button', { name: '변경하기' }));
    expect(await screen.findByText(AUTH.verificationExpired)).toBeInTheDocument();
    expect(screen.queryByLabelText('새 비밀번호')).toBeNull();
    expect(screen.getByLabelText('이메일')).not.toHaveAttribute('readonly');
  });

  it('칸별 서버 오류는 칸 아래에, 그 밖의 오류는 폼 아래에 보여 주고 비밀번호를 비운다', async () => {
    mockFetch([
      ...verifyRoutes,
      {
        method: 'POST',
        path: '/api/auth/password-reset',
        status: 400,
        body: { error: { code: 'VALIDATION_FAILED', message: '입력을 확인해 주세요', fields: { newPassword: '너무 쉬운 비밀번호예요' } } },
      },
    ]);
    const { unmount } = renderPage();
    await verifyEmail();
    fillPasswords('abcd123!');
    fireEvent.click(screen.getByRole('button', { name: '변경하기' }));
    expect(await screen.findByText('너무 쉬운 비밀번호예요')).toBeInTheDocument();
    expect(screen.getByLabelText('새 비밀번호')).toHaveValue('');
    unmount();

    mockFetch([
      ...verifyRoutes,
      { method: 'POST', path: '/api/auth/password-reset', status: 500, body: { error: { code: 'INTERNAL', message: '서버 오류가 났어요' } } },
    ]);
    renderPage();
    await verifyEmail();
    fillPasswords('abcd123!');
    fireEvent.click(screen.getByRole('button', { name: '변경하기' }));
    expect(await screen.findByText('서버 오류가 났어요')).toBeInTheDocument();
  });

  it('이메일 변경을 누르면 인증이 풀리고, 보낸 뒤 이메일을 고쳐도 인증번호 칸이 사라진다', async () => {
    mockFetch(verifyRoutes);
    renderPage();
    await verifyEmail();
    fireEvent.click(screen.getByRole('button', { name: '이메일 변경' }));
    await waitFor(() => expect(screen.getByLabelText('이메일')).not.toHaveAttribute('readonly'));
    expect(screen.queryByLabelText('새 비밀번호')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '인증번호 받기' }));
    expect(await screen.findByLabelText('인증번호')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'c@d.com' } });
    expect(screen.queryByLabelText('인증번호')).toBeNull();
  });
});
