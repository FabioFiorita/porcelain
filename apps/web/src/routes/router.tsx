import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  type RouterHistory,
} from '@tanstack/react-router';
import { WorkspaceError } from '../views/workspace/workspace-error';
import { WorkspacePending } from '../views/workspace/workspace-pending';
import { WorkspaceView } from '../views/workspace/workspace-view';

export function createAppRouter(history?: RouterHistory) {
  const rootRoute = createRootRoute({ component: Outlet });
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    validateSearch: (search: Record<string, unknown>): { worktree?: string } =>
      typeof search.worktree === 'string' ? { worktree: search.worktree } : {},
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
