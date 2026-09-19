import {
  createRootRoute,
  createRoute,
  createRouter,
  type RouterHistory,
} from '@tanstack/react-router';
import { parseEntry } from '../domain/documents';
import { isSurface, type Surface } from '../domain/review';
import { ConnectionGate } from '../views/workspace/pairing-screen';
import { WorkspaceError } from '../views/workspace/workspace-error';
import { WorkspacePending } from '../views/workspace/workspace-pending';
import { WorkspaceView } from '../views/workspace/workspace-view';

export type WorkspaceSearch = {
  worktree?: string;
  surface?: Surface;
  /** The active document, e.g. `change:src/a.ts`. See domain/documents.ts. */
  entry?: string;
  /** The active document in the right-hand pane when the centre is split. */
  side?: string;
};

const MAX_ENTRY_LENGTH = 8192;

/**
 * Hand-written like apps/web: invalid values are dropped, never thrown. Every
 * key starts as undefined on purpose: the router lays this result over the root
 * route's raw search, so a key merely left out (an old `surface=git` or
 * `entry=git:push`) would come back.
 */
export function validateWorkspaceSearch(
  search: Record<string, unknown>,
): WorkspaceSearch {
  const result: WorkspaceSearch = {
    worktree: undefined,
    surface: undefined,
    entry: undefined,
    side: undefined,
  };
  if (typeof search.worktree === 'string' && search.worktree !== '')
    result.worktree = search.worktree;
  if (isSurface(search.surface)) result.surface = search.surface;
  const validEntry = (value: unknown): value is string =>
    typeof value === 'string' &&
    value.length <= MAX_ENTRY_LENGTH &&
    parseEntry(value) != null;
  if (validEntry(search.entry)) result.entry = search.entry;
  if (validEntry(search.side)) result.side = search.side;
  return result;
}

/** Above every route: an unpaired or revoked browser sees the pairing screen instead. */
const rootRoute = createRootRoute({ component: ConnectionGate });

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: validateWorkspaceSearch,
  component: WorkspaceView,
  pendingComponent: WorkspacePending,
  errorComponent: WorkspaceError,
});

export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree: rootRoute.addChildren([homeRoute]),
    history,
    defaultPreload: false,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
