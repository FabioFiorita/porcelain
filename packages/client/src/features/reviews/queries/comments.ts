import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import type { QueryFunctionContext } from '@tanstack/query-core';
import {
  type WorktreeConnection,
  type WorktreeScope,
} from '../../../shared/api/connection.ts';
import { reviewsApi } from '../api.ts';
import { runRequest } from '../../../shared/api/effect-client.ts';

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
      const result = await runRequest(
        reviewsApi(connection).listCommentThreads({
          params: { worktreeId: scope.worktreeId },
        }),
        connected.signal,
      );
      assertCurrentAnswer(
        connected.signal,
        result.every((thread) => thread.worktreeId === scope.worktreeId),
      );
      return result;
    },
  };
}
