import { useQuery } from '@tanstack/react-query';
import { api } from './client';

/* 스티커 상점: 잉크 · 스티커 팩 · 도전과제 · 다이어리 표지 스티커 */

export type InkReason = 'CHECKIN' | 'POST' | 'COMMENT' | 'CHALLENGE' | 'PURCHASE';

export interface InkEntry {
  id: number;
  /** 받으면 양수, 쓰면 음수 */
  amount: number;
  reason: InkReason;
  /** 도전과제 이름이나 팩 이름 (그 밖에는 null) */
  label: string | null;
  createdAt: string;
}

export interface InkWallet {
  balance: number;
  checkedInToday: boolean;
  streak: number;
  earn: {
    checkin: number;
    post: number;
    postDailyMax: number;
    postsToday: number;
    comment: number;
    commentDailyMax: number;
    commentsToday: number;
  };
  history: InkEntry[];
}

export interface Sticker {
  code: string;
  name: string;
  limited: boolean;
}

export interface StickerPack {
  code: string;
  name: string;
  description: string;
  price: number;
  owned: boolean;
  stickers: Sticker[];
}

export interface OwnedSticker extends Sticker {
  packName: string | null;
  acquiredAt: string;
}

export interface Challenge {
  code: string;
  title: string;
  description: string;
  goal: number;
  progress: number;
  rewardInk: number;
  rewardSticker: Sticker | null;
  completed: boolean;
  claimed: boolean;
}

/** 표지 자리: 좌상 · 우상 · 좌하 · 우하 · 가운데 */
export type StickerSlot = 'TL' | 'TR' | 'BL' | 'BR' | 'C';

export interface DiarySticker {
  slot: StickerSlot;
  code: string;
  /** -15 · -8 · 0 · 8 · 15 도 */
  rotation: number;
}

export const STICKER_SLOTS: StickerSlot[] = ['TL', 'TR', 'C', 'BL', 'BR'];
export const STICKER_ROTATIONS = [-15, -8, 0, 8, 15];
/** 다이어리마다 붙일 수 있는 스티커 수 (서버 myblog.shop.stickers-per-diary와 같게) */
export const STICKERS_PER_DIARY = 3;

export const getInk = () => api<InkWallet>('/api/me/ink');
export const checkin = () => api<{ earned: number; balance: number; streak: number }>('/api/shop/checkin', { method: 'POST' });
export const getPacks = () => api<StickerPack[]>('/api/shop/packs');
export const buyPack = (code: string) =>
  api<{ balance: number; packCode: string }>(`/api/shop/packs/${encodeURIComponent(code)}/buy`, { method: 'POST' });
export const getMyStickers = () => api<OwnedSticker[]>('/api/me/stickers');
export const getChallenges = () => api<Challenge[]>('/api/shop/challenges');
export const claimChallenge = (code: string) =>
  api<{ earned: number; sticker: { code: string; name: string } | null; balance: number }>(
    `/api/shop/challenges/${encodeURIComponent(code)}/claim`,
    { method: 'POST' },
  );
export const getDiaryStickers = (categoryIds: number[]) =>
  api<Record<string, DiarySticker[]>>('/api/diary-stickers', { query: { categoryIds: categoryIds.join(',') } });
export const putDiaryStickers = (categoryId: number, stickers: DiarySticker[]) =>
  api<DiarySticker[]>(`/api/categories/${categoryId}/stickers`, { method: 'PUT', body: { stickers } });

export const shopKeys = {
  all: ['shop'] as const,
  ink: ['shop', 'ink'] as const,
  packs: ['shop', 'packs'] as const,
  mine: ['shop', 'mine'] as const,
  challenges: ['shop', 'challenges'] as const,
  diaryStickers: (ids: number[]) => ['diaryStickers', ...ids] as const,
};

export const stickerUrl = (code: string) => `/stickers/${code}.svg`;

/** 내 잉크 (로그인했을 때만) */
export function useInk(enabled = true) {
  return useQuery({ queryKey: shopKeys.ink, queryFn: getInk, enabled, staleTime: 30_000, refetchOnWindowFocus: true });
}

/** 여러 다이어리의 표지 스티커 { 다이어리 번호: 스티커들 } */
export function useDiaryStickers(categoryIds: number[]) {
  const ids = [...new Set(categoryIds)].sort((a, b) => a - b);
  const q = useQuery({
    queryKey: shopKeys.diaryStickers(ids),
    queryFn: () => getDiaryStickers(ids),
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
  return q.data ?? {};
}
