import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { errorMessage, isNotFound } from '../api/client';
import { deletePost, getPost, togglePin } from '../api/endpoints';
import { qk } from '../api/queries';
import type { PostDetail } from '../api/types';
import { useRequireLogin } from '../api/useRequireLogin';
import { CommentSection } from '../components/CommentSection';
import { LikeButton } from '../components/LikeButton';
import { MarkdownView } from '../components/MarkdownView';
import { NotFound } from '../components/NotFound';
import { ReportDialog } from '../components/ReportDialog';
import { ErrorBox, Loading } from '../components/Status';
import { TagList } from '../components/TagList';
import { useToast } from '../components/toastContext';
import { useHighlightTopic } from '../components/topicHighlight';
import { categoryColor, formatDate, formatDateTime } from '../lib/format';
import { recordRead } from '../lib/readHistory';
import { CATEGORY, POST } from '../messages';

/** 글 상세 (3.5, CF-09, CF-18~21) */
export function PostDetailPage() {
  const { postId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const requireLogin = useRequireLogin();
  const [reporting, setReporting] = useState(false);

  const { data: post, isPending, error, refetch } = useQuery({
    queryKey: qk.post(postId),
    queryFn: () => getPost(postId),
    staleTime: 60_000,
  });
  useHighlightTopic(post?.topic?.code);

  // 메인 추천 글에 쓰는 '읽은 글' 기록 (이 브라우저에만, 내 글은 빼고)
  useEffect(() => {
    if (post && !post.isAuthor) recordRead({ id: post.id, blogId: post.blog.id, categoryName: post.category.name });
  }, [post]);

  const remove = useMutation({
    mutationFn: (id: number) => deletePost(id),
    onSuccess: () => {
      const blogId = post?.blog.id;
      queryClient.removeQueries({ queryKey: qk.post(postId) });
      void queryClient.invalidateQueries({ queryKey: ['blog'] });
      void queryClient.invalidateQueries({ queryKey: ['manage'] });
      navigate(blogId ? `/blogs/${blogId}` : '/', { replace: true });
    },
    onError: (e) => toast.show(errorMessage(e), 'error'),
  });

  // 대표글 고정·해제 (작성자만, 블로그마다 최대 3개)
  const pin = useMutation({
    mutationFn: (id: number) => togglePin(id),
    onSuccess: ({ pinned }) => {
      queryClient.setQueryData<PostDetail>(qk.post(postId), (old) => (old ? { ...old, pinned } : old));
      if (post) void queryClient.invalidateQueries({ queryKey: qk.pinned(post.blog.id) });
      toast.show(pinned ? CATEGORY.pinned : CATEGORY.unpinned);
    },
    onError: (e) => toast.show(errorMessage(e), 'error'),
  });

  if (isPending) return <Loading />;
  if (isNotFound(error)) return <NotFound what="글" />;
  if (error) return <ErrorBox error={error} onRetry={() => void refetch()} />;

  const categoryListUrl = `/blogs/${post.blog.id}?category=${post.category.id}`;

  return (
    <article className="post">
      <nav className="breadcrumb" aria-label="현재 위치">
        <Link to="/">홈</Link>
        <span aria-hidden="true">›</span>
        {post.topic && (
          <>
            <Link to={`/topics/${post.topic.code}`}>{post.topic.name}</Link>
            <span aria-hidden="true">›</span>
          </>
        )}
        <Link to={`/blogs/${post.blog.id}`}>{post.blog.name}</Link>
        <span aria-hidden="true">›</span>
        <Link to={categoryListUrl}>{post.category.name}</Link>
      </nav>

      {post.coverImageUrl && <img className="post__cover" src={post.coverImageUrl} alt="" />}

      <header className="post__head">
        <Link to={categoryListUrl} className="post__cat">
          <span className="dot" style={{ background: categoryColor(post.category.colorIndex) }} aria-hidden="true" />
          {post.category.name}
        </Link>
        <h1 className="post__title">
          {post.title}
          {post.visibility === 'PRIVATE' && <span className="badge badge--muted">{POST.privateBadge}</span>}
        </h1>
        <p className="post__meta">
          <Link to={`/blogs/${post.blog.id}`}>{post.blog.name}</Link>
          <span>
            · 작성 <time dateTime={post.createdAt}>{formatDateTime(post.createdAt)}</time>
          </span>
          {post.contentUpdatedAt && (
            <span>
              · 수정 <time dateTime={post.contentUpdatedAt}>{formatDateTime(post.contentUpdatedAt)}</time>
            </span>
          )}
        </p>
        {post.isAuthor && (
          <div className="post__author-actions">
            <button
              type="button"
              className={`btn btn--sm btn--ghost pin-btn${post.pinned ? ' is-on' : ''}`}
              aria-pressed={!!post.pinned}
              disabled={pin.isPending}
              onClick={() => pin.mutate(post.id)}
            >
              📌 {post.pinned ? CATEGORY.unpin : CATEGORY.pin}
            </button>
            <Link to={`/posts/${post.id}/edit`} className="btn btn--sm btn--ghost">
              수정
            </Link>
            <button
              type="button"
              className="btn btn--sm btn--ghost btn--danger-text"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(POST.deleteConfirm)) remove.mutate(post.id);
              }}
            >
              삭제
            </button>
          </div>
        )}
      </header>

      <MarkdownView source={post.body} className="post__body" />

      <TagList tags={post.tags ?? []} />

      <div className="post__reactions">
        <LikeButton post={post} />
        {!post.isAuthor && (
          <button type="button" className="link-btn" onClick={() => requireLogin(() => setReporting(true))}>
            신고
          </button>
        )}
      </div>

      <nav className="prevnext" aria-label="이전 글 다음 글">
        {post.prev ? (
          <Link to={`/posts/${post.prev.id}`} className="prevnext__item prevnext__item--prev">
            <span className="prevnext__label">← 이전 글</span>
            <span className="prevnext__title">{post.prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {post.next && (
          <Link to={`/posts/${post.next.id}`} className="prevnext__item prevnext__item--next">
            <span className="prevnext__label">다음 글 →</span>
            <span className="prevnext__title">{post.next.title}</span>
          </Link>
        )}
      </nav>

      <section className="card blog-intro">
        <div>
          <p className="blog-intro__name">{post.blog.name}</p>
          {post.blog.description && <p className="blog-intro__desc">{post.blog.description}</p>}
        </div>
        <Link to={`/blogs/${post.blog.id}`} className="btn btn--sm btn--outline">
          블로그 보기
        </Link>
      </section>

      {post.otherPosts.length > 0 && (
        <section className="section other-posts">
          <h2 className="section__title">이 블로그의 다른 글</h2>
          <ul className="other-posts__list">
            {post.otherPosts.slice(0, 3).map((o) => (
              <li key={o.id}>
                <Link to={`/posts/${o.id}`}>
                  <span className="other-posts__title">{o.title}</span>
                  {o.createdAt && <time dateTime={o.createdAt}>{formatDate(o.createdAt)}</time>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="post__back">
        <Link to={categoryListUrl} className="btn btn--ghost">
          ← 글 목록으로
        </Link>
      </div>

      <CommentSection post={post} />

      {reporting && <ReportDialog postId={post.id} onClose={() => setReporting(false)} />}
    </article>
  );
}
