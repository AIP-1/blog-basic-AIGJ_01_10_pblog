import { useLayoutEffect, useRef } from 'react';
import { useTrending } from '../api/queries';
import type { TrendingItem } from '../api/types';
import { formatTime } from '../lib/format';

function ChangeBadge({ item }: Readonly<{ item: TrendingItem }>) {
  switch (item.change) {
    case 'UP':
      return (
        <span className="trend__change trend__change--up" aria-label={`${item.delta}칸 올라감`}>
          ▲{item.delta}
        </span>
      );
    case 'DOWN':
      return (
        <span className="trend__change trend__change--down" aria-label={`${item.delta}칸 내려감`}>
          ▼{item.delta}
        </span>
      );
    case 'NEW':
      return <span className="trend__change trend__change--new">NEW</span>;
    default:
      return (
        <span className="trend__change trend__change--same" aria-label="변화 없음">
          -
        </span>
      );
  }
}

interface TrendingListProps {
  onSelect: (keyword: string) => void;
  title?: string;
  className?: string;
}

/** 실시간 인기 검색어 1~10위 (3.8). 순위가 바뀐 항목은 위아래로 부드럽게 움직인다. */
export function TrendingList({ onSelect, title = '실시간 인기 검색어', className }: Readonly<TrendingListProps>) {
  const { data, isPending, isError } = useTrending();
  const listRef = useRef<HTMLOListElement>(null);
  const positions = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = new Map<string, number>();
    el.querySelectorAll<HTMLElement>('[data-keyword]').forEach((node) => {
      const key = node.dataset.keyword ?? '';
      const top = node.offsetTop;
      next.set(key, top);
      const prev = positions.current.get(key);
      if (!reduce && prev !== undefined && prev !== top && typeof node.animate === 'function') {
        node.animate([{ transform: `translateY(${prev - top}px)` }, { transform: 'translateY(0)' }], {
          duration: 450,
          easing: 'ease-out',
        });
      }
    });
    positions.current = next;
  }, [data]);

  const renderBody = () => {
    if (isPending) return <p className="trend__empty">불러오는 중…</p>;
    if (isError) return <p className="trend__empty">순위를 불러오지 못했습니다</p>;
    if (data.items.length === 0) return <p className="trend__empty">아직 인기 검색어가 없습니다</p>;
    return (
      <ol className="trend__list" ref={listRef}>
        {data.items.map((item) => (
          <li key={item.keyword} data-keyword={item.keyword} className="trend__item">
            <button type="button" className="trend__btn" onMouseDown={(e) => e.preventDefault()} onClick={() => onSelect(item.keyword)}>
              <span className={`trend__rank${item.rank <= 3 ? ' is-top' : ''}`}>{item.rank}</span>
              <span className="trend__keyword">{item.keyword}</span>
              <ChangeBadge item={item} />
            </button>
          </li>
        ))}
      </ol>
    );
  };

  return (
    <section className={className ? `trend ${className}` : 'trend'} aria-label={title}>
      <div className="trend__head">
        <h3 className="trend__title">{title}</h3>
        {data?.updatedAt && <span className="trend__time">{formatTime(data.updatedAt)} 기준</span>}
      </div>
      {renderBody()}
    </section>
  );
}
