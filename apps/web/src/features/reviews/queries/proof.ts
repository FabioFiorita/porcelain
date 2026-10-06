import { readProofFile } from '@porcelain/client/reviews';
import { useAtomValue } from '@effect/atom-react';
import type { ReviewScope } from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';

export function useProofFile(
  scope: ReviewScope,
  context: ConnectionContext,
  proofId: string,
) {
  return useAtomValue(
    readProofFile({ scope, connection: context.connection, proofId }),
  );
}
