import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { getNotices } from '../api/endpoints';
import { qk } from '../api/queries';
import { PostRow } from '../components/Cards';
import { Pagination } from '../components/Pagination';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { EXPLORE, NOTICE } from '../messages';

/** 공지사항: 서비스 소식 · 버전별 바뀐 점. 글은 보통 글 화면에서 읽는다 */
export function NoticesPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.notices(page),
    queryFn: () => getNotices(page),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="narrow">
      <header className="page-head">
        <h1 className="page-head__title">{NOTICE.title}</h1>
        <p className="page-head__desc">{NOTICE.desc}</p>
        {data && data.totalItems > 0 && <p className="page-head__meta">{EXPLORE.postCount(data.totalItems)}</p>}
      </header>
      {isPending ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <Empty>{NOTICE.empty}</Empty>
      ) : (
        <>
          <div className="row-list">
            {data.items.map((p) => (
              <PostRow key={p.id} post={p} showBlog={false} />
            ))}
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={(p) => setParams(p > 1 ? { page: String(p) } : {})} />
        </>
      )}
    </div>
  );
}
