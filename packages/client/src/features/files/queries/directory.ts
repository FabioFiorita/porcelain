import { runRequest } from '../../../shared/api/effect-client.ts';
import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import type { QueryFunctionContext } from '@tanstack/query-core';
import {
  type WorktreeConnection,
  type WorktreeScope,
} from '../../../shared/api/connection.ts';
import { filesApi } from '../api.ts';

export function directoryQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  path: string,
) {
  return {
    queryKey: queryKeys.worktreeSurface(connection, scope, ['directory', path]),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await runRequest(
        filesApi(connection).listDirectory({
          params: { worktreeId: scope.worktreeId },
          query: { path },
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
