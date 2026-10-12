import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { isNotFound } from '../api/client';
import { getBlog, getBlogTags, getCategories } from '../api/endpoints';
import { qk } from '../api/queries';
import type { BlogDetail, Category } from '../api/types';
import { categoryColor } from '../lib/format';
import { NotFound } from './NotFound';
import { ErrorBox, Loading } from './Status';
import { useHighlightTopic } from './topicHighlight';

interface BlogShellProps {
  blogId: string;
  /** tag는 왼쪽 태그 모음에서 고른 것 */
  active: { type: 'list'; categoryId: string | null; tag?: string | null };
  children: (ctx: { blog: BlogDetail; categories: Category[] }) => ReactNode;
}

/** 자물쇠 (비공개 다이어리) */
export function LockIcon({ label = '비공개' }: { label?: string }) {
  return (
    <svg className="lock-icon" viewBox="0 0 16 16" width="10" height="10" role="img" aria-label={label}>
      <path
        fill="currentColor"
        d="M5 7V5a3 3 0 1 1 6 0v2h.5A1.5 1.5 0 0 1 13 8.5v5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5v-5A1.5 1.5 0 0 1 4.5 7H5Zm1.5 0h3V5a1.5 1.5 0 0 0-3 0v2Z"
      />
    </svg>
  );
}

/** 다이어리 표지 (책 모양). 색은 다이어리의 표지 색 */
export function DiaryCover({ colorIndex, size = 'md', locked }: { colorIndex: number; size?: 'sm' | 'md' | 'lg'; locked?: boolean }) {
  return (
    <span className={`cover cover--${size}`} style={{ ['--c' as string]: categoryColor(colorIndex) }} aria-hidden={!locked}>
      {locked && (
        <span className="cover__lock">
          <LockIcon />
        </span>
      )}
    </span>
  );
}

/**
 * 블로그 화면 공통 틀 (데모 블로그 화면): 이름·소개·다이어리 책장 머리 +
 * 왼쪽 다이어리 목록·태그 모음 + 본문.
 */
export function BlogShell({ blogId, active, children }: BlogShellProps) {
  const blogQ = useQuery({ queryKey: qk.blog(blogId), queryFn: () => getBlog(blogId) });
  const catQ = useQuery({ queryKey: qk.categories(blogId), queryFn: () => getCategories(blogId), enabled: blogQ.isSuccess });
  const tagQ = useQuery({ queryKey: qk.blogTags(blogId), queryFn: () => getBlogTags(blogId), enabled: blogQ.isSuccess });
  useHighlightTopic(blogQ.data?.topic?.code);

  if (blogQ.isPending) return <Loading />;
  if (isNotFound(blogQ.error)) return <NotFound what="블로그" />;
  if (blogQ.error) return <ErrorBox error={blogQ.error} onRetry={() => void blogQ.refetch()} />;

  const blog = blogQ.data;
  const categories = catQ.data ?? [];
  const tags = tagQ.data ?? [];
  const total = categories.reduce((sum, c) => sum + c.postCount, 0);
  const currentCat = active.categoryId;
  const currentTag = active.tag ?? '';
  const base = `/blogs/${blog.id}`;

  return (
    <div className="blog">
      {/* 데모의 블로그 배너 자리 — 배너 사진 기능이 생기기 전까지는 회색 띠 */}
      <div className="blog-banner blog-banner--empty" aria-hidden="true" />
      <header className="blog-head">
        <div className="blog-head__text">
          <h1 className="blog-head__name">
            <Link to={base}>{blog.name}</Link>
          </h1>
          {blog.description ? (
            <p className="blog-head__intro">{blog.description}</p>
          ) : (
            blog.isOwner && (
              <p className="blog-head__intro muted">
                아직 소개가 없습니다. <Link to="/manage/settings">소개 쓰기</Link>
              </p>
            )
          )}
          <p className="blog-head__meta">
            <span className="avatar avatar--xs" aria-hidden="true">
              {blog.owner.nickname.slice(0, 1)}
            </span>
            {blog.owner.nickname} · 다이어리 {categories.length}권 · 글 {total}개
          </p>
          <nav className="bookshelf" aria-label="다이어리 책장">
            <div className="bookshelf__books">
              {categories.map((c) => {
                const on = currentCat === String(c.id);
                return (
                  <Link
                    key={c.id}
                    to={`${base}?category=${c.id}`}
                    className={`book${on ? ' is-on' : ''}`}
                    aria-current={on ? 'page' : undefined}
                    title={c.description ? `${c.name} — ${c.description}` : c.name}
                  >
                    <DiaryCover colorIndex={c.colorIndex} locked={c.visibility === 'PRIVATE'} />
                    <span className="book__name">{c.name}</span>
                    <span className="book__count">{c.postCount}</span>
                  </Link>
                );
              })}
              {blog.isOwner && (
                <Link to="/manage/categories" className="book book--add" title="새 다이어리">
                  <span className="cover cover--md cover--add" aria-hidden="true">
                    +
                  </span>
                  <span className="book__name">새 다이어리</span>
                  <span className="book__count">&nbsp;</span>
                </Link>
              )}
            </div>
            <div className="bookshelf__board" aria-hidden="true" />
          </nav>
        </div>
        {blog.isOwner && (
          <div className="blog-head__actions">
            <Link to="/write" className="btn btn--sm btn--primary">
              글쓰기
            </Link>
            <Link to="/manage" className="btn btn--sm btn--ghost">
              블로그 관리
            </Link>
          </div>
        )}
      </header>

      <div className="with-side">
        <aside className="side">
          <nav aria-label="다이어리">
            <h2 className="side__title">다이어리</h2>
            <ul className="diary-list">
              <li>
                <Link to={base} className={currentCat === null ? 'is-current' : ''} aria-current={currentCat === null ? 'page' : undefined}>
                  <span className="diary-list__name">전체</span>
                  <span className="diary-list__count">{total}</span>
                </Link>
              </li>
              {categories.map((c) => {
                const isCur = currentCat === String(c.id);
                return (
                  <li key={c.id}>
                    <Link to={`${base}?category=${c.id}`} className={isCur ? 'is-current' : ''} aria-current={isCur ? 'page' : undefined}>
                      <span className="diary-list__name">
                        <span className="dot" style={{ background: categoryColor(c.colorIndex) }} aria-hidden="true" />
                        {c.name}
                        {c.visibility === 'PRIVATE' && <LockIcon />}
                      </span>
                      <span className="diary-list__count">{c.postCount}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {blog.isOwner && (
              <Link to="/manage/categories" className="side__add">
                + 새 다이어리
              </Link>
            )}
          </nav>
          {tags.length > 0 && (
            <section className="side__tags" aria-label="이 블로그의 태그">
              <h2 className="side__title">태그</h2>
              <div className="tag-cloud">
                {tags.map((t) => {
                  const on = t.name.toLowerCase() === currentTag.toLowerCase();
                  return (
                    <Link
                      key={t.name}
                      to={`${base}?tag=${encodeURIComponent(t.name)}`}
                      className={`tag${on ? ' is-on' : ''}`}
                      aria-current={on ? 'true' : undefined}
                    >
                      #{t.name}
                      <span className="tag-cloud__count">{t.count}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </aside>
        <div className="blog__main">{children({ blog, categories })}</div>
      </div>
    </div>
  );
}
