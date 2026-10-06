import { readReviewedFiles } from '@porcelain/client/reviews';
import { useAtomMount } from '@effect/atom-react';
import { useConfirmedRead } from '@/shared/query/confirmed-read';
import {
  type ChangeList,
  mergeReviewChanges,
  type ReviewScope,
} from '@porcelain/client/reviews/rules';
import {
  type ReviewRange,
  WORKTREE_RANGE,
} from '@porcelain/client/reviews/rules';
import { type ConnectionContext } from '@/shared/workspace/connection';

export function useReviewedMarks(
  scope: ReviewScope,
  context: ConnectionContext,
  range: ReviewRange = WORKTREE_RANGE,
) {
  return useConfirmedRead(
    readReviewedFiles({ scope, connection: context.connection, range }),
  ).value;
}

export function usePrefetchReviewed(
  scope: ReviewScope,
  context: ConnectionContext,
  range: ReviewRange = WORKTREE_RANGE,
) {
  useAtomMount(
    readReviewedFiles({ scope, connection: context.connection, range }),
  );
}

export function useReviewChangeItems(
  scope: ReviewScope,
  context: ConnectionContext,
  changes: ChangeList,
  paths?: readonly string[],
) {
  return mergeReviewChanges(changes, useReviewedMarks(scope, context), paths);
}
