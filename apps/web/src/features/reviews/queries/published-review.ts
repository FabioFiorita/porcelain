import {
  publishedReviewQueryOptions,
  layerMarksQueryOptions,
} from '@porcelain/client/reviews';
import { useQuery } from '@tanstack/react-query';
import { PUBLISHED_REVIEW_REFRESH_MS } from '@/config/limits';
import type { ReviewLayer, ReviewScope } from '../rules/review';
import { layerReviewState } from '../rules/reviewed';
import { type ConnectionContext } from '@/shared/workspace/connection';

export function usePublishedReview(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  return useQuery({
    ...publishedReviewQueryOptions(scope, context.connection),
    staleTime: PUBLISHED_REVIEW_REFRESH_MS,
    refetchInterval: PUBLISHED_REVIEW_REFRESH_MS,
    refetchOnWindowFocus: true,
    throwOnError: false,
  });
}

export function useHasReviewLayers(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  return usePublishedReview(scope, context).data?.active ?? false;
}

export function useLayerMark(
  scope: ReviewScope,
  context: ConnectionContext,
  layer: Pick<ReviewLayer, 'id' | 'fingerprint'>,
) {
  const published = usePublishedReview(scope, context);
  const marks = useQuery({
    ...layerMarksQueryOptions(scope, context.connection),
    throwOnError: false,
  });
  return {
    ...layerReviewState(marks.data, layer),
    settled: marks.isSuccess && !marks.isFetching && !published.isFetching,
    failed: marks.isError,
  };
}
