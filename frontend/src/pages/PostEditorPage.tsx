import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type ChangeEvent, type SubmitEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { errorMessage, isApiError, isNotFound } from '../api/client';
import {
  createDraft,
  createPost,
  deleteDraft,
  getCategories,
  getDraft,
  getDrafts,
  getLastCategory,
  getPostForEdit,
  updateDraft,
  updatePost,
  uploadImage,
} from '../api/endpoints';
import { qk, useConfig, useMe, useTopics } from '../api/queries';
import type { Category, DraftSaveRequest, MeResponse, PostSaveRequest, UploadedImage, Visibility } from '../api/types';
import { MarkdownView } from '../components/MarkdownView';
import { Modal } from '../components/Modal';
import { NotFound } from '../components/NotFound';
import { RequireLogin } from '../components/RequireLogin';
import { ErrorBox, FieldError, FormMessage, Loading } from '../components/Status';
import { ALLOWED_IMAGE_TYPES } from '../lib/config';
import { formatDateTime } from '../lib/format';
import { fromDisplay, photoToken, toDisplay } from '../lib/photoTokens';
import { useUnsavedChangesPrompt } from '../lib/useUnsavedChangesPrompt';
import { isValidTag, normalizeTag } from '../lib/validation';
import { POST, SOCIAL, SUB_VIS } from '../messages';

export function PostEditorPage() {
  const { postId } = useParams();
  return (
    <RequireLogin>
      {(me) => (postId ? <EditLoader me={me} postId={postId} /> : <CreateLoader me={me} />)}
    </RequireLogin>
  );
}

function NoBlog() {
  return <NotFound what="블로그" />;
}

/** 새 글. "/write?draft=ID"면 그 임시저장 글을 불러와 이어 쓴다. */
function CreateLoader({ me }: Readonly<{ me: MeResponse }>) {
  const blogId = me.blog?.id;
  const [params] = useSearchParams();
  const draftParam = Number(params.get('draft'));
  const draftId = Number.isInteger(draftParam) && draftParam > 0 ? draftParam : null;
  const cats = useQuery({
    queryKey: qk.categories(blogId ?? 0),
    queryFn: () => getCategories(blogId as number),
    enabled: !!blogId,
  });
  const last = useQuery({ queryKey: qk.lastCategory, queryFn: getLastCategory, enabled: !!blogId, retry: false });
  const draft = useQuery({
    queryKey: qk.draft(draftId ?? 0),
    queryFn: () => getDraft(draftId as number),
    enabled: draftId !== null,
    retry: false,
    staleTime: Infinity,
  });
  if (!blogId) return <NoBlog />;
  if (cats.isPending || last.isPending || (draftId !== null && draft.isPending)) return <Loading />;
  if (cats.error) return <ErrorBox error={cats.error} onRetry={() => void cats.refetch()} />;
  if (draftId !== null && isNotFound(draft.error)) return <NotFound what="임시저장 글" />;
  if (draft.error) return <ErrorBox error={draft.error} onRetry={() => void draft.refetch()} />;

  const categories = cats.data;
  const lastId = last.data?.categoryId;
  // 다이어리 화면의 "이 다이어리에 쓰기"는 /write?category=ID 로 온다
  const askedId = Number(params.get('category'));
  const defaultCat =
    categories.find((c) => c.id === askedId) ??
    categories.find((c) => c.id === lastId) ??
    categories.find((c) => c.isDefault) ??
    categories[0] ??
    null;
  const d = draftId !== null ? draft.data : undefined;

  return (
    <EditorForm
      key={draftId ?? 'new'}
      mode="create"
      blogId={blogId}
      categories={categories}
      draftId={d?.id ?? null}
      initial={
        d
          ? {
              title: d.title,
              body: d.body,
              categoryId: d.categoryId ?? defaultCat?.id ?? null,
              topicCode: d.topicCode ?? me.blog?.topicCode ?? null,
              visibility: d.visibility,
              tags: d.tags,
              images: d.images,
              coverImageId: d.coverImageId,
            }
          : {
              title: '',
              body: '',
              categoryId: defaultCat?.id ?? null,
              topicCode: me.blog?.topicCode ?? null,
              visibility: 'PUBLIC',
              tags: [],
              images: [],
              coverImageId: null,
            }
      }
    />
  );
}

function EditLoader({ me, postId }: Readonly<{ me: MeResponse; postId: string }>) {
  const blogId = me.blog?.id;
  const src = useQuery({ queryKey: qk.postEdit(postId), queryFn: () => getPostForEdit(postId), retry: false, staleTime: Infinity });
  const cats = useQuery({
    queryKey: qk.categories(blogId ?? 0),
    queryFn: () => getCategories(blogId as number),
    enabled: !!blogId,
  });
  if (src.isPending || (blogId && cats.isPending)) return <Loading />;
  if (isNotFound(src.error) || (src.error && isApiError(src.error) && src.error.status === 403)) return <NotFound what="글" />;
  if (src.error) return <ErrorBox error={src.error} onRetry={() => void src.refetch()} />;
  if (!blogId) return <NoBlog />;
  if (cats.error) return <ErrorBox error={cats.error} onRetry={() => void cats.refetch()} />;

  const s = src.data;
  return (
    <EditorForm
      key={s.id}
      mode="edit"
      postId={s.id}
      blogId={blogId}
      categories={cats.data ?? []}
      initial={{
        title: s.title,
        body: s.body,
        categoryId: s.categoryId,
        topicCode: s.topicCode,
        visibility: s.visibility,
        tags: s.tags ?? [],
        images: s.images ?? [],
        coverImageId: s.coverImageId ?? null,
      }}
    />
  );
}

interface EditorInitial {
  title: string;
  body: string;
  categoryId: number | null;
  topicCode: string | null;
  visibility: Visibility;
  tags: string[];
  images: UploadedImage[];
  coverImageId: number | null;
}

interface EditorFormProps {
  mode: 'create' | 'edit';
  postId?: number;
  /** 이어 쓰는 임시저장 글 (새 글에서만) */
  draftId?: number | null;
  blogId: number;
  categories: Category[];
  initial: EditorInitial;
}

type FieldKey = 'title' | 'body' | 'categoryId' | 'tags';

/** 글쓰기·수정 (CF-05, CF-13-6, CF-20, CF-22) */
function EditorForm({ mode, postId, draftId: initialDraftId = null, blogId, categories, initial }: Readonly<EditorFormProps>) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { limits, draftLimit, draftAutosaveSeconds } = useConfig();
  const blogName = useMe().data?.blog?.name ?? '';
  const topics = useTopics();
  const ids = { title: useId(), body: useId(), category: useId(), topic: useId(), tag: useId(), file: useId() };
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [categoryId, setCategoryId] = useState<number | null>(initial.categoryId);
  const [topicCode, setTopicCode] = useState<string | null>(initial.topicCode);
  const [visibility, setVisibility] = useState<Visibility>(initial.visibility);
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [tagInput, setTagInput] = useState('');
  const [images, setImages] = useState<UploadedImage[]>(initial.images);
  const [coverImageId, setCoverImageId] = useState<number | null>(initial.coverImageId);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [tagError, setTagError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const busy = useRef(false);

  /* ---------- 임시저장 (새 글에서만) ---------- */
  const canDraft = mode === 'create';
  const [draftId, setDraftId] = useState<number | null>(initialDraftId);
  const [draftState, setDraftState] = useState<string | null>(null);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const draftBusy = useRef(false);
  const drafts = useQuery({ queryKey: qk.drafts, queryFn: getDrafts, enabled: canDraft });

  // 마지막으로 저장한(또는 불러온) 내용. 이것과 다르면 "저장하지 않은 내용"이다
  const snapshotOf = (v: {
    title: string;
    body: string;
    categoryId: number | null;
    topicCode: string | null;
    visibility: Visibility;
    tags: string[];
    coverImageId: number | null;
  }) => JSON.stringify([v.title, v.body, v.categoryId, v.topicCode, v.visibility, v.tags, v.coverImageId]);
  const snapshot = snapshotOf({ title, body, categoryId, topicCode, visibility, tags, coverImageId });
  const [savedSnapshot, setSavedSnapshot] = useState(() => snapshotOf(initial));

  const dirty = snapshot !== savedSnapshot || tagInput.trim() !== '';
  const allowNavigation = useUnsavedChangesPrompt(dirty);

  const usedImages = images.filter((img) => body.includes(img.url));

  const saveDraft = async (auto: boolean) => {
    if (!canDraft || draftBusy.current || busy.current) return;
    if (!title.trim() && !body.trim()) {
      if (!auto) setFormError(POST.draftEmpty);
      return;
    }
    if (auto && snapshot === savedSnapshot) return; // 바뀐 게 없으면 자동 저장은 건너뛴다
    const usedIds = usedImages.map((i) => i.id);
    const req: DraftSaveRequest = {
      title,
      body,
      categoryId,
      topicCode,
      visibility,
      tags,
      imageIds: usedIds,
      coverImageId: coverImageId !== null && usedIds.includes(coverImageId) ? coverImageId : null,
    };
    const sent = snapshot;
    draftBusy.current = true;
    try {
      const res = draftId === null ? await createDraft(req) : await updateDraft(draftId, req);
      if (draftId === null) {
        setDraftId(res.id);
        // 새로고침해도 이어 쓸 수 있게 주소에 남긴다 (화면은 다시 그리지 않는다)
        window.history.replaceState(window.history.state, '', `/write?draft=${res.id}`);
      }
      setSavedSnapshot(sent);
      setDraftState(POST.draftSaved(formatDateTime(res.updatedAt).slice(-5), auto));
      if (!auto) setFormError(null);
      void queryClient.invalidateQueries({ queryKey: qk.drafts });
    } catch (err) {
      if (!auto) setFormError(isApiError(err) && err.fields.body ? err.fields.body : errorMessage(err));
    } finally {
      draftBusy.current = false;
    }
  };

  // 바뀐 게 있으면 정해진 간격마다 자동 임시저장
  const saveDraftRef = useRef(saveDraft);
  useEffect(() => {
    saveDraftRef.current = saveDraft;
  });
  useEffect(() => {
    if (!canDraft || draftAutosaveSeconds <= 0) return;
    const timer = window.setInterval(() => void saveDraftRef.current(true), draftAutosaveSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [canDraft, draftAutosaveSeconds]);

  const removeDraft = async (id: number) => {
    if (!window.confirm(POST.draftDeleteConfirm)) return;
    try {
      await deleteDraft(id);
      if (id === draftId) setDraftId(null);
      void queryClient.invalidateQueries({ queryKey: qk.drafts });
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  /* ---------- 태그 ---------- */
  const addTag = (raw: string): boolean => {
    const tag = normalizeTag(raw);
    if (!tag) return true;
    if (!isValidTag(tag, limits.tagMax)) {
      setTagError(POST.tagRule(limits.tagMax));
      return false;
    }
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setTagError(POST.tagDuplicate);
      return false;
    }
    if (tags.length >= limits.tagsPerPost) {
      setTagError(POST.tagLimit(limits.tagsPerPost));
      return false;
    }
    setTags([...tags, tag]);
    setTagError(null);
    return true;
  };
  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (addTag(tagInput)) setTagInput('');
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  /* ---------- 이미지 ---------- */
  // 글쓰기 칸에는 사진 주소 대신 "[📷 사진 N]"이 보인다 (저장하는 본문은 마크다운 그대로)
  const display = toDisplay(body, images);

  /** 커서 자리에 사진 이름표를 넣는다. photos는 방금 올린 사진까지 포함한 목록 */
  const insertAtCursor = (snippet: string, photos: UploadedImage[] = images) => {
    const el = bodyRef.current;
    const start = el?.selectionStart ?? display.length;
    const end = el?.selectionEnd ?? display.length;
    const before = display.slice(0, start);
    const after = display.slice(end);
    const pre = before && !before.endsWith('\n') ? '\n' : '';
    const text = `${pre}${snippet}\n`;
    setBody(fromDisplay(before + text + after, photos));
    requestAnimationFrame(() => {
      if (!el) return;
      const pos = before.length + text.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type) || file.size > limits.imageMaxBytes) {
      setImageError(SOCIAL.imageRule);
      return;
    }
    if (usedImages.length >= limits.imagesPerPost) {
      setImageError(POST.imageLimit(limits.imagesPerPost));
      return;
    }
    setUploading(true);
    setImageError(null);
    try {
      const img = await uploadImage(file);
      const next = [...images, img];
      setImages(next);
      insertAtCursor(photoToken(next.length), next);
    } catch (err) {
      setImageError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  /* ---------- 공개 여부 ---------- */
  const onVisibility = (next: Visibility) => {
    if (next === visibility) return;
    // 비공개 · 구독자만에서 공개로 바꿀 때 한 번 더 확인
    if (visibility !== 'PUBLIC' && next === 'PUBLIC' && !window.confirm(POST.toPublicConfirm)) return;
    setVisibility(next);
  };

  /* ---------- 저장 ---------- */
  const validate = (): Partial<Record<FieldKey, string>> => {
    const e: Partial<Record<FieldKey, string>> = {};
    const t = title.trim();
    if (!t) e.title = POST.titleRequired;
    else if (t.length > limits.postTitleMax) e.title = POST.titleTooLong(limits.postTitleMax);
    if (!body.trim()) e.body = POST.bodyRequired;
    else if (body.length > limits.postBodyMax) e.body = POST.bodyTooLong(limits.postBodyMax);
    if (categoryId === null) e.categoryId = POST.categoryRequired;
    return e;
  };

  const onSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy.current) return; // 연타 방지 (CF-05-11)
    let finalTags = tags;
    if (tagInput.trim()) {
      const tag = normalizeTag(tagInput);
      if (isValidTag(tag, limits.tagMax) && !tags.some((t) => t.toLowerCase() === tag.toLowerCase()) && tags.length < limits.tagsPerPost) {
        finalTags = [...tags, tag];
        setTags(finalTags);
        setTagInput('');
      }
    }
    const v = validate();
    setErrors(v);
    if (v.title) {
      setTab('write');
      return titleRef.current?.focus();
    }
    if (v.body) {
      setTab('write');
      requestAnimationFrame(() => bodyRef.current?.focus());
      return;
    }
    if (v.categoryId) return;

    const imageIds = usedImages.map((i) => i.id);
    const req: PostSaveRequest = {
      title: title.trim(),
      body,
      categoryId: categoryId as number,
      topicCode,
      visibility,
      tags: finalTags,
      imageIds,
      coverImageId: coverImageId !== null && imageIds.includes(coverImageId) ? coverImageId : null,
      ...(mode === 'create' && draftId !== null ? { draftId } : {}),
    };

    busy.current = true;
    setSaving(true);
    setFormError(null);
    try {
      let id: number;
      if (mode === 'edit' && postId !== undefined) {
        await updatePost(postId, req);
        id = postId;
      } else {
        id = (await createPost(blogId, req)).id;
      }
      void queryClient.invalidateQueries({ queryKey: ['blog'] });
      void queryClient.invalidateQueries({ queryKey: ['post', String(id)] });
      void queryClient.invalidateQueries({ queryKey: ['manage'] });
      void queryClient.invalidateQueries({ queryKey: qk.lastCategory });
      void queryClient.invalidateQueries({ queryKey: qk.home });
      void queryClient.invalidateQueries({ queryKey: qk.drafts });
      void queryClient.invalidateQueries({ queryKey: ['shop'] }); // 잉크 적립 알림 (InkWatcher)
      allowNavigation();
      void navigate(`/posts/${id}`, { replace: mode === 'edit' });
    } catch (err) {
      // 저장에 실패해도 입력한 내용은 그대로 둔다 (CF-05-8)
      if (isNotFound(err)) {
        setFormError(POST.notFound);
      } else if (isApiError(err) && Object.keys(err.fields).length > 0) {
        const f = err.fields;
        setErrors({ title: f.title, body: f.body, categoryId: f.categoryId, tags: f.tags });
        if (!f.title && !f.body && !f.categoryId && !f.tags) setFormError(errorMessage(err));
      } else {
        setFormError(errorMessage(err));
      }
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  let submitLabel = mode === 'edit' ? '저장' : '올리기';
  if (saving) submitLabel = '저장하는 중…';

  let draftsContent: ReactNode;
  if (drafts.isPending) {
    draftsContent = <Loading />;
  } else if (drafts.error) {
    draftsContent = <ErrorBox error={drafts.error} onRetry={() => void drafts.refetch()} />;
  } else if (drafts.data.items.length === 0) {
    draftsContent = <p className="muted">{POST.draftNone}</p>;
  } else {
    draftsContent = (
      <ul className="draft-list">
        {drafts.data.items.map((d) => (
          <li key={d.id} className={`draft-list__item${d.id === draftId ? ' is-current' : ''}`}>
            <Link to={`/write?draft=${d.id}`} className="draft-list__open" onClick={() => setDraftsOpen(false)}>
              <b>{d.title || POST.draftNoTitle}</b>
              {d.preview && <span className="draft-list__preview">{d.preview}</span>}
              <time className="muted" dateTime={d.updatedAt}>
                {formatDateTime(d.updatedAt)}
              </time>
            </Link>
            <button type="button" className="link-btn link-btn--danger" onClick={() => void removeDraft(d.id)}>
              삭제
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <form className="editor" onSubmit={onSubmit} noValidate>
      <div className="editor__head">
        <h1 className="page-title">
          {mode === 'edit' ? '글 수정' : '글쓰기'}
          {blogName && <span className="editor__blog">{blogName}</span>}
        </h1>
        {canDraft && (
          <div className="editor__actions">
            <span className="muted editor__draft-state" aria-live="polite">
              {draftState}
            </span>
            <button type="button" className="text-btn editor__drafts" onClick={() => setDraftsOpen(true)}>
              임시저장 글 <b>{drafts.data?.items.length ?? 0}</b>
            </button>
          </div>
        )}
      </div>

      <div className="editor__meta">
        <label htmlFor={ids.category} className="editor__meta-label">
          다이어리
        </label>
        <select
          id={ids.category}
          className="input select input--sm editor__cat"
          value={categoryId ?? ''}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
        >
          {categoryId === null && <option value="">다이어리 선택</option>}
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {`${c.name}${SUB_VIS.optionSuffix[c.visibility] ?? ''}`}
            </option>
          ))}
        </select>
        <label htmlFor={ids.topic} className="editor__meta-label">
          분야
        </label>
        <select
          id={ids.topic}
          className="input select input--sm editor__topic"
          value={topicCode ?? ''}
          onChange={(e) => setTopicCode(e.target.value || null)}
        >
          {topicCode === null && <option value="">블로그 주제</option>}
          {topics.map((t) => (
            <option key={t.code} value={t.code}>
              {t.name}
            </option>
          ))}
        </select>
        <div className="seg-tabs editor__vis" role="radiogroup" aria-label="공개 여부">
          <button type="button" role="radio" aria-checked={visibility === 'PUBLIC'} className={visibility === 'PUBLIC' ? 'is-on' : ''} onClick={() => onVisibility('PUBLIC')}>
            공개
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={visibility === 'SUBSCRIBERS'}
            className={visibility === 'SUBSCRIBERS' ? 'is-on' : ''}
            title={SUB_VIS.editorHint}
            onClick={() => onVisibility('SUBSCRIBERS')}
          >
            {SUB_VIS.label}
          </button>
          <button type="button" role="radio" aria-checked={visibility === 'PRIVATE'} className={visibility === 'PRIVATE' ? 'is-on' : ''} onClick={() => onVisibility('PRIVATE')}>
            비공개
          </button>
        </div>
        <FieldError message={errors.categoryId} />
      </div>

      <div className="field">
        <label htmlFor={ids.title} className="sr-only">
          제목
        </label>
        <input
          id={ids.title}
          ref={titleRef}
          className="editor__title"
          placeholder="제목 (필수)"
          value={title}
          maxLength={limits.postTitleMax + 20}
          aria-invalid={!!errors.title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="field__foot">
          <FieldError message={errors.title} />
          <span className="counter">
            {title.trim().length}/{limits.postTitleMax}
          </span>
        </div>
      </div>

      <div className="editor__tabs tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'write'} className={`tabs__tab${tab === 'write' ? ' is-active' : ''}`} onClick={() => setTab('write')}>
          작성
        </button>
        <button type="button" role="tab" aria-selected={tab === 'preview'} className={`tabs__tab${tab === 'preview' ? ' is-active' : ''}`} onClick={() => setTab('preview')}>
          미리보기
        </button>
        <div className="editor__tools">
          <input
            id={ids.file}
            ref={fileRef}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(',')}
            className="sr-only"
            onChange={(e) => void onFile(e)}
          />
          <button type="button" className="btn btn--sm btn--outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? '올리는 중…' : '이미지 올리기'}
          </button>
        </div>
      </div>

      {tab === 'write' ? (
        <div className="field">
          <label htmlFor={ids.body} className="sr-only">
            본문 (마크다운)
          </label>
          <textarea
            id={ids.body}
            ref={bodyRef}
            className="input textarea editor__body"
            placeholder="본문 (필수) — 마크다운으로 써요. 사진은 '이미지 올리기'로 넣으면 [📷 사진 1]처럼 보여요"
            value={display}
            aria-invalid={!!errors.body}
            onChange={(e) => setBody(fromDisplay(e.target.value, images))}
          />
        </div>
      ) : (
        <div className="editor__preview card">
          {body.trim() ? <MarkdownView source={body} /> : <p className="muted">미리 볼 내용이 없습니다</p>}
        </div>
      )}
      <FieldError message={errors.body} />
      <FormMessage kind="error" message={imageError} />

      {usedImages.length > 0 && (
        <div className="photo-strip">
          <p className="photo-strip__head">
            올린 사진 {usedImages.length}/{limits.imagesPerPost}
            <span className="muted"> · 누르면 커서 자리에 다시 넣고, ★로 대표 사진을 골라요</span>
          </p>
          <ul className="photo-strip__list">
            {usedImages.map((img) => {
              const n = images.indexOf(img) + 1;
              const isCover = coverImageId === img.id;
              return (
                <li key={img.id} className={`photo-strip__item${isCover ? ' is-cover' : ''}`}>
                  <button type="button" className="photo-strip__img" title={`사진 ${n} 다시 넣기`} onClick={() => insertAtCursor(photoToken(n))}>
                    <img src={img.url} alt={`사진 ${n}`} />
                    <span className="photo-strip__label">사진 {n}</span>
                  </button>
                  <button
                    type="button"
                    className="photo-strip__star"
                    aria-pressed={isCover}
                    aria-label={isCover ? `사진 ${n} 대표 사진 빼기` : `사진 ${n}을 대표 사진으로`}
                    onClick={() => setCoverImageId(isCover ? null : img.id)}
                  >
                    {isCover ? '★' : '☆'}
                  </button>
                  <button
                    type="button"
                    className="photo-strip__remove"
                    aria-label={`사진 ${n} 빼기`}
                    onClick={() => {
                      setBody(fromDisplay(display.split(`${photoToken(n)}\n`).join('').split(photoToken(n)).join(''), images));
                      if (isCover) setCoverImageId(null);
                    }}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="field">
        <label htmlFor={ids.tag} className="sr-only">
          태그 ({tags.length}/{limits.tagsPerPost})
        </label>
        <div className="tag-input editor__tags">
          {tags.map((t) => (
            <span key={t} className="tag tag--chip">
              #{t}
              <button type="button" aria-label={`${t} 태그 지우기`} onClick={() => setTags(tags.filter((x) => x !== t))}>
                ×
              </button>
            </span>
          ))}
          <input
            id={ids.tag}
            className="tag-input__field"
            placeholder={tags.length >= limits.tagsPerPost ? '' : `#태그 입력 후 Enter (최대 ${limits.tagsPerPost}개)`}
            value={tagInput}
            disabled={tags.length >= limits.tagsPerPost}
            onChange={(e) => {
              setTagInput(e.target.value);
              setTagError(null);
            }}
            onKeyDown={onTagKey}
            onBlur={() => {
              if (tagInput.trim() && addTag(tagInput)) setTagInput('');
            }}
          />
        </div>
        <FieldError message={tagError ?? errors.tags} />
      </div>

      {draftsOpen && (
        <Modal title={`임시저장 글 ${drafts.data?.items.length ?? 0}/${drafts.data?.limit ?? draftLimit}`} onClose={() => setDraftsOpen(false)}>
          {draftsContent}
        </Modal>
      )}

      <FormMessage kind="error" message={formError} />
      <div className="editor__bottom">
        <span className={`editor__count${body.length > limits.postBodyMax ? ' is-over' : ''}`}>
          {body.length.toLocaleString()}자 / {limits.postBodyMax.toLocaleString()}
        </span>
        <button type="button" className="btn btn--ghost" onClick={() => navigate(-1)}>
          취소
        </button>
        {canDraft && (
          <button type="button" className="btn btn--outline" disabled={saving} onClick={() => void saveDraft(false)}>
            임시저장
          </button>
        )}
        <button type="submit" className="btn btn--primary" disabled={saving || uploading}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
