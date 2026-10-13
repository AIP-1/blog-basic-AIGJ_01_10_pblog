import type { AppConfig, Topic } from '../api/types';

/** 서버 /api/config 가 없거나 칸이 빠졌을 때 쓰는 기본값 (원본 각 파일의 '기본값' 표). */
export const DEFAULT_TOPICS: Topic[] = [
  { code: 'daily', name: '일상', description: '' },
  { code: 'travel', name: '여행', description: '' },
  { code: 'food', name: '음식', description: '' },
  { code: 'hobby', name: '취미', description: '' },
  { code: 'exercise', name: '운동', description: '' },
  { code: 'game', name: '게임', description: '' },
  { code: 'culture', name: '문화', description: '' },
  { code: 'study', name: '공부', description: '' },
  { code: 'money', name: '경제', description: '' },
];

export const DEFAULT_CONFIG: AppConfig = {
  limits: {
    nicknameMin: 2,
    nicknameMax: 10,
    passwordMin: 8,
    passwordMax: 64,
    bioMax: 100,
    blogNameMax: 30,
    blogDescriptionMax: 200,
    blogAboutMax: 5000,
    postTitleMax: 100,
    postBodyMax: 10000,
    categoryNameMax: 20,
    categoryDescriptionMax: 100,
    commentMax: 500,
    tagsPerPost: 5,
    tagMax: 15,
    reportDetailMax: 200,
    imageMaxBytes: 5 * 1024 * 1024,
    imagesPerPost: 10,
    searchMin: 2,
    searchMax: 50,
    withdrawKeepDays: 30,
    bookmarkFolderNameMax: 20,
  },
  pageSize: 10,
  trendingIntervalSeconds: 5,
  draftLimit: 20,
  draftAutosaveSeconds: 60,
  topics: DEFAULT_TOPICS,
  socialLogin: [],
};

export function mergeConfig(server: Partial<AppConfig> | null | undefined): AppConfig {
  if (!server) return DEFAULT_CONFIG;
  return {
    ...DEFAULT_CONFIG,
    ...server,
    limits: { ...DEFAULT_CONFIG.limits, ...(server.limits ?? {}) },
    topics: server.topics && server.topics.length > 0 ? server.topics : DEFAULT_CONFIG.topics,
    socialLogin: Array.isArray(server.socialLogin) ? server.socialLogin : DEFAULT_CONFIG.socialLogin,
  };
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
