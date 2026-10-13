import { AUTH, EXPLORE } from '../messages';

/** 글자 수. 서버(Texts.length)처럼 이모지 같은 글자도 한 글자로 센다. */
export function charCount(s: string): number {
  return [...s].length;
}

/** CF-01-2: 앞뒤 공백 제거 후 형식 검사 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/** CF-01-3: 2~10자, 한글·영문·숫자 */
export function isValidNickname(nickname: string, min = 2, max = 10): boolean {
  const n = nickname.trim();
  return n.length >= min && n.length <= max && /^[가-힣A-Za-z0-9]+$/.test(n);
}

/** CF-01-4 허용 특수문자 */
export const PASSWORD_SPECIALS = '!@#$%^&*()_+-=';
const SPECIAL_RE = /[!@#$%^&*()_+\-=]/;
const ALLOWED_RE = /^[A-Za-z\d!@#$%^&*()_+\-=]*$/;

export interface PasswordCheck {
  length: boolean;
  letter: boolean;
  digit: boolean;
  special: boolean;
  /** 공백·허용되지 않은 문자가 없는지 */
  allowedChars: boolean;
}

/** CF-01-6: 입력 중 규칙 충족 여부 */
export function checkPassword(pw: string, min = 8, max = 64): PasswordCheck {
  return {
    length: pw.length >= min && pw.length <= max,
    letter: /[A-Za-z]/.test(pw),
    digit: /\d/.test(pw),
    special: SPECIAL_RE.test(pw),
    allowedChars: ALLOWED_RE.test(pw),
  };
}

export function isValidPassword(pw: string, min = 8, max = 64): boolean {
  const c = checkPassword(pw, min, max);
  return c.length && c.letter && c.digit && c.special && c.allowedChars;
}

export function passwordError(pw: string, min = 8, max = 64): string | null {
  if (!pw) return AUTH.required;
  return isValidPassword(pw, min, max) ? null : AUTH.passwordRule;
}

/** CF-20-2: 앞의 # 제거, 공백·쉼표 불가, 1~max 자 */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '');
}
export function isValidTag(tag: string, max = 15): boolean {
  return tag.length >= 1 && tag.length <= max && !/[\s,]/.test(tag);
}

/** CF-11-1: 검색어 2~50자 (앞뒤 공백 제거) */
export function validateQuery(raw: string, min: number, max: number): string | null {
  const q = raw.trim();
  if (!q) return EXPLORE.searchEmpty;
  if (q.length < min) return EXPLORE.searchTooShort;
  if (q.length > max) return EXPLORE.searchTooLong(max);
  return null;
}
