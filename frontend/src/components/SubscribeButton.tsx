import { useMutation, useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '../api/client';
import { toggleDiarySubscribe, toggleSubscribe } from '../api/endpoints';
import { qk } from '../api/queries';
import type { BlogDetail, Category } from '../api/types';
import { useRequireLogin } from '../api/useRequireLogin';
import { SUBSCRIBE } from '../messages';
import { useToast } from './toastContext';

type ToggleResult = { subscribed: boolean; subscriberCount: number };

/** 구독 버튼 공통: 누르면 구독, 다시 누르면 취소 (데모 .sub-btn) */
function useSubscribeToggle(toggle: () => Promise<ToggleResult>, onDone: (res: ToggleResult) => void) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: toggle,
    onSuccess: (res) => {
      onDone(res);
      // 구독 피드 · 구독 목록, 그리고 구독자만 다이어리 · 글이 보이게 되므로 블로그 화면도 다시 읽는다
      void queryClient.invalidateQueries({ queryKey: qk.subscriptions });
      toast.show(res.subscribed ? SUBSCRIBE.added : SUBSCRIBE.removed);
    },
    onError: (e) => {
      if ((e as { status?: number }).status !== 401) toast.show(errorMessage(e), 'error');
    },
  });
}

/** 블로그 구독/취소: 이 블로그의 모든 공개 다이어리를 받아 본다. 새 글은 구독 화면(/subscriptions)에 모인다 */
export function SubscribeButton({ blog }: Readonly<{ blog: BlogDetail }>) {
  const queryClient = useQueryClient();
  const requireLogin = useRequireLogin();
  const on = !!blog.subscribedByMe;
  const mutation = useSubscribeToggle(
    () => toggleSubscribe(blog.id),
    (res) => {
      queryClient.setQueryData<BlogDetail>(qk.blog(blog.id), (old) =>
        old ? { ...old, subscribedByMe: res.subscribed, subscriberCount: res.subscriberCount } : old,
      );
      void queryClient.invalidateQueries({ queryKey: qk.categories(blog.id) });
      void queryClient.invalidateQueries({ queryKey: ['blog', String(blog.id), 'posts'] });
    },
  );

  return (
    <button
      type="button"
      className={`btn sub-btn${on ? ' is-on' : ''}`}
      aria-pressed={on}
      title={SUBSCRIBE.blogHint}
      disabled={mutation.isPending}
      onClick={() => requireLogin(() => mutation.mutateAsync())}
    >
      {on ? SUBSCRIBE.blogSubscribed : SUBSCRIBE.blogSubscribe}
    </button>
  );
}

/** 다이어리 한 권 구독/취소. 내 다이어리 · 비공개 다이어리는 버튼이 없다 */
export function DiarySubscribeButton({ blogId, diary }: Readonly<{ blogId: number; diary: Category }>) {
  const queryClient = useQueryClient();
  const requireLogin = useRequireLogin();
  const on = !!diary.subscribedByMe;
  const mutation = useSubscribeToggle(
    () => toggleDiarySubscribe(diary.id),
    (res) => {
      queryClient.setQueryData<Category[]>(qk.categories(blogId), (old) =>
        old?.map((c) => (c.id === diary.id ? { ...c, subscribedByMe: res.subscribed, subscriberCount: res.subscriberCount } : c)),
      );
      void queryClient.invalidateQueries({ queryKey: ['blog', String(blogId), 'posts'] });
    },
  );

  return (
    <button
      type="button"
      className={`btn sub-btn${on ? ' is-on' : ''}`}
      aria-pressed={on}
      disabled={mutation.isPending}
      onClick={() => requireLogin(() => mutation.mutateAsync())}
    >
      {on ? SUBSCRIBE.diarySubscribed : SUBSCRIBE.diarySubscribe}
    </button>
  );
}
