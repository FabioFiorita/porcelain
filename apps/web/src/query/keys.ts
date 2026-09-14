import type { ReviewScope } from '../domain/review';

export const queryKeys = {
  commitModels: (environmentId: string) =>
    ['commit-models', environmentId] as const,
  inventory: (environmentId: string) => ['inventory', environmentId] as const,
  reviewProject: (environmentId: string, projectId: string) =>
    ['review', environmentId, projectId] as const,
  filePreferences: (environmentId: string, projectId: string) =>
    [
      ...queryKeys.reviewProject(environmentId, projectId),
      'file-preferences',
    ] as const,
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
  comments: (environmentId: string, scope: ReviewScope) =>
    queryKeys.reviewSurface(environmentId, scope, ['comments']),
};
