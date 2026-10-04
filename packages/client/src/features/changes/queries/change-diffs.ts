import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import type { ReadChangeDiffsRequest } from '@porcelain/contracts/changes';
import type { QueryFunctionContext } from '@tanstack/query-core';
import {
  type WorktreeConnection,
  type WorktreeScope,
} from '../../../shared/api/connection.ts';
import { changesApi } from '../api.ts';

export function changeDiffsQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  input: ReadChangeDiffsRequest,
) {
  return {
    queryKey: queryKeys.worktreeSurface(connection, scope, [
      'change-diffs',
      input,
    ]),
    retry: false,
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await changesApi(connection).diffs({
        signal: connected.signal,
        worktreeId: scope.worktreeId,
        input,
      });
      assertCurrentAnswer(
        connected.signal,
        result.environmentId === connection.environmentId &&
          result.worktreeId === scope.worktreeId &&
          result.statusToken === input.expectedStatusToken,
      );
      return result;
    },
  };
}
