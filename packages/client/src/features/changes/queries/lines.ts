import type { QueryFunctionContext } from '@tanstack/query-core';
import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { runRequest } from '../../../shared/api/effect-client.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { changesApi } from '../api.ts';

export function changeLinesQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  path: string,
  from: number,
  to: number,
) {
  return {
    queryKey: queryKeys.worktreeSurface(connection, scope, [
      'step-lines',
      path,
      from,
      to,
    ]),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const request = connection.request(signal);
      const result = await runRequest(
        changesApi(connection).readChangeLines({
          params: { worktreeId: scope.worktreeId },
          query: { path, from, to, at: 'worktree' },
        }),
        request.signal,
      );
      assertCurrentAnswer(
        request.signal,
        result.environmentId === connection.environmentId &&
          result.worktreeId === scope.worktreeId,
      );
      return result;
    },
  };
}
