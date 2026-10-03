import type { QueryFunctionContext } from '@tanstack/query-core';
import {
  type WorktreeConnection,
  type WorktreeScope,
} from '../../../shared/api/connection.ts';
import { historyApi } from '../api.ts';

export function commitQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  oid: string,
  parent = 1,
) {
  return {
    queryKey: [
      'review',
      connection.environmentId,
      scope.projectId,
      scope.worktreeId,
      'commit',
      oid,
      parent,
      ...(connection.cacheIdentity ?? []),
    ],
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await historyApi(connection).commit({
        signal: connected.signal,
        worktreeId: scope.worktreeId,
        oid,
        parent,
      });
      connected.signal.throwIfAborted();

      return result;
    },
  };
}
