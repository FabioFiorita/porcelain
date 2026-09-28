import {
  queryOptions,
  useQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { filesApi, unreadableFileReason } from '../api';
import type { FilesConnection, FilesScope } from '../rules/scope';

function textQueryOptions(
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

export function useTextContents(
  connection: FilesConnection | null,
  scope: FilesScope,
  paths: readonly string[],
) {
  if (!connection) throw new Error('A connected environment is required');
  const queries = useQueries({
    queries: paths.map((path) => ({
      ...textQueryOptions(
        connection.environmentId,
        scope,
        path,
        connection.request,
      ),
      throwOnError: false,
    })),
  });
  return {
    contents: new Map(
      paths.flatMap((path, index) => {
        const data = queries[index]?.data;
        return data === undefined || !('text' in data)
          ? []
          : [[path, data.text] as const];
      }),
    ),
    pending: queries.some((query) => query.isPending),
    failed: queries.some((query) => query.isError),
    retry: () => {
      for (const query of queries) void query.refetch();
    },
  };
}
