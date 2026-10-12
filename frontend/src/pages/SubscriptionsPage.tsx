import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { getDiarySubscriptions, getSubscriptionPosts, getSubscriptions } from '../api/endpoints';
import { qk } from '../api/queries';
import type { SubscriptionKind } from '../api/types';
import { PostRow, VisBadge } from '../components/Cards';
import { Pagination } from '../components/Pagination';
import { RequireLogin } from '../components/RequireLogin';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { categoryColor } from '../lib/format';
import { SUBSCRIBE } from '../messages';

const KINDS: SubscriptionKind[] = ['all', 'diary', 'blog'];

function toKind(v: string | null): SubscriptionKind {
  return v === 'diary' || v === 'blog' ? v : 'all';
}

/**
 * 구독 피드 (데모 #/feed): 전체 · 다이어리 · 블로그 탭으로 구독한 곳의 새 글(최신순),
 * 오른쪽에 구독한 다이어리 · 블로그 목록
 */
export function SubscriptionsPage() {
  return <RequireLogin>{() => <Subscriptions />}</RequireLogin>;
}

function Subscriptions() {
  const [params, setParams] = useSearchParams();
  const kind = toKind(params.get('kind'));
  const page = Math.max(1, Number(params.get('page')) || 1);
  const blogsQ = useQuery({ queryKey: qk.subscriptions, queryFn: getSubscriptions });
  const diariesQ = useQuery({ queryKey: qk.diarySubscriptions, queryFn: getDiarySubscriptions });
  const postsQ = useQuery({
    queryKey: qk.subscriptionPosts(page, kind),
    queryFn: () => getSubscriptionPosts(page, kind),
    placeholderData: (prev) => prev,
  });
  const blogs = blogsQ.data ?? [];
  const diaries = diariesQ.data ?? [];
  const counts = { all: blogs.length + diaries.length, diary: diaries.length, blog: blogs.length };
  const what = SUBSCRIBE.emptyWhat[kind];

  const tabUrl = (k: SubscriptionKind) => (k === 'all' ? '/subscriptions' : `/subscriptions?kind=${k}`);
  const onPage = (p: number) => {
    const next = new URLSearchParams();
    if (kind !== 'all') next.set('kind', kind);
    if (p > 1) next.set('page', String(p));
    setParams(next);
    window.scrollTo({ top: 0 });
  };

  const body = () => {
    if (blogsQ.isPending || diariesQ.isPending || postsQ.isPending) return <Loading />;
    const error = blogsQ.error ?? diariesQ.error ?? postsQ.error;
    if (error) {
      return (
        <ErrorBox
          error={error}
          onRetry={() => {
            void blogsQ.refetch();
            void diariesQ.refetch();
            void postsQ.refetch();
          }}
        />
      );
    }
    if (counts[kind] === 0) {
      return (
        <Empty>
          <b>{SUBSCRIBE.empty(what)}</b>
          <span>{SUBSCRIBE.emptyHint(what)}</span>
          <Link to="/" className="btn">
            {SUBSCRIBE.browse}
          </Link>
        </Empty>
      );
    }
    const data = postsQ.data;
    if (!data) return <Loading />;
    if (data.items.length === 0) {
      return (
        <Empty>
          <b>{SUBSCRIBE.feedEmpty}</b>
        </Empty>
      );
    }
    return (
      <>
        <div className="row-list">
          {data.items.map((p) => (
            <PostRow key={p.id} post={p} badge={<VisBadge visibility={p.visibility} />} />
          ))}
        </div>
        <Pagination page={data.page} totalPages={data.totalPages} onChange={onPage} />
      </>
    );
  };

  return (
    <div className="home__grid feed">
      <section className="home__main">
        <header className="section-head">
          <h2>{SUBSCRIBE.feedTitle[kind]}</h2>
          <span>{SUBSCRIBE.total(postsQ.data?.totalItems ?? 0)}</span>
        </header>
        <nav className="feed-tabs" aria-label={SUBSCRIBE.tabsLabel}>
          {KINDS.map((k) => (
            <Link key={k} to={tabUrl(k)} className={kind === k ? 'is-on' : ''} aria-current={kind === k ? 'page' : undefined}>
              {SUBSCRIBE.tabs[k]}
              {k !== 'all' && <span className="feed-tabs__n"> {counts[k]}</span>}
            </Link>
          ))}
        </nav>
        {body()}
      </section>
      <aside className="home__aside">
        <section className="box">
          <h3 className="box-title">
            {SUBSCRIBE.diariesTitle} <span className="muted">{diaries.length}</span>
          </h3>
          {diaries.length > 0 ? (
            <ul className="blog-list">
              {diaries.map((d) => (
                <li key={d.id}>
                  <Link to={`/blogs/${d.blog.id}?category=${d.id}`}>
                    <span className="cover cover--sm" style={{ ['--c' as string]: categoryColor(d.colorIndex) }} aria-hidden="true" />
                    <span className="bl-text">
                      <b>{d.name}</b>
                      <span>
                        {d.blog.name} · 글 {d.postCount.toLocaleString()}개
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="feed__hint">{SUBSCRIBE.asideEmpty}</p>
          )}
        </section>
        <section className="box">
          <h3 className="box-title">
            {SUBSCRIBE.blogsTitle} <span className="muted">{blogs.length}</span>
          </h3>
          {blogs.length > 0 ? (
            <ul className="blog-list">
              {blogs.map((b) => (
                <li key={b.id}>
                  <Link to={`/blogs/${b.id}`}>
                    <span className="avatar avatar--sm" aria-hidden="true">
                      {b.ownerNickname.slice(0, 1)}
                    </span>
                    <span className="bl-text">
                      <b>{b.name}</b>
                      <span>
                        {b.ownerNickname} · {SUBSCRIBE.allDiaries}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="feed__hint">{SUBSCRIBE.asideEmpty}</p>
          )}
        </section>
      </aside>
    </div>
  );
}
