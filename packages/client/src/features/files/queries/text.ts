import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import type { QueryFunctionContext } from '@tanstack/query-core';
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
    queryKey: queryKeys.worktreeSurface(connection, scope, ['text', path]),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      try {
        const result = await filesApi(connection).text({
          signal: connected.signal,
          worktreeId: scope.worktreeId,
          path,
        });
        assertCurrentAnswer(
          connected.signal,
          result.worktreeId === scope.worktreeId,
        );
        return result;
      } catch (error) {
        assertCurrentAnswer(connected.signal);
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
