import { useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';
import { errorMessage, isApiError } from '../api/client';
import { updateCategory } from '../api/endpoints';
import { useConfig } from '../api/queries';
import { putDiaryStickers, useDiaryStickers, type DiarySticker } from '../api/shop';
import type { Category, Visibility } from '../api/types';
import { CATEGORY_COLORS } from '../lib/format';
import { CATEGORY, SUB_VIS } from '../messages';
import { CoverStickerEditor } from './CoverStickerEditor';
import { Modal } from './Modal';
import { FieldError, FormMessage } from './Status';
import { useToast } from './toastContext';

/** 다이어리 설정: 이름 · 소개 · 표지 색 · 표지 스티커 · 공개 범위 */
export function DiarySettingsModal({ diary, onClose }: { diary: Category; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { limits } = useConfig();
  const ids = { name: useId(), desc: useId() };
  const [name, setName] = useState(diary.name);
  const [description, setDescription] = useState(diary.description ?? '');
  const [colorIndex, setColorIndex] = useState(diary.colorIndex);
  const [visibility, setVisibility] = useState<Visibility>(diary.visibility ?? 'PUBLIC');
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // 표지 스티커: 건드리기 전(null)에는 저장된 것을 보여 주고, 바꿨을 때만 저장한다
  const savedStickers = useDiaryStickers([diary.id])[diary.id];
  const [stickers, setStickers] = useState<DiarySticker[] | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: { name?: string; description?: string } = {};
    if (!name.trim()) next.name = CATEGORY.nameRequired;
    else if (name.trim().length > limits.categoryNameMax) next.name = CATEGORY.nameTooLong(limits.categoryNameMax);
    if (description.trim().length > limits.categoryDescriptionMax) {
      next.description = CATEGORY.descriptionTooLong(limits.categoryDescriptionMax);
    }
    setErrors(next);
    if (next.name || next.description) return;
    if (visibility === 'PRIVATE' && diary.visibility !== 'PRIVATE' && !window.confirm(CATEGORY.toPrivateConfirm)) return;
    setSaving(true);
    setFormError(null);
    try {
      await updateCategory(diary.id, {
        ...(name.trim() !== diary.name ? { name: name.trim() } : {}),
        description: description.trim(),
        colorIndex,
        visibility,
      });
      if (stickers !== null) {
        await putDiaryStickers(diary.id, stickers);
        void queryClient.invalidateQueries({ queryKey: ['diaryStickers'] });
      }
      void queryClient.invalidateQueries({ queryKey: ['blog'] });
      void queryClient.invalidateQueries({ queryKey: ['manage'] });
      toast.show(CATEGORY.saved);
      onClose();
    } catch (err) {
      if (isApiError(err) && Object.keys(err.fields).length > 0) {
        setErrors({ name: err.fields.name, description: err.fields.description });
      } else {
        setFormError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="다이어리 설정" onClose={onClose} width="md">
      <form className="form diary-settings" onSubmit={onSubmit} noValidate>
        <div className="diary-settings__preview">
          <CoverStickerEditor
            colorIndex={colorIndex}
            visibility={visibility}
            value={stickers ?? savedStickers ?? []}
            onChange={setStickers}
          />
        </div>
        <div className="field">
          <label htmlFor={ids.name} className="field__label">
            이름
          </label>
          <input id={ids.name} className="input" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
          <FieldError message={errors.name} />
        </div>
        <div className="field">
          <label htmlFor={ids.desc} className="field__label">
            소개 <span className="muted">(선택)</span>
          </label>
          <input
            id={ids.desc}
            className="input"
            value={description}
            placeholder="이 다이어리를 한 줄로 소개해 주세요"
            onChange={(e) => setDescription(e.target.value)}
            aria-invalid={!!errors.description}
          />
          <div className="field__foot">
            <FieldError message={errors.description} />
            <span className="counter">
              {description.trim().length}/{limits.categoryDescriptionMax}
            </span>
          </div>
        </div>
        <fieldset className="field">
          <legend className="field__label">표지 색</legend>
          <div className="swatches">
            {CATEGORY_COLORS.map((color, i) => (
              <label key={color} className={`swatch${i === colorIndex ? ' is-selected' : ''}`} style={{ background: color }}>
                <input type="radio" name="cover-color" className="sr-only" checked={i === colorIndex} onChange={() => setColorIndex(i)} />
                <span className="sr-only">{i + 1}번 색</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="field radio-group">
          <legend className="field__label">공개 범위</legend>
          <label className="radio">
            <input type="radio" name="diary-visibility" checked={visibility === 'PUBLIC'} onChange={() => setVisibility('PUBLIC')} />
            <span className="radio__text">
              공개 <small className="muted">{SUB_VIS.diaryVisHint.PUBLIC}</small>
            </span>
          </label>
          <label className="radio">
            <input
              type="radio"
              name="diary-visibility"
              checked={visibility === 'SUBSCRIBERS'}
              onChange={() => setVisibility('SUBSCRIBERS')}
            />
            <span className="radio__text">
              {SUB_VIS.label} <small className="muted">{SUB_VIS.diaryVisHint.SUBSCRIBERS}</small>
            </span>
          </label>
          <label className="radio">
            <input type="radio" name="diary-visibility" checked={visibility === 'PRIVATE'} onChange={() => setVisibility('PRIVATE')} />
            <span className="radio__text">
              비공개 <small className="muted">{SUB_VIS.diaryVisHint.PRIVATE}</small>
            </span>
          </label>
          {diary.subscriberCount > 0 && diary.visibility !== 'PRIVATE' && (
            <p className="muted diary-settings__note">{SUB_VIS.subCountNote(diary.subscriberCount)}</p>
          )}
        </fieldset>
        <FormMessage kind="error" message={formError} />
        <div className="form__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            저장
          </button>
        </div>
      </form>
    </Modal>
  );
}
