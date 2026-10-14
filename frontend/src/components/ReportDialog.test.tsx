import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithProviders } from '../test/utils';
import { ReportDialog } from './ReportDialog';

const reportBody = (fetchMock: ReturnType<typeof mockFetch>) => {
  const call = fetchMock.mock.calls.find(([url, init]) => url === '/api/posts/7/reports' && init?.method === 'POST');
  return call ? (JSON.parse(String(call[1]?.body)) as unknown) : undefined;
};

describe('신고 창 (CF-21)', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=t; path=/';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('사유를 고르지 않으면 보내지 않고 안내한다', async () => {
    const fetchMock = mockFetch([{ path: '/api/auth/me', status: 204 }]);
    const user = userEvent.setup();
    renderWithProviders(<ReportDialog postId={7} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: '신고하기' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '신고하기' }));
    expect(await screen.findByText('신고 사유를 골라 주세요')).toBeInTheDocument();
    expect(reportBody(fetchMock)).toBeUndefined();
    // 사유를 고르면 안내가 사라진다
    await user.click(screen.getByLabelText('스팸'));
    expect(screen.queryByText('신고 사유를 골라 주세요')).toBeNull();
  });

  it('기타를 고르면 설명칸이 열리고, 설명과 함께 보낸 뒤 알림을 띄우고 닫는다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', status: 204 },
      { method: 'POST', path: '/api/posts/7/reports', status: 204 },
    ]);
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ReportDialog postId={7} onClose={onClose} />);
    expect(screen.queryByLabelText('설명 (선택)')).toBeNull();
    await user.click(screen.getByLabelText('기타'));
    await user.type(screen.getByLabelText('설명 (선택)'), '  광고 글이에요 ');
    expect(screen.getByText('10/200')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '신고하기' }));
    expect(await screen.findByText('신고가 접수되었습니다')).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    expect(reportBody(fetchMock)).toEqual({ reason: 'OTHER', detail: '광고 글이에요' });
  });

  it('기타가 아닌 사유는 설명 없이 사유만 보낸다', async () => {
    const fetchMock = mockFetch([
      { path: '/api/auth/me', status: 204 },
      { method: 'POST', path: '/api/posts/7/reports', status: 204 },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<ReportDialog postId={7} onClose={vi.fn()} />);
    await user.click(screen.getByLabelText('욕설·혐오'));
    await user.click(screen.getByRole('button', { name: '신고하기' }));
    expect(await screen.findByText('신고가 접수되었습니다')).toBeInTheDocument();
    expect(reportBody(fetchMock)).toEqual({ reason: 'ABUSE' });
  });

  it('이미 신고한 글이면 그 문구를, 다른 오류는 서버 문구를 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { method: 'POST', path: '/api/posts/7/reports', status: 409, body: { error: { code: 'ALREADY_REPORTED', message: 'dup' } } },
      { method: 'POST', path: '/api/posts/8/reports', status: 500, body: { error: { code: 'INTERNAL', message: '서버 오류입니다' } } },
    ]);
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<ReportDialog postId={7} onClose={vi.fn()} />);
    await user.click(screen.getByLabelText('음란물'));
    await user.click(screen.getByRole('button', { name: '신고하기' }));
    expect(await screen.findByText('이미 신고한 글입니다')).toBeInTheDocument();
    unmount();

    renderWithProviders(<ReportDialog postId={8} onClose={vi.fn()} />);
    await user.click(screen.getByLabelText('스팸'));
    await user.click(screen.getByRole('button', { name: '신고하기' }));
    expect(await screen.findByText('서버 오류입니다')).toBeInTheDocument();
  });

  it('취소를 누르면 닫는다', async () => {
    mockFetch([{ path: '/api/auth/me', status: 204 }]);
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ReportDialog postId={7} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
