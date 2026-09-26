import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { historyApi } from '../api';
import type { HistoryConnection, HistoryScope } from '../rules/connection';

function commitQueryOptions(
  environmentId: string,
  scope: HistoryScope,
  oid: string,
  parent: number,
  request: (signal?: AbortSignal) => { signal: AbortSignal },
) {
  return queryOptions({
    queryKey: [
      'review',
      environmentId,
      scope.projectId,
      scope.worktreeId,
      'commit',
      oid,
      parent,
    ],
    queryFn: async ({ signal }) => {
      const connected = request(signal);
      const commit = await historyApi.commit(
        connected.signal,
        scope.worktreeId,
        oid,
        parent,
      );
      connected.signal.throwIfAborted();
      return commit;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useCommit(
  connection: HistoryConnection | null,
  scope: HistoryScope,
  oid: string,
  parent = 1,
) {
  if (!connection) throw new Error('A connected environment is required');
  return useSuspenseQuery(
    commitQueryOptions(
      connection.environmentId,
      scope,
      oid,
      parent,
      connection.request,
    ),
  ).data;
}
