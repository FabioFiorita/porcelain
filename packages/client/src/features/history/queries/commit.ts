import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
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
    queryKey: queryKeys.worktreeSurface(connection, scope, [
      'commit',
      oid,
      parent,
    ]),
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
      assertCurrentAnswer(connected.signal);

      return result;
    },
  };
}
