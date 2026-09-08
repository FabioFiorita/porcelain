import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router';
import { App } from './app';

const rootRoute = createRootRoute({ component: Outlet });
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>): { worktree?: string } =>
    typeof search.worktree === 'string' ? { worktree: search.worktree } : {},
  component: App,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([homeRoute]),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
