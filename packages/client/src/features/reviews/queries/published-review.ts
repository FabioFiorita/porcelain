import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import type { QueryFunctionContext } from '@tanstack/query-core';
import {
  type WorktreeConnection,
  type WorktreeScope,
} from '../../../shared/api/connection.ts';
import { reviewsApi } from '../api.ts';
import { runRequest } from '../../../shared/api/effect-client.ts';

export function publishedReviewQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
) {
  return {
    queryKey: queryKeys.worktreeSurface(connection, scope, ['review']),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const { review } = await runRequest(
        reviewsApi(connection).readPublishedReview({
          params: { worktreeId: scope.worktreeId },
        }),
        connected.signal,
      );
      const result = review ?? null;
      const matches =
        result === null ||
        (result.environmentId === connection.environmentId &&
          result.worktreeId === scope.worktreeId);
      assertCurrentAnswer(connected.signal, matches);
      return result;
    },
  };
}
