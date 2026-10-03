import type { ReadChangeDiffsRequest } from '@porcelain/contracts/changes';
import type { QueryFunctionContext } from '@tanstack/query-core';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
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
    queryKey: [
      'review',
      connection.environmentId,
      scope.projectId,
      scope.worktreeId,
      'change-diffs',
      input,
      ...(connection.cacheIdentity ?? []),
    ],
    retry: false,
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await changesApi(connection).diffs({
        signal: connected.signal,
        worktreeId: scope.worktreeId,
        input,
      });
      connected.signal.throwIfAborted();
      if (
        result.environmentId !== connection.environmentId ||
        result.worktreeId !== scope.worktreeId ||
        result.statusToken !== input.expectedStatusToken
      )
        throw new ConnectionError(
          'The review context changed. Reopen Porcelain to continue safely.',
        );
      return result;
    },
  };
}
