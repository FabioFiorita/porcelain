import type { ReviewScope } from '../domain/review';

// One owner for the review key space: `useRefreshReview` and Git action
// invalidation both depend on these prefixes matching keys built elsewhere.
export const queryKeys = {
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
  comments: (environmentId: string, scope: ReviewScope) =>
    queryKeys.reviewSurface(environmentId, scope, ['comments']),
};
