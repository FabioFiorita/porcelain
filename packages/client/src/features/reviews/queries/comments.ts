import type { QueryFunctionContext } from '@tanstack/query-core';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import {
  type WorktreeConnection,
  type WorktreeScope,
} from '../../../shared/api/connection.ts';
import { commentsApi } from '../api.ts';

export function commentsQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
) {
  return {
    queryKey: [
      'review',
      connection.environmentId,
      scope.projectId,
      scope.worktreeId,
      'comments',
      ...(connection.cacheIdentity ?? []),
    ],
    staleTime: 0,
    refetchOnMount: true,
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await commentsApi(connection).list({
        worktreeId: scope.worktreeId,
        ...connected,
      });
      connected.signal.throwIfAborted();
      if (result.some((thread) => thread.worktreeId !== scope.worktreeId))
        throw new ConnectionError(
          'The comment context changed. Reopen Porcelain to continue safely.',
        );
      return result;
    },
  };
}
