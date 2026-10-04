import { queryKeys, assertCurrentAnswer } from '@porcelain/client/transport';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { historyApi } from '../api';
import type { HistoryScope } from '../rules/connection';
import { type Connection } from '@/shared/workspace/connection';

function fileTimelineQueryOptions(
  scope: HistoryScope,
  path: string,
  connection: Connection,
) {
  return queryOptions({
    queryKey: queryKeys.worktreeSurface(connection, scope, [
      'history',
      'file',
      path,
    ]),
    queryFn: async ({ signal }) => {
      const connected = connection.request(signal);
      const timeline = await historyApi(connection).fileCommits({
        signal: connected.signal,
        worktreeId: scope.worktreeId,
        path,
      });
      assertCurrentAnswer(connected.signal);
      return timeline;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useFileTimeline(
  connection: Connection,
  scope: HistoryScope,
  path: string,
) {
  return useSuspenseQuery(fileTimelineQueryOptions(scope, path, connection))
    .data;
}
