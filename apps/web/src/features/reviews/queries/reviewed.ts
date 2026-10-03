import {
  queryOptions,
  usePrefetchQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import {
  type ChangeList,
  mergeReviewChanges,
  type ReviewScope,
} from '../rules/review';
import {
  type ReviewRange,
  reviewedScopeKey,
  WORKTREE_RANGE,
} from '../rules/reviewed';
import { type ConnectionContext } from '@/shared/workspace/connection';
import { reviewsApi } from '../api';

export function reviewedQueryOptions(
  scope: ReviewScope,
  context: ConnectionContext,
  range: ReviewRange = WORKTREE_RANGE,
) {
  const { connection } = context;
  return queryOptions({
    queryKey: queryKeys.reviewSurface(
      connection.environmentId,
      scope,
      reviewedScopeKey(range),
    ),
    queryFn: async ({ signal }) => {
      const request = connection.request(signal);
      const data = await reviewsApi(connection).reviewed.list({
        ...scope,
        ...request,
        range,
      });
      request.signal.throwIfAborted();
      return data;
    },
  });
}

export function useReviewedMarks(
  scope: ReviewScope,
  context: ConnectionContext,
  range: ReviewRange = WORKTREE_RANGE,
) {
  return useSuspenseQuery(reviewedQueryOptions(scope, context, range)).data;
}

export function usePrefetchReviewed(
  scope: ReviewScope,
  context: ConnectionContext,
  range: ReviewRange = WORKTREE_RANGE,
) {
  usePrefetchQuery(reviewedQueryOptions(scope, context, range));
}

export function useReviewChangeItems(
  scope: ReviewScope,
  context: ConnectionContext,
  changes: ChangeList,
  paths?: readonly string[],
) {
  return mergeReviewChanges(changes, useReviewedMarks(scope, context), paths);
}
