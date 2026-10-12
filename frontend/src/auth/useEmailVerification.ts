import { useRef, useState } from 'react';
import { errorMessage, isApiError } from '../api/client';
import { confirmVerification, requestVerification, type VerificationPurpose } from '../api/endpoints';
import { AUTH } from '../messages';

export interface VerificationMessage {
  kind: 'ok' | 'error';
  text: string;
}

/** 필드에 붙일 오류 (이메일·닉네임 칸 아래) */
export type FieldTarget = 'email' | 'nickname';

const FIELD_CODES: Record<string, FieldTarget> = {
  EMAIL_TAKEN: 'email',
  NICKNAME_TAKEN: 'nickname',
};

/**
 * 인증번호 받기 → 입력·확인 → 이메일 잠금 (CF-01-11~19, CF-25-2~5).
 * 가입과 비밀번호 찾기가 같은 흐름을 쓴다.
 */
export function useEmailVerification(purpose: VerificationPurpose) {
  const [sent, setSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<VerificationMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const busy = useRef(false);

  /** 성공하면 null, 칸에 붙일 오류면 { field, message } */
  const send = async (email: string, nickname?: string): Promise<{ field: FieldTarget; message: string } | null> => {
    if (busy.current) return null;
    busy.current = true;
    setSending(true);
    setMessage(null);
    try {
      const res = await requestVerification({ purpose, email, ...(nickname !== undefined ? { nickname } : {}) });
      setSent(true);
      setCode('');
      const text = purpose === 'reset' ? AUTH.resetSent : AUTH.codeSent;
      // 메일 서버를 연결하기 전까지 서버가 번호를 함께 돌려준다
      setMessage({ kind: 'ok', text: res?.devCode ? `${text} (임시 인증번호: ${res.devCode})` : text });
      return null;
    } catch (e) {
      if (isApiError(e) && FIELD_CODES[e.code]) {
        return { field: FIELD_CODES[e.code], message: errorMessage(e) };
      }
      setMessage({ kind: 'error', text: errorMessage(e) });
      return null;
    } finally {
      busy.current = false;
      setSending(false);
    }
  };

  const confirm = async (email: string) => {
    if (busy.current) return;
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setMessage({ kind: 'error', text: AUTH.codeRequired });
      return;
    }
    busy.current = true;
    setConfirming(true);
    try {
      await confirmVerification({ purpose, email, code: trimmed });
      setVerified(true);
      setMessage({ kind: 'ok', text: AUTH.verified });
    } catch (e) {
      setMessage({ kind: 'error', text: errorMessage(e) });
      if (isApiError(e) && (e.code === 'CODE_EXPIRED' || e.code === 'CODE_ATTEMPTS_EXCEEDED')) setCode('');
    } finally {
      busy.current = false;
      setConfirming(false);
    }
  };

  /** 이메일 변경 — 인증 취소 (CF-01-19) */
  const cancel = (msg: VerificationMessage | null = null) => {
    setSent(false);
    setVerified(false);
    setCode('');
    setMessage(msg);
  };

  return {
    sent,
    verified,
    code,
    setCode: (v: string) => setCode(v.toUpperCase().replace(/\s/g, '').slice(0, 6)),
    message,
    sending,
    confirming,
    send,
    confirm,
    cancel,
  };
}
