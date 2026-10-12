import type { PostSummary } from '../api/types';

/**
 * 추천 글에 쓰는 '읽은 글' 기록 (데모 '간단한 맞춤 추천').
 * 이 브라우저에만 남고 서버로 보내지 않는다. 기록 지우기 · 끄기를 할 수 있다.
 */
const KEY = 'sagak.reads.v1';
const OFF_KEY = 'sagak.reads.off';
const MAX = 50;

export interface ReadEntry {
  id: number;
  blogId: number;
  categoryName: string;
  at: number;
}

function load(): ReadEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? (list as ReadEntry[]) : [];
  } catch {
    return [];
  }
}

export function isTrackingOff(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) === '1';
  } catch {
    return false;
  }
}

export function setTrackingOff(off: boolean) {
  try {
    if (off) {
      localStorage.setItem(OFF_KEY, '1');
      localStorage.removeItem(KEY);
    } else {
      localStorage.removeItem(OFF_KEY);
    }
  } catch {
    /* 저장할 수 없는 브라우저면 무시 */
  }
}

export function clearReads() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
}

export function readCount(): number {
  return load().length;
}

/** 글을 열면 부른다 (내 글은 부르지 않는다). */
export function recordRead(entry: Omit<ReadEntry, 'at'>) {
  if (isTrackingOff()) return;
  const list = load().filter((e) => e.id !== entry.id);
  list.unshift({ ...entry, at: Date.now() });
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* 무시 */
  }
}

export interface Recommended extends PostSummary {
  reason: string;
}

/**
 * 후보(인기 글)에서 읽지 않은 글을 점수로 고른다: 자주 읽은 블로그 +3, 같은 다이어리 이름 +2.
 * 점수가 없으면 '인기 글'로 채운다.
 */
export function recommend(pool: PostSummary[], count: number, myBlogId?: number | null): Recommended[] {
  const reads = isTrackingOff() ? [] : load();
  const readIds = new Set(reads.map((r) => r.id));
  const blogFreq = new Map<number, number>();
  const catNames = new Set<string>();
  for (const r of reads) {
    blogFreq.set(r.blogId, (blogFreq.get(r.blogId) ?? 0) + 1);
    catNames.add(r.categoryName);
  }
  const candidates = pool.filter((p) => !readIds.has(p.id) && p.blog.id !== myBlogId);
  const scored = candidates
    .map((p, i) => {
      const fromBlog = blogFreq.has(p.blog.id);
      const sameCat = !!p.category && catNames.has(p.category.name);
      const score = (fromBlog ? 3 : 0) + (sameCat ? 2 : 0);
      const reason = fromBlog ? `자주 읽은 '${p.blog.name}'` : sameCat ? `읽은 '${p.category?.name}' 다이어리와 비슷` : '인기 글';
      return { p, i, score, reason };
    })
    .sort((a, b) => b.score - a.score || a.i - b.i);
  return scored.slice(0, count).map(({ p, reason }) => ({ ...p, reason }));
}
