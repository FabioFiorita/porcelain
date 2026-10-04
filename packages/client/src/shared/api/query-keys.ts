import type { WorktreeConnection } from './connection.ts';
import type { QueryFilters } from '@tanstack/query-core';

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
  connectedInventory: (connection: WorktreeConnection) =>
    queryKeys.withIdentity(
      queryKeys.inventory(connection.environmentId),
      connection,
    ),
  environment: (environmentId: string, address: string, deviceId?: string) =>
    ['environment', environmentId, address, deviceId] as const,
  session: () => ['access', 'session'] as const,
  appUpdate: () => ['desktop-app-update'] as const,
  remoteStatus: (environmentId: string, address: string) =>
    ['remote-status', environmentId, address] as const,
  pairedAccess: (environmentId: string) =>
    ['paired-access', environmentId] as const,
  remoteAccess: (environmentId: string) =>
    ['remote-access', environmentId] as const,
  serviceUpdate: (environmentId: string) =>
    ['service-update', environmentId] as const,
  projectFolder: (environmentId: string, path?: string) =>
    ['project-folder', environmentId, path ?? null] as const,
  filePreferences: (environmentId: string, projectId: string) =>
    ['review', environmentId, projectId, 'file-preferences'] as const,
  commitModels: (environmentId: string) =>
    ['commit-models', environmentId] as const,
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

export function reviewSurfaceFilters(
  environmentId: string,
  scope: ReviewScope,
  surfaces: ReadonlySet<string>,
): QueryFilters {
  const prefix = queryKeys.review(environmentId, scope);
  return {
    queryKey: prefix,
    predicate: (query) => surfaces.has(String(query.queryKey[prefix.length])),
  };
}

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
