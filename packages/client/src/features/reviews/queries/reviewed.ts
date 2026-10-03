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
    queryKey: [
      'review',
      connection.environmentId,
      scope.projectId,
      scope.worktreeId,
      'reviewed',
      ...(range.kind === 'branch' ? ['branch', range.branch ?? ''] : []),
      ...(connection.cacheIdentity ?? []),
    ],
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await reviewsApi(connection).reviewed.list({
        worktreeId: scope.worktreeId,
        ...connected,
        range,
      });
      connected.signal.throwIfAborted();

      return result;
    },
  };
}

export function layerMarksQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
) {
  return {
    queryKey: [
      'review',
      connection.environmentId,
      scope.projectId,
      scope.worktreeId,
      'reviewed-layers',
      ...(connection.cacheIdentity ?? []),
    ],
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await reviewsApi(connection).reviewedLayers.list({
        worktreeId: scope.worktreeId,
        ...connected,
      });
      connected.signal.throwIfAborted();

      return result;
    },
  };
}
