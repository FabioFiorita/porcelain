import { usePathDiffs } from './path-diffs';
import { changesApi } from '../api';
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
    key: (batch) => [
      'review',
      connected.environmentId,
      scope.projectId,
      scope.worktreeId,
      'commit-diffs',
      oid,
      parent,
      batch.map((entry) => entry.join('\0')),
    ],
    read: (signal, batch) =>
      changesApi(connected).commitDiffs(
        signal,
        scope.worktreeId,
        oid,
        parent,
        batch,
      ),
  });
}
