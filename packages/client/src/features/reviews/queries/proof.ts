import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { runRequest } from '../../../shared/api/effect-client.ts';
import type { QueryFunctionContext } from '@tanstack/query-core';
import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { reviewsApi } from '../api.ts';

export function proofFileQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  proofId: string,
) {
  return {
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'proof',
      proofId,
    ]),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const request = connection.request(signal);
      const file = await runRequest(
        reviewsApi(connection).readProofFile({
          params: { worktreeId: scope.worktreeId },
          query: { proofId },
        }),
        request.signal,
      );
      assertCurrentAnswer(request.signal);
      return file;
    },
    staleTime: Number.POSITIVE_INFINITY,
  };
}
