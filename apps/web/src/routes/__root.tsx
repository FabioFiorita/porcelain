import type { AtomRegistry } from 'effect/reactivity';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { ThemeProvider } from '@/features/preferences/index';

export const Route = createRootRouteWithContext<{
  registry: AtomRegistry.AtomRegistry;
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
