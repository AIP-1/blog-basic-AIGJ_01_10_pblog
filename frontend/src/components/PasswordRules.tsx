import { checkPassword } from '../lib/validation';

/** 비밀번호 입력 중 규칙 충족 표시 (CF-01-6) */
export function PasswordRules({ value, min = 8, max = 64 }: Readonly<{ value: string; min?: number; max?: number }>) {
  const c = checkPassword(value, min, max);
  const rules: { key: string; label: string; ok: boolean }[] = [
    { key: 'length', label: `${min}~${max}자`, ok: c.length },
    { key: 'letter', label: '영문', ok: c.letter },
    { key: 'digit', label: '숫자', ok: c.digit },
    { key: 'special', label: '특수문자', ok: c.special },
  ];
  return (
    <ul className="pw-rules" aria-label="비밀번호 규칙">
      {rules.map((r) => (
        <li key={r.key} className={r.ok ? 'is-ok' : ''} data-rule={r.key} data-ok={r.ok}>
          <span aria-hidden="true">{r.ok ? '✓' : '○'}</span> {r.label}
          <span className="sr-only">{r.ok ? ' 충족' : ' 미충족'}</span>
        </li>
      ))}
      {!c.allowedChars && value.length > 0 ? (
        <li className="is-bad" data-rule="chars">
          공백이나 쓸 수 없는 문자가 있습니다
        </li>
      ) : (
        <li className={value.length > 0 ? 'is-ok' : ''} data-rule="chars">
          <span aria-hidden="true">{value.length > 0 ? '✓' : '○'}</span> 공백 · 다른 기호 없음
        </li>
      )}
    </ul>
  );
}
