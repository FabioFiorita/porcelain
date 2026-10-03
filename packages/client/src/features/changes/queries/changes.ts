import type { QueryFunctionContext } from '@tanstack/query-core';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import {
  type WorktreeConnection,
  type WorktreeScope,
} from '../../../shared/api/connection.ts';
import { changesApi } from '../api.ts';

export function changesQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
) {
  return {
    queryKey: [
      'review',
      connection.environmentId,
      scope.projectId,
      scope.worktreeId,
      'changes',
      ...(connection.cacheIdentity ?? []),
    ],
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await changesApi(connection).list(
        connected.signal,
        scope.worktreeId,
      );
      connected.signal.throwIfAborted();
      if (
        result.environmentId !== connection.environmentId ||
        result.worktreeId !== scope.worktreeId
      )
        throw new ConnectionError(
          'The review context changed. Reopen Porcelain to continue safely.',
        );
      return { changes: result };
    },
  };
}
