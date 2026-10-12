import { Link, NavLink, useLocation, useSearchParams } from 'react-router';
import { useMe } from '../api/queries';
import { useAuth } from '../auth/context';
import { NOTICE, SUBSCRIBE } from '../messages';
import { SearchBox } from './SearchBox';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

/** 맨 위 메뉴(한 줄): 로고 · 홈 · 구독 · 내 블로그 · 공지사항 · 검색창 · 야간모드 · 로그인/회원가입 또는 글쓰기/사용자 메뉴 (데모 topbar) */
export function Header() {
  const { data: me, isPending } = useMe();
  const { openLogin } = useAuth();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const onSearch = pathname === '/search';
  const q = onSearch ? (params.get('q') ?? '') : '';
  const myBlog = me?.blog ? `/blogs/${me.blog.id}` : null;
  // 내 블로그 안의 화면(글 쓰기 제외)이면 '내 블로그'를 강조한다
  const onMyBlog = !!myBlog && (pathname === myBlog || pathname.startsWith(`${myBlog}/`));

  return (
    <header className="site-header">
      <div className="site-header__bar container">
        <Link to="/" className="logo" aria-label="사각 홈">
          사각
        </Link>
        <nav className="mainnav" aria-label="메뉴">
          <NavLink to="/" end className="mainnav__item">
            홈
          </NavLink>
          <NavLink to="/subscriptions" className="mainnav__item">
            {SUBSCRIBE.nav}
          </NavLink>
          {myBlog && (
            <Link to={myBlog} className={`mainnav__item${onMyBlog ? ' active' : ''}`} aria-current={onMyBlog ? 'page' : undefined}>
              내 블로그
            </Link>
          )}
          <NavLink to="/notices" className="mainnav__item">
            {NOTICE.title}
          </NavLink>
        </nav>
        <div className="site-header__search">
          <SearchBox key={onSearch ? `q:${q}` : 'idle'} initialQuery={q} />
        </div>
        <div className="site-header__auth">
          <ThemeToggle />
          {isPending ? null : me ? (
            <>
              <Link to="/write" className="btn btn--sm btn--primary site-header__write">
                글쓰기
              </Link>
              <UserMenu me={me} />
            </>
          ) : (
            <>
              <button type="button" className="btn btn--sm btn--text" onClick={() => openLogin({ tab: 'login' })}>
                로그인
              </button>
              <button type="button" className="btn btn--sm btn--primary" onClick={() => openLogin({ tab: 'signup' })}>
                회원가입
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
