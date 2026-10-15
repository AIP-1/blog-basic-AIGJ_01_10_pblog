import { describe, expect, it } from 'vitest';
import { charCount, checkPassword, isValidEmail, isValidNickname, isValidPassword, isValidTag, normalizeTag, validateQuery } from './validation';

describe('입력 규칙', () => {
  it('CF-01-4 비밀번호: 영문·숫자·특수문자 포함 8~64자, 공백 불가', () => {
    expect(isValidPassword('abcd123!')).toBe(true);
    expect(isValidPassword('abcd1234')).toBe(false); // 특수문자 없음
    expect(isValidPassword('abc12!')).toBe(false); // 짧음
    expect(isValidPassword('abcd12345!!')).toBe(true); // 11자
    expect(isValidPassword('a1!' + 'x'.repeat(61))).toBe(true); // 64자
    expect(isValidPassword('a1!' + 'x'.repeat(62))).toBe(false); // 65자
    expect(isValidPassword('abcd 123!')).toBe(false); // 공백
    expect(isValidPassword('abcd123~')).toBe(false); // 허용되지 않은 특수문자
    expect(checkPassword('ab1')).toEqual({ length: false, letter: true, digit: true, special: false, allowedChars: true });
  });

  it('CF-01-3 닉네임: 한글·영문·숫자 2~10자', () => {
    expect(isValidNickname('수연')).toBe(true);
    expect(isValidNickname('a')).toBe(false);
    expect(isValidNickname('nick name')).toBe(false);
    expect(isValidNickname('abc_1')).toBe(false);
  });

  it('CF-20-2 태그: 앞의 # 제거, 공백·쉼표 불가', () => {
    expect(normalizeTag('#여행')).toBe('여행');
    expect(isValidTag('여행')).toBe(true);
    expect(isValidTag('a,b')).toBe(false);
    expect(isValidTag('a'.repeat(16))).toBe(false);
  });

  it('CF-11-1 검색어 2~50자', () => {
    expect(validateQuery('   ', 2, 50)).toBe('검색어를 입력해 주세요');
    expect(validateQuery(' 단 ', 2, 50)).toBe('검색어를 2자 이상 입력해 주세요');
    expect(validateQuery('단풍 명소', 2, 50)).toBeNull();
    expect(validateQuery('x'.repeat(51), 2, 50)).not.toBeNull();
  });

  it('글자 수는 서버처럼 이모지도 한 글자로 센다', () => {
    expect(charCount('가나다')).toBe(3);
    expect(charCount('좋아요😀')).toBe(4);
    expect('좋아요😀'.length).toBe(5);
  });
});

describe('이메일 형식 (CF-01-2, 서버 EmailNormalizer와 같은 규칙)', () => {
  it('보통 주소는 받고, 도메인에 점이 없거나 비거나 겹치면 막는다', () => {
    expect(isValidEmail(' user@example.co.kr ')).toBe(true);
    for (const bad of ['a@b', 'a@b.', 'a@.b.c', 'a@b..c', 'a b@c.d', '@b.c']) {
      expect(isValidEmail(bad), bad).toBe(false);
    }
  });
});
