import {
  queryOptions,
  useQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { filesApi } from '../api';
import type { FilesScope } from '../rules/scope';
import { type Connection } from '@/shared/workspace/connection';

function directoryQueryOptions(
  environmentId: string,
  scope: FilesScope,
  path: string,
  connection: Connection,
) {
  return queryOptions({
    queryKey: [
      'review',
      environmentId,
      scope.projectId,
      scope.worktreeId,
      'directory',
      path,
    ],
    queryFn: async ({ signal }) => {
      const connected = connection.request(signal);
      const response = await filesApi(connection).directory(
        connected.signal,
        scope.worktreeId,
        path,
      );
      connected.signal.throwIfAborted();
      return response;
    },
  });
}

export function useDirectory(
  connection: Connection | null,
  scope: FilesScope,
  path: string,
) {
  if (!connection) throw new Error('A connected environment is required');
  return useSuspenseQuery(
    directoryQueryOptions(connection.environmentId, scope, path, connection),
  ).data;
}

export function useDirectories(
  connection: Connection | null,
  scope: FilesScope,
  paths: readonly string[],
) {
  if (!connection) throw new Error('A connected environment is required');
  return useQueries({
    queries: paths.map((path) =>
      directoryQueryOptions(connection.environmentId, scope, path, connection),
    ),
  });
}
