/** 로그인이 필요한 화면 — 로그아웃하면 첫 화면으로 (CF-02-11) */
export function isLoginRequiredPath(pathname: string): boolean {
  return (
    pathname === '/write' ||
    pathname === '/me' ||
    pathname === '/bookmarks' ||
    pathname === '/subscriptions' ||
    pathname.startsWith('/manage') ||
    /^\/posts\/[^/]+\/edit$/.test(pathname)
  );
}
