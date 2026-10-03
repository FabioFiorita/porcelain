import { usePathDiffs } from './path-diffs';
import { commitDiffsQueryOptions } from '@porcelain/client/changes';
import type { ChangesScope } from '../rules/changes';
import {
  type Connection,
  requireConnection,
} from '@/shared/workspace/connection';

export function useCommitDiffs(
  connection: Connection | null,
  scope: ChangesScope,
  oid: string,
  parent: number,
  paths: readonly (readonly string[])[],
) {
  const connected = requireConnection(connection);
  return usePathDiffs({
    connection: connected,
    paths,
    key: (batch) =>
      commitDiffsQueryOptions(scope, connected, oid, parent, batch).queryKey,
    read: (signal, batch) =>
      commitDiffsQueryOptions(scope, connected, oid, parent, batch).queryFn({
        signal,
      }),
  });
}
