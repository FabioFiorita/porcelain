import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { historyApi } from '../api';
import type { HistoryConnection, HistoryScope } from '../rules/connection';

function fileTimelineQueryOptions(
  environmentId: string,
  scope: HistoryScope,
  path: string,
  request: (signal?: AbortSignal) => { signal: AbortSignal },
) {
  return queryOptions({
    queryKey: [
      'review',
      environmentId,
      scope.projectId,
      scope.worktreeId,
      'history',
      'file',
      path,
    ],
    queryFn: async ({ signal }) => {
      const connected = request(signal);
      const timeline = await historyApi.fileCommits(
        connected.signal,
        scope.worktreeId,
        path,
      );
      connected.signal.throwIfAborted();
      return timeline;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useFileTimeline(
  connection: HistoryConnection | null,
  scope: HistoryScope,
  path: string,
) {
  if (!connection) throw new Error('A connected environment is required');
  return useSuspenseQuery(
    fileTimelineQueryOptions(
      connection.environmentId,
      scope,
      path,
      connection.request,
    ),
  ).data;
}
