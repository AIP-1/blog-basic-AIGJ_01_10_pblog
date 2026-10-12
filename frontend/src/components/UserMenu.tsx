import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useInk } from '../api/shop';
import type { MeResponse } from '../api/types';
import { useAuth } from '../auth/context';
import { isLoginRequiredPath } from '../lib/paths';
import { setThemeChoice, useTheme, type ThemeChoice } from '../lib/theme';
import { SHOP } from '../messages';
import { InkIcon } from './Sticker';

const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: '시스템' },
  { value: 'light', label: '밝게' },
  { value: 'dark', label: '어둡게' },
];

/** 사용자 메뉴: 이름·이메일 / 내 블로그 / 블로그 관리(새 댓글 수) / 책갈피 / 내 정보 / 화면 밝기 / 로그아웃 (데모 이름 메뉴) */
export function UserMenu({ me }: { me: MeResponse }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { doLogout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const count = me.newCommentCount ?? 0;
  const { choice } = useTheme();
  const ink = useInk().data;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onLogout = async () => {
    setOpen(false);
    // 로그인이 필요한 화면이면 먼저 첫 화면으로 옮긴다 (CF-02-11)
    if (isLoginRequiredPath(pathname)) navigate('/', { replace: true });
    await doLogout();
  };

  const close = () => setOpen(false);

  return (
    <div className="usermenu" ref={rootRef}>
      <button
        type="button"
        className="usermenu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="avatar" aria-hidden="true">
          {me.member.nickname.slice(0, 1)}
        </span>
        <span className="usermenu__name">{me.member.nickname}</span>
        {count > 0 && (
          <span className="badge badge--dot" aria-label={`새 댓글 ${count}개`}>
            {count}
          </span>
        )}
      </button>
      {open && (
        <ul className="usermenu__list" role="menu">
          <li role="none" className="usermenu__who">
            <b>{me.member.nickname}</b>
            <span>{me.member.email}</span>
          </li>
          {me.blog && (
            <li role="none">
              <Link role="menuitem" to={`/blogs/${me.blog.id}`} onClick={close}>
                내 블로그
              </Link>
            </li>
          )}
          <li role="none">
            <Link role="menuitem" to="/bookmarks" onClick={close}>
              책갈피
            </Link>
          </li>
          <li role="none">
            <Link role="menuitem" to="/manage" onClick={close}>
              블로그 관리
              {count > 0 && <span className="badge">{count}</span>}
            </Link>
          </li>
          <li role="none">
            <Link role="menuitem" to="/shop" onClick={close} className="usermenu__ink">
              {SHOP.title}
              <span className="ink-amount">
                <InkIcon size={12} />
                {(ink?.balance ?? 0).toLocaleString()}
              </span>
            </Link>
          </li>
          <li role="none">
            <Link role="menuitem" to="/me" onClick={close}>
              내 정보
            </Link>
          </li>
          <li role="none" className="usermenu__theme">
            <span id="usermenu-theme">화면</span>
            <div role="group" aria-labelledby="usermenu-theme">
              {THEME_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={choice === o.value}
                  className={choice === o.value ? 'is-on' : undefined}
                  onClick={() => setThemeChoice(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </li>
          <li role="none">
            <button type="button" role="menuitem" onClick={() => void onLogout()}>
              로그아웃
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
