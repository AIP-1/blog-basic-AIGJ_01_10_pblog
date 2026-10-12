import { describe, expect, it } from 'vitest';
import { fromDisplay, toDisplay } from './photoTokens';

const photos = [{ url: '/images/a.jpg' }, { url: '/images/b.png' }];

describe('photoTokens', () => {
  it('글쓰기 칸에는 사진 주소 대신 이름표를 보여 준다', () => {
    const body = '카페\n![](/images/a.jpg)\n라떼\n![](/images/b.png)';
    expect(toDisplay(body, photos)).toBe('카페\n[📷 사진 1]\n라떼\n[📷 사진 2]');
  });

  it('이름표를 다시 마크다운으로 바꾼다', () => {
    const body = '카페\n![](/images/a.jpg)\n라떼\n![](/images/b.png)';
    expect(fromDisplay(toDisplay(body, photos), photos)).toBe(body);
  });

  it('올린 사진이 아닌 주소와 없는 번호는 그대로 둔다', () => {
    expect(toDisplay('![x](https://e.com/c.gif)', photos)).toBe('![x](https://e.com/c.gif)');
    expect(fromDisplay('[📷 사진 9]', photos)).toBe('[📷 사진 9]');
  });
});
