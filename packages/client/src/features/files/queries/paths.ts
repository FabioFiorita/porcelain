import type { QueryFunctionContext } from '@tanstack/query-core';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import {
  type WorktreeConnection,
  type WorktreeScope,
} from '../../../shared/api/connection.ts';
import { filesApi } from '../api.ts';

export function pathsQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
) {
  return {
    queryKey: [
      'review',
      connection.environmentId,
      scope.projectId,
      scope.worktreeId,
      'paths',
      ...(connection.cacheIdentity ?? []),
    ],
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await filesApi(connection).paths(
        connected.signal,
        scope.worktreeId,
      );
      connected.signal.throwIfAborted();
      if (result.worktreeId !== scope.worktreeId)
        throw new ConnectionError(
          'The file context changed. Reopen Porcelain to continue safely.',
        );
      return result;
    },
  };
}
