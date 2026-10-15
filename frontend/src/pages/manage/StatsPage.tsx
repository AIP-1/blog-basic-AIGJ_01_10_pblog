import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { getStats } from '../../api/endpoints';
import { qk } from '../../api/queries';
import { ErrorBox, Loading } from '../../components/Status';
import { MANAGE } from '../../messages';
import { CommentsChart, ViewsChart } from './charts';

/** 통계: 7일 / 30일 (처음 30일), 조회·방문 그래프 + 댓글 그래프 (BM-06) */
export function StatsPage() {
  const [days, setDays] = useState<7 | 30>(30);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.stats(days),
    queryFn: () => getStats(days),
    placeholderData: (prev) => prev,
  });

  const sum = (k: 'views' | 'visitors' | 'comments') => (data?.daily ?? []).reduce((s, d) => s + (d[k] ?? 0), 0);

  let content: ReactNode;
  if (isPending) {
    content = <Loading />;
  } else if (error) {
    content = <ErrorBox error={error} onRetry={() => void refetch()} />;
  } else if (data.daily.length === 0) {
    content = <p className="muted">{MANAGE.noData}</p>;
  } else {
    content = (
      <>
        <div className="stat-grid">
          <div className="stat-card">
            <p className="stat-card__label">조회수 합계</p>
            <p className="stat-card__value">{sum('views').toLocaleString()}</p>
          </div>
          <div className="stat-card">
            <p className="stat-card__label">방문자 합계</p>
            <p className="stat-card__value">{sum('visitors').toLocaleString()}</p>
          </div>
          <div className="stat-card">
            <p className="stat-card__label">댓글 합계</p>
            <p className="stat-card__value">{sum('comments').toLocaleString()}</p>
          </div>
        </div>
        <section className="card section-card">
          <h2 className="section-card__title">일별 조회수 · 방문자</h2>
          <ViewsChart data={data.daily} height={260} />
        </section>
        <section className="card section-card">
          <h2 className="section-card__title">일별 댓글 수</h2>
          <CommentsChart data={data.daily} />
        </section>
      </>
    );
  }

  return (
    <div>
      <div className="page-head-row">
        <h1 className="page-title">통계</h1>
        <div className="segmented" role="group" aria-label="기간">
          {([7, 30] as const).map((d) => (
            <button key={d} type="button" className={days === d ? 'is-active' : ''} aria-pressed={days === d} onClick={() => setDays(d)}>
              {d}일
            </button>
          ))}
        </div>
      </div>
      {content}
    </div>
  );
}
