import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { filesApi, unreadableFileReason } from '../api';
import type { FilesConnection, FilesScope } from '../rules/scope';

export function textQueryOptions(
  environmentId: string,
  scope: FilesScope,
  path: string,
  request: (signal?: AbortSignal) => { signal: AbortSignal },
) {
  return queryOptions({
    queryKey: [
      'review',
      environmentId,
      scope.projectId,
      scope.worktreeId,
      'text',
      path,
    ],
    queryFn: async ({ signal }) => {
      const connected = request(signal);
      try {
        const response = await filesApi.text(
          connected.signal,
          scope.worktreeId,
          path,
        );
        connected.signal.throwIfAborted();
        return response;
      } catch (error) {
        const reason = unreadableFileReason(error);
        if (reason) {
          const unreadable: { kind: 'unreadable'; reason: string } = {
            kind: 'unreadable',
            reason,
          };
          return unreadable;
        }
        throw error;
      }
    },
  });
}

export function useTextFile(
  connection: FilesConnection | null,
  scope: FilesScope,
  path: string,
  _active: boolean,
) {
  if (!connection) throw new Error('A connected environment is required');
  return useSuspenseQuery(
    textQueryOptions(connection.environmentId, scope, path, connection.request),
  ).data;
}
