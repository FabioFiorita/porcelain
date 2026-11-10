import { readReview } from '@porcelain/client/reviews';
import { useConfirmedRead } from '@/shared/query/confirmed-read';
import type { Connection } from '@/shared/workspace/connection';

export function usePullRequestCheckout(
  connection: Connection,
  reviewId: string,
) {
  const { value } = useConfirmedRead(readReview({ connection, reviewId }));
  return value.review && value.revision
    ? {
        projectId: value.review.projectId,
        worktreeId: value.revision.content.worktreeId,
      }
    : undefined;
}
