import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState, type SubmitEvent } from 'react';
import { errorMessage, isApiError } from '../api/client';
import { createComment, deleteComment, getComments } from '../api/endpoints';
import { qk, useConfig, useMe } from '../api/queries';
import type { Comment, PostDetail } from '../api/types';
import { useRequireLogin } from '../api/useRequireLogin';
import { useAuth } from '../auth/context';
import { formatDateTime } from '../lib/format';
import { charCount } from '../lib/validation';
import { SOCIAL } from '../messages';
import { ErrorBox, FieldError, Loading } from './Status';
import { useToast } from './toastContext';

/** 댓글 입력칸. 원 댓글과 답글이 같이 쓴다. */
function CommentForm({
  label,
  placeholder,
  submitLabel,
  rows,
  pending,
  onSubmit,
  onCancel,
}: Readonly<{
  label: string;
  placeholder: string;
  submitLabel: string;
  rows: number;
  pending: boolean;
  onSubmit: (text: string) => Promise<unknown>;
  onCancel?: () => void;
}>) {
  const { limits } = useConfig();
  const requireLogin = useRequireLogin();
  const inputId = useId();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return setError(SOCIAL.commentRequired);
    if (charCount(text) > limits.commentMax) return setError(SOCIAL.commentTooLong(limits.commentMax));
    if (pending) return;
    requireLogin(() =>
      onSubmit(body).then(
        () => {
          setBody('');
          setError(null);
        },
        (err: unknown) => {
          if (isApiError(err) && err.status === 401) throw err; // useRequireLogin이 로그인 창을 다시 띄운다
          setError(isApiError(err) && err.fields.body ? err.fields.body : errorMessage(err));
        },
      ),
    );
  };

  return (
    <form className={`comment-form${onCancel ? ' comment-form--reply' : ''}`} onSubmit={submit}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <textarea
        id={inputId}
        className="input textarea"
        rows={rows}
        placeholder={placeholder}
        value={body}
        autoFocus={!!onCancel}
        onChange={(e) => {
          setBody(e.target.value);
          setError(null);
        }}
      />
      <div className="comment-form__foot">
        <span className="counter">
          {charCount(body.trim())}/{limits.commentMax}
        </span>
        {onCancel && (
          <button type="button" className="btn btn--sm" onClick={onCancel}>
            취소
          </button>
        )}
        <button type="submit" className="btn btn--primary btn--sm" disabled={pending}>
          {submitLabel}
        </button>
      </div>
      <FieldError message={error} />
    </form>
  );
}

/** 댓글: 오래된 순, 답글 한 단계, 비회원 안내, 등록, 삭제 확인, 탈퇴한 사용자 (CF-18) */
export function CommentSection({ post }: Readonly<{ post: PostDetail }>) {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { openLogin } = useAuth();
  const toast = useToast();
  const [replyTo, setReplyTo] = useState<number | null>(null);

  const q = useQuery({ queryKey: qk.comments(post.id), queryFn: () => getComments(post.id) });

  // 댓글 관리에서 "#comment-{id}" 로 들어오면 그 위치로 (BM-05-2)
  useEffect(() => {
    if (!q.data) return;
    const hash = window.location.hash;
    if (hash.startsWith('#comment')) {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'center' });
    }
  }, [q.data]);

  const changeCount = (delta: number) => {
    queryClient.setQueryData<PostDetail>(qk.post(post.id), (old) =>
      old ? { ...old, commentCount: Math.max(0, old.commentCount + delta) } : old,
    );
    void queryClient.invalidateQueries({ queryKey: qk.comments(post.id) });
  };

  const add = useMutation({
    mutationFn: ({ text, parentId }: { text: string; parentId?: number }) => createComment(post.id, text, parentId),
    onSuccess: (_data, vars) => {
      if (vars.parentId !== undefined) setReplyTo(null);
      changeCount(1);
      void queryClient.invalidateQueries({ queryKey: ['shop'] }); // 잉크 적립 알림 (InkWatcher)
    },
  });

  const remove = useMutation({
    mutationFn: (c: Comment) => deleteComment(c.id),
    // 원 댓글을 지우면 답글도 함께 지워진다
    onSuccess: (_data, c) => changeCount(-(1 + (c.replies?.length ?? 0))),
    onError: (e) => toast.show(errorMessage(e), 'error'),
  });

  const confirmRemove = (c: Comment) => {
    const msg = c.replies?.length ? SOCIAL.commentDeleteWithRepliesConfirm : SOCIAL.commentDeleteConfirm;
    if (window.confirm(msg)) remove.mutate(c);
  };

  const toggleReply = (id: number) => {
    if (!me) {
      openLogin();
      return;
    }
    setReplyTo(replyTo === id ? null : id);
  };

  const renderComment = (c: Comment, root?: Comment) => (
    <li key={c.id} id={`comment-${c.id}`} className={`comment${root ? ' comment--reply' : ''}`}>
      <div className="comment__head">
        <span className={`comment__author${c.author ? '' : ' is-withdrawn'}`}>
          {c.author ? c.author.nickname : SOCIAL.withdrawnUser}
        </span>
        <time className="comment__time" dateTime={c.createdAt}>
          {formatDateTime(c.createdAt)}
        </time>
        <span className="comment__actions">
          {!root && (
            <button
              type="button"
              className="link-btn comment__reply"
              onClick={() => toggleReply(c.id)}
            >
              답글
            </button>
          )}
          {c.canDelete && (
            <button type="button" className="link-btn" disabled={remove.isPending} onClick={() => confirmRemove(c)}>
              삭제
            </button>
          )}
        </span>
      </div>
      <p className="comment__body">{c.body}</p>
      {!root && (c.replies?.length || replyTo === c.id) ? (
        <ul className="comment-replies">
          {c.replies?.map((r) => renderComment(r, c))}
          {replyTo === c.id && me && (
            <li className="comment comment--reply">
              <CommentForm
                label="답글 입력"
                placeholder="답글을 입력하세요"
                submitLabel="답글 등록"
                rows={2}
                pending={add.isPending}
                onSubmit={(text) => add.mutateAsync({ text, parentId: c.id })}
                onCancel={() => setReplyTo(null)}
              />
            </li>
          )}
        </ul>
      ) : null}
    </li>
  );

  const renderList = () => {
    if (q.isPending) return <Loading />;
    if (q.error) return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />;
    if (q.data.length === 0) return <p className="muted">아직 댓글이 없습니다</p>;
    return <ul className="comment-list">{q.data.map((c) => renderComment(c))}</ul>;
  };

  const count = q.data ? q.data.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0) : post.commentCount;

  return (
    <section className="comments" id="comments" aria-label="댓글">
      <h2 className="comments__title">
        댓글 <span className="comments__count">{count}</span>
      </h2>

      {renderList()}

      {me ? (
        <CommentForm
          label="댓글 입력"
          placeholder="댓글을 입력하세요"
          submitLabel="댓글 등록"
          rows={3}
          pending={add.isPending}
          onSubmit={(text) => add.mutateAsync({ text })}
        />
      ) : (
        <div className="comment-login">
          <p>{SOCIAL.commentLoginRequired}</p>
          <button type="button" className="btn btn--sm" onClick={() => openLogin()}>
            로그인
          </button>
        </div>
      )}
    </section>
  );
}
