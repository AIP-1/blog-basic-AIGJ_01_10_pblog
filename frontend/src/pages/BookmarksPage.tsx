import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { errorMessage } from '../api/client';
import {
  createBookmarkFolder,
  deleteBookmarkFolder,
  getBookmarkFolders,
  getBookmarks,
  removeBookmark,
  renameBookmarkFolder,
  saveBookmark,
} from '../api/endpoints';
import { qk, useConfig } from '../api/queries';
import type { BookmarkFolder } from '../api/types';
import { PostRow } from '../components/Cards';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { RequireLogin } from '../components/RequireLogin';
import { ErrorBox, Loading } from '../components/Status';
import { formatDateLong, formatRelative } from '../lib/format';
import { BOOKMARK } from '../messages';

/**
 * 내 책갈피 (데모 '저장한 글'): 폴더 탭(전체 · 미분류 · 폴더마다 개수), 최근에 꽂은 글부터.
 * 줄마다 폴더 옮기기 · 빼기, 고른 폴더는 이름 바꾸기 · 삭제. 지금 볼 수 없는 글(비공개로 바뀐 글 등)은 빠진다.
 */
export function BookmarksPage() {
  return <RequireLogin>{() => <Bookmarks />}</RequireLogin>;
}

const folderHref = (folder: string) => (folder === 'all' ? '/bookmarks' : `/bookmarks?folder=${folder}`);

function Bookmarks() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const foldersQ = useQuery({ queryKey: qk.bookmarkFolders, queryFn: getBookmarkFolders });
  const info = foldersQ.data;
  // 없는 폴더를 가리키면 전체로 (데모와 같다)
  const asked = params.get('folder') ?? 'all';
  const curFolder = info?.folders.find((f) => String(f.id) === asked);
  const folder = asked === 'none' || curFolder ? asked : 'all';
  const listQ = useQuery({
    queryKey: qk.bookmarks(folder, page),
    queryFn: () => getBookmarks(folder, page),
    enabled: !!info,
    placeholderData: (prev) => prev,
  });
  const [naming, setNaming] = useState<'new' | 'rename' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
  const onError = (e: unknown) => setError(errorMessage(e));
  const move = useMutation({
    mutationFn: ({ postId, folderId }: { postId: number; folderId: number | null }) => saveBookmark(postId, folderId),
    onSuccess: (_, v) => {
      void queryClient.invalidateQueries({ queryKey: qk.post(v.postId) });
      return refresh();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (postId: number) => removeBookmark(postId),
    onSuccess: (_, postId) => {
      void queryClient.invalidateQueries({ queryKey: qk.post(postId) });
      return refresh();
    },
    onError,
  });

  const folderOptions = (folders: BookmarkFolder[]) => (
    <>
      <option value="">{BOOKMARK.none}</option>
      {folders.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
    </>
  );

  return (
    <section className="saved">
      <header className="saved__head">
        <h1>{BOOKMARK.title}</h1>
        {curFolder && (
          <span className="saved__tools">
            <button type="button" className="text-btn" onClick={() => setNaming('rename')}>
              {BOOKMARK.renameFolder}
            </button>
            <button type="button" className="text-btn saved__danger" onClick={() => setDeleting(true)}>
              {BOOKMARK.deleteFolder}
            </button>
          </span>
        )}
      </header>
      {foldersQ.isPending ? (
        <Loading />
      ) : foldersQ.error ? (
        <ErrorBox error={foldersQ.error} onRetry={() => void foldersQ.refetch()} />
      ) : (
        <>
          <nav className="folder-tabs" aria-label={BOOKMARK.foldersLabel}>
            <Link to={folderHref('all')} className={folder === 'all' ? 'is-on' : undefined}>
              {BOOKMARK.all} <span className="folder-tabs__n">{foldersQ.data.total}</span>
            </Link>
            <Link to={folderHref('none')} className={folder === 'none' ? 'is-on' : undefined}>
              {BOOKMARK.none} <span className="folder-tabs__n">{foldersQ.data.none}</span>
            </Link>
            {foldersQ.data.folders.map((f) => (
              <Link key={f.id} to={folderHref(String(f.id))} className={folder === String(f.id) ? 'is-on' : undefined}>
                {f.name} <span className="folder-tabs__n">{f.count}</span>
              </Link>
            ))}
            <button type="button" className="folder-tabs__add" onClick={() => setNaming('new')}>
              {BOOKMARK.newFolder}
            </button>
          </nav>
          {listQ.isPending ? (
            <Loading />
          ) : listQ.error ? (
            <ErrorBox error={listQ.error} onRetry={() => void listQ.refetch()} />
          ) : listQ.data.items.length === 0 ? (
            <div className="empty saved__empty">
              <b>{folder === 'all' ? BOOKMARK.empty : BOOKMARK.emptyFolder}</b>
              {BOOKMARK.emptyHint}
            </div>
          ) : (
            <>
              <ul className="saved-list">
                {listQ.data.items.map((p) => (
                  <li key={p.id}>
                    <span className="saved-list__when" title={formatDateLong(p.savedAt)}>
                      {BOOKMARK.savedAgo(formatRelative(p.savedAt))}
                    </span>
                    <label className="saved-list__folder">
                      {BOOKMARK.folderSelect}{' '}
                      <select
                        aria-label={BOOKMARK.moveLabel}
                        value={p.folderId ?? ''}
                        onChange={(e) => move.mutate({ postId: p.id, folderId: e.target.value ? Number(e.target.value) : null })}
                      >
                        {folderOptions(foldersQ.data.folders)}
                      </select>
                    </label>
                    <PostRow post={p} />
                    <button
                      type="button"
                      className="saved-list__remove"
                      aria-label={BOOKMARK.removeLabel(p.title)}
                      onClick={() => remove.mutate(p.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination
                page={listQ.data.page}
                totalPages={listQ.data.totalPages}
                onChange={(n) => {
                  const next = new URLSearchParams(params);
                  if (n > 1) next.set('page', String(n));
                  else next.delete('page');
                  setParams(next);
                }}
              />
            </>
          )}
        </>
      )}
      {error && (
        <p className="modal-error" role="alert">
          {error}
        </p>
      )}

      {naming === 'new' && (
        <FolderNameDialog
          title={BOOKMARK.newFolderTitle}
          initial=""
          onClose={() => setNaming(null)}
          onSave={async (name) => {
            const f = await createBookmarkFolder(name);
            await refresh();
            navigate(folderHref(String(f.id)));
          }}
        />
      )}
      {naming === 'rename' && curFolder && (
        <FolderNameDialog
          title={BOOKMARK.renameFolderTitle}
          initial={curFolder.name}
          onClose={() => setNaming(null)}
          onSave={async (name) => {
            await renameBookmarkFolder(curFolder.id, name);
            await refresh();
          }}
        />
      )}
      {deleting && curFolder && (
        <ConfirmDialog
          title={BOOKMARK.deleteFolderTitle(curFolder.name)}
          body={BOOKMARK.deleteFolderBody(curFolder.count)}
          ok={BOOKMARK.deleteFolder}
          onClose={() => setDeleting(false)}
          onOk={async () => {
            await deleteBookmarkFolder(curFolder.id);
            navigate('/bookmarks');
            await refresh();
            void queryClient.invalidateQueries({ queryKey: ['post'] });
          }}
        />
      )}
    </section>
  );
}

/** 폴더 이름 적기 (새 폴더 · 이름 바꾸기) */
function FolderNameDialog({
  title,
  initial,
  onSave,
  onClose,
}: {
  title: string;
  initial: string;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const { limits } = useConfig();
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Modal title={title} onClose={onClose}>
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          try {
            await onSave(name);
            onClose();
          } catch (x) {
            setError(errorMessage(x));
            setBusy(false);
          }
        }}
      >
        <input
          className="input"
          value={name}
          maxLength={limits.bookmarkFolderNameMax}
          placeholder={BOOKMARK.folderName}
          aria-label={BOOKMARK.folderName}
          autoComplete="off"
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
        {error && (
          <p className="modal-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <span className="modal-actions__grow" />
          <button type="button" className="btn btn--text" onClick={onClose}>
            {BOOKMARK.cancel}
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {BOOKMARK.folderSave}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** 한 번 더 확인 (데모 confirmModal) */
function ConfirmDialog({
  title,
  body,
  ok,
  onOk,
  onClose,
}: {
  title: string;
  body: string;
  ok: string;
  onOk: () => Promise<void>;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Modal title={title} onClose={onClose}>
      <p className="modal-text">{body}</p>
      {error && (
        <p className="modal-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <span className="modal-actions__grow" />
        <button type="button" className="btn btn--text" onClick={onClose}>
          {BOOKMARK.cancel}
        </button>
        <button
          type="button"
          className="btn btn--danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onOk();
              onClose();
            } catch (x) {
              setError(errorMessage(x));
              setBusy(false);
            }
          }}
        >
          {ok}
        </button>
      </div>
    </Modal>
  );
}
