import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { errorMessage } from '../../api/client';
import { deleteComment, getManageComments } from '../../api/endpoints';
import { qk } from '../../api/queries';
import type { ManageCommentItem, Page } from '../../api/types';
import { Pagination } from '../../components/Pagination';
import { Empty, ErrorBox, Loading } from '../../components/Status';
import { useToast } from '../../components/toastContext';
import { formatDateTime } from '../../lib/format';
import { MANAGE, SOCIAL } from '../../messages';

/** 댓글 관리: 최신순, NEW, 글 제목 → 댓글 위치, 삭제 (BM-05). 열면 새 댓글이 읽음이 된다. */
export function CommentsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const key = qk.manageComments(page);

  const q = useQuery({ queryKey: key, queryFn: () => getManageComments(page), staleTime: Infinity, gcTime: 0 });

  // 서버가 읽음 처리를 했으니 사용자 메뉴·관리 메뉴·대시보드의 숫자를 새로 받는다 (BM-05-6)
  const loaded = q.isSuccess;
  useEffect(() => {
    if (!loaded) return;
    void queryClient.invalidateQueries({ queryKey: qk.me });
    void queryClient.invalidateQueries({ queryKey: qk.dashboard });
  }, [loaded, queryClient]);

  const remove = useMutation({
    mutationFn: (id: number) => deleteComment(id),
    onSuccess: (_r, id) => {
      // NEW 표시를 유지하려고 목록을 다시 받지 않고 지운 항목만 뺀다
      queryClient.setQueryData<Page<ManageCommentItem>>(key, (old) =>
        old ? { ...old, items: old.items.filter((c) => c.id !== id), totalItems: Math.max(0, old.totalItems - 1) } : old,
      );
      void queryClient.invalidateQueries({ queryKey: ['post'] });
    },
    onError: (e) => toast.show(errorMessage(e), 'error'),
  });

  let content: ReactNode;
  if (q.isPending) {
    content = <Loading />;
  } else if (q.error) {
    content = <ErrorBox error={q.error} onRetry={() => void q.refetch()} />;
  } else if (q.data.items.length === 0) {
    content = <Empty>{MANAGE.noComments}</Empty>;
  } else {
    content = (
      <>
        <ul className="mcomment-list card">
          {q.data.items.map((c) => (
            <li key={c.id} className={`mcomment${c.isNew ? ' is-new' : ''}`}>
              <div className="mcomment__head">
                {c.isNew && <span className="badge badge--new">NEW</span>}
                {c.reply && <span className="badge badge--muted">답글</span>}
                <span className={`comment__author${c.author ? '' : ' is-withdrawn'}`}>
                  {c.author ? c.author.nickname : SOCIAL.withdrawnUser}
                </span>
                <time className="comment__time" dateTime={c.createdAt}>
                  {formatDateTime(c.createdAt)}
                </time>
                <button
                  type="button"
                  className="link-btn link-btn--danger mcomment__delete"
                  disabled={remove.isPending}
                  onClick={() => {
                    const msg = c.reply ? SOCIAL.commentDeleteConfirm : SOCIAL.commentDeleteMaybeRepliesConfirm;
                    if (window.confirm(msg)) remove.mutate(c.id);
                  }}
                >
                  삭제
                </button>
              </div>
              <p className="mcomment__body">{c.preview}</p>
              <Link to={`/posts/${c.post.id}#comment-${c.id}`} className="mcomment__post">
                {c.post.title}
              </Link>
            </li>
          ))}
        </ul>
        <Pagination page={q.data.page} totalPages={q.data.totalPages} onChange={(p) => setParams(p > 1 ? { page: String(p) } : {})} />
      </>
    );
  }

  return (
    <div>
      <h1 className="page-title">댓글 관리</h1>
      {content}
    </div>
  );
}
