import { pathsQueryOptions } from '@porcelain/client/files';
import { useQuery } from '@tanstack/react-query';
import type { FilesScope } from '../rules/scope';
import { type Connection } from '@/shared/workspace/connection';

export function useWorktreePaths(
  connection: Connection | null,
  scope: FilesScope,
  enabled = true,
) {
  if (!connection) throw new Error('A connected environment is required');
  return useQuery({
    ...pathsQueryOptions(scope, connection),
    enabled,
    retry: false,
    throwOnError: false,
  });
}
