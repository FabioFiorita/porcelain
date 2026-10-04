import { textQueryOptions } from '@porcelain/client/files';
import { useQueries, useSuspenseQuery } from '@tanstack/react-query';
import type { FilesScope } from '../rules/scope';
import { type Connection } from '@/shared/workspace/connection';

export function useTextFile(
  connection: Connection,
  scope: FilesScope,
  path: string,
) {
  return useSuspenseQuery(textQueryOptions(scope, connection, path)).data;
}

export function useTextContents(
  connection: Connection,
  scope: FilesScope,
  paths: readonly string[],
) {
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
