import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTH, SOCIAL_LOGIN } from '../messages';
import { mockFetch, renderWithProviders } from '../test/utils';
import { SocialSignupPage } from './SocialSignupPage';

const pending = { provider: 'kakao', email: 'kakao@example.com', nickname: '카카오곰' };

function LocationProbe() {
  const { pathname } = useLocation();
  return <output data-testid="path">{pathname}</output>;
}

function renderPage() {
  return renderWithProviders(
    <>
      <SocialSignupPage />
      <LocationProbe />
    </>,
    { path: '/signup/social' },
  );
}

describe('소셜 가입 화면', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('가입 대기 정보가 없으면(404) 처음부터 다시 하라고 안내한다', async () => {
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/auth/social/pending', status: 404, body: { error: { code: 'SOCIAL_SIGNUP_NOT_FOUND', message: '' } } },
    ]);
    renderPage();
    expect(await screen.findByText(SOCIAL_LOGIN.pendingMissing)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: SOCIAL_LOGIN.backHome })).toHaveAttribute('href', '/');
  });

  it('다른 오류면 서버 문구를 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/auth/social/pending', status: 500, body: { error: { code: 'INTERNAL', message: '서버가 잠시 아파요' } } },
    ]);
    renderPage();
    expect(await screen.findByText('서버가 잠시 아파요')).toBeInTheDocument();
  });

  it('제공자 이름·이메일(읽기 전용)·추천 닉네임을 채워 보여 주고, 닉네임 규칙을 확인한다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/auth/social/pending', body: pending },
    ]);
    renderPage();
    expect(await screen.findByRole('heading', { name: '카카오로 가입' })).toBeInTheDocument();
    expect(screen.getByLabelText('이메일')).toHaveValue('kakao@example.com');
    expect(screen.getByLabelText('이메일')).toHaveAttribute('readonly');
    expect(screen.getByText(SOCIAL_LOGIN.emailHint('카카오'))).toBeInTheDocument();
    const nickname = screen.getByLabelText('닉네임');
    expect(nickname).toHaveValue('카카오곰');

    fireEvent.change(nickname, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: SOCIAL_LOGIN.signupSubmit }));
    expect(await screen.findByText(AUTH.required)).toBeInTheDocument();
    expect(nickname).toHaveFocus();

    fireEvent.change(nickname, { target: { value: '!' } });
    expect(screen.getByText(AUTH.nicknameRule)).toBeInTheDocument();
    expect(nickname).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock.mock.calls.some(([u]) => u === '/api/auth/social/signup')).toBe(false);
  });

  it('이미 쓰는 닉네임이면 닉네임 칸 아래에 알려 주고, 고치면 지운다', async () => {
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/auth/social/pending', body: pending },
      {
        method: 'POST',
        path: '/api/auth/social/signup',
        status: 409,
        body: { error: { code: 'NICKNAME_TAKEN', message: AUTH.nicknameTaken } },
      },
    ]);
    document.cookie = 'XSRF-TOKEN=t; path=/';
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: SOCIAL_LOGIN.signupSubmit }));
    expect(await screen.findByText(AUTH.nicknameTaken)).toBeInTheDocument();
    expect(screen.getByLabelText('닉네임')).toHaveFocus();
    fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: '다른곰' } });
    expect(screen.queryByText(AUTH.nicknameTaken)).toBeNull();
  });

  it('그 밖의 가입 오류는 폼 아래에 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/auth/social/pending', body: pending },
      { method: 'POST', path: '/api/auth/social/signup', status: 500, body: { error: { code: 'INTERNAL', message: '잠시 뒤 다시 시도해 주세요' } } },
    ]);
    document.cookie = 'XSRF-TOKEN=t; path=/';
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: SOCIAL_LOGIN.signupSubmit }));
    expect(await screen.findByText('잠시 뒤 다시 시도해 주세요')).toBeInTheDocument();
  });

  it('가입하면 다듬은 닉네임을 보내고, 환영 알림 뒤 홈으로 간다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/auth/social/pending', body: pending },
      { method: 'POST', path: '/api/auth/social/signup', body: { id: 1, member: { id: 1, nickname: '새곰', email: pending.email } } },
    ]);
    document.cookie = 'XSRF-TOKEN=t; path=/';
    renderPage();
    fireEvent.change(await screen.findByLabelText('닉네임'), { target: { value: ' 새곰 ' } });
    fireEvent.click(screen.getByRole('button', { name: SOCIAL_LOGIN.signupSubmit }));
    expect(await screen.findByText(SOCIAL_LOGIN.signupDone)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent(/^\/$/));
    const call = fetchMock.mock.calls.find(([u]) => u === '/api/auth/social/signup');
    expect(JSON.parse((call?.[1] as RequestInit).body as string)).toEqual({ nickname: '새곰' });
  });
});
