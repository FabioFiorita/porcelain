import { queryOptions, useQuery } from '@tanstack/react-query';
import { filesApi } from '../api';
import type { FilesConnection, FilesScope } from '../rules/scope';

function pathsQueryOptions(
  environmentId: string,
  scope: FilesScope,
  request: (signal?: AbortSignal) => { signal: AbortSignal },
) {
  return queryOptions({
    queryKey: [
      'review',
      environmentId,
      scope.projectId,
      scope.worktreeId,
      'paths',
    ],
    queryFn: async ({ signal }) => {
      const connected = request(signal);
      const response = await filesApi.paths(connected.signal, scope.worktreeId);
      connected.signal.throwIfAborted();
      return response;
    },
  });
}

export function useWorktreePaths(
  connection: FilesConnection | null,
  scope: FilesScope,
  enabled = true,
) {
  if (!connection) throw new Error('A connected environment is required');
  return useQuery({
    ...pathsQueryOptions(connection.environmentId, scope, connection.request),
    enabled,
    retry: false,
    throwOnError: false,
  });
}
