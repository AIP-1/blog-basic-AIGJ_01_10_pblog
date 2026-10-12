import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { checkin, shopKeys, useInk } from '../api/shop';
import { SHOP } from '../messages';
import { useToast } from './toastContext';

/** 한국 시간 오늘 날짜 (출석은 한국 자정에 바뀐다) */
function seoulToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

/**
 * 로그인한 동안 머리말에 숨어 있다.
 * - 오늘 출석하지 않았으면 하루 한 번 출석을 부른다.
 * - 잉크 내역에 새로 쌓인 적립이 있으면 "글쓰기 잉크 +20" 같은 알림을 띄운다.
 */
export function InkWatcher() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data } = useInk();
  const lastSeen = useRef<number | null>(null);
  const checkinTriedOn = useRef<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const maxId = data.history.reduce((m, e) => Math.max(m, e.id), 0);
    if (lastSeen.current === null) {
      lastSeen.current = maxId;
    } else {
      const seen = lastSeen.current;
      data.history
        .filter((e) => e.id > seen && e.amount > 0)
        .reverse()
        .forEach((e) => toast.show(SHOP.earnedToast(SHOP.reasons[e.reason] ?? SHOP.ink, e.amount)));
      lastSeen.current = Math.max(seen, maxId);
    }
    const today = seoulToday();
    if (!data.checkedInToday && checkinTriedOn.current !== today) {
      checkinTriedOn.current = today;
      checkin()
        .then(() => queryClient.invalidateQueries({ queryKey: shopKeys.ink }))
        .catch(() => undefined);
    }
  }, [data, queryClient, toast]);

  return null;
}
