import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState, type SubmitEvent } from 'react';
import { errorMessage, isApiError } from '../../api/client';
import { getBlog, getBlogAbout, updateBlog } from '../../api/endpoints';
import { qk, useConfig, useTopics } from '../../api/queries';
import { ErrorBox, FieldError, FormMessage, Loading } from '../../components/Status';
import { useToast } from '../../components/toastContext';
import { useUnsavedChangesPrompt } from '../../lib/useUnsavedChangesPrompt';
import { ACCOUNT, MANAGE } from '../../messages';
import { useManage } from './context';

interface Values {
  name: string;
  description: string;
  about: string;
  topicCode: string;
}

/** 블로그 설정: 이름 · 소개 n/200 · 소개 글 · 주제 (BM-07) */
export function SettingsPage() {
  const { blogId } = useManage();
  const blog = useQuery({ queryKey: qk.blog(blogId), queryFn: () => getBlog(blogId) });
  const about = useQuery({ queryKey: qk.blogAbout(blogId), queryFn: () => getBlogAbout(blogId) });
  if (blog.isPending || about.isPending) return <Loading />;
  if (blog.error) return <ErrorBox error={blog.error} onRetry={() => void blog.refetch()} />;
  if (about.error) return <ErrorBox error={about.error} onRetry={() => void about.refetch()} />;
  const initial: Values = {
    name: blog.data.name,
    description: blog.data.description ?? '',
    about: about.data.about ?? '',
    topicCode: blog.data.topic?.code ?? '',
  };
  return <SettingsForm key={JSON.stringify(initial)} blogId={blogId} initial={initial} />;
}

function SettingsForm({ blogId, initial }: Readonly<{ blogId: number; initial: Values }>) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const topics = useTopics();
  const { limits } = useConfig();
  const ids = { name: useId(), desc: useId(), about: useId(), topic: useId() };
  const nameRef = useRef<HTMLInputElement>(null);
  const [v, setV] = useState<Values>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  const changed = (Object.keys(v) as (keyof Values)[]).filter((k) => v[k] !== initial[k]);
  useUnsavedChangesPrompt(changed.length > 0);

  const set = (k: keyof Values, value: string) => {
    setV((old) => ({ ...old, [k]: value }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const onSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs: typeof errors = {};
    const name = v.name.trim();
    if (!name) errs.name = MANAGE.blogNameRequired;
    else if (name.length > limits.blogNameMax) errs.name = MANAGE.blogNameTooLong(limits.blogNameMax);
    setErrors(errs);
    if (errs.name) return nameRef.current?.focus();
    if (changed.length === 0 || busy.current) return;
    busy.current = true;
    setSaving(true);
    setFormError(null);
    try {
      const body: Partial<Values> = {};
      for (const k of changed) body[k] = k === 'name' ? name : v[k];
      await updateBlog(blogId, body);
      toast.show(ACCOUNT.saved);
      void queryClient.invalidateQueries({ queryKey: ['blog', String(blogId)] });
      void queryClient.invalidateQueries({ queryKey: qk.me });
      void queryClient.invalidateQueries({ queryKey: qk.home });
    } catch (err) {
      if (isApiError(err) && Object.keys(err.fields).length > 0) {
        setErrors({
          name: err.fields.name,
          description: err.fields.description,
          about: err.fields.about,
          topicCode: err.fields.topicCode,
        });
      } else setFormError(errorMessage(err));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">블로그 설정</h1>
      <form className="form card section-card" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor={ids.name} className="field__label">
            블로그 이름
          </label>
          <input
            id={ids.name}
            ref={nameRef}
            className="input"
            value={v.name}
            maxLength={limits.blogNameMax + 5}
            aria-invalid={!!errors.name}
            onChange={(e) => set('name', e.target.value)}
          />
          <FieldError message={errors.name} />
        </div>
        <div className="field">
          <label htmlFor={ids.desc} className="field__label">
            소개
          </label>
          <textarea
            id={ids.desc}
            className="input textarea"
            rows={3}
            maxLength={limits.blogDescriptionMax}
            value={v.description}
            onChange={(e) => set('description', e.target.value)}
          />
          <div className="field__foot">
            <FieldError message={errors.description} />
            <span className="counter">
              {v.description.length}/{limits.blogDescriptionMax}
            </span>
          </div>
        </div>
        <div className="field">
          <label htmlFor={ids.about} className="field__label">
            소개 글 (블로그 소개 화면)
          </label>
          <textarea
            id={ids.about}
            className="input textarea"
            rows={6}
            maxLength={limits.blogAboutMax}
            value={v.about}
            onChange={(e) => set('about', e.target.value)}
          />
          <div className="field__foot">
            <FieldError message={errors.about} />
            <span className="counter">
              {v.about.length}/{limits.blogAboutMax}
            </span>
          </div>
        </div>
        <div className="field">
          <label htmlFor={ids.topic} className="field__label">
            주제
          </label>
          <select id={ids.topic} className="input select" value={v.topicCode} onChange={(e) => set('topicCode', e.target.value)}>
            {!v.topicCode && <option value="">주제 선택</option>}
            {topics.map((t) => (
              <option key={t.code} value={t.code}>
                {t.name}
              </option>
            ))}
          </select>
          <FieldError message={errors.topicCode} />
        </div>
        <FormMessage kind="error" message={formError} />
        <div className="form__actions">
          <button type="submit" className="btn btn--primary" disabled={saving || changed.length === 0}>
            저장
          </button>
        </div>
      </form>
    </div>
  );
}
