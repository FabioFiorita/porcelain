import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  useLoaderData,
  type RouterHistory,
} from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { isSurface, type Surface } from '@/features/review/index';
import {
  connectionErrorMessage,
  pairBrowser,
  parsePairingLink,
  PairingView,
} from '@/features/access/index';
import { PAIRING_PENDING_MS } from '@/config/limits';
import { ThemeProvider } from '@/shared/workspace/theme';
import { WorkspaceError } from '@/app/views/workspace-error';
import { WorkspacePending } from '@/app/views/workspace-pending';
import { WorkspaceView } from '@/app/views/workspace-view';

function PairRoute() {
  const data = useLoaderData({ from: '/pair' });
  return data ? <PairingView reason={data.reason} /> : <PairingView />;
}

export function createAppRouter(
  queryClient: QueryClient,
  history?: RouterHistory,
) {
  const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
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
    preload: false,
    pendingMs: PAIRING_PENDING_MS,
    pendingComponent: PairingView,
    loader: async ({ context, abortController }) => {
      const fragment = window.location.hash;
      if (fragment)
        window.history.replaceState(
          window.history.state,
          '',
          `${window.location.pathname}${window.location.search}`,
        );
      const link = parsePairingLink(fragment);
      if (!link) return { reason: 'That link carried no pairing code.' };
      try {
        await pairBrowser(context.queryClient, link, abortController.signal);
      } catch (error) {
        return { reason: connectionErrorMessage(error) };
      }
      redirect({ to: '/', replace: true, throw: true });
    },
    component: PairRoute,
  });

  return createRouter({
    routeTree: rootRoute.addChildren([homeRoute, pairRoute]),
    context: { queryClient },
    ...(history ? { history } : {}),
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
