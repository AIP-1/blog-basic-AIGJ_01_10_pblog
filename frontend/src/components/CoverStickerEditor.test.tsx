import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiarySticker } from '../api/shop';
import { mockFetch, renderWithProviders } from '../test/utils';
import { CoverStickerEditor } from './CoverStickerEditor';

const owned = [
  { code: 'leaf', name: '낙엽', limited: false, packName: '가을 팩', acquiredAt: '2026-10-01T00:00:00+09:00' },
  { code: 'cup', name: '커피잔', limited: false, packName: '카페 팩', acquiredAt: '2026-10-01T00:00:00+09:00' },
];

let latest: DiarySticker[] = [];
function Harness({ initial }: { initial: DiarySticker[] }) {
  const [value, setValue] = useState(initial);
  return (
    <CoverStickerEditor
      colorIndex={2}
      visibility="PUBLIC"
      value={value}
      onChange={(next) => {
        latest = next;
        setValue(next);
      }}
    />
  );
}

function setup(initial: DiarySticker[] = [], stickers: unknown = owned) {
  latest = initial;
  mockFetch([
    { path: '/api/auth/me', status: 204 },
    { path: '/api/me/stickers', body: stickers },
  ]);
  return renderWithProviders(<Harness initial={initial} />);
}

describe('다이어리 표지 스티커 꾸미기', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('빈 표지: 첫 자리(왼쪽 위)를 고른 채로 시작하고, 스티커를 누르면 그 자리에 붙인다', async () => {
    setup();
    expect(screen.getByRole('button', { name: '왼쪽 위' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('0/3')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: '낙엽' }));
    expect(latest).toEqual([{ slot: 'TL', code: 'leaf', rotation: 0 }]);
    expect(screen.getByText('1/3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '낙엽' })).toHaveClass('is-on');
    expect(screen.getByRole('button', { name: '왼쪽 위' })).toHaveClass('is-taken');

    // 같은 자리에서 다른 스티커를 누르면 바꾼다
    fireEvent.click(screen.getByRole('button', { name: '커피잔' }));
    expect(latest).toEqual([{ slot: 'TL', code: 'cup', rotation: 0 }]);
  });

  it('붙인 자리에서는 기울기를 고르고 뗄 수 있다', async () => {
    setup([{ slot: 'TL', code: 'leaf', rotation: 0 }]);
    // 빈 자리가 남았으니 다음 빈 자리(오른쪽 위)를 고른 채로 시작한다
    expect(screen.getByRole('button', { name: '오른쪽 위' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('group', { name: '기울기' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '왼쪽 위' }));
    expect(screen.getByRole('button', { name: '0°' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '↻15°' }));
    expect(latest).toEqual([{ slot: 'TL', code: 'leaf', rotation: 15 }]);
    expect(screen.getByRole('button', { name: '↻15°' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '↺8°' }));
    expect(latest[0].rotation).toBe(-8);
    fireEvent.click(screen.getByRole('button', { name: '떼기' }));
    expect(latest).toEqual([]);
    expect(screen.queryByRole('button', { name: '떼기' })).not.toBeInTheDocument();
  });

  it('세 장이 다 찼으면 빈 자리에 더 붙이지 못하게 알린다', async () => {
    setup([
      { slot: 'TL', code: 'leaf', rotation: 0 },
      { slot: 'TR', code: 'cup', rotation: 8 },
      { slot: 'C', code: 'leaf', rotation: 0 },
    ]);
    // 다 찼으면 첫 스티커 자리를 고른 채로 시작한다
    expect(screen.getByRole('button', { name: '왼쪽 위' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '오른쪽 아래' }));
    fireEvent.click(await screen.findByRole('button', { name: '커피잔' }));
    expect(screen.getByText('스티커는 3개까지 붙일 수 있어요')).toBeInTheDocument();
    expect(latest).toHaveLength(3);
    // 붙은 자리로 옮겨 떼면 경고가 사라진다
    fireEvent.click(screen.getByRole('button', { name: '가운데' }));
    fireEvent.click(screen.getByRole('button', { name: '떼기' }));
    expect(screen.queryByText('스티커는 3개까지 붙일 수 있어요')).not.toBeInTheDocument();
    expect(latest).toHaveLength(2);
  });

  it('가진 스티커가 없으면 상점 가기 링크를 보여 준다', async () => {
    setup([], []);
    await waitFor(() => expect(screen.getByText(/아직 가진 스티커가 없어요/)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: '상점 가기' })).toHaveAttribute('href', '/shop');
  });
});
