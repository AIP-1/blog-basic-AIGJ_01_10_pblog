import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithProviders } from '../test/utils';
import { SocialLoginButtons } from './SocialLoginButtons';

describe('SocialLoginButtons', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('서버에 켜진 제공자만 보여 준다', async () => {
    mockFetch([{ path: '/api/config', body: { socialLogin: ['google'] } }]);
    renderWithProviders(<SocialLoginButtons />);
    const google = await screen.findByRole('link', { name: '구글로 시작하기' });
    expect(google).toHaveAttribute('href', '/oauth2/authorization/google');
    expect(screen.queryByRole('link', { name: '카카오로 시작하기' })).not.toBeInTheDocument();
    expect(screen.getByText('또는')).toBeInTheDocument();
  });

  it('둘 다 켜져 있으면 카카오, 구글 순서로 보여 준다', async () => {
    mockFetch([{ path: '/api/config', body: { socialLogin: ['google', 'kakao'] } }]);
    renderWithProviders(<SocialLoginButtons />);
    await screen.findByRole('link', { name: '카카오로 시작하기' });
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/oauth2/authorization/kakao', '/oauth2/authorization/google']);
  });

  it('켜진 제공자가 없으면 "또는" 줄까지 아무것도 그리지 않는다', async () => {
    const fetchMock = mockFetch([{ path: '/api/config', body: { socialLogin: [] } }]);
    const { container } = renderWithProviders(<SocialLoginButtons />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container.querySelector('.social-login')).toBeNull();
    expect(screen.queryByText('또는')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
