import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  type RouterHistory,
} from '@tanstack/react-router';
import { isSurface, type Surface } from '../domain/review';
import { PairingView } from '../views/connection/pairing-view';
import { ThemeProvider } from '../views/workspace/theme';
import { WorkspaceError } from '../views/workspace/workspace-error';
import { WorkspacePending } from '../views/workspace/workspace-pending';
import { WorkspaceView } from '../views/workspace/workspace-view';

export function createAppRouter(history?: RouterHistory) {
  const rootRoute = createRootRoute({
    component: () => (
      <ThemeProvider>
        <Outlet />
      </ThemeProvider>
    ),
  });
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    validateSearch: (
      search: Record<string, unknown>,
    ): {
      worktree?: string;
      surface?: Surface;
      entry?: string;
      side?: string;
    } => ({
      ...(typeof search.worktree === 'string'
        ? { worktree: search.worktree }
        : {}),
      ...(isSurface(search.surface) ? { surface: search.surface } : {}),
      ...(typeof search.entry === 'string' && search.entry.length <= 8192
        ? { entry: search.entry }
        : {}),
      ...(typeof search.side === 'string' && search.side.length <= 8192
        ? { side: search.side }
        : {}),
    }),
    component: WorkspaceView,
    pendingComponent: WorkspacePending,
    errorComponent: WorkspaceError,
  });

  const pairRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/pair',
    component: PairingView,
  });

  return createRouter({
    routeTree: rootRoute.addChildren([homeRoute, pairRoute]),
    ...(history ? { history } : {}),
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
