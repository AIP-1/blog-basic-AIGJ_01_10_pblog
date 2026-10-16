/** 비밀 댓글 표시용 자물쇠. 글자 색을 따라가는 선 아이콘 (책갈피 아이콘과 같은 모양새) */
export function LockIcon({ size = 12 }: Readonly<{ size?: number }>) {
  return (
    <svg className="lock-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" data-testid="lock-icon">
      <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
