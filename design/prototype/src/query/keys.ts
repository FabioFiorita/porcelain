import type { ReviewScope } from '../api/api';

/**
 * The only place query keys are built. Mirrors apps/web/src/query/keys.ts.
 * Everything about one worktree sits under `worktree(...)`, so a live notice can
 * reload exactly one resource of one worktree: `[...worktree, resource, ...]`.
 */
export const queryKeys = {
  session: (environmentId: string) => ['session', environmentId] as const,
  inventory: (environmentId: string) => ['inventory', environmentId] as const,
  discovered: (environmentId: string) => ['discovered', environmentId] as const,
  commitModels: (environmentId: string) =>
    ['commit-models', environmentId] as const,
  browse: (environmentId: string, path: string | null) =>
    ['browse', environmentId, path ?? '~'] as const,
  project: (environmentId: string, projectId: string) =>
    ['worktree', environmentId, projectId] as const,
  worktree: (environmentId: string, scope: ReviewScope) =>
    [
      ...queryKeys.project(environmentId, scope.projectId),
      scope.worktreeId,
    ] as const,
  resource: (
    environmentId: string,
    scope: ReviewScope,
    resource: WorktreeResource,
    ...rest: readonly unknown[]
  ) =>
    [...queryKeys.worktree(environmentId, scope), resource, ...rest] as const,
  /** Project-scoped: every worktree of a project shares its hidden paths. */
  filePreferences: (environmentId: string, projectId: string) =>
    [
      ...queryKeys.project(environmentId, projectId),
      'file-preferences',
    ] as const,
};

/** One entry per server read about a worktree. Position 4 of every worktree key. */
export type WorktreeResource =
  | 'changes'
  | 'diff'
  | 'range'
  | 'review'
  | 'marks'
  | 'comments'
  | 'text'
  | 'directory'
  | 'search'
  | 'preview'
  | 'history'
  | 'commit-files'
  | 'commit-diff'
  | 'branches';

/** Reads a worktree key back: `['worktree', env, projectId, worktreeId, resource, ...rest]`. */
export function worktreeKeyParts(key: readonly unknown[]) {
  if (key[0] !== 'worktree' || key.length < 5) return null;
  return {
    worktreeId: key[3] as string,
    resource: key[4] as WorktreeResource,
    rest: key.slice(5),
  };
}
