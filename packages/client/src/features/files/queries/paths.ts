import { runRequest } from '../../../shared/api/effect-client.ts';
import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import type { QueryFunctionContext } from '@tanstack/query-core';
import {
  type WorktreeConnection,
  type WorktreeScope,
} from '../../../shared/api/connection.ts';
import { filesApi } from '../api.ts';

export function pathsQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
) {
  return {
    queryKey: queryKeys.worktreeSurface(connection, scope, ['paths']),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await runRequest(
        filesApi(connection).listWorktreePaths({
          params: { worktreeId: scope.worktreeId },
        }),
        connected.signal,
      );
      assertCurrentAnswer(
        connected.signal,
        result.worktreeId === scope.worktreeId,
      );
      return result;
    },
  };
}
