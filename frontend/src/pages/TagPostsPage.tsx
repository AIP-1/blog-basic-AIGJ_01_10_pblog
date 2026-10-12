import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router';
import { getTagPosts } from '../api/endpoints';
import { qk } from '../api/queries';
import { PostRow } from '../components/Cards';
import { Pagination } from '../components/Pagination';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { EXPLORE } from '../messages';

/** 태그별 공개 글 목록 (CF-20-3) */
export function TagPostsPage() {
  const { name = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.tagPosts(name, page),
    queryFn: () => getTagPosts(name, page),
    placeholderData: (prev) => prev,
  });

  return (
    <div>
      <header className="page-head">
        <h1 className="page-head__title">#{name}</h1>
        {data && <p className="page-head__meta">{EXPLORE.postCount(data.totalItems)}</p>}
      </header>
      {isPending ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <Empty>{EXPLORE.emptyList}</Empty>
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
