import { gitStatusQueryOptions } from '@porcelain/client/changes';
import { useQuery } from '@tanstack/react-query';
import type { ChangesScope } from '@porcelain/client/changes/rules';
import type { Connection } from '@/shared/workspace/connection';

export function useGitStatus(
  scope: ChangesScope,
  connection: Connection,
  enabled = true,
) {
  const query = useQuery({
    ...gitStatusQueryOptions(scope, connection),
    enabled,
    throwOnError: false,
  });
  return {
    status: query.data,
    pending: enabled && query.isPending,
    read: async () => (await query.refetch()).data,
  };
}
