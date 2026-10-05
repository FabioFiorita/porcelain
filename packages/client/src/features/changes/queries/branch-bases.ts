import type { QueryFunctionContext } from '@tanstack/query-core';
import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { runRequest } from '../../../shared/api/effect-client.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { changesApi } from '../api.ts';

export function branchBasesQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
) {
  return {
    queryKey: queryKeys.worktreeSurface(connection, scope, ['branch-bases']),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const request = connection.request(signal);
      const result = await runRequest(
        changesApi(connection).listBranchBases({
          params: { worktreeId: scope.worktreeId },
        }),
        request.signal,
      );
      assertCurrentAnswer(request.signal);
      return result;
    },
  };
}
