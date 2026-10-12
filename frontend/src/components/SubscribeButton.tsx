import { useMutation, useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '../api/client';
import { toggleSubscribe } from '../api/endpoints';
import { qk } from '../api/queries';
import type { BlogDetail } from '../api/types';
import { useRequireLogin } from '../api/useRequireLogin';
import { SUBSCRIBE } from '../messages';
import { useToast } from './toastContext';

/** 블로그 구독/취소. 구독한 블로그의 새 글은 구독 화면(/subscriptions)에 모인다 */
export function SubscribeButton({ blog }: { blog: BlogDetail }) {
  const queryClient = useQueryClient();
  const requireLogin = useRequireLogin();
  const toast = useToast();
  const on = !!blog.subscribedByMe;
  const mutation = useMutation({
    mutationFn: () => toggleSubscribe(blog.id),
    onSuccess: (res) => {
      queryClient.setQueryData<BlogDetail>(qk.blog(blog.id), (old) =>
        old ? { ...old, subscribedByMe: res.subscribed, subscriberCount: res.subscriberCount } : old,
      );
      void queryClient.invalidateQueries({ queryKey: qk.subscriptions });
      toast.show(res.subscribed ? SUBSCRIBE.added : SUBSCRIBE.removed);
    },
    onError: (e) => {
      if ((e as { status?: number }).status !== 401) toast.show(errorMessage(e), 'error');
    },
  });

  return (
    <button
      type="button"
      className={`btn btn--sm ${on ? 'btn--outline' : 'btn--primary'}`}
      aria-pressed={on}
      disabled={mutation.isPending}
      onClick={() => requireLogin(() => mutation.mutateAsync())}
    >
      {on ? SUBSCRIBE.subscribed : SUBSCRIBE.subscribe}
      <span className="subscribe-btn__count">{(blog.subscriberCount ?? 0).toLocaleString()}</span>
    </button>
  );
}
