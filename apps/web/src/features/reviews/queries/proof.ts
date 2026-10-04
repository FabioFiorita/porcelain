import { assertCurrentAnswer } from '@porcelain/client/transport';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@porcelain/client/transport';
import type { ReviewScope } from '../rules/review';
import { type ConnectionContext } from '@/shared/workspace/connection';
import { reviewsApi } from '../api';

function proofFileQueryOptions(
  scope: ReviewScope,
  context: ConnectionContext,
  proofId: string,
) {
  const { connection } = context;
  return queryOptions({
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'proof',
      proofId,
    ]),
    queryFn: async ({ signal }) => {
      const request = connection.request(signal);
      const file = await reviewsApi(connection).proofFile({
        ...scope,
        ...request,
        proofId,
      });
      assertCurrentAnswer(request.signal);
      return file;
    },
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useProofFile(
  scope: ReviewScope,
  context: ConnectionContext,
  proofId: string,
) {
  return useQuery({
    ...proofFileQueryOptions(scope, context, proofId),
    throwOnError: false,
  });
}
