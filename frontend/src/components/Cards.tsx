import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { BlogRef, BlogSummary, CategoryRef, PostSummary, Visibility } from '../api/types';
import { categoryColor, formatDate, formatDateLong, formatRelative } from '../lib/format';
import { POST, SUB_VIS } from '../messages';

/** 블로그 카드: 주인 첫 글자 · 주제 · 이름 · 주인 · 소개 · 글 개수 · 최근 글 날짜 (3.2) */
export function BlogCard({ blog }: { blog: BlogSummary }) {
  return (
    <article className="blog-card">
      <Link to={`/blogs/${blog.id}`} className="blog-card__link">
        <div className="blog-card__top">
          <span className="avatar avatar--lg" aria-hidden="true">
            {blog.ownerNickname.slice(0, 1)}
          </span>
          {blog.topic && <span className="chip">{blog.topic.name}</span>}
        </div>
        <h3 className="blog-card__name">{blog.name}</h3>
        <p className="blog-card__owner">{blog.ownerNickname}</p>
        {blog.description && <p className="blog-card__desc">{blog.description}</p>}
        <p className="blog-card__stats">
          글 {blog.postCount.toLocaleString()}개
          {blog.lastPostAt && <> · 최근 {formatDate(blog.lastPostAt)}</>}
        </p>
      </Link>
    </article>
  );
}

const ICON_HEART = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
  </svg>
);
const ICON_COMMENT = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
  </svg>
);

/** 좋아요 수 · 댓글 수 (작은 아이콘) */
export function PostStats({ likes = 0, comments = 0 }: { likes?: number; comments?: number }) {
  return (
    <>
      <span className="stat" title={`좋아요 ${likes}`}>
        {ICON_HEART}
        {likes}
      </span>
      <span className="stat" title={`댓글 ${comments}`}>
        {ICON_COMMENT}
        {comments}
      </span>
    </>
  );
}

/**
 * 사진 자리: 대표 사진이 있으면 사진, 없으면 연한 회색 줄노트.
 * 인기 글·추천 글 카드처럼 사진 칸이 꼭 있어야 하는 곳에서 쓴다.
 */
export function Thumb({ src, className = 'thumb' }: { src?: string | null; className?: string }) {
  if (src) {
    return (
      <span className={className}>
        <img src={src} alt="" loading="lazy" />
      </span>
    );
  }
  return <span className={`${className} thumb--paper`} aria-hidden="true" />;
}

/** 다이어리 이름표: 표지 색 점 + 이름 */
export function DiaryChip({ blogId, category }: { blogId: number; category: CategoryRef }) {
  return (
    <Link className="diary-chip" to={`/blogs/${blogId}?category=${category.id}`}>
      <span className="dot" style={{ background: categoryColor(category.colorIndex) }} aria-hidden="true" />
      {category.name}
    </Link>
  );
}

/** 글 공개 범위 표시: 비공개 · 구독자 공개 (데모 visBadge). 공개면 없다 */
export function VisBadge({ visibility }: { visibility?: Visibility }) {
  if (visibility === 'PRIVATE') return <span className="badge badge--muted">{POST.privateBadge}</span>;
  if (visibility === 'SUBSCRIBERS') {
    return (
      <span className="badge badge--sub" title={SUB_VIS.postHint}>
        {SUB_VIS.badge}
      </span>
    );
  }
  return null;
}

/**
 * 글 한 줄 (데모 글 목록): 제목 · 미리보기 · (블로그) · 다이어리 · N분 전 · 좋아요 · 댓글, 오른쪽에 사진 자리.
 * blogId는 블로그 화면처럼 post.blog가 없을 때 넘긴다.
 */
export function PostRow({
  post,
  blogId,
  showBlog = true,
  badge,
}: {
  post: Pick<PostSummary, 'id' | 'title' | 'excerpt' | 'createdAt' | 'coverImageUrl' | 'likeCount' | 'commentCount'> & {
    blog?: BlogRef;
    category?: CategoryRef | null;
    authorNickname?: string;
  };
  blogId?: number;
  showBlog?: boolean;
  badge?: ReactNode;
}) {
  const bid = post.blog?.id ?? blogId;
  return (
    <article className="row">
      <div className="row__text">
        <Link className="row__link" to={`/posts/${post.id}`}>
          <h3 className="row__title">
            {badge}
            {post.title}
          </h3>
          {post.excerpt && <p className="row__preview">{post.excerpt}</p>}
        </Link>
        <div className="row__meta">
          {showBlog && post.blog && (
            <>
              <Link className="row__blog" to={`/blogs/${post.blog.id}`}>
                <span className="avatar avatar--xs" aria-hidden="true">
                  {(post.authorNickname || post.blog.name).slice(0, 1)}
                </span>
                {post.blog.name}
              </Link>
              <span className="row__sep" aria-hidden="true">
                ·
              </span>
            </>
          )}
          {post.category && bid !== undefined && <DiaryChip blogId={bid} category={post.category} />}
          <time dateTime={post.createdAt} title={formatDateLong(post.createdAt)}>
            {formatRelative(post.createdAt)}
          </time>
          <PostStats likes={post.likeCount} comments={post.commentCount} />
        </div>
      </div>
      {/* 가로 목록은 사진이 없으면 사진 칸을 비우지 않고 아예 뺀다 */}
      {post.coverImageUrl && (
        <Link className="row__thumb" to={`/posts/${post.id}`} tabIndex={-1} aria-hidden="true">
          <Thumb src={post.coverImageUrl} />
        </Link>
      )}
    </article>
  );
}
