import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import type { QueryFunctionContext } from '@tanstack/query-core';
import {
  type WorktreeConnection,
  type WorktreeScope,
} from '../../../shared/api/connection.ts';
import { filesApi } from '../api.ts';
import { listWorktreePathsEndpoint } from '@porcelain/contracts/files';
import { recoverFileReadQueryOptions } from './recovery.ts';

export function pathsQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
) {
  return recoverFileReadQueryOptions({
    endpoint: listWorktreePathsEndpoint,
    scope,
    connection,
    queryKey: queryKeys.worktreeSurface(connection, scope, ['paths']),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await filesApi(connection).paths({
        signal: connected.signal,
        worktreeId: scope.worktreeId,
      });
      assertCurrentAnswer(
        connected.signal,
        result.worktreeId === scope.worktreeId,
      );
      return result;
    },
  });
}
