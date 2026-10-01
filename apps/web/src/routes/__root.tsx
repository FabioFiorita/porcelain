import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { ThemeProvider } from '@/features/access/index';

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: RootLayout,
});

function RootLayout() {
  return (
    <ThemeProvider>
      <Outlet />
    </ThemeProvider>
  );
}
