import { useState } from 'react';
import { Outlet, ScrollRestoration } from 'react-router';
import { AuthModal } from './AuthModal';
import { Header } from './Header';
import { TopicHighlightContext } from './topicHighlight';

export function Layout() {
  const [code, setCode] = useState<string | null>(null);
  return (
    <TopicHighlightContext.Provider value={{ code, setCode }}>
      <div className="app">
        <Header />
        <main className="site-main container">
          <Outlet />
        </main>
        <footer className="site-footer">
          <div className="container site-footer__inner">
            <span className="site-footer__logo">© 사각</span>
            <span>각자의 블로그에 생각을 끄적이는 곳</span>
          </div>
        </footer>
        <AuthModal />
        <ScrollRestoration />
      </div>
    </TopicHighlightContext.Provider>
  );
}
