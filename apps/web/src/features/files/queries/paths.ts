import { queryOptions, useQuery } from '@tanstack/react-query';
import { filesApi } from '../api';
import type { FilesScope } from '../rules/scope';
import { type Connection } from '@/shared/workspace/connection';

function pathsQueryOptions(
  environmentId: string,
  scope: FilesScope,
  connection: Connection,
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
      const connected = connection.request(signal);
      const response = await filesApi(connection).paths(
        connected.signal,
        scope.worktreeId,
      );
      connected.signal.throwIfAborted();
      return response;
    },
  });
}

export function useWorktreePaths(
  connection: Connection | null,
  scope: FilesScope,
  enabled = true,
) {
  if (!connection) throw new Error('A connected environment is required');
  return useQuery({
    ...pathsQueryOptions(connection.environmentId, scope, connection),
    enabled,
    retry: false,
    throwOnError: false,
  });
}
