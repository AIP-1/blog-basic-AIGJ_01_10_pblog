import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  getMyStickers,
  shopKeys,
  STICKER_ROTATIONS,
  STICKER_SLOTS,
  STICKERS_PER_DIARY,
  type DiarySticker,
  type StickerSlot,
} from '../api/shop';
import type { Visibility } from '../api/types';
import { SHOP } from '../messages';
import { DiaryCover } from './BlogShell';
import { StickerImg } from './Sticker';

function rotationLabel(r: number): string {
  if (r > 0) return `↻${r}°`;
  if (r < 0) return `↺${-r}°`;
  return '0°';
}

/**
 * 다이어리 설정의 표지 꾸미기: 큰 표지 위의 자리(점선 동그라미)를 고르고, 가진 스티커를 눌러 붙인다.
 * 자리마다 기울기를 고르거나 뗄 수 있다. 저장은 다이어리 설정의 '저장'과 함께 한다.
 */
export function CoverStickerEditor({
  colorIndex,
  visibility,
  value,
  onChange,
}: Readonly<{
  colorIndex: number;
  visibility: Visibility;
  value: DiarySticker[];
  onChange: (next: DiarySticker[]) => void;
}>) {
  const mineQ = useQuery({ queryKey: shopKeys.mine, queryFn: getMyStickers });
  // 처음 고른 자리: 자리가 남았으면 빈 자리, 다 찼으면 첫 스티커 자리
  const [slot, setSlot] = useState<StickerSlot>(() =>
    value.length >= STICKERS_PER_DIARY ? value[0].slot : (STICKER_SLOTS.find((s) => !value.some((v) => v.slot === s)) ?? 'TL'),
  );
  const [warn, setWarn] = useState(false);
  const current = value.find((v) => v.slot === slot);
  const owned = mineQ.data ?? [];

  const place = (code: string) => {
    if (current) {
      onChange(value.map((v) => (v.slot === slot ? { ...v, code } : v)));
    } else if (value.length >= STICKERS_PER_DIARY) {
      setWarn(true);
      return;
    } else {
      onChange([...value, { slot, code, rotation: 0 }]);
    }
    setWarn(false);
  };
  const tilt = (rotation: number) => onChange(value.map((v) => (v.slot === slot ? { ...v, rotation } : v)));
  const remove = () => {
    onChange(value.filter((v) => v.slot !== slot));
    setWarn(false);
  };

  const renderOwned = () => {
    if (mineQ.isPending) return null;
    if (owned.length === 0) {
      return (
        <p className="cover-editor__empty muted">
          {SHOP.coverEmpty} <Link to="/shop">{SHOP.coverGoShop}</Link>
        </p>
      );
    }
    return (
      <ul className="cover-editor__stickers">
        {owned.map((s) => (
          <li key={s.code}>
            <button
              type="button"
              className={current?.code === s.code ? 'is-on' : undefined}
              title={s.name}
              aria-label={s.name}
              onClick={() => place(s.code)}
            >
              <StickerImg code={s.code} size={40} />
            </button>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="cover-editor">
      <div className="cover-editor__stage">
        <DiaryCover colorIndex={colorIndex} size="xl" visibility={visibility} stickers={value} />
        <div className="cover-editor__slots">
          {STICKER_SLOTS.map((s) => {
            const taken = value.some((v) => v.slot === s);
            return (
              <button
                key={s}
                type="button"
                className={`cover-editor__slot cover-editor__slot--${s}${s === slot ? ' is-on' : ''}${taken ? ' is-taken' : ''}`}
                aria-pressed={s === slot}
                aria-label={SHOP.slots[s]}
                title={SHOP.slots[s]}
                onClick={() => setSlot(s)}
              />
            );
          })}
        </div>
      </div>
      <div className="cover-editor__panel">
        <p className="cover-editor__hint muted">{SHOP.coverHint(STICKERS_PER_DIARY)}</p>
        <div className="cover-editor__row">
          <b className="cover-editor__slotname">{SHOP.slots[slot]}</b>
          <span className="muted">
            {value.length}/{STICKERS_PER_DIARY}
          </span>
          {current && (
            <button type="button" className="btn btn--sm btn--text cover-editor__remove" onClick={remove}>
              {SHOP.coverRemove}
            </button>
          )}
        </div>
        {current && (
          <div className="segmented cover-editor__tilt" role="group" aria-label={SHOP.coverTilt}>
            {STICKER_ROTATIONS.map((r) => (
              <button
                key={r}
                type="button"
                className={current.rotation === r ? 'is-active' : undefined}
                aria-pressed={current.rotation === r}
                onClick={() => tilt(r)}
              >
                {rotationLabel(r)}
              </button>
            ))}
          </div>
        )}
        {warn && <p className="cover-editor__warn">{SHOP.coverMax(STICKERS_PER_DIARY)}</p>}
        {renderOwned()}
      </div>
    </div>
  );
}
