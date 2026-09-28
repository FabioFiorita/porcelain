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
import type { ReviewsContext } from '../rules/reviewed';

export function reviewedQueryOptions(
  scope: ReviewScope,
  context: ReviewsContext,
) {
  const { api, connection } = context;
  return queryOptions({
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'reviewed',
    ]),
    queryFn: async ({ signal }) => {
      const request = connection.request(signal);
      const data = await api.reviews.reviewed.list({ ...scope, ...request });
      request.signal.throwIfAborted();
      return data;
    },
  });
}

function useReviewedMarks(scope: ReviewScope, context: ReviewsContext) {
  return useSuspenseQuery(reviewedQueryOptions(scope, context)).data;
}

export function usePrefetchReviewed(
  scope: ReviewScope,
  context: ReviewsContext,
) {
  usePrefetchQuery(reviewedQueryOptions(scope, context));
}

export function useReviewChangeItems(
  scope: ReviewScope,
  context: ReviewsContext,
  changes: ChangeList,
  paths?: readonly string[],
) {
  return mergeReviewChanges(changes, useReviewedMarks(scope, context), paths);
}
