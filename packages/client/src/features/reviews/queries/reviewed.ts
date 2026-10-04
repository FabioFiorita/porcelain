import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import type { QueryFunctionContext } from '@tanstack/query-core';
import {
  type WorktreeConnection,
  type WorktreeScope,
} from '../../../shared/api/connection.ts';
import { reviewsApi } from '../api.ts';

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
      const result = await reviewsApi(connection).reviewed.list({
        worktreeId: scope.worktreeId,
        ...connected,
        range,
      });
      assertCurrentAnswer(
        connected.signal,
        result.worktreeId === scope.worktreeId,
      );

      return result;
    },
  };
}

export function layerMarksQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
) {
  return {
    queryKey: queryKeys.worktreeSurface(connection, scope, ['reviewed-layers']),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await reviewsApi(connection).reviewedLayers.list({
        worktreeId: scope.worktreeId,
        ...connected,
      });
      assertCurrentAnswer(
        connected.signal,
        result.worktreeId === scope.worktreeId,
      );

      return result;
    },
  };
}
