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
          <div className="container">© 사각</div>
        </footer>
        <AuthModal />
        <ScrollRestoration />
      </div>
    </TopicHighlightContext.Provider>
  );
}
