import { reviewedQueryOptions } from '@porcelain/client/reviews';
import { usePrefetchQuery, useSuspenseQuery } from '@tanstack/react-query';
import {
  type ChangeList,
  mergeReviewChanges,
  type ReviewScope,
} from '../rules/review';
import { type ReviewRange, WORKTREE_RANGE } from '../rules/reviewed';
import { type ConnectionContext } from '@/shared/workspace/connection';

export function useReviewedMarks(
  scope: ReviewScope,
  context: ConnectionContext,
  range: ReviewRange = WORKTREE_RANGE,
) {
  return useSuspenseQuery(
    reviewedQueryOptions(scope, context.connection, range),
  ).data;
}

export function usePrefetchReviewed(
  scope: ReviewScope,
  context: ConnectionContext,
  range: ReviewRange = WORKTREE_RANGE,
) {
  usePrefetchQuery(reviewedQueryOptions(scope, context.connection, range));
}

export function useReviewChangeItems(
  scope: ReviewScope,
  context: ConnectionContext,
  changes: ChangeList,
  paths?: readonly string[],
) {
  return mergeReviewChanges(changes, useReviewedMarks(scope, context), paths);
}
