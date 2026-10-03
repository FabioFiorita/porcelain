import type { QueryFunctionContext } from '@tanstack/query-core';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import {
  type WorktreeConnection,
  type WorktreeScope,
} from '../../../shared/api/connection.ts';
import { filesApi } from '../api.ts';
import { readTextFileEndpoint } from '@porcelain/contracts/files';
import { isEndpointError } from '../../../shared/api/request.ts';

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
        const result = await filesApi(connection).text({
          signal: connected.signal,
          worktreeId: scope.worktreeId,
          path,
        });
        connected.signal.throwIfAborted();
        if (result.worktreeId !== scope.worktreeId)
          throw new ConnectionError(
            'The file context changed. Reopen Porcelain to continue safely.',
          );
        return result;
      } catch (error) {
        connected.signal.throwIfAborted();
        const reason = isEndpointError(
          error,
          readTextFileEndpoint,
          'unsupported_text',
        )
          ? 'This file is binary or uses an unsupported text encoding.'
          : isEndpointError(error, readTextFileEndpoint, 'file_too_large')
            ? 'This file is too large to display as text.'
            : null;
        if (reason) return { kind: 'unreadable' as const, reason };
        throw error;
      }
    },
  };
}
