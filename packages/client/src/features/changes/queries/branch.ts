import type { ReadBranchDiffsRequest } from '@porcelain/contracts/changes';
import type { QueryFunctionContext } from '@tanstack/query-core';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
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
    queryKey: [
      'review',
      connection.environmentId,
      scope.projectId,
      scope.worktreeId,
      'branch',
      base ?? null,
      ...(connection.cacheIdentity ?? []),
    ],
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await changesApi(connection).branch({
        signal: connected.signal,
        worktreeId: scope.worktreeId,
        base,
      });
      connected.signal.throwIfAborted();
      if (result.worktreeId !== scope.worktreeId)
        throw new ConnectionError(
          'The review context changed. Reopen Porcelain to continue safely.',
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
    queryKey: [
      'review',
      connection.environmentId,
      scope.projectId,
      scope.worktreeId,
      'branch-diffs',
      input,
      ...(connection.cacheIdentity ?? []),
    ],
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await changesApi(connection).branchDiffs({
        signal: connected.signal,
        worktreeId: scope.worktreeId,
        input,
      });
      connected.signal.throwIfAborted();

      return result;
    },
  };
}
