import { stickerUrl, type DiarySticker } from '../api/shop';

/** 스티커 한 장. 그림은 public/stickers/<code>.svg, 하얀 테두리(칼선)와 그림자는 CSS로 붙인다 */
export function StickerImg({ code, name, size, className }: { code: string; name?: string; size?: number; className?: string }) {
  return (
    <img
      src={stickerUrl(code)}
      alt={name ?? ''}
      width={size}
      height={size}
      className={`sticker${className ? ` ${className}` : ''}`}
      draggable={false}
      loading="lazy"
    />
  );
}

/** 잉크 방울 */
export function InkIcon({ size = 14 }: { size?: number }) {
  return (
    <svg className="ink-icon" viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
      <path fill="currentColor" d="M8 1.2c.3 0 .6.2.8.5C10.4 4 13 7.3 13 10a5 5 0 0 1-10 0c0-2.7 2.6-6 4.2-8.3.2-.3.5-.5.8-.5Z" />
      <ellipse cx="6.2" cy="10.2" rx="1.1" ry="1.7" fill="#fff" opacity=".55" />
    </svg>
  );
}

/** 다이어리 표지에 붙인 스티커들 (DiaryCover 안에 그린다) */
export function CoverStickers({ stickers }: { stickers?: DiarySticker[] }) {
  if (!stickers || stickers.length === 0) return null;
  return (
    <>
      {stickers.map((s) => (
        <img
          key={s.slot}
          src={stickerUrl(s.code)}
          alt=""
          className={`cover__sticker cover__sticker--${s.slot}`}
          style={{ ['--rot' as string]: `${s.rotation}deg` }}
          draggable={false}
        />
      ))}
    </>
  );
}
