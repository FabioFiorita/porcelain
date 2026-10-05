import type { QueryFunctionContext } from '@tanstack/query-core';
import { COMMITS_PER_PAGE } from '@porcelain/contracts/shared';
import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { runRequest } from '../../../shared/api/effect-client.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { changesApi } from '../../changes/api.ts';

export function fileTimelineQueryOptions(
  scope: WorktreeScope,
  path: string,
  connection: WorktreeConnection,
) {
  return {
    queryKey: queryKeys.worktreeSurface(connection, scope, [
      'history',
      'file',
      path,
    ]),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const request = connection.request(signal);
      const result = await runRequest(
        changesApi(connection).listFileCommits({
          params: { worktreeId: scope.worktreeId },
          query: { path, limit: COMMITS_PER_PAGE },
        }),
        request.signal,
      );
      assertCurrentAnswer(request.signal);
      return result;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  };
}
