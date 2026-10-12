import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { getSubscriptionPosts, getSubscriptions } from '../api/endpoints';
import { qk } from '../api/queries';
import { PostRow } from '../components/Cards';
import { Pagination } from '../components/Pagination';
import { RequireLogin } from '../components/RequireLogin';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { formatRelative } from '../lib/format';
import { SUBSCRIBE } from '../messages';

/** 구독: 위에 구독한 블로그, 아래에 그 블로그들의 새 공개 글(최신순) */
export function SubscriptionsPage() {
  return <RequireLogin>{() => <Subscriptions />}</RequireLogin>;
}

function Subscriptions() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const blogsQ = useQuery({ queryKey: qk.subscriptions, queryFn: getSubscriptions });
  const postsQ = useQuery({
    queryKey: qk.subscriptionPosts(page),
    queryFn: () => getSubscriptionPosts(page),
    placeholderData: (prev) => prev,
  });
  const blogs = blogsQ.data ?? [];

  return (
    <div className="narrow">
      <header className="page-head">
        <h1 className="page-head__title">{SUBSCRIBE.title}</h1>
        <p className="page-head__desc">{SUBSCRIBE.desc}</p>
      </header>

      {blogsQ.isPending ? (
        <Loading />
      ) : blogsQ.error ? (
        <ErrorBox error={blogsQ.error} onRetry={() => void blogsQ.refetch()} />
      ) : blogs.length === 0 ? (
        <Empty>{SUBSCRIBE.empty}</Empty>
      ) : (
        <>
          <section aria-label={SUBSCRIBE.blogsTitle}>
            <h2 className="section__title">
              {SUBSCRIBE.blogsTitle} <span className="muted">{blogs.length}</span>
            </h2>
            <div className="sub-blogs">
              {blogs.map((b) => (
                <Link key={b.id} to={`/blogs/${b.id}`} className="sub-blog">
                  <span className="avatar avatar--xs" aria-hidden="true">
                    {b.ownerNickname.slice(0, 1)}
                  </span>
                  <span className="sub-blog__text">
                    <span className="sub-blog__name">{b.name}</span>
                    <span className="sub-blog__meta">
                      {b.ownerNickname}
                      {b.lastPostAt && <> · {formatRelative(b.lastPostAt)}</>}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="section">
            <h2 className="section__title">{SUBSCRIBE.feedTitle}</h2>
            {postsQ.isPending ? (
              <Loading />
            ) : postsQ.error ? (
              <ErrorBox error={postsQ.error} onRetry={() => void postsQ.refetch()} />
            ) : postsQ.data.items.length === 0 ? (
              <Empty>{SUBSCRIBE.feedEmpty}</Empty>
            ) : (
              <>
                <div className="row-list">
                  {postsQ.data.items.map((p) => (
                    <PostRow key={p.id} post={p} />
                  ))}
                </div>
                <Pagination
                  page={postsQ.data.page}
                  totalPages={postsQ.data.totalPages}
                  onChange={(p) => setParams(p > 1 ? { page: String(p) } : {})}
                />
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
