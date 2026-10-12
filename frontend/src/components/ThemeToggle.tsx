import { setThemeChoice, useTheme } from '../lib/theme';

/** 맨 위 메뉴의 야간모드 단추: 누르면 밝게 ↔ 어둡게 (고른 값을 이 브라우저에 남긴다) */
export function ThemeToggle() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label="야간모드"
      aria-pressed={dark}
      title={dark ? '밝게 보기' : '어둡게 보기'}
      onClick={() => setThemeChoice(dark ? 'light' : 'dark')}
    >
      {dark ? (
        // 해: 지금 어두우니 누르면 밝아진다
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        // 달
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />
        </svg>
      )}
    </button>
  );
}
