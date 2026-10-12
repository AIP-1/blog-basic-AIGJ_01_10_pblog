import { beforeEach, describe, expect, it } from 'vitest';
import type { PostSummary } from '../api/types';
import { formatRelative } from './format';
import { clearReads, readCount, recommend, recordRead, setTrackingOff } from './readHistory';

const post = (id: number, blogId: number, cat: string): PostSummary => ({
  id,
  title: `글 ${id}`,
  excerpt: '',
  createdAt: '2026-10-01T00:00:00Z',
  blog: { id: blogId, name: `블로그 ${blogId}` },
  category: { id: id * 10, name: cat },
});

describe('readHistory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('falls back to popular order without reads', () => {
    const pool = [post(1, 1, '일상'), post(2, 2, '여행')];
    expect(recommend(pool, 4).map((p) => [p.id, p.reason])).toEqual([
      [1, '인기 글'],
      [2, '인기 글'],
    ]);
  });

  it('prefers blogs and diaries the reader opened, skipping read posts and my blog', () => {
    recordRead({ id: 9, blogId: 2, categoryName: '여행' });
    const pool = [post(1, 1, '일상'), post(3, 3, '여행'), post(2, 2, '맛집'), post(9, 2, '여행'), post(5, 5, '일상')];
    const got = recommend(pool, 3, 5);
    expect(got.map((p) => p.id)).toEqual([2, 3, 1]);
    expect(readCount()).toBe(1);
    clearReads();
    expect(readCount()).toBe(0);
  });

  it('records nothing while tracking is off', () => {
    setTrackingOff(true);
    recordRead({ id: 1, blogId: 1, categoryName: '일상' });
    expect(readCount()).toBe(0);
  });
});

describe('formatRelative', () => {
  const now = Date.parse('2026-10-12T12:00:00Z');
  it('shows minutes, hours, days, then the date', () => {
    expect(formatRelative('2026-10-12T11:59:30Z', now)).toBe('방금 전');
    expect(formatRelative('2026-10-12T11:30:00Z', now)).toBe('30분 전');
    expect(formatRelative('2026-10-12T09:00:00Z', now)).toBe('3시간 전');
    expect(formatRelative('2026-10-09T12:00:00Z', now)).toBe('3일 전');
    expect(formatRelative('2026-10-01T12:00:00Z', now)).toBe('2026.10.01');
  });
});
