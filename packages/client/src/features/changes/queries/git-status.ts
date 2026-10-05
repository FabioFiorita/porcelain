import type { QueryFunctionContext } from '@tanstack/query-core';
import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { runRequest } from '../../../shared/api/effect-client.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { changesApi } from '../api.ts';

export function gitStatusQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
) {
  return {
    queryKey: queryKeys.worktreeSurface(connection, scope, ['git-status']),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const request = connection.request(signal);
      const result = await runRequest(
        changesApi(connection).readGitStatus({
          params: { worktreeId: scope.worktreeId },
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
