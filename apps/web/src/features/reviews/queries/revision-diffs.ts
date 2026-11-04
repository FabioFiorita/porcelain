import { useAtomValue } from '@effect/atom-react';
import { readReviewRevisionDiffs } from '@porcelain/client/reviews';
import type { ReviewRevision } from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { retainedDiffPaths } from '../rules/review-file';

export function useRevisionDiffs(
  revision: ReviewRevision,
  connection: ConnectionContext['connection'],
  files: ReviewRevision['files'],
) {
  return useAtomValue(
    readReviewRevisionDiffs({
      connection,
      reviewId: revision.reviewId,
      revision: revision.revision,
      paths: files.map(retainedDiffPaths),
    }),
  );
}
