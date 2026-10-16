import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { errorMessage } from '../../api/client';
import { deletePost, getCategories, getManagePosts } from '../../api/endpoints';
import { qk } from '../../api/queries';
import type { Visibility } from '../../api/types';
import { VisBadge } from '../../components/Cards';
import { Pagination } from '../../components/Pagination';
import { Empty, ErrorBox, Loading } from '../../components/Status';
import { useToast } from '../../components/toastContext';
import { formatDate } from '../../lib/format';
import { MANAGE, POST, SUB_VIS } from '../../messages';
import { useManage } from './context';

function toVisibility(v: string | null): Visibility | null {
  return v === 'PUBLIC' || v === 'SUBSCRIBERS' || v === 'PRIVATE' ? v : null;
}

/** 글 관리: 공개 여부·분류 거르기, 보기·수정·삭제 (BM-03) */
export function PostsPage() {
  const { blogId } = useManage();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const visibility = toVisibility(params.get('visibility'));
  const categoryId = params.get('category');
  const page = Math.max(1, Number(params.get('page')) || 1);

  const cats = useQuery({ queryKey: qk.categories(blogId), queryFn: () => getCategories(blogId) });
  const list = useQuery({
    queryKey: qk.managePosts(visibility ?? 'all', categoryId ?? 'all', page),
    queryFn: () => getManagePosts({ visibility, categoryId, page }),
    placeholderData: (prev) => prev,
  });

  const remove = useMutation({
    mutationFn: (id: number) => deletePost(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manage'] });
      void queryClient.invalidateQueries({ queryKey: ['blog'] });
    },
    onError: (e) => toast.show(errorMessage(e), 'error'),
  });

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const filtered = !!visibility || !!categoryId;

  let content: ReactNode;
  if (list.isPending) {
    content = <Loading />;
  } else if (list.error) {
    content = <ErrorBox error={list.error} onRetry={() => void list.refetch()} />;
  } else if (list.data.items.length === 0) {
    content = (
      <Empty>
        {filtered ? (
          <p>{MANAGE.noFilteredPosts}</p>
        ) : (
          <>
            <p>{MANAGE.noPostsYet}</p>
            <Link to="/write" className="btn btn--primary">
              글쓰기
            </Link>
          </>
        )}
      </Empty>
    );
  } else {
    content = (
      <>
        <table className="rtable">
          <thead>
            <tr>
              <th>제목</th>
              <th>다이어리</th>
              <th>작성일</th>
              <th>공개</th>
              <th className="num">조회</th>
              <th className="num">댓글</th>
              <th>
                <span className="sr-only">동작</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.data.items.map((p) => (
              <tr key={p.id}>
                <td data-label="제목" className="rtable__title">
                  <Link to={`/posts/${p.id}`}>{p.title}</Link>
                </td>
                <td data-label="다이어리">{p.category.name}</td>
                <td data-label="작성일">{formatDate(p.createdAt)}</td>
                <td data-label="공개">
                  {p.visibility === 'PUBLIC' ? '공개' : <VisBadge visibility={p.visibility} />}
                </td>
                <td data-label="조회" className="num">
                  {p.viewCount.toLocaleString()}
                </td>
                <td data-label="댓글" className="num">
                  {p.commentCount.toLocaleString()}
                </td>
                <td className="rtable__actions">
                  <Link to={`/posts/${p.id}`} className="link-btn">
                    보기
                  </Link>
                  <Link to={`/posts/${p.id}/edit`} className="link-btn">
                    수정
                  </Link>
                  <button
                    type="button"
                    className="link-btn link-btn--danger"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(POST.deleteConfirm)) remove.mutate(p.id);
                    }}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={list.data.page} totalPages={list.data.totalPages} onChange={(p) => update('page', p > 1 ? String(p) : null)} />
      </>
    );
  }

  return (
    <div>
      <div className="page-head-row">
        <h1 className="page-title">글 관리</h1>
        <Link to="/write" className="btn btn--primary btn--sm">
          글쓰기
        </Link>
      </div>
      <div className="filters">
        <label className="filters__item">
          <span className="sr-only">공개 여부</span>
          <select className="input select" value={visibility ?? ''} onChange={(e) => update('visibility', e.target.value || null)}>
            <option value="">전체</option>
            <option value="PUBLIC">공개</option>
            <option value="SUBSCRIBERS">{SUB_VIS.label}</option>
            <option value="PRIVATE">비공개</option>
          </select>
        </label>
        <label className="filters__item">
          <span className="sr-only">다이어리</span>
          <select className="input select" value={categoryId ?? ''} onChange={(e) => update('category', e.target.value || null)}>
            <option value="">모든 다이어리</option>
            {(cats.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {content}
    </div>
  );
}
