import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { getDashboard } from '../../api/endpoints';
import { qk } from '../../api/queries';
import type { CountTriple } from '../../api/types';
import { VisBadge } from '../../components/Cards';
import { ErrorBox, Loading } from '../../components/Status';
import { formatDate } from '../../lib/format';
import { MANAGE } from '../../messages';
import { ViewsChart } from './charts';

function StatCard({ label, value }: { label: string; value: CountTriple }) {
  return (
    <div className="stat-card">
      <p className="stat-card__label">{label}</p>
      <p className="stat-card__value">{value.today.toLocaleString()}</p>
      <p className="stat-card__sub">
        어제 {value.yesterday.toLocaleString()} · 누적 {value.total.toLocaleString()}
      </p>
    </div>
  );
}

/** 대시보드 (BM-02) */
export function DashboardPage() {
  const { data, isPending, error, refetch } = useQuery({ queryKey: qk.dashboard, queryFn: getDashboard });
  if (isPending) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={() => void refetch()} />;

  const zero: CountTriple = { today: 0, yesterday: 0, total: 0 };
  return (
    <div className="dashboard">
      <h1 className="page-title">대시보드</h1>
      <div className="stat-grid">
        <StatCard label="오늘 조회수" value={data.views ?? zero} />
        <StatCard label="오늘 방문자" value={data.visitors ?? zero} />
        <div className={`stat-card${data.newCommentCount > 0 ? ' stat-card--hot' : ''}`}>
          <p className="stat-card__label">새 댓글</p>
          <p className="stat-card__value">{data.newCommentCount.toLocaleString()}</p>
          <Link to="/manage/comments" className="stat-card__link">
            댓글 보기 →
          </Link>
        </div>
      </div>

      <section className="card section-card">
        <div className="section__head">
          <h2 className="section-card__title">최근 30일</h2>
          <Link to="/manage/stats" className="section__more">
            통계 더 보기
          </Link>
        </div>
        {data.daily.length === 0 ? <p className="muted">{MANAGE.noData}</p> : <ViewsChart data={data.daily} />}
      </section>

      <div className="two-col">
        <section className="card section-card">
          <h2 className="section-card__title">인기 글 (최근 7일)</h2>
          {data.popularPosts.length === 0 ? (
            <p className="muted">{MANAGE.noPostsYet}</p>
          ) : (
            <ol className="rank-list">
              {data.popularPosts.map((p) => (
                <li key={p.id}>
                  <Link to={`/posts/${p.id}`}>{p.title}</Link>
                  <span className="muted">{p.viewCount.toLocaleString()}회</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="card section-card">
          <h2 className="section-card__title">최근 글</h2>
          {data.recentPosts.length === 0 ? (
            <p className="muted">{MANAGE.noPostsYet}</p>
          ) : (
            <ul className="rank-list">
              {data.recentPosts.map((p) => (
                <li key={p.id}>
                  <Link to={`/posts/${p.id}`}>
                    {p.title}
                    <VisBadge visibility={p.visibility} />
                  </Link>
                  <span className="muted">{formatDate(p.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
