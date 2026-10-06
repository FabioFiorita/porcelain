import type { WorktreeConnection } from './connection.ts';

type ReviewScope = { projectId: string; worktreeId: string };

export const queryKeys = {
  withIdentity: (key: readonly unknown[], connection: WorktreeConnection) =>
    [...key, ...(connection.cacheIdentity ?? [])] as const,
  worktreeSurface: (
    connection: WorktreeConnection,
    scope: ReviewScope,
    surface: readonly unknown[],
  ) =>
    queryKeys.withIdentity(
      queryKeys.reviewSurface(connection.environmentId, scope, surface),
      connection,
    ),
  worktreeReads: (
    connection: WorktreeConnection,
    scope: ReviewScope,
    surface: readonly unknown[],
  ) => [
    queryKeys.environment(connection.environmentId),
    queryKeys.review(connection.environmentId, scope),
    queryKeys.reviewSurface(
      connection.environmentId,
      scope,
      surface.slice(0, 1),
    ),
    queryKeys.reviewSurface(connection.environmentId, scope, surface),
  ],
  connectedInventory: (connection: WorktreeConnection) =>
    queryKeys.withIdentity(
      queryKeys.inventory(connection.environmentId),
      connection,
    ),
  environment: (environmentId: string) =>
    ['environment', environmentId] as const,
  filePreferences: (environmentId: string, projectId: string) =>
    ['review', environmentId, projectId, 'file-preferences'] as const,
  inventory: (environmentId: string | undefined) =>
    ['inventory', environmentId] as const,
  reviewProject: (environmentId: string, projectId: string) =>
    ['review', environmentId, projectId] as const,
  review: (environmentId: string, scope: ReviewScope) =>
    [
      ...queryKeys.reviewProject(environmentId, scope.projectId),
      scope.worktreeId,
    ] as const,
  reviewSurface: (
    environmentId: string,
    scope: ReviewScope,
    surface: readonly unknown[],
  ) => [...queryKeys.review(environmentId, scope), ...surface] as const,
};

export const fileSurfaces: ReadonlySet<string> = new Set([
  'changes',
  'directory',
  'text',
  'paths',
  'git-status',
  'asset',
  'html-preview',
  'step-lines',
]);

export const gitSurfaces: ReadonlySet<string> = new Set([
  'changes',
  'git-status',
  'paths',
  'step-lines',
]);
