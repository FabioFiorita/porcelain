import type { QueryFunctionContext } from '@tanstack/query-core';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import {
  type WorktreeConnection,
  type WorktreeScope,
} from '../../../shared/api/connection.ts';
import { filesApi } from '../api.ts';

export function directoryQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  path: string,
) {
  return {
    queryKey: [
      'review',
      connection.environmentId,
      scope.projectId,
      scope.worktreeId,
      'directory',
      path,
      ...(connection.cacheIdentity ?? []),
    ],
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await filesApi(connection).directory({
        signal: connected.signal,
        worktreeId: scope.worktreeId,
        path,
      });
      connected.signal.throwIfAborted();
      if (result.worktreeId !== scope.worktreeId)
        throw new ConnectionError(
          'The file context changed. Reopen Porcelain to continue safely.',
        );
      return result;
    },
  };
}
