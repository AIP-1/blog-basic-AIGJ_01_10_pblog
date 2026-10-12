import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { getHome } from '../api/endpoints';
import type { PostSummary } from '../api/types';
import { qk } from '../api/queries';
import { BlogCard, FeaturedCard, PostCard } from '../components/Cards';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { TrendingList } from '../components/TrendingList';
import { COMMON, NOTICE } from '../messages';
import { formatDate } from '../lib/format';

/** 홈: 오늘의 이슈 · 새로 올라온 글 6 · 인기 검색어 · 블로그 둘러보기 (3.2, 커뮤니티 제외) */
export function HomePage() {
  const navigate = useNavigate();
  const { data, isPending, error, refetch } = useQuery({ queryKey: qk.home, queryFn: getHome });

  if (isPending) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={() => void refetch()} />;

  const [big, ...smalls] = data.featured;

  return (
    <div className="home">
      <NoticeStrip notices={data.notices ?? []} />
      {big && (
        <section className="home__featured" aria-label="오늘의 이슈">
          <h2 className="sr-only">오늘의 이슈</h2>
          <div className="featured-grid">
            <FeaturedCard post={big} size="lg" />
            {smalls.length > 0 && (
              <div className="featured-grid__side">
                {smalls.slice(0, 2).map((p) => (
                  <FeaturedCard key={p.id} post={p} size="sm" />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <div className="with-aside">
        <section className="section">
          <h2 className="section__title">새로 올라온 글</h2>
          {data.latestPosts.length === 0 ? (
            <Empty>{COMMON.noPosts}</Empty>
          ) : (
            <div className="post-rows">
              {data.latestPosts.slice(0, 6).map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          )}
        </section>
        <aside className="aside">
          <TrendingList onSelect={(k) => navigate(`/search?q=${encodeURIComponent(k)}&type=all`)} className="card" />
        </aside>
      </div>

      <section className="section" id="blogs">
        <h2 className="section__title">블로그 둘러보기</h2>
        {data.blogs.length === 0 ? (
          <Empty>{COMMON.noBlogs}</Empty>
        ) : (
          <div className="card-grid card-grid--3">
            {data.blogs.map((b) => (
              <BlogCard key={b.id} blog={b} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** 메인 맨 위 공지 띠: 최근 공지 몇 개 (없으면 안 보인다) */
function NoticeStrip({ notices }: { notices: PostSummary[] }) {
  if (notices.length === 0) return null;
  return (
    <section className="notice-strip" aria-label={NOTICE.title}>
      <Link to="/notices" className="notice-strip__label">
        {NOTICE.title}
      </Link>
      <ul className="notice-strip__list">
        {notices.map((n) => (
          <li key={n.id}>
            <Link to={`/posts/${n.id}`}>{n.title}</Link>
            <time dateTime={n.createdAt}>{formatDate(n.createdAt)}</time>
          </li>
        ))}
      </ul>
      <Link to="/notices" className="notice-strip__more">
        {NOTICE.more} ›
      </Link>
    </section>
  );
}
