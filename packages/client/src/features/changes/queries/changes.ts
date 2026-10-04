import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import type { QueryFunctionContext } from '@tanstack/query-core';
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
    queryKey: queryKeys.worktreeSurface(connection, scope, ['changes']),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await changesApi(connection).list({
        signal: connected.signal,
        worktreeId: scope.worktreeId,
      });
      assertCurrentAnswer(
        connected.signal,
        result.environmentId === connection.environmentId &&
          result.worktreeId === scope.worktreeId,
      );
      return { changes: result };
    },
  };
}
