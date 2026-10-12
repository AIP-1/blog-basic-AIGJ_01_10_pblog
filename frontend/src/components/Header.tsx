import { Link, NavLink, useLocation, useSearchParams } from 'react-router';
import { useMe } from '../api/queries';
import { useAuth } from '../auth/context';
import { SearchBox } from './SearchBox';
import { TopicNav } from './TopicNav';
import { UserMenu } from './UserMenu';
import { NOTICE } from '../messages';

/** 맨 위 메뉴(한 줄): 로고 · 홈 · 주제 메뉴 · 검색창 · 로그인/회원가입 또는 글쓰기/사용자 메뉴 (3.1) */
export function Header() {
  const { data: me, isPending } = useMe();
  const { openLogin } = useAuth();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const onSearch = pathname === '/search';
  const q = onSearch ? (params.get('q') ?? '') : '';

  return (
    <header className="site-header">
      <div className="site-header__bar container">
        <Link to="/" className="logo" aria-label="사각 홈">
          사각
        </Link>
        <Link to="/" className="site-header__home">
          홈
        </Link>
        <TopicNav />
        <NavLink to="/notices" className="site-header__home site-header__notice">
          {NOTICE.title}
        </NavLink>
        <div className="site-header__search">
          <SearchBox key={onSearch ? `q:${q}` : 'idle'} initialQuery={q} />
        </div>
        <div className="site-header__auth">
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
