import {
  readCommentThreads,
  readReviewComments,
} from '@porcelain/client/reviews';
import { useAtomMount } from '@effect/atom-react';
import { useConfirmedRead } from '@/shared/query/confirmed-read';
import type { ReviewScope } from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';

export function useComments(scope: ReviewScope, context: ConnectionContext) {
  const { result, value: threads } = useConfirmedRead(
    scope.review
      ? readReviewComments({
          reviewId: scope.review.reviewId,
          connection: context.connection,
        })
      : readCommentThreads({ scope, connection: context.connection }),
  );
  return { threads, result };
}
export function usePrefetchComments(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  useAtomMount(
    scope.review
      ? readReviewComments({
          reviewId: scope.review.reviewId,
          connection: context.connection,
        })
      : readCommentThreads({ scope, connection: context.connection }),
  );
}
