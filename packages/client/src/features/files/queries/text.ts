import type { QueryFunctionContext } from '@tanstack/query-core';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import {
  type WorktreeConnection,
  type WorktreeScope,
} from '../../../shared/api/connection.ts';
import { filesApi, unreadableFileReason } from '../api.ts';

export function textQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  path: string,
) {
  return {
    queryKey: [
      'review',
      connection.environmentId,
      scope.projectId,
      scope.worktreeId,
      'text',
      path,
      ...(connection.cacheIdentity ?? []),
    ],
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      try {
        const result = await filesApi(connection).text(
          connected.signal,
          scope.worktreeId,
          path,
        );
        connected.signal.throwIfAborted();
        if (result.worktreeId !== scope.worktreeId)
          throw new ConnectionError(
            'The file context changed. Reopen Porcelain to continue safely.',
          );
        return result;
      } catch (error) {
        connected.signal.throwIfAborted();
        const reason = unreadableFileReason(error);
        if (reason) return { kind: 'unreadable' as const, reason };
        throw error;
      }
    },
  };
}
