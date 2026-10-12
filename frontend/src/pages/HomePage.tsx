import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { getBlog, getFeed, getHome } from '../api/endpoints';
import { qk, useMe, useTopics } from '../api/queries';
import type { FeedSort, MeResponse, PopularDiary, PostSummary } from '../api/types';
import { useAuth } from '../auth/context';
import { AdSlider } from '../components/AdSlider';
import { BlogCard, PostRow, PostStats, Thumb } from '../components/Cards';
import { Pagination } from '../components/Pagination';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { TopicIcon } from '../components/TopicIcon';
import { TrendingList } from '../components/TrendingList';
import { categoryColor, formatDate } from '../lib/format';
import { clearReads, isTrackingOff, readCount, recommend, setTrackingOff } from '../lib/readHistory';
import { COMMON, HOME, NOTICE, SUBSCRIBE } from '../messages';

const RECOMMEND_COUNT = 4;

/**
 * 홈 (데모 메인): 공지 띠 · 광고 슬라이드 · 이번 주 인기 글 · 추천 글 · 분야별 글(주제 탭 · 최신순/인기순 · 페이지),
 * 오른쪽에 내 계정 상자 · 인기 다이어리 · 실시간 인기 검색어, 맨 아래 블로그 둘러보기.
 */
export function HomePage() {
  const navigate = useNavigate();
  const { data, isPending, error, refetch } = useQuery({ queryKey: qk.home, queryFn: getHome });

  if (isPending) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={() => void refetch()} />;

  return (
    <div className="home">
      <NoticeStrip notices={data.notices ?? []} />
      <AdSlider />

      <section className="popular">
        <header className="section-head">
          <h2>{HOME.weeklyTitle}</h2>
        </header>
        <PopularCards posts={data.weeklyPopular ?? []} />
      </section>

      <div className="home__grid">
        <div className="home__main">
          <RecommendSection pool={data.popularPosts ?? []} />
          <TopicFeed />
          <section className="home__blogs">
            <header className="section-head">
              <h2>{HOME.blogsTitle}</h2>
            </header>
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
        <aside className="home__aside">
          <AccountBox />
          <PopularDiaries diaries={data.popularDiaries ?? []} />
          <TrendingList onSelect={(k) => navigate(`/search?q=${encodeURIComponent(k)}&type=all`)} className="box" />
        </aside>
      </div>
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

/** 이번 주 인기 글: 사진 카드 6개, 왼쪽 위에 순위 (1~3위 빨강) */
function PopularCards({ posts }: { posts: PostSummary[] }) {
  if (posts.length === 0) return <p className="hint hint--pad">{HOME.weeklyEmpty}</p>;
  return (
    <ol className="pop-cards">
      {posts.map((p, i) => (
        <li key={p.id}>
          <Link to={`/posts/${p.id}`}>
            <span className="pop-media">
              <Thumb src={p.coverImageUrl} className="pop-thumb" />
              <span className="pop-badge">{i + 1}</span>
            </span>
            <b className="pop-title">{p.title}</b>
            <span className="pop-blog">{p.blog.name}</span>
            <span className="pop-meta">
              조회 {(p.viewCount ?? 0).toLocaleString()}
              <PostStats likes={p.likeCount} comments={p.commentCount} />
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

/** 추천 글: 이 브라우저에서 읽은 글로 인기 글 중에서 고른다. 기록이 없으면 인기 글 */
function RecommendSection({ pool }: { pool: PostSummary[] }) {
  const { data: me } = useMe();
  const [, setTick] = useState(0);
  const rerender = () => setTick((t) => t + 1);
  const off = isTrackingOff();
  const reads = readCount();
  const items = recommend(pool, RECOMMEND_COUNT, me?.blog?.id);
  const based = !off && reads > 0 && items.some((p) => p.reason !== '인기 글');

  return (
    <section className="recommend">
      <header className="section-head">
        <h2>{HOME.recommendTitle}</h2>
        <span>{off ? HOME.recommendOff : based ? HOME.recommendBased : HOME.recommendHint}</span>
      </header>
      {items.length === 0 ? (
        <p className="hint hint--pad">{HOME.recommendEmpty}</p>
      ) : (
        <ul className="rec-list">
          {items.map((p) => (
            <li key={p.id}>
              <Link to={`/posts/${p.id}`}>
                <Thumb src={p.coverImageUrl} className="rec-thumb" />
                <span className="rec-reason">{p.reason}</span>
                <b className="rec-title">{p.title}</b>
                <span className="rec-meta">
                  {p.blog.name}
                  {p.category && ` · ${p.category.name}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="rec-privacy">
        {off ? (
          <>
            {HOME.recommendOffNote}
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setTrackingOff(false);
                rerender();
              }}
            >
              켜기
            </button>
          </>
        ) : (
          <>
            {HOME.recommendUses(reads)}
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                clearReads();
                rerender();
              }}
            >
              기록 지우기
            </button>
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setTrackingOff(true);
                rerender();
              }}
            >
              기록 끄기
            </button>
          </>
        )}
      </p>
    </section>
  );
}

/** 분야별 글: 주제 탭 + 최신순/인기순 + 페이지 번호. 주소(?topic=&sort=&page=)에 남는다 */
function TopicFeed() {
  const topics = useTopics();
  const [params, setParams] = useSearchParams();
  const topic = params.get('topic') ?? '';
  const sort: FeedSort = params.get('sort') === 'popular' ? 'popular' : 'latest';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.feed(topic, sort, page),
    queryFn: () => getFeed({ topic, sort, page }),
    placeholderData: (prev) => prev,
  });

  const link = (next: { topic?: string; sort?: FeedSort; page?: number }) => {
    const t = next.topic ?? topic;
    const s = next.sort ?? sort;
    const p = next.page ?? 1;
    const q = new URLSearchParams();
    if (t) q.set('topic', t);
    if (s !== 'latest') q.set('sort', s);
    if (p > 1) q.set('page', String(p));
    return q;
  };
  const setFeed = (next: { topic?: string; sort?: FeedSort; page?: number }) => {
    setParams(link(next), { preventScrollReset: true });
    document.getElementById('latest')?.scrollIntoView({ block: 'start' });
  };

  return (
    <section className="topic-feed">
      <header className="section-head" id="latest">
        <h2>{HOME.feedTitle}</h2>
        <nav className="seg-tabs push-right" aria-label="정렬">
          <button type="button" className={sort === 'latest' ? 'is-on' : ''} onClick={() => setFeed({ sort: 'latest' })}>
            최신순
          </button>
          <button
            type="button"
            className={sort === 'popular' ? 'is-on' : ''}
            title={HOME.popularHint}
            onClick={() => setFeed({ sort: 'popular' })}
          >
            인기순
          </button>
        </nav>
      </header>
      <nav className="topic-tabs" aria-label="분야">
        <button type="button" className={!topic ? 'is-on' : ''} aria-pressed={!topic} onClick={() => setFeed({ topic: '' })}>
          <TopicIcon code="all" />
          전체
        </button>
        {topics.map((t) => (
          <button
            key={t.code}
            type="button"
            className={t.code === topic ? 'is-on' : ''}
            aria-pressed={t.code === topic}
            onClick={() => setFeed({ topic: t.code })}
          >
            <TopicIcon code={t.code} />
            {t.name}
          </button>
        ))}
      </nav>
      {isPending ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <div className="empty">
          <b>{HOME.feedEmpty}</b>
        </div>
      ) : (
        <>
          <div className="row-list">
            {data.items.map((p) => (
              <PostRow key={p.id} post={p} />
            ))}
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} window={5} onChange={(p) => setFeed({ page: p })} />
        </>
      )}
    </section>
  );
}

/** 오른쪽 위 내 계정 상자: 로그인 전엔 로그인·회원가입, 뒤엔 내 블로그 요약과 바로가기 */
function AccountBox() {
  const { data: me } = useMe();
  const { openLogin } = useAuth();
  if (!me) {
    return (
      <section className="box account-box">
        <p className="box-lead">
          로그인하고 내 블로그에
          <br />
          글을 써 보세요.
        </p>
        <button type="button" className="btn btn--primary btn--block" onClick={() => openLogin({ tab: 'login' })}>
          로그인
        </button>
        <button type="button" className="btn btn--outline btn--block" onClick={() => openLogin({ tab: 'signup' })}>
          회원가입
        </button>
      </section>
    );
  }
  return <MyAccountBox me={me} />;
}

function MyAccountBox({ me }: { me: MeResponse }) {
  const blogId = me.blog?.id;
  const { data: blog } = useQuery({
    queryKey: qk.blog(blogId ?? 0),
    queryFn: () => getBlog(blogId ?? 0),
    enabled: blogId !== undefined,
  });
  const count = me.newCommentCount ?? 0;
  return (
    <section className="box account-box">
      <div className="me-row">
        <span className="avatar" aria-hidden="true">
          {me.member.nickname.slice(0, 1)}
        </span>
        <div>
          <b>{me.blog?.name ?? me.member.nickname}</b>
          <span>
            {me.member.nickname}
            {blog && ` · 글 ${blog.postCount.toLocaleString()}개`}
          </span>
        </div>
      </div>
      <div className="box-actions">
        <Link className="btn btn--primary" to="/write">
          글쓰기
        </Link>
        {blogId !== undefined && (
          <Link className="btn btn--outline" to={`/blogs/${blogId}`}>
            내 블로그
          </Link>
        )}
      </div>
      <div className="box-links">
        <Link to="/manage">
          블로그 관리
          {count > 0 && <span className="badge">{count}</span>}
        </Link>
        <Link to="/me">내 정보</Link>
        <Link to="/notices">{NOTICE.title}</Link>
      </div>
    </section>
  );
}

/** 인기 다이어리: 다이어리 표지 + 이름 + 블로그 · 글 수 */
function PopularDiaries({ diaries }: { diaries: PopularDiary[] }) {
  if (diaries.length === 0) return null;
  return (
    <section className="box">
      <h3 className="box-title">{HOME.diariesTitle}</h3>
      <ol className="blog-list">
        {diaries.map((d, i) => (
          <li key={d.id}>
            <Link to={`/blogs/${d.blog.id}?category=${d.id}`}>
              <span className="b-rank">{i + 1}</span>
              <span className="cover cover--sm" style={{ ['--c' as string]: categoryColor(d.colorIndex) }} aria-hidden="true" />
              <span className="bl-text">
                <b>{d.name}</b>
                <span>
                  {d.blog.name} · {SUBSCRIBE.count(d.subscriberCount ?? 0)} · 글 {d.postCount.toLocaleString()}개
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
