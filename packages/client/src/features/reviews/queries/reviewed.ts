import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import type { QueryFunctionContext } from '@tanstack/query-core';
import {
  type WorktreeConnection,
  type WorktreeScope,
} from '../../../shared/api/connection.ts';
import { reviewsApi } from '../api.ts';
import { runRequest } from '../../../shared/api/effect-client.ts';

export function reviewedQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  range:
    | { kind: 'worktree' }
    | { kind: 'branch'; branch: string | undefined } = { kind: 'worktree' },
) {
  return {
    queryKey: queryKeys.worktreeSurface(connection, scope, [
      'reviewed',
      ...(range.kind === 'branch' ? ['branch', range.branch ?? ''] : []),
    ]),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await runRequest(
        reviewsApi(connection).listReviewedFiles({
          params: { worktreeId: scope.worktreeId },
          query:
            range.kind === 'branch'
              ? {
                  scope: 'branch',
                  ...(range.branch === undefined
                    ? {}
                    : { branch: range.branch }),
                }
              : {},
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
