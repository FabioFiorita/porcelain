import { runRequest } from '../../../shared/api/effect-client.ts';
import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import type { QueryFunctionContext } from '@tanstack/query-core';
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
    queryKey: queryKeys.worktreeSurface(connection, scope, ['text', path]),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      try {
        const result = await runRequest(
          filesApi(connection).readTextFile({
            params: { worktreeId: scope.worktreeId },
            query: { path },
          }),
          connected.signal,
        );
        assertCurrentAnswer(
          connected.signal,
          result.worktreeId === scope.worktreeId,
        );
        return result;
      } catch (error) {
        assertCurrentAnswer(connected.signal);
        const reason = unreadableFileReason(error);
        if (reason) return { kind: 'unreadable' as const, reason };
        throw error;
      }
    },
  };
}
