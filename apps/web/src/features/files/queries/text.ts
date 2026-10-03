import { textQueryOptions } from '@porcelain/client/files';
import { useQueries, useSuspenseQuery } from '@tanstack/react-query';
import type { FilesScope } from '../rules/scope';
import { type Connection } from '@/shared/workspace/connection';

export function useTextFile(
  connection: Connection | null,
  scope: FilesScope,
  path: string,
  _active: boolean,
) {
  if (!connection) throw new Error('A connected environment is required');
  return useSuspenseQuery(textQueryOptions(scope, connection, path)).data;
}

export function useTextContents(
  connection: Connection | null,
  scope: FilesScope,
  paths: readonly string[],
) {
  if (!connection) throw new Error('A connected environment is required');
  const queries = useQueries({
    queries: paths.map((path) => ({
      ...textQueryOptions(scope, connection, path),
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
