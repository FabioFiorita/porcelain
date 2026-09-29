import { queryOptions, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import type { ReviewScope } from '../rules/review';
import type { ReviewsContext } from '../rules/reviewed';

function proofFileQueryOptions(
  scope: ReviewScope,
  context: ReviewsContext,
  proofId: string,
) {
  const { api, connection } = context;
  return queryOptions({
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'proof',
      proofId,
    ]),
    queryFn: async ({ signal }) => {
      const request = connection.request(signal);
      const file = await api.reviews.proofFile({
        ...scope,
        ...request,
        proofId,
      });
      request.signal.throwIfAborted();
      return file;
    },
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useProofFile(
  scope: ReviewScope,
  context: ReviewsContext,
  proofId: string,
) {
  return useQuery({
    ...proofFileQueryOptions(scope, context, proofId),
    throwOnError: false,
  });
}
