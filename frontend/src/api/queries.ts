import { useQuery } from '@tanstack/react-query';
import { DEFAULT_TOPICS, mergeConfig } from '../lib/config';
import { getConfig, getMe, getTopics, getTrending } from './endpoints';

export const qk = {
  me: ['me'] as const,
  config: ['config'] as const,
  topics: ['topics'] as const,
  trending: ['trending'] as const,
  home: ['home'] as const,
  notices: (page: number) => ['notices', page] as const,
  bookmarks: (folder: string, page: number) => ['bookmarks', folder, page] as const,
  bookmarkFolders: ['bookmarks', 'folders'] as const,
  subscriptions: ['subscriptions'] as const,
  diarySubscriptions: ['subscriptions', 'diaries'] as const,
  subscriptionPosts: (page: number, kind = 'all') => ['subscriptions', 'posts', kind, page] as const,
  feed: (topic: string, sort: string, page: number) => ['feed', topic, sort, page] as const,
  topic: (code: string) => ['topic', code] as const,
  blog: (id: string | number) => ['blog', String(id)] as const,
  blogAbout: (id: string | number) => ['blog', String(id), 'about'] as const,
  categories: (id: string | number) => ['blog', String(id), 'categories'] as const,
  blogPosts: (id: string | number, categoryId: string | null, page: number, tag = '', sort = 'latest') =>
    ['blog', String(id), 'posts', categoryId ?? 'all', page, tag, sort] as const,
  blogTags: (id: string | number) => ['blog', String(id), 'tags'] as const,
  pinned: (id: string | number) => ['blog', String(id), 'pinned'] as const,
  post: (id: string | number) => ['post', String(id)] as const,
  postEdit: (id: string | number) => ['post', String(id), 'edit'] as const,
  comments: (id: string | number) => ['post', String(id), 'comments'] as const,
  tagPosts: (name: string, page: number) => ['tag', name, page] as const,
  search: (q: string, type: string, page: number) => ['search', q, type, page] as const,
  myProfile: ['myProfile'] as const,
  lastCategory: ['lastCategory'] as const,
  drafts: ['drafts'] as const,
  draft: (id: number) => ['drafts', id] as const,
  dashboard: ['manage', 'dashboard'] as const,
  managePosts: (visibility: string, categoryId: string, page: number) =>
    ['manage', 'posts', visibility, categoryId, page] as const,
  manageComments: (page: number) => ['manage', 'comments', page] as const,
  stats: (days: number) => ['manage', 'stats', days] as const,
};

/** 로그인 상태. null 이면 비로그인. */
export function useMe() {
  return useQuery({ queryKey: qk.me, queryFn: getMe, staleTime: 60_000 });
}

export function useConfig() {
  const q = useQuery({ queryKey: qk.config, queryFn: getConfig, staleTime: Infinity, retry: 1 });
  return mergeConfig(q.data);
}

export function useTopics() {
  const config = useConfig();
  const q = useQuery({ queryKey: qk.topics, queryFn: getTopics, staleTime: Infinity, retry: 1 });
  if (q.data && q.data.length > 0) return q.data;
  return config.topics.length > 0 ? config.topics : DEFAULT_TOPICS;
}

/** 인기 검색어 — 홈 카드·검색창 상자·검색 결과 오른쪽이 같은 쿼리를 쓴다 (3.8). */
export function useTrending(enabled = true) {
  const config = useConfig();
  return useQuery({
    queryKey: qk.trending,
    queryFn: getTrending,
    enabled,
    refetchInterval: enabled ? Math.max(1, config.trendingIntervalSeconds) * 1000 : false,
    staleTime: 0,
  });
}
