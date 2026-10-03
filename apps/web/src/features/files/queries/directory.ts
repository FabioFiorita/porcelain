import { directoryQueryOptions } from '@porcelain/client/files';
import { useQueries, useSuspenseQuery } from '@tanstack/react-query';
import type { FilesScope } from '../rules/scope';
import { type Connection } from '@/shared/workspace/connection';

export function useDirectory(
  connection: Connection | null,
  scope: FilesScope,
  path: string,
) {
  if (!connection) throw new Error('A connected environment is required');
  return useSuspenseQuery(directoryQueryOptions(scope, connection, path)).data;
}

export function useDirectories(
  connection: Connection | null,
  scope: FilesScope,
  paths: readonly string[],
) {
  if (!connection) throw new Error('A connected environment is required');
  return useQueries({
    queries: paths.map((path) =>
      directoryQueryOptions(scope, connection, path),
    ),
  });
}
