import type { QueryFunctionContext } from '@tanstack/query-core';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import {
  type WorktreeConnection,
  type WorktreeScope,
} from '../../../shared/api/connection.ts';
import { changesApi } from '../api.ts';

export function commitDiffsQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  oid: string,
  parent: number,
  paths: readonly (readonly string[])[],
) {
  return {
    queryKey: [
      'review',
      connection.environmentId,
      scope.projectId,
      scope.worktreeId,
      'commit-diffs',
      oid,
      parent,
      paths,
      ...(connection.cacheIdentity ?? []),
    ],
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await changesApi(connection).commitDiffs(
        connected.signal,
        scope.worktreeId,
        oid,
        parent,
        paths.map((entry) => [...entry]),
      );
      connected.signal.throwIfAborted();
      if (result.commitOid !== oid)
        throw new ConnectionError(
          'The commit context changed. Reopen Porcelain to continue safely.',
        );
      return result;
    },
  };
}
