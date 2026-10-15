import { useState } from 'react';
import type { PostDetail } from '../api/types';
import { useRequireLogin } from '../api/useRequireLogin';
import { BOOKMARK } from '../messages';
import { BookmarkDialog } from './BookmarkDialog';

/** 책갈피 (데모 '저장'). 글 아래 공유 버튼 옆에 있고, 누르면 폴더를 고르는 창이 뜬다. 내 책갈피(/bookmarks)에 모인다 */
export function BookmarkButton({ post }: Readonly<{ post: PostDetail }>) {
  const requireLogin = useRequireLogin();
  const [open, setOpen] = useState(false);
  const on = !!post.bookmarkedByMe;

  return (
    <>
      <button
        type="button"
        className={`tool-btn bookmark-btn${on ? ' is-on' : ''}`}
        aria-pressed={on}
        onClick={() => requireLogin(() => setOpen(true))}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 3h12v18l-6-4-6 4Z" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        {on ? BOOKMARK.buttonOn(post.bookmark?.folderName ?? BOOKMARK.none) : BOOKMARK.button}
      </button>
      {open && <BookmarkDialog post={post} onClose={() => setOpen(false)} />}
    </>
  );
}
