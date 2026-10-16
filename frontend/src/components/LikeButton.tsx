import { useMutation, useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '../api/client';
import { toggleLike } from '../api/endpoints';
import { qk } from '../api/queries';
import type { PostDetail } from '../api/types';
import { useRequireLogin } from '../api/useRequireLogin';
import { SOCIAL } from '../messages';
import { useToast } from './toastContext';

/** 좋아요 누름/취소 (CF-19). 자기 글에는 누를 수 없다. */
export function LikeButton({ post }: Readonly<{ post: PostDetail }>) {
  const queryClient = useQueryClient();
  const requireLogin = useRequireLogin();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: () => toggleLike(post.id),
    onSuccess: (res) => {
      queryClient.setQueryData<PostDetail>(qk.post(post.id), (old) =>
        old ? { ...old, likedByMe: res.liked, likeCount: res.likeCount } : old,
      );
    },
    onError: (e) => {
      if ((e as { status?: number }).status !== 401) toast.show(errorMessage(e), 'error');
    },
  });

  const disabled = post.isAuthor || mutation.isPending;
  return (
    <button
      type="button"
      className={`like-btn${post.likedByMe ? ' is-on' : ''}`}
      aria-pressed={post.likedByMe}
      disabled={disabled}
      title={post.isAuthor ? SOCIAL.ownPost : undefined}
      onClick={() => requireLogin(() => mutation.mutateAsync())}
    >
      <span aria-hidden="true">{post.likedByMe ? '♥' : '♡'}</span> 좋아요 <strong>{post.likeCount}</strong>
    </button>
  );
}
