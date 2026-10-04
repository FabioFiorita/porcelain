import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import type { QueryFunctionContext } from '@tanstack/query-core';
import {
  type WorktreeConnection,
  type WorktreeScope,
} from '../../../shared/api/connection.ts';
import { filesApi } from '../api.ts';
import { listDirectoryEndpoint } from '@porcelain/contracts/files';
import { recoverFileReadQueryOptions } from './recovery.ts';

export function directoryQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  path: string,
) {
  return recoverFileReadQueryOptions({
    endpoint: listDirectoryEndpoint,
    scope,
    connection,
    queryKey: queryKeys.worktreeSurface(connection, scope, ['directory', path]),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await filesApi(connection).directory({
        signal: connected.signal,
        worktreeId: scope.worktreeId,
        path,
      });
      assertCurrentAnswer(
        connected.signal,
        result.worktreeId === scope.worktreeId,
      );
      return result;
    },
  });
}
