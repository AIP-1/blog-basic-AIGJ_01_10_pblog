import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState, type SubmitEvent } from 'react';
import { errorMessage, isApiError } from '../../api/client';
import { createCategory, deleteCategory, getCategories, moveCategory, renameCategory } from '../../api/endpoints';
import { qk, useConfig } from '../../api/queries';
import type { Category } from '../../api/types';
import { ErrorBox, FieldError, FormMessage, Loading } from '../../components/Status';
import { categoryColor } from '../../lib/format';
import { MANAGE, POST } from '../../messages';
import { useManage } from './context';

function nameError(name: string, max: number): string | null {
  const n = name.trim();
  if (!n) return MANAGE.categoryNameRequired;
  if (n.length > max) return MANAGE.categoryNameTooLong(max);
  return null;
}

function categoryErrorMessage(e: unknown, fallbackCount?: number): string {
  if (isApiError(e)) {
    if (e.code === 'CATEGORY_NAME_TAKEN') return POST.categoryNameTaken;
    if (e.code === 'CATEGORY_HAS_POSTS') {
      const n = typeof e.details.postCount === 'number' ? e.details.postCount : fallbackCount;
      return n !== undefined ? POST.categoryHasPosts(n) : errorMessage(e);
    }
    if (e.code === 'DEFAULT_CATEGORY') return POST.defaultCategory;
    if (e.fields.name) return e.fields.name;
  }
  return errorMessage(e);
}

/** 다이어리 관리: 추가 · 이름 변경 · 위/아래 · 삭제 (BM-04, CF-08) */
export function CategoriesPage() {
  const { blogId } = useManage();
  const queryClient = useQueryClient();
  const { limits } = useConfig();
  const newId = useId();
  const newRef = useRef<HTMLInputElement>(null);
  const [newName, setNewName] = useState('');
  const [newError, setNewError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [editing, setEditing] = useState<{ id: number; name: string; error: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const q = useQuery({ queryKey: qk.categories(blogId), queryFn: () => getCategories(blogId) });

  const run = async (fn: () => Promise<unknown>, onError: (e: unknown) => void) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey: qk.categories(blogId) });
      void queryClient.invalidateQueries({ queryKey: ['blog', String(blogId)] });
      return true;
    } catch (e) {
      onError(e);
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const onAdd = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const err = nameError(newName, limits.categoryNameMax);
    if (err) {
      setNewError(err);
      newRef.current?.focus();
      return;
    }
    setMessage(null);
    const ok = await run(() => createCategory(blogId, newName.trim()), (e2) => setNewError(categoryErrorMessage(e2)));
    if (ok) {
      setNewName('');
      setNewError(null);
    }
  };

  const onRename = async () => {
    if (!editing) return;
    const err = nameError(editing.name, limits.categoryNameMax);
    if (err) return setEditing({ ...editing, error: err });
    const { id, name } = editing;
    const ok = await run(() => renameCategory(id, name.trim()), (e) => setEditing({ id, name, error: categoryErrorMessage(e) }));
    if (ok) setEditing(null);
  };

  const onMove = (c: Category, direction: 'up' | 'down') => {
    setMessage(null);
    void run(() => moveCategory(c.id, direction), (e) => setMessage({ kind: 'error', text: categoryErrorMessage(e) }));
  };

  const onDelete = (c: Category) => {
    setMessage(null);
    if (c.isDefault) return setMessage({ kind: 'error', text: POST.defaultCategory });
    if (c.postCount > 0) return setMessage({ kind: 'error', text: POST.categoryHasPosts(c.postCount) });
    if (!window.confirm(POST.categoryDeleteConfirm)) return;
    void run(() => deleteCategory(c.id), (e) => setMessage({ kind: 'error', text: categoryErrorMessage(e, c.postCount) }));
  };

  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />;
  const cats = q.data;

  return (
    <div>
      <h1 className="page-title">다이어리 관리</h1>
      <FormMessage kind={message?.kind ?? 'info'} message={message?.text} />
      <ul className="cat-manage card">
        {cats.map((c, i) => (
          <li key={c.id} className="cat-manage__item">
            <span className="dot" style={{ background: categoryColor(c.colorIndex) }} aria-hidden="true" />
            {editing?.id === c.id ? (
              <div className="cat-manage__edit">
                <input
                  className="input input--sm"
                  aria-label="다이어리 이름"
                  value={editing.name}
                  maxLength={limits.categoryNameMax + 5}
                  autoFocus
                  onChange={(e) => setEditing({ ...editing, name: e.target.value, error: null })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void onRename();
                    } else if (e.key === 'Escape') setEditing(null);
                  }}
                />
                <button type="button" className="btn btn--sm btn--primary" disabled={busy} onClick={() => void onRename()}>
                  저장
                </button>
                <button type="button" className="btn btn--sm btn--ghost" onClick={() => setEditing(null)}>
                  취소
                </button>
                <FieldError message={editing.error} />
              </div>
            ) : (
              <>
                <span className="cat-manage__name">
                  {c.name}
                  {c.isDefault && <span className="badge badge--muted">기본</span>}
                </span>
                <span className="cat-manage__count">글 {c.postCount}</span>
                <span className="cat-manage__actions">
                  <button type="button" className="icon-btn" aria-label={`${c.name} 위로`} disabled={busy || i === 0} onClick={() => onMove(c, 'up')}>
                    ▲
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`${c.name} 아래로`}
                    disabled={busy || i === cats.length - 1}
                    onClick={() => onMove(c, 'down')}
                  >
                    ▼
                  </button>
                  <button type="button" className="link-btn" onClick={() => setEditing({ id: c.id, name: c.name, error: null })}>
                    이름 변경
                  </button>
                  <button type="button" className="link-btn link-btn--danger" disabled={busy || c.isDefault} onClick={() => onDelete(c)}>
                    삭제
                  </button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>

      <form className="cat-add" onSubmit={onAdd} noValidate>
        <label htmlFor={newId} className="sr-only">
          새 다이어리 이름
        </label>
        <input
          id={newId}
          ref={newRef}
          className="input"
          placeholder="새 다이어리 이름"
          value={newName}
          maxLength={limits.categoryNameMax + 5}
          onChange={(e) => {
            setNewName(e.target.value);
            setNewError(null);
          }}
        />
        <button type="submit" className="btn btn--primary" disabled={busy}>
          추가
        </button>
      </form>
      <FieldError message={newError} />

      <p className="notice notice--muted">{MANAGE.categoryNotice}</p>
    </div>
  );
}
