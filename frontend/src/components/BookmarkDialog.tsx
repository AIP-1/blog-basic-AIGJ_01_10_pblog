import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '../api/client';
import { createBookmarkFolder, getBookmarkFolders, removeBookmark, saveBookmark } from '../api/endpoints';
import { qk, useConfig } from '../api/queries';
import type { BookmarkFolders, BookmarkPlace, PostDetail } from '../api/types';
import { BOOKMARK } from '../messages';
import { Modal } from './Modal';

/**
 * 책갈피 창 (데모 '어디에 저장할까요?'): 폴더 고르기, 새 폴더 만들기.
 * 이미 꽂은 글이면 다른 폴더로 옮기거나 책갈피를 뺀다.
 */
export function BookmarkDialog({ post, onClose }: Readonly<{ post: PostDetail; onClose: () => void }>) {
  const queryClient = useQueryClient();
  const { limits } = useConfig();
  const saved = post.bookmarkedByMe ? (post.bookmark ?? { folderId: null, folderName: null }) : null;
  const [choice, setChoice] = useState<number | null>(saved?.folderId ?? null);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const foldersQ = useQuery({ queryKey: qk.bookmarkFolders, queryFn: getBookmarkFolders });
  const folders = foldersQ.data?.folders ?? [];

  const setPlace = (place: BookmarkPlace | null) => {
    queryClient.setQueryData<PostDetail>(qk.post(post.id), (old) =>
      old ? { ...old, bookmarkedByMe: !!place, bookmark: place } : old,
    );
    void queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    onClose();
  };

  const add = useMutation({
    mutationFn: () => createBookmarkFolder(newName),
    onSuccess: (f) => {
      queryClient.setQueryData<BookmarkFolders>(qk.bookmarkFolders, (old) =>
        old ? { ...old, folders: [...old.folders, f] } : old,
      );
      void queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      setChoice(f.id);
      setNewName('');
      setError(null);
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const save = useMutation({
    mutationFn: () => saveBookmark(post.id, choice),
    onSuccess: (place) => setPlace(place),
    onError: (e) => setError(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => removeBookmark(post.id),
    onSuccess: () => setPlace(null),
    onError: (e) => setError(errorMessage(e)),
  });
  const busy = save.isPending || remove.isPending;

  return (
    <Modal title={saved ? BOOKMARK.savedTitle : BOOKMARK.pickTitle} onClose={onClose}>
      <p className="modal-text">‘{post.title}’</p>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) save.mutate();
        }}
      >
        <div className="folder-pick">
          <label className="folder-pick__item">
            <input type="radio" name="bookmark-folder" checked={choice === null} onChange={() => setChoice(null)} />
            {BOOKMARK.none}
          </label>
          {folders.map((f) => (
            <label key={f.id} className="folder-pick__item">
              <input type="radio" name="bookmark-folder" checked={choice === f.id} onChange={() => setChoice(f.id)} />
              {f.name}
              <span className="muted">{f.count}</span>
            </label>
          ))}
        </div>
        <div className="new-folder">
          <input
            value={newName}
            maxLength={limits.bookmarkFolderNameMax}
            placeholder={BOOKMARK.newFolderName}
            aria-label={BOOKMARK.newFolderName}
            autoComplete="off"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (!add.isPending) add.mutate();
              }
            }}
          />
          <button type="button" className="btn btn--sm btn--outline" disabled={add.isPending} onClick={() => add.mutate()}>
            {BOOKMARK.addFolder}
          </button>
        </div>
        {error && (
          <p className="modal-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          {saved && (
            <button type="button" className="btn btn--text btn--danger-text" disabled={busy} onClick={() => remove.mutate()}>
              {BOOKMARK.remove}
            </button>
          )}
          <span className="modal-actions__grow" />
          <button type="button" className="btn btn--text" onClick={onClose}>
            {BOOKMARK.cancel}
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {saved ? BOOKMARK.move : BOOKMARK.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}
