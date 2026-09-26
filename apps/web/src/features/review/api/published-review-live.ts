import { readPublishedReviewResponseSchema } from '@porcelain/contracts/reviews';
import { requestJson } from '@/shared/api/request';
import type { ReviewPort } from './review-port';
import { worktreePath } from './review-request';

export function createPublishedReviewLive(
  transport: typeof fetch,
): Pick<ReviewPort, 'review'> {
  return {
    review: async ({ worktreeId, signal }) =>
      (
        await requestJson(
          transport,
          `${worktreePath(worktreeId)}/review`,
          readPublishedReviewResponseSchema,
          { signal },
        )
      ).review ?? null,
  };
}
