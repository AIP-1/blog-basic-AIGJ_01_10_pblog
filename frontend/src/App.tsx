import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { RouterProvider, type createBrowserRouter } from 'react-router';
import { AuthProvider } from './auth/AuthProvider';
import { ToastProvider } from './components/ToastProvider';

type Router = ReturnType<typeof createBrowserRouter>;

export function App({ queryClient, router }: Readonly<{ queryClient: QueryClient; router: Router }>) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
