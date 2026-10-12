/**
 * 글쓰기 칸에서는 사진 마크다운(![](주소)) 대신 짧은 이름표 "[📷 사진 N]"을 보여 준다.
 * 실제로 저장하는 본문은 그대로 마크다운이고, N은 올린 순서(1부터)다.
 */
type Photo = { url: string };

const MD_IMAGE = /!\[[^\]\n]*\]\(([^)\s]+)\)/g;
const TOKEN = /\[📷 사진 (\d+)\]/g;

export const photoToken = (n: number) => `[📷 사진 ${n}]`;

/** 마크다운 본문 → 글쓰기 칸에 보일 글. 올린 사진이 아닌 주소는 그대로 둔다 */
export function toDisplay(body: string, photos: Photo[]): string {
  return body.replace(MD_IMAGE, (whole, url: string) => {
    const i = photos.findIndex((p) => p.url === url);
    return i < 0 ? whole : photoToken(i + 1);
  });
}

/** 글쓰기 칸의 글 → 마크다운 본문. 없는 번호의 이름표는 글자 그대로 둔다 */
export function fromDisplay(text: string, photos: Photo[]): string {
  return text.replace(TOKEN, (whole, n: string) => {
    const p = photos[Number(n) - 1];
    return p ? `![](${p.url})` : whole;
  });
}
