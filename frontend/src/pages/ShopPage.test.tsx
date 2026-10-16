import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, type MockRoute, renderWithProviders } from '../test/utils';
import { ShopPage } from './ShopPage';

const me = { member: { id: 3, nickname: '끄적이', email: 'd@b.com' }, blog: { id: 1, name: '생각 서랍' }, newCommentCount: 0 };
const packs = [
  {
    code: 'autumn',
    name: '가을 팩',
    description: '낙엽과 도토리',
    price: 100,
    owned: false,
    stickers: [
      { code: 'leaf', name: '낙엽', limited: false },
      { code: 'acorn', name: '도토리', limited: false },
    ],
  },
  { code: 'cafe', name: '카페 팩', description: '커피 한 잔', price: 30, owned: false, stickers: [{ code: 'cup', name: '커피잔', limited: false }] },
  { code: 'basic', name: '기본 팩', description: '처음 팩', price: 10, owned: true, stickers: [] },
];
const challenges = [
  {
    code: 'first-post',
    title: '첫 글 쓰기',
    description: '글을 하나 써 보세요',
    goal: 1,
    progress: 1,
    rewardInk: 50,
    rewardSticker: { code: 'star', name: '반짝 별', limited: true },
    completed: true,
    claimed: false,
  },
  { code: 'ten-comments', title: '댓글 열 개', description: '댓글을 열 개 달아요', goal: 10, progress: 4, rewardInk: 30, rewardSticker: null, completed: false, claimed: false },
  { code: 'checkin', title: '첫 출석', description: '출석해요', goal: 1, progress: 1, rewardInk: 10, rewardSticker: null, completed: true, claimed: true },
];
const wallet = {
  balance: 50,
  checkedInToday: true,
  streak: 4,
  earn: { checkin: 10, post: 20, postDailyMax: 3, postsToday: 5, comment: 2, commentDailyMax: 10, commentsToday: 1 },
  history: [
    { id: 2, amount: -30, reason: 'PURCHASE', label: '카페 팩', createdAt: '2026-10-13T10:00:00+09:00' },
    { id: 1, amount: 10, reason: 'CHECKIN', label: null, createdAt: '2026-10-13T09:00:00+09:00' },
  ],
};

function setup({ loggedIn = true, path = '/shop', extra = [] as MockRoute[], ink = wallet as unknown } = {}) {
  const fetchMock = mockFetch([
    ...extra,
    loggedIn ? { path: '/api/auth/me', body: me } : { path: '/api/auth/me', status: 204 },
    { path: '/api/me/ink', body: ink },
    { path: '/api/shop/packs', body: packs },
    { path: '/api/shop/challenges', body: challenges },
  ]);
  renderWithProviders(<ShopPage />, { path });
  return fetchMock;
}

describe('스티커 상점', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=t; path=/';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('비로그인: 팩과 한정 스티커를 보여 주고, 사려면 로그인하라고 안내한다 (요청하지 않음)', async () => {
    const fetchMock = setup({ loggedIn: false });
    expect(await screen.findByRole('heading', { name: '가을 팩' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '스티커 상점' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '상점' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByAltText('낙엽')).toHaveAttribute('src', '/stickers/leaf.svg');
    expect(screen.getByText('✓ 가진 팩')).toBeInTheDocument();
    expect(await screen.findByText('도전과제로만 받을 수 있어요')).toBeInTheDocument();
    expect(screen.getByTitle('반짝 별 — 첫 글 쓰기')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '로그인하면 살 수 있어요' })).toBeInTheDocument();
    expect(screen.getByText('매일 출석 +10')).toBeInTheDocument();
    expect(screen.queryByText('잉크 내역')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u]) => u === '/api/me/ink')).toBe(false);

    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);
    fireEvent.click(screen.getAllByRole('button', { name: '구매' })[0]);
    expect(confirm).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'POST')).toBe(false);
  });

  it('로그인: 잔액·출석·오늘 받은 횟수·내역을 보여 주고, 잉크가 모자란 팩은 막는다', async () => {
    setup();
    const side = await screen.findByRole('complementary');
    expect(await within(side).findByText('50')).toBeInTheDocument();
    expect(within(side).getByText('오늘 출석 완료')).toBeInTheDocument();
    expect(within(side).getByText('연속 출석 4일')).toBeInTheDocument();
    expect(within(side).getByText('오늘 1/1')).toBeInTheDocument();
    expect(within(side).getByText('오늘 3/3')).toBeInTheDocument();
    expect(within(side).getByText('오늘 1/10')).toBeInTheDocument();
    expect(within(side).getByText('-30')).toHaveClass('ink-minus');
    expect(within(side).getByText('+10')).toHaveClass('ink-plus');
    expect(within(side).getByText('· 카페 팩')).toBeInTheDocument();
    expect(await screen.findByText('50 잉크가 더 필요해요')).toBeInTheDocument();
    const [autumnBuy, cafeBuy] = screen.getAllByRole('button', { name: '구매' });
    expect(autumnBuy).toBeDisabled();
    expect(cafeBuy).toBeEnabled();
  });

  it('팩을 사겠다고 확인하면 사고 알림을 띄우며, 취소하면 요청하지 않는다', async () => {
    const fetchMock = setup({ extra: [{ method: 'POST', path: '/api/shop/packs/cafe/buy', body: { balance: 20, packCode: 'cafe' } }] });
    await screen.findByText('50 잉크가 더 필요해요');
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    const cafeBuy = screen.getAllByRole('button', { name: '구매' })[1];
    fireEvent.click(cafeBuy);
    expect(confirm).toHaveBeenCalledWith("'카페 팩' 팩을 30 잉크에 살까요?");
    expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'POST')).toBe(false);
    confirm.mockReturnValue(true);
    fireEvent.click(cafeBuy);
    expect(await screen.findByText("'카페 팩' 팩을 샀어요. 다이어리 설정에서 표지에 붙여 보세요")).toBeInTheDocument();
  });

  it('팩 사기에 실패하면 오류 알림을 띄운다', async () => {
    setup({ extra: [{ method: 'POST', path: '/api/shop/packs/cafe/buy', status: 409, body: { error: { code: 'INSUFFICIENT_INK', message: '' } } }] });
    await screen.findByText('50 잉크가 더 필요해요');
    vi.stubGlobal('confirm', vi.fn(() => true));
    fireEvent.click(screen.getAllByRole('button', { name: '구매' })[1]);
    expect(await screen.findByRole('alert')).toHaveTextContent('잉크가 부족해요');
  });

  it('내역이 없으면 빈 안내를 보여 준다', async () => {
    setup({ ink: { ...wallet, checkedInToday: false, streak: 0, history: [] } });
    expect(await screen.findByText('아직 내역이 없어요')).toBeInTheDocument();
    expect(screen.getByText('오늘 0/1')).toBeInTheDocument();
    expect(screen.queryByText('오늘 출석 완료')).not.toBeInTheDocument();
  });

  it('탭을 바꾸면 주소의 tab 값이 바뀌고 내 스티커를 보여 준다', async () => {
    setup({
      extra: [
        {
          path: '/api/me/stickers',
          body: [
            { code: 'leaf', name: '낙엽', limited: false, packName: '가을 팩', acquiredAt: '2026-10-01T00:00:00+09:00' },
            { code: 'star', name: '반짝 별', limited: true, packName: null, acquiredAt: '2026-10-02T00:00:00+09:00' },
          ],
        },
      ],
    });
    await screen.findByRole('heading', { name: '가을 팩' });
    fireEvent.click(screen.getByRole('tab', { name: '내 스티커' }));
    expect(await screen.findByText('낙엽')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '내 스티커' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('가을 팩')).toBeInTheDocument();
    expect(screen.getByText('한정')).toHaveClass('badge--limited');
    fireEvent.click(screen.getByRole('tab', { name: '상점' }));
    expect(await screen.findByRole('heading', { name: '카페 팩' })).toBeInTheDocument();
  });

  it('내 스티커: 비로그인이면 로그인하라고 안내한다', async () => {
    setup({ loggedIn: false, path: '/shop?tab=mine' });
    expect(await screen.findByText('로그인하면 내 스티커를 볼 수 있어요')).toBeInTheDocument();
  });

  it('내 스티커가 없으면 상점 가기 링크를 보여 준다', async () => {
    setup({ path: '/shop?tab=mine', extra: [{ path: '/api/me/stickers', body: [] }] });
    expect(await screen.findByText(/아직 가진 스티커가 없어요/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '상점 가기' })).toHaveAttribute('href', '/shop');
  });

  it('내 스티커를 못 받으면 오류를 보여 준다', async () => {
    setup({ path: '/shop?tab=mine', extra: [{ path: '/api/me/stickers', status: 500, body: { error: { code: 'X', message: '스티커 오류' } } }] });
    expect(await screen.findByText('스티커 오류')).toBeInTheDocument();
  });

  it('도전과제: 진행률과 받음·받기·진행 중 상태를 보여 주고, 받기를 누르면 보상을 받는다', async () => {
    const fetchMock = setup({
      path: '/shop?tab=challenges',
      extra: [{ method: 'POST', path: '/api/shop/challenges/first-post/claim', body: { earned: 50, sticker: { code: 'star', name: '반짝 별' }, balance: 100 } }],
    });
    const bar = await screen.findByRole('progressbar', { name: '댓글 열 개' });
    expect(bar).toHaveAttribute('aria-valuenow', '4');
    expect(screen.getByText('4/10')).toBeInTheDocument();
    expect(screen.getByText('✓ 받음')).toBeInTheDocument();
    expect(screen.getByText('진행 중')).toBeInTheDocument();
    expect(screen.getByText('· 반짝 별')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: '받기' }));
    expect(await screen.findByText("'반짝 별' 스티커를 받았어요")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u, i]) => u === '/api/shop/challenges/first-post/claim' && i?.method === 'POST')).toBe(true);
  });

  it('도전과제 받기에 실패하면 오류 알림을 띄운다', async () => {
    setup({
      path: '/shop?tab=challenges',
      extra: [{ method: 'POST', path: '/api/shop/challenges/first-post/claim', status: 409, body: { error: { code: 'ALREADY_CLAIMED', message: '' } } }],
    });
    fireEvent.click(await screen.findByRole('button', { name: '받기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('이미 보상을 받았어요');
  });

  it('비로그인이면 다 깬 도전과제도 받기 버튼이 없다', async () => {
    setup({ loggedIn: false, path: '/shop?tab=challenges' });
    expect(await screen.findByText('첫 글 쓰기')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '받기' })).not.toBeInTheDocument();
    expect(screen.getAllByText('진행 중')).toHaveLength(2);
  });

  it('팩·도전과제를 못 받으면 오류를 보여 준다', async () => {
    mockFetch([
      { path: '/api/auth/me', status: 204 },
      { path: '/api/shop/packs', status: 500, body: { error: { code: 'X', message: '팩 오류' } } },
      { path: '/api/shop/challenges', status: 500, body: { error: { code: 'X', message: '도전 오류' } } },
    ]);
    renderWithProviders(<ShopPage />, { path: '/shop' });
    expect(await screen.findByText('팩 오류')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '도전과제' }));
    await waitFor(() => expect(screen.getByText('도전 오류')).toBeInTheDocument());
  });
});
