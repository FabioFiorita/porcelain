import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import type { ReadBranchDiffsRequest } from '@porcelain/contracts/changes';
import type { QueryFunctionContext } from '@tanstack/query-core';
import {
  type WorktreeConnection,
  type WorktreeScope,
} from '../../../shared/api/connection.ts';
import { changesApi } from '../api.ts';

export function branchQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  base?: string,
) {
  return {
    queryKey: queryKeys.worktreeSurface(connection, scope, [
      'branch',
      base ?? null,
    ]),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await changesApi(connection).branch({
        signal: connected.signal,
        worktreeId: scope.worktreeId,
        base,
      });
      assertCurrentAnswer(
        connected.signal,
        result.worktreeId === scope.worktreeId,
      );
      return result;
    },
  };
}

export function branchDiffsQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  input: ReadBranchDiffsRequest,
) {
  return {
    queryKey: queryKeys.worktreeSurface(connection, scope, [
      'branch-diffs',
      input,
    ]),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await changesApi(connection).branchDiffs({
        signal: connected.signal,
        worktreeId: scope.worktreeId,
        input,
      });
      assertCurrentAnswer(connected.signal);

      return result;
    },
  };
}
