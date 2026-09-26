import {
  queryOptions,
  useQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { filesApi } from '../api';
import type { FilesConnection, FilesScope } from '../rules/scope';

function directoryQueryOptions(
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
      'directory',
      path,
    ],
    queryFn: async ({ signal }) => {
      const connected = request(signal);
      const response = await filesApi.directory(
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
  connection: FilesConnection | null,
  scope: FilesScope,
  path: string,
) {
  if (!connection) throw new Error('A connected environment is required');
  return useSuspenseQuery(
    directoryQueryOptions(
      connection.environmentId,
      scope,
      path,
      connection.request,
    ),
  ).data;
}

export function useDirectories(
  connection: FilesConnection | null,
  scope: FilesScope,
  paths: readonly string[],
) {
  if (!connection) throw new Error('A connected environment is required');
  return useQueries({
    queries: paths.map((path) =>
      directoryQueryOptions(
        connection.environmentId,
        scope,
        path,
        connection.request,
      ),
    ),
  });
}
