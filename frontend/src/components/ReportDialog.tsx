import { useMutation } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { errorMessage, isApiError } from '../api/client';
import { reportPost } from '../api/endpoints';
import { useConfig } from '../api/queries';
import type { ReportReason } from '../api/types';
import { SOCIAL } from '../messages';
import { Modal } from './Modal';
import { FormMessage } from './Status';
import { useToast } from './toastContext';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'SPAM', label: '스팸' },
  { value: 'ABUSE', label: '욕설·혐오' },
  { value: 'ADULT', label: '음란물' },
  { value: 'OTHER', label: '기타' },
];

/** 신고: 사유 하나 + 기타 설명 0~200자 (CF-21) */
export function ReportDialog({ postId, onClose }: Readonly<{ postId: number; onClose: () => void }>) {
  const { limits } = useConfig();
  const toast = useToast();
  const detailId = useId();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      reportPost(postId, { reason: reason as ReportReason, ...(reason === 'OTHER' && detail.trim() ? { detail: detail.trim() } : {}) }),
    onSuccess: () => {
      toast.show(SOCIAL.reported);
      onClose();
    },
    onError: (e) => {
      if (isApiError(e) && e.code === 'ALREADY_REPORTED') setError(SOCIAL.alreadyReported);
      else setError(errorMessage(e));
    },
  });

  return (
    <Modal title="신고하기" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!reason) return setError(SOCIAL.reportReasonRequired);
          if (!mutation.isPending) mutation.mutate();
        }}
      >
        <fieldset className="radio-group">
          <legend className="field__label">신고 사유</legend>
          {REASONS.map((r) => (
            <label key={r.value} className="radio">
              <input
                type="radio"
                name="reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => {
                  setReason(r.value);
                  setError(null);
                }}
              />
              {r.label}
            </label>
          ))}
        </fieldset>
        {reason === 'OTHER' && (
          <div className="field">
            <label htmlFor={detailId} className="field__label">
              설명 (선택)
            </label>
            <textarea
              id={detailId}
              className="input textarea"
              rows={3}
              maxLength={limits.reportDetailMax}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
            <p className="counter">
              {detail.length}/{limits.reportDetailMax}
            </p>
          </div>
        )}
        <FormMessage kind="error" message={error} />
        <div className="form__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn btn--danger" disabled={mutation.isPending}>
            신고하기
          </button>
        </div>
      </form>
    </Modal>
  );
}
