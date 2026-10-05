import { pathsQueryOptions } from '@porcelain/client/files';
import { useQuery } from '@tanstack/react-query';
import type { FilesScope } from '@porcelain/client/files/rules';
import { type Connection } from '@/shared/workspace/connection';

export function useWorktreePaths(
  connection: Connection,
  scope: FilesScope,
  enabled = true,
) {
  return useQuery({
    ...pathsQueryOptions(scope, connection),
    enabled,
    retry: false,
    throwOnError: false,
  });
}
