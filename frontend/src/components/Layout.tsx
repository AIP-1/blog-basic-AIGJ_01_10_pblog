import { useMemo, useState } from 'react';
import { Link, Outlet, ScrollRestoration } from 'react-router';
import { POLICIES } from '../lib/policies';
import { AuthModal } from './AuthModal';
import { Header } from './Header';
import { SocialLoginNotice } from './SocialLoginNotice';
import { TopicHighlightContext } from './topicHighlight';

export function Layout() {
  const [code, setCode] = useState<string | null>(null);
  const highlight = useMemo(() => ({ code, setCode }), [code]);
  return (
    <TopicHighlightContext.Provider value={highlight}>
      <div className="app">
        <Header />
        <main className="site-main container">
          <Outlet />
        </main>
        <footer className="site-footer">
          <div className="container site-footer__inner">
            <span className="site-footer__logo">© 사각</span>
            <nav className="site-footer__links" aria-label="약관과 정책">
              {POLICIES.map((p) => (
                <Link key={p.path} to={p.path} className={p.path === '/privacy' ? 'is-strong' : undefined}>
                  {p.title}
                </Link>
              ))}
              <Link to="/notices">공지사항</Link>
            </nav>
            <span>각자의 블로그에 생각을 끄적이는 곳</span>
          </div>
        </footer>
        <AuthModal />
        <SocialLoginNotice />
        <ScrollRestoration />
      </div>
    </TopicHighlightContext.Provider>
  );
}
