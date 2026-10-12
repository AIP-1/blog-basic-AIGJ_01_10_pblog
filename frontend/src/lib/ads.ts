/** 메인 맨 위 슬라이드 광고 — 지금은 자리표시 (데모 config.js의 ADS). image를 넣으면 오른쪽에 그림이 나온다 */
export interface AdSlide {
  kicker: string;
  title: string;
  text: string;
  href: string;
  bg: string;
  fg: string;
  image?: string;
}

export const AD_INTERVAL_MS = 5000;

export const ADS: AdSlide[] = [
  { kicker: '광고 자리 1', title: '이 자리에 광고 배너가 들어가요', text: '가로로 넓은 배너 · 5초마다 다음 광고로 넘어가요', href: '/', bg: '#eef3fb', fg: '#1f3a5f' },
  { kicker: '광고 자리 2', title: '새 다이어리를 펼쳐 보세요', text: '오늘 있었던 일을 한 줄만 적어도 충분해요', href: '/write', bg: '#fbf0ea', fg: '#6b3a1f' },
  { kicker: '광고 자리 3', title: '공지사항 · 바뀐 점 보기', text: '사각의 새 소식과 버전별로 바뀐 점', href: '/notices', bg: '#eef7f2', fg: '#1f5a43' },
];
