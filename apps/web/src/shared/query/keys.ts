import type { QueryFilters } from '@tanstack/react-query';

type ReviewScope = { projectId: string; worktreeId: string };

export const queryKeys = {
  commitModels: (environmentId: string) =>
    ['commit-models', environmentId] as const,
  inventory: (environmentId: string) => ['inventory', environmentId] as const,
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
