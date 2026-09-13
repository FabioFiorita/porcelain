import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  type RouterHistory,
} from '@tanstack/react-router';
import { isSurface, type Surface } from '../domain/review';
import { WorkspaceError } from '../views/workspace/workspace-error';
import { WorkspacePending } from '../views/workspace/workspace-pending';
import { WorkspaceView } from '../views/workspace/workspace-view';

export function createAppRouter(history?: RouterHistory) {
  const rootRoute = createRootRoute({ component: Outlet });
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

  return createRouter({
    routeTree: rootRoute.addChildren([homeRoute]),
    ...(history ? { history } : {}),
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
