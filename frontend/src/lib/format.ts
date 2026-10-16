const TZ = 'Asia/Seoul';

function parts(iso: string, withTime: boolean): Record<string, string> | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) out[p.type] = p.value;
  return out;
}

/** 2026.10.01 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const p = parts(iso, false);
  return p ? `${p.year}.${p.month}.${p.day}` : '';
}

/** 2026.10.01 14:03 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const p = parts(iso, true);
  return p ? `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}` : '';
}

/** 방금 전 · N분 전 · N시간 전 · N일 전(5일까지), 그보다 오래면 2026.10.01 (데모 글 목록) */
export function formatRelative(iso: string | null | undefined, now: number = Date.now(), maxDays = 5): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const sec = Math.max(0, (now - t) / 1000);
  if (sec < 60) return '방금 전';
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  const days = Math.floor(sec / 86400);
  return days <= maxDays ? `${days}일 전` : formatDate(iso);
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
/** 2026년 10월 1일 수요일 14:03 (글 화면 · 마우스를 올리면 보이는 전체 날짜) */
export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return '';
  const p = parts(iso, true);
  if (!p) return '';
  const dow = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(new Date(iso));
  const idx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(dow);
  return `${p.year}년 ${Number(p.month)}월 ${Number(p.day)}일 ${DOW[idx] ?? ''}요일 ${p.hour}:${p.minute}`;
}

/** 14:03:05 */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(d);
}

/** 2026-10-01 → 10.01 (그래프 축) */
export function formatShortDay(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  return m ? `${m[2]}.${m[3]}` : date;
}

/** 잠금 해제까지 남은 분 (올림, 최소 1) */
export function minutesUntil(iso: string, now: number): number {
  const ms = new Date(iso).getTime() - now;
  if (Number.isNaN(ms)) return 10;
  return Math.max(1, Math.ceil(ms / 60_000));
}

/** 분류 색 점 (BM-04-3: 정해진 순서로 자동 배정) */
export const CATEGORY_COLORS = ['#f7c59f', '#a9cbef', '#a8dcc9', '#c7b8ea', '#f3e09a', '#f4b6c2', '#c5d6a0', '#d5dae2'];
export function categoryColor(index = 0): string {
  return CATEGORY_COLORS[((index % CATEGORY_COLORS.length) + CATEGORY_COLORS.length) % CATEGORY_COLORS.length];
}
