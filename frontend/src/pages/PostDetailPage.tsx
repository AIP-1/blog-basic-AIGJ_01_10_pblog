import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { errorMessage, isNotFound } from '../api/client';
import { deletePost, getPost, togglePin } from '../api/endpoints';
import { qk } from '../api/queries';
import type { PostDetail } from '../api/types';
import { useRequireLogin } from '../api/useRequireLogin';
import { PostStats } from '../components/Cards';
import { CommentSection } from '../components/CommentSection';
import { LikeButton } from '../components/LikeButton';
import { MarkdownView } from '../components/MarkdownView';
import { NotFound } from '../components/NotFound';
import { ReportDialog } from '../components/ReportDialog';
import { ErrorBox, Loading } from '../components/Status';
import { TagList } from '../components/TagList';
import { useToast } from '../components/toastContext';
import { useHighlightTopic } from '../components/topicHighlight';
import { categoryColor, formatDate, formatDateLong, formatDateTime } from '../lib/format';
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
  // 공유: 휴대폰처럼 공유 창이 있으면 그걸, 없으면 주소를 복사한다
  const share = async () => {
    const url = `${window.location.origin}/posts/${post.id}`;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: post.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.show(POST.linkCopied);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      window.prompt(POST.copyPrompt, url);
    }
  };
  const author = post.blog.owner?.nickname ?? post.blog.ownerNickname ?? post.blog.name;

  return (
    <article className="post">
      <Link to={`/blogs/${post.blog.id}`} className="post__back-link">
        ← {post.blog.name}
      </Link>

      {post.coverImageUrl && <img className="post__cover" src={post.coverImageUrl} alt="" />}

      <header className="post__head">
        <nav className="post__crumbs" aria-label="분야 · 다이어리">
          {post.topic && (
            <>
              <Link to={`/topics/${post.topic.code}`} className="post__topic">
                {post.topic.name}
              </Link>
              <span className="post__crumb-sep" aria-hidden="true">
                ›
              </span>
            </>
          )}
          <Link to={categoryListUrl} className="diary-chip">
            <span className="dot" style={{ background: categoryColor(post.category.colorIndex) }} aria-hidden="true" />
            {post.category.name}
          </Link>
        </nav>
        <h1 className="post__title">
          {post.visibility === 'PRIVATE' && <span className="badge badge--muted">{POST.privateBadge}</span>}
          {post.title}
        </h1>
        <p className="post__byline">
          <Link to={`/blogs/${post.blog.id}`} className="post__author">
            <span className="avatar avatar--xs" aria-hidden="true">
              {author.slice(0, 1)}
            </span>
            <b>{author}</b>
          </Link>
          <time dateTime={post.createdAt}>{formatDateLong(post.createdAt)}</time>
          {post.contentUpdatedAt && (
            <span title={formatDateLong(post.contentUpdatedAt)}>
              수정 <time dateTime={post.contentUpdatedAt}>{formatDateTime(post.contentUpdatedAt)}</time>
            </span>
          )}
          {post.viewCount !== undefined && <span>조회 {post.viewCount.toLocaleString()}</span>}
        </p>
      </header>

      <MarkdownView source={post.body} className="post__body" />

      <TagList tags={post.tags ?? []} />

      <div className="post__reactions">
        <LikeButton post={post} />
      </div>

      <div className="post__tools">
        {!post.isAuthor ? (
          <button type="button" className="text-btn post__report" onClick={() => requireLogin(() => setReporting(true))}>
            신고
          </button>
        ) : (
          <span className="post__tools-spacer" />
        )}
        <button type="button" className="tool-btn" onClick={() => void share()}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
          </svg>
          공유
        </button>
        {post.isAuthor && (
          <>
            <span className="post__tools-divider" aria-hidden="true" />
            <button
              type="button"
              className={`btn btn--sm btn--outline pin-btn${post.pinned ? ' is-on' : ''}`}
              aria-pressed={!!post.pinned}
              disabled={pin.isPending}
              onClick={() => pin.mutate(post.id)}
            >
              📌 {post.pinned ? CATEGORY.unpin : CATEGORY.pin}
            </button>
            <Link to={`/posts/${post.id}/edit`} className="btn btn--sm btn--outline">
              수정
            </Link>
            <button
              type="button"
              className="btn btn--sm btn--outline btn--danger-text"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(POST.deleteConfirm)) remove.mutate(post.id);
              }}
            >
              삭제
            </button>
          </>
        )}
      </div>

      <nav className="prevnext" aria-label="이전 글 다음 글">
        {post.prev ? (
          <Link to={`/posts/${post.prev.id}`} className="prevnext__item prevnext__item--prev">
            <span className="prevnext__label">‹ 이전 글</span>
            <span className="prevnext__title">{post.prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        <Link to={categoryListUrl} className="btn btn--sm btn--outline prevnext__list">
          목록으로
        </Link>
        {post.next ? (
          <Link to={`/posts/${post.next.id}`} className="prevnext__item prevnext__item--next">
            <span className="prevnext__label">다음 글 ›</span>
            <span className="prevnext__title">{post.next.title}</span>
          </Link>
        ) : (
          <span />
        )}
      </nav>

      {post.otherPosts.length > 0 && (
        <section className="other-box">
          <header className="other-box__head">
            <h2>
              <span className="other-box__blog">{post.blog.name}</span>의 다른 글
            </h2>
            <Link to={`/blogs/${post.blog.id}`} className="other-box__more">
              블로그 보기 →
            </Link>
          </header>
          {post.blog.description && <p className="other-box__desc">{post.blog.description}</p>}
          <ul className="other-box__list">
            {post.otherPosts.map((o) => (
              <li key={o.id}>
                <Link to={`/posts/${o.id}`}>
                  <span className="other-box__title">{o.title}</span>
                  <span className="other-box__meta">
                    <PostStats likes={o.likeCount} comments={o.commentCount} />
                    {o.createdAt && <time dateTime={o.createdAt}>{formatDate(o.createdAt)}</time>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CommentSection post={post} />

      {reporting && <ReportDialog postId={post.id} onClose={() => setReporting(false)} />}
    </article>
  );
}
