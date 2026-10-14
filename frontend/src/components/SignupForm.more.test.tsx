import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTH } from '../messages';
import { mockFetch, type MockRoute, renderWithProviders } from '../test/utils';
import { SignupForm } from './SignupForm';

const verifyRoutes: MockRoute[] = [
  { method: 'POST', path: '/api/auth/verifications', status: 202, body: { expiresAt: '2026-10-08T10:10:00+09:00', devCode: 'XY12AB' } },
  { method: 'POST', path: '/api/auth/verifications/confirm', body: { verifiedUntil: '2026-10-08T10:40:00+09:00' } },
];
const signupError = (status: number, code: string, message: string, fields?: Record<string, string>): MockRoute => ({
  method: 'POST',
  path: '/api/auth/signup',
  status,
  body: { error: { code, message, ...(fields ? { fields } : {}) } },
});

function renderForm(routes: MockRoute[], onDone = vi.fn()) {
  const fetchMock = mockFetch([...verifyRoutes, ...routes]);
  document.cookie = 'XSRF-TOKEN=t; path=/';
  renderWithProviders(<SignupForm onDone={onDone} />);
  return { fetchMock, onDone };
}

async function verifyAndFill(password = 'abcd123!') {
  fireEvent.change(await screen.findByLabelText('닉네임'), { target: { value: ' 수연 ' } });
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'A@B.com' } });
  fireEvent.click(screen.getByRole('button', { name: '인증번호 받기' }));
  expect(await screen.findByText(`${AUTH.codeSent} (임시 인증번호: XY12AB)`)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('인증번호'), { target: { value: 'xy12ab' } });
  fireEvent.click(screen.getByRole('button', { name: '확인' }));
  expect(await screen.findByText(AUTH.verified)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('비밀번호 확인'), { target: { value: password } });
}

const submit = () => fireEvent.click(screen.getByRole('button', { name: '가입하기' }));

describe('SignupForm 가입 제출 (CF-01)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('가입에 성공하면 다듬은 값으로 요청하고 정규화한 이메일로 onDone 을 부른다', async () => {
    const { fetchMock, onDone } = renderForm([{ method: 'POST', path: '/api/auth/signup', status: 201 }]);
    await verifyAndFill();
    submit();
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('a@b.com'));
    const call = fetchMock.mock.calls.find(([u]) => u === '/api/auth/signup');
    expect(JSON.parse((call?.[1] as RequestInit).body as string)).toEqual({
      nickname: '수연',
      email: 'a@b.com',
      password: 'abcd123!',
      passwordConfirm: 'abcd123!',
    });
  });

  it('인증 유효 시간이 지났으면 인증을 취소하고 그 문구를 보여 준다', async () => {
    const { onDone } = renderForm([signupError(400, 'VERIFICATION_EXPIRED', AUTH.verificationExpired)]);
    await verifyAndFill();
    submit();
    expect(await screen.findByText(AUTH.verificationExpired)).toBeInTheDocument();
    expect(screen.getByLabelText('이메일')).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('비밀번호')).toHaveValue('');
    expect(screen.getByText(AUTH.notVerified)).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('그 사이 가입된 이메일이면 인증을 풀고 이메일 칸 아래에 알리며 그 칸으로 옮긴다', async () => {
    renderForm([signupError(409, 'EMAIL_TAKEN', AUTH.emailTaken)]);
    await verifyAndFill();
    submit();
    expect(await screen.findByText(AUTH.emailTaken)).toBeInTheDocument();
    expect(screen.getByLabelText('이메일')).toHaveFocus();
    expect(screen.getByLabelText('이메일')).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'c@d.com' } });
    expect(screen.queryByText(AUTH.emailTaken)).toBeNull();
  });

  it('닉네임이 겹치면 닉네임 칸 아래에 알리고 비밀번호를 비운다', async () => {
    renderForm([signupError(409, 'NICKNAME_TAKEN', AUTH.nicknameTaken)]);
    await verifyAndFill();
    submit();
    expect(await screen.findByText(AUTH.nicknameTaken)).toBeInTheDocument();
    expect(screen.getByLabelText('닉네임')).toHaveFocus();
    expect(screen.getByLabelText('비밀번호')).toHaveValue('');
    expect(screen.getByLabelText('비밀번호 확인')).toHaveValue('');
    expect(screen.getByLabelText('이메일')).toHaveAttribute('readonly');
  });

  it('칸별 서버 오류는 해당 칸 아래에 보여 준다', async () => {
    renderForm([signupError(400, 'VALIDATION_FAILED', '입력을 확인해 주세요', { password: '비밀번호가 너무 흔해요' })]);
    await verifyAndFill();
    submit();
    expect(await screen.findByText('비밀번호가 너무 흔해요')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호')).toHaveFocus();
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'x' } });
    expect(screen.queryByText('비밀번호가 너무 흔해요')).toBeNull();
  });

  it('알 수 없는 칸의 오류나 그 밖의 오류는 폼 아래에 보여 준다', async () => {
    renderForm([signupError(400, 'VALIDATION_FAILED', '알 수 없는 칸 오류', { other: 'x' })]);
    await verifyAndFill();
    submit();
    expect(await screen.findByText('알 수 없는 칸 오류')).toBeInTheDocument();
  });

  it('서버 오류는 폼 아래 문구로 보여 준다', async () => {
    renderForm([signupError(500, 'INTERNAL', '서버가 잠시 쉬고 있어요')]);
    await verifyAndFill();
    submit();
    expect(await screen.findByText('서버가 잠시 쉬고 있어요')).toHaveClass('form-msg--error');
    expect(screen.getByLabelText('비밀번호')).toHaveValue('');
  });

  it('인증번호를 보낼 때 닉네임이 겹치면 닉네임 칸 아래에 알리고, 그 밖의 오류는 인증 영역에 보여 준다', async () => {
    mockFetch([
      { method: 'POST', path: '/api/auth/verifications', status: 409, body: { error: { code: 'NICKNAME_TAKEN', message: AUTH.nicknameTaken } } },
    ]);
    document.cookie = 'XSRF-TOKEN=t; path=/';
    const { unmount } = renderWithProviders(<SignupForm onDone={() => undefined} />);
    fireEvent.change(await screen.findByLabelText('닉네임'), { target: { value: '수연' } });
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'a@b.com' } });
    fireEvent.click(screen.getByRole('button', { name: '인증번호 받기' }));
    expect(await screen.findByText(AUTH.nicknameTaken)).toBeInTheDocument();
    unmount();

    mockFetch([
      { method: 'POST', path: '/api/auth/verifications', status: 429, body: { error: { code: 'DAILY_LIMIT', message: AUTH.dailyLimit } } },
    ]);
    renderWithProviders(<SignupForm onDone={() => undefined} />);
    fireEvent.change(await screen.findByLabelText('닉네임'), { target: { value: '수연' } });
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'a@b.com' } });
    fireEvent.click(screen.getByRole('button', { name: '인증번호 받기' }));
    expect(await screen.findByText(AUTH.dailyLimit)).toBeInTheDocument();
    expect(screen.queryByLabelText('인증번호')).toBeNull();
  });

  it('칸을 떠나면 빈 칸·규칙 오류를 보여 주고, 인증 전 제출은 첫 오류 칸으로 옮긴다', async () => {
    const fetchMock = mockFetch([]);
    renderWithProviders(<SignupForm onDone={() => undefined} />);
    const nickname = await screen.findByLabelText('닉네임');
    fireEvent.blur(nickname);
    expect(screen.getByText(AUTH.required)).toBeInTheDocument();
    fireEvent.change(nickname, { target: { value: '!' } });
    expect(screen.getByText(AUTH.nicknameRule)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'short' } });
    fireEvent.blur(screen.getByLabelText('비밀번호'));
    expect(screen.getByText(AUTH.passwordRule)).toBeInTheDocument();

    fireEvent.submit(screen.getByRole('form', { name: '회원가입' }));
    expect(nickname).toHaveFocus();
    expect(fetchMock.mock.calls.some(([u]) => u === '/api/auth/signup')).toBe(false);
  });
});
