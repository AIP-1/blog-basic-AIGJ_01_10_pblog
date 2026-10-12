import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { isNotFound } from '../api/client';
import { getTopicPage } from '../api/endpoints';
import { qk } from '../api/queries';
import { BlogCard, PostRow } from '../components/Cards';
import { NotFound } from '../components/NotFound';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { COMMON } from '../messages';

/** 주제별 화면: 제목·설명·"블로그 N개 · 글 N개", 블로그, 글 9개 (3.3, 커뮤니티 제외) */
export function TopicPage() {
  const { code = '' } = useParams();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.topic(code),
    queryFn: () => getTopicPage(code),
  });

  if (isPending) return <Loading />;
  if (isNotFound(error)) return <NotFound what="주제" />;
  if (error) return <ErrorBox error={error} onRetry={() => void refetch()} />;

  return (
    <div className="topic-page">
      <header className="page-head">
        <h1 className="page-head__title">{data.topic.name}</h1>
        {data.topic.description && <p className="page-head__desc">{data.topic.description}</p>}
        <p className="page-head__meta">
          블로그 {data.blogCount.toLocaleString()}개 · 글 {data.postCount.toLocaleString()}개
        </p>
      </header>

      <section className="section">
        <h2 className="section__title">{data.topic.name} 블로그</h2>
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

      <section className="section">
        <h2 className="section__title">{data.topic.name} 글</h2>
        {data.posts.length === 0 ? (
          <Empty>{COMMON.noPosts}</Empty>
        ) : (
          <div className="row-list">
            {data.posts.slice(0, 9).map((p) => (
              <PostRow key={p.id} post={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
