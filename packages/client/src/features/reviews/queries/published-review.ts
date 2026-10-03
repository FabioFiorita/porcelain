import type { QueryFunctionContext } from '@tanstack/query-core';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import {
  type WorktreeConnection,
  type WorktreeScope,
} from '../../../shared/api/connection.ts';
import { reviewsApi } from '../api.ts';

export function publishedReviewQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
) {
  return {
    queryKey: [
      'review',
      connection.environmentId,
      scope.projectId,
      scope.worktreeId,
      'review',
      ...(connection.cacheIdentity ?? []),
    ],
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await reviewsApi(connection).review({
        worktreeId: scope.worktreeId,
        ...connected,
      });
      connected.signal.throwIfAborted();
      if (
        result &&
        (result.environmentId !== connection.environmentId ||
          result.worktreeId !== scope.worktreeId)
      )
        throw new ConnectionError(
          'The review context changed. Reopen Porcelain to continue safely.',
        );
      return result;
    },
  };
}
