import type { RouteObject } from 'react-router';
import { Layout } from './components/Layout';
import { BlogAboutPage } from './pages/BlogAboutPage';
import { BlogPage } from './pages/BlogPage';
import { HomePage } from './pages/HomePage';
import { ManageLayout } from './pages/manage/ManageLayout';
import { NotFoundPage } from './pages/NotFoundPage';
import { NoticesPage } from './pages/NoticesPage';
import { PasswordResetPage } from './pages/PasswordResetPage';
import { SearchPage } from './pages/SearchPage';
import { TagPostsPage } from './pages/TagPostsPage';
import { TopicPage } from './pages/TopicPage';

/** contracts/screens.md 의 화면 주소 (커뮤니티 제외) */
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/topics/:code', element: <TopicPage /> },
      { path: '/blogs/:blogId', element: <BlogPage /> },
      { path: '/blogs/:blogId/about', element: <BlogAboutPage /> },
      { path: '/posts/:postId', lazy: async () => ({ Component: (await import('./pages/PostDetailPage')).PostDetailPage }) },
      { path: '/posts/:postId/edit', lazy: async () => ({ Component: (await import('./pages/PostEditorPage')).PostEditorPage }) },
      { path: '/write', lazy: async () => ({ Component: (await import('./pages/PostEditorPage')).PostEditorPage }) },
      { path: '/tags/:name', element: <TagPostsPage /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/notices', element: <NoticesPage /> },
      { path: '/password-reset', element: <PasswordResetPage /> },
      ...['/terms', '/privacy', '/rules'].map((path) => ({ path, lazy: async () => ({ Component: (await import('./pages/PolicyPage')).PolicyPage }) })),
      { path: '/subscriptions', lazy: async () => ({ Component: (await import('./pages/SubscriptionsPage')).SubscriptionsPage }) },
      { path: '/bookmarks', lazy: async () => ({ Component: (await import('./pages/BookmarksPage')).BookmarksPage }) },
      { path: '/me', lazy: async () => ({ Component: (await import('./pages/MyPage')).MyPage }) },
      {
        path: '/manage',
        element: <ManageLayout />,
        children: [
          {
            index: true,
            // 그래프(recharts)는 관리 화면에서만 쓰므로 따로 불러온다
            lazy: async () => ({ Component: (await import('./pages/manage/DashboardPage')).DashboardPage }),
          },
          { path: 'posts', lazy: async () => ({ Component: (await import('./pages/manage/PostsPage')).PostsPage }) },
          { path: 'categories', lazy: async () => ({ Component: (await import('./pages/manage/CategoriesPage')).CategoriesPage }) },
          { path: 'comments', lazy: async () => ({ Component: (await import('./pages/manage/CommentsPage')).CommentsPage }) },
          { path: 'stats', lazy: async () => ({ Component: (await import('./pages/manage/StatsPage')).StatsPage }) },
          { path: 'settings', lazy: async () => ({ Component: (await import('./pages/manage/SettingsPage')).SettingsPage }) },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
