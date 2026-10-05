import { directoryQueryOptions } from '@porcelain/client/files';
import { useQueries, useSuspenseQuery } from '@tanstack/react-query';
import type { FilesScope } from '@porcelain/client/files/rules';
import { type Connection } from '@/shared/workspace/connection';

export function useDirectory(
  connection: Connection,
  scope: FilesScope,
  path: string,
) {
  return useSuspenseQuery(directoryQueryOptions(scope, connection, path)).data;
}

export function useDirectories(
  connection: Connection,
  scope: FilesScope,
  paths: readonly string[],
) {
  return useQueries({
    queries: paths.map((path) =>
      directoryQueryOptions(scope, connection, path),
    ),
  });
}
