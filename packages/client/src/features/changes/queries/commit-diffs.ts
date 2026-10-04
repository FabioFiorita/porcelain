import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import type { QueryFunctionContext } from '@tanstack/query-core';
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
    queryKey: queryKeys.worktreeSurface(connection, scope, [
      'commit-diffs',
      oid,
      parent,
      paths,
    ]),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await changesApi(connection).commitDiffs({
        signal: connected.signal,
        worktreeId: scope.worktreeId,
        oid,
        parent,
        paths: paths.map((entry) => [...entry]),
      });
      assertCurrentAnswer(connected.signal, result.commitOid === oid);
      return result;
    },
  };
}
