import { useMutation, useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '../api/client';
import { toggleBookmark } from '../api/endpoints';
import { qk } from '../api/queries';
import type { PostDetail } from '../api/types';
import { useRequireLogin } from '../api/useRequireLogin';
import { BOOKMARK } from '../messages';
import { useToast } from './toastContext';

/** 책갈피 넣기/빼기. 내 책갈피(/bookmarks)에 모인다 */
export function BookmarkButton({ post }: { post: PostDetail }) {
  const queryClient = useQueryClient();
  const requireLogin = useRequireLogin();
  const toast = useToast();
  const on = !!post.bookmarkedByMe;
  const mutation = useMutation({
    mutationFn: () => toggleBookmark(post.id),
    onSuccess: (res) => {
      queryClient.setQueryData<PostDetail>(qk.post(post.id), (old) => (old ? { ...old, bookmarkedByMe: res.bookmarked } : old));
      void queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      toast.show(res.bookmarked ? BOOKMARK.added : BOOKMARK.removed);
    },
    onError: (e) => {
      if ((e as { status?: number }).status !== 401) toast.show(errorMessage(e), 'error');
    },
  });

  return (
    <button
      type="button"
      className={`like-btn bookmark-btn${on ? ' is-on' : ''}`}
      aria-pressed={on}
      disabled={mutation.isPending}
      onClick={() => requireLogin(() => mutation.mutateAsync())}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M4 2h8v12l-4-3-4 3V2Z" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      책갈피
    </button>
  );
}
