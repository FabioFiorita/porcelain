import {
  readProofFile,
  readReviewRevisionProof,
} from '@porcelain/client/reviews';
import { useAtomValue } from '@effect/atom-react';
import type { ReviewScope } from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';

export function useProofFile(
  scope: ReviewScope,
  context: ConnectionContext,
  proofId: string,
) {
  return useAtomValue(
    scope.review
      ? readReviewRevisionProof({
          ...scope.review,
          connection: context.connection,
          proofId,
        })
      : readProofFile({ scope, connection: context.connection, proofId }),
  );
}
