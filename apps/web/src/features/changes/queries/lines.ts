import { changeLinesQueryOptions } from '@porcelain/client/changes';
import { useQuery } from '@tanstack/react-query';
import type { ChangesScope } from '@porcelain/client/changes/rules';
import type { Connection } from '@/shared/workspace/connection';

export function useChangeLines(
  scope: ChangesScope,
  connection: Connection,
  path: string,
  from: number,
  to: number,
  enabled: boolean,
) {
  return useQuery({
    ...changeLinesQueryOptions(scope, connection, path, from, to),
    enabled,
    throwOnError: false,
  });
}
