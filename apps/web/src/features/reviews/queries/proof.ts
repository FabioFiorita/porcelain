import { proofFileQueryOptions } from '@porcelain/client/reviews';
import { useQuery } from '@tanstack/react-query';
import type { ReviewScope } from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';

export function useProofFile(
  scope: ReviewScope,
  context: ConnectionContext,
  proofId: string,
) {
  return useQuery({
    ...proofFileQueryOptions(scope, context.connection, proofId),
    throwOnError: false,
  });
}
