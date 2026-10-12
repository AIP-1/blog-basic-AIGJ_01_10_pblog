import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { getBookmarks } from '../api/endpoints';
import { qk } from '../api/queries';
import { PostRow } from '../components/Cards';
import { Pagination } from '../components/Pagination';
import { RequireLogin } from '../components/RequireLogin';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { BOOKMARK, EXPLORE } from '../messages';

/** 내 책갈피: 최근에 넣은 글부터. 지금 볼 수 없는 글(비공개로 바뀐 글 등)은 빠진다 */
export function BookmarksPage() {
  return <RequireLogin>{() => <Bookmarks />}</RequireLogin>;
}

function Bookmarks() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.bookmarks(page),
    queryFn: () => getBookmarks(page),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="narrow">
      <header className="page-head">
        <h1 className="page-head__title">{BOOKMARK.title}</h1>
        <p className="page-head__desc">{BOOKMARK.desc}</p>
        {data && data.totalItems > 0 && <p className="page-head__meta">{EXPLORE.postCount(data.totalItems)}</p>}
      </header>
      {isPending ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <Empty>{BOOKMARK.empty}</Empty>
      ) : (
        <>
          <div className="row-list">
            {data.items.map((p) => (
              <PostRow key={p.id} post={p} />
            ))}
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={(p) => setParams(p > 1 ? { page: String(p) } : {})} />
        </>
      )}
    </div>
  );
}
