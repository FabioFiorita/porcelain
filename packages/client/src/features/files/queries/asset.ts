import type { QueryFunctionContext } from '@tanstack/query-core';
import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { runRequest } from '../../../shared/api/effect-client.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { filesApi } from '../api.ts';

export function assetQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  path: string,
) {
  return {
    queryKey: queryKeys.worktreeSurface(connection, scope, ['asset', path]),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await runRequest(
        filesApi(connection).readFileAsset({
          params: { worktreeId: scope.worktreeId },
          query: { path },
        }),
        connected.signal,
      );
      assertCurrentAnswer(connected.signal);
      return result;
    },
  };
}
