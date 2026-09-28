import { queryOptions, useQuery } from '@tanstack/react-query';
import { ConnectionError } from '@/shared/api/connection-error';
import { queryKeys } from '@/shared/query/keys';
import { PUBLISHED_REVIEW_REFRESH_MS } from '@/config/limits';
import type { ReviewScope } from '../rules/review';
import type { ReviewsContext } from '../rules/reviewed';

function publishedReviewQueryOptions(
  scope: ReviewScope,
  context: ReviewsContext,
) {
  const { api, connection } = context;
  return queryOptions({
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'review',
    ]),
    queryFn: async ({ signal }) => {
      const request = connection.request(signal);
      const review = await api.reviews.review({ ...scope, ...request });
      request.signal.throwIfAborted();
      if (
        review &&
        (review.worktreeId !== scope.worktreeId ||
          review.environmentId !== connection.environmentId)
      )
        throw new ConnectionError(
          'The review context changed. Reopen Porcelain to continue safely.',
        );
      return review;
    },
    staleTime: PUBLISHED_REVIEW_REFRESH_MS,
    refetchInterval: PUBLISHED_REVIEW_REFRESH_MS,
    refetchOnWindowFocus: true,
  });
}

export function usePublishedReview(
  scope: ReviewScope,
  context: ReviewsContext,
) {
  return useQuery({
    ...publishedReviewQueryOptions(scope, context),
    throwOnError: false,
  });
}

export function useHasReviewLayers(
  scope: ReviewScope,
  context: ReviewsContext,
) {
  return usePublishedReview(scope, context).data?.active ?? false;
}

export function layerMarksQueryOptions(
  scope: ReviewScope,
  context: ReviewsContext,
) {
  const { api, connection } = context;
  return queryOptions({
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'reviewed-layers',
    ]),
    queryFn: async ({ signal }) => {
      const request = connection.request(signal);
      const result = await api.reviews.reviewedLayers.list({
        ...scope,
        ...request,
      });
      request.signal.throwIfAborted();
      return result;
    },
  });
}

export function useLayerMarks(scope: ReviewScope, context: ReviewsContext) {
  return useQuery({
    ...layerMarksQueryOptions(scope, context),
    throwOnError: false,
  });
}
