import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { errorMessage } from '../api/client';
import { deletePosts, getBlogPosts, getPinnedPosts, movePosts } from '../api/endpoints';
import { qk } from '../api/queries';
import type { BlogPostListItem, BlogPostSort, Category } from '../api/types';
import { BlogShell, DiaryCover, LockIcon } from '../components/BlogShell';
import { BlogIntro } from './BlogAboutPage';
import { PostRow } from '../components/Cards';
import { DiarySettingsModal } from '../components/DiarySettingsModal';
import { Pagination } from '../components/Pagination';
import { Empty, ErrorBox, FormMessage, Loading } from '../components/Status';
import { useToast } from '../components/toastContext';
import { categoryColor, formatDate } from '../lib/format';
import { CATEGORY, EXPLORE, POST } from '../messages';

function toPage(v: string | null): number {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

const SORTS: { key: BlogPostSort; label: string; hint?: string }[] = [
  { key: 'latest', label: '최신순' },
  {
    key: 'popular',
    label: '인기순',
    hint: '조회 ×1 + 좋아요 ×5 + 댓글 단 사람 ×3 + 책갈피 ×4',
  },
  { key: 'oldest', label: '오래된 순' },
];

/** 블로그 글 목록 — 다이어리·태그·정렬·페이지를 주소에 유지 (CF-10, 데모 블로그 화면) */
export function BlogPage() {
  const { blogId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const categoryId = params.get('category');
  const tag = params.get('tag') ?? '';
  const sortParam = params.get('sort');
  const sort: BlogPostSort = sortParam === 'popular' || sortParam === 'oldest' ? sortParam : 'latest';
  const page = toPage(params.get('page'));
  const editing = params.get('edit') === '1';

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  return (
    <BlogShell blogId={blogId} active={{ type: 'list', categoryId, tag }}>
      {({ blog, categories }) => {
        const diary = categories.find((c) => String(c.id) === categoryId);
        // 편집은 내 다이어리 안에서만
        const edit = editing && blog.isOwner && !!diary;
        return (
          <>
            {diary && (
              <DiaryHead
                diary={diary}
                isOwner={blog.isOwner}
                editing={edit}
                onEdit={(on) => {
                  const next = new URLSearchParams(params);
                  if (on) {
                    next.set('edit', '1');
                    next.delete('tag');
                  } else next.delete('edit');
                  setParams(next);
                }}
              />
            )}
            {!diary && !tag && page === 1 && (
              <>
                <BlogIntro blogId={blogId} isOwner={blog.isOwner} />
                <PinnedPosts blogId={blogId} isOwner={blog.isOwner} />
              </>
            )}
            {edit && diary ? (
              <DiaryEditList
                blogId={blog.id}
                diary={diary}
                others={categories.filter((c) => c.id !== diary.id)}
                page={page}
                onPage={(p) => setParam('page', p > 1 ? String(p) : null)}
              />
            ) : (
              <BlogPostList
                blogId={blogId}
                isOwner={blog.isOwner}
                categoryId={categoryId}
                title={diary ? '글' : '전체 글'}
                tag={tag}
                sort={sort}
                page={page}
                onSort={(s) => setParam('sort', s === 'latest' ? null : s)}
                onClearTag={() => setParam('tag', null)}
                onPage={(p) => {
                  setParam('page', p > 1 ? String(p) : null);
                  window.scrollTo({ top: 0 });
                }}
              />
            )}
          </>
        );
      }}
    </BlogShell>
  );
}

/** 다이어리를 고르면 위에 보이는 머리: 표지 · 이름 · 소개 · 글 수, 주인에게는 쓰기 · 설정 */
function DiaryHead({
  diary,
  isOwner,
  editing,
  onEdit,
}: {
  diary: Category;
  isOwner: boolean;
  editing: boolean;
  onEdit: (on: boolean) => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const locked = diary.visibility === 'PRIVATE';
  return (
    <section className="diary-head" style={{ ['--c' as string]: categoryColor(diary.colorIndex) }}>
      <DiaryCover colorIndex={diary.colorIndex} size="lg" locked={locked} />
      <div className="diary-head__info">
        <h2>
          {diary.name}
          {locked && <LockIcon />}
        </h2>
        {diary.description && <p>{diary.description}</p>}
        <span className="muted">
          글 {diary.postCount}개{locked ? ` · ${CATEGORY.privateNote}` : ''}
        </span>
      </div>
      {isOwner && (
        <div className="diary-head__actions">
          {editing ? (
            <button type="button" className="btn btn--sm btn--primary" onClick={() => onEdit(false)}>
              {CATEGORY.editDone}
            </button>
          ) : (
            <>
              <Link to={`/write?category=${diary.id}`} className="btn btn--sm btn--primary">
                {CATEGORY.writeHere}
              </Link>
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => setSettingsOpen(true)}>
                다이어리 설정
              </button>
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => onEdit(true)}>
                {CATEGORY.edit}
              </button>
            </>
          )}
        </div>
      )}
      {settingsOpen && <DiarySettingsModal key={diary.id} diary={diary} onClose={() => setSettingsOpen(false)} />}
    </section>
  );
}

/** 블로그 첫 화면 위쪽 대표글 (최대 3개, 고정한 순서) */
function PinnedPosts({ blogId, isOwner }: { blogId: string; isOwner: boolean }) {
  const { data } = useQuery({
    queryKey: qk.pinned(blogId),
    queryFn: () => getPinnedPosts(blogId),
  });
  if (!data || data.length === 0) return null;
  return (
    <section className="pinned" aria-label={CATEGORY.pinnedTitle}>
      <div className="pinned__head">
        <h2>📌 {CATEGORY.pinnedTitle}</h2>
        {isOwner && <span className="muted">{CATEGORY.pinnedHint}</span>}
      </div>
      <ul className="pinned__list">
        {data.map((p) => (
          <li key={p.id}>
            <Link to={`/posts/${p.id}`} className="pinned__card">
              {p.coverImageUrl && <img src={p.coverImageUrl} alt="" className="pinned__thumb" />}
              {p.category && (
                <span className="pinned__diary">
                  <span className="dot" style={{ background: categoryColor(p.category.colorIndex) }} aria-hidden="true" />
                  {p.category.name}
                </span>
              )}
              <b className="pinned__title">{p.title}</b>
              {p.excerpt && <span className="pinned__excerpt">{p.excerpt}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 다이어리 편집: 글을 골라 다른 다이어리로 옮기거나 한꺼번에 지운다 (지금 페이지의 글) */
function DiaryEditList({
  blogId,
  diary,
  others,
  page,
  onPage,
}: {
  blogId: number;
  diary: Category;
  others: Category[];
  page: number;
  onPage: (p: number) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [picked, setPicked] = useState<number[]>([]);
  const [target, setTarget] = useState<number | null>(others[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    data,
    isPending,
    error: loadError,
    refetch,
  } = useQuery({
    queryKey: qk.blogPosts(blogId, String(diary.id), page),
    queryFn: () => getBlogPosts(blogId, { categoryId: String(diary.id), page }),
  });

  if (isPending) return <Loading />;
  if (loadError) return <ErrorBox error={loadError} onRetry={() => void refetch()} />;
  if (data.items.length === 0) return <Empty>{CATEGORY.editEmpty}</Empty>;

  const ids = data.items.map((p) => p.id);
  const allOn = picked.length > 0 && ids.every((id) => picked.includes(id));
  const toggle = (id: number) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    try {
      toast.show(await action());
      setPicked([]);
      void queryClient.invalidateQueries({ queryKey: ['blog'] });
      void queryClient.invalidateQueries({ queryKey: ['manage'] });
      void queryClient.invalidateQueries({ queryKey: ['post'] });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onMove = () => {
    const to = others.find((c) => c.id === target);
    if (!to || !window.confirm(CATEGORY.moveConfirm(picked.length, to.name))) return;
    void run(async () => CATEGORY.moved((await movePosts(blogId, picked, to.id)).moved));
  };
  const onDelete = () => {
    if (!window.confirm(CATEGORY.bulkDeleteConfirm(picked.length))) return;
    void run(async () => CATEGORY.bulkDeleted((await deletePosts(blogId, picked)).deleted));
  };

  return (
    <section>
      <div className="edit-bar" role="toolbar" aria-label="글 편집">
        <label className="checkbox">
          <input type="checkbox" checked={allOn} onChange={() => setPicked(allOn ? [] : ids)} />
          {CATEGORY.selectAll}
        </label>
        <span className="muted" aria-live="polite">
          {CATEGORY.selected(picked.length)}
        </span>
        <span className="edit-bar__tools">
          {others.length > 0 && (
            <>
              <select
                className="input select input--sm"
                aria-label={CATEGORY.moveTo}
                value={target ?? ''}
                onChange={(e) => setTarget(Number(e.target.value))}
              >
                {others.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn--sm btn--outline" disabled={!picked.length || busy} onClick={onMove}>
                {CATEGORY.move}
              </button>
            </>
          )}
          <button type="button" className="btn btn--sm btn--danger" disabled={!picked.length || busy} onClick={onDelete}>
            삭제
          </button>
        </span>
      </div>
      <FormMessage kind="error" message={error} />
      <ul className="post-list edit-list">
        {data.items.map((p: BlogPostListItem) => (
          <li key={p.id} className={`post-list__item edit-list__row${picked.includes(p.id) ? ' is-on' : ''}`}>
            <label className="edit-list__label">
              <input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} aria-label={`${p.title} 선택`} />
              <span className="edit-list__text">
                <span className="post-list__title">{p.title}</span>
                <span className="muted">
                  {formatDate(p.createdAt)}
                  {p.visibility === 'PRIVATE' && ` · ${POST.privateBadge}`}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        onChange={(p) => {
          setPicked([]);
          onPage(p);
        }}
      />
    </section>
  );
}

interface ListProps {
  blogId: string;
  isOwner: boolean;
  categoryId: string | null;
  title: string;
  tag: string;
  sort: BlogPostSort;
  page: number;
  onSort: (s: BlogPostSort) => void;
  onClearTag: () => void;
  onPage: (p: number) => void;
}

function BlogPostList({ blogId, isOwner, categoryId, title, tag, sort, page, onSort, onClearTag, onPage }: ListProps) {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.blogPosts(blogId, categoryId, page, tag, sort),
    queryFn: () => getBlogPosts(blogId, { categoryId, tag, sort, page }),
    placeholderData: (prev) => prev,
  });

  if (isPending) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={() => void refetch()} />;

  return (
    <section>
      <div className="list-head">
        <h2 className="list-head__title">{title}</h2>
        <span className="list-head__count">{EXPLORE.postCount(data.totalItems)}</span>
        <nav className="seg-tabs" aria-label="정렬">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={sort === s.key ? 'is-on' : ''}
              aria-pressed={sort === s.key}
              title={s.hint}
              onClick={() => onSort(s.key)}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>
      {tag && (
        <div className="tag-filter">
          <b>#{tag}</b>
          <span className="muted">{EXPLORE.postCount(data.totalItems)}</span>
          <button type="button" className="link-btn" onClick={onClearTag}>
            {CATEGORY.tagFilterClear}
          </button>
        </div>
      )}
      {data.items.length === 0 ? (
        <Empty>
          <p>{tag ? CATEGORY.emptyTag : EXPLORE.emptyList}</p>
          {isOwner && !tag && (
            <>
              <p>{EXPLORE.firstPost}</p>
              <Link to={categoryId ? `/write?category=${categoryId}` : '/write'} className="btn btn--primary">
                글쓰기
              </Link>
            </>
          )}
        </Empty>
      ) : (
        <div className="row-list">
          {data.items.map((p) => (
            <PostRow
              key={p.id}
              post={p}
              blogId={Number(blogId)}
              showBlog={false}
              badge={p.visibility === 'PRIVATE' ? <span className="badge badge--muted">{POST.privateBadge}</span> : undefined}
            />
          ))}
        </div>
      )}
      <Pagination page={data.page} totalPages={data.totalPages} onChange={onPage} />
    </section>
  );
}
