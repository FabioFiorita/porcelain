import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { historyApi } from '../api';
import type { HistoryScope } from '../rules/connection';
import { type Connection } from '@/shared/workspace/connection';

function fileTimelineQueryOptions(
  environmentId: string,
  scope: HistoryScope,
  path: string,
  connection: Connection,
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
      const connected = connection.request(signal);
      const timeline = await historyApi(connection).fileCommits(
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
  connection: Connection | null,
  scope: HistoryScope,
  path: string,
) {
  if (!connection) throw new Error('A connected environment is required');
  return useSuspenseQuery(
    fileTimelineQueryOptions(connection.environmentId, scope, path, connection),
  ).data;
}
