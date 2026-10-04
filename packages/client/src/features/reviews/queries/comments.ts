import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import type { QueryFunctionContext } from '@tanstack/query-core';
import {
  type WorktreeConnection,
  type WorktreeScope,
} from '../../../shared/api/connection.ts';
import { commentsApi } from '../api.ts';

export function commentsQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
) {
  return {
    queryKey: queryKeys.worktreeSurface(connection, scope, ['comments']),
    staleTime: 0,
    refetchOnMount: true,
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await commentsApi(connection).list({
        worktreeId: scope.worktreeId,
        ...connected,
      });
      assertCurrentAnswer(
        connected.signal,
        result.every((thread) => thread.worktreeId === scope.worktreeId),
      );
      return result;
    },
  };
}
