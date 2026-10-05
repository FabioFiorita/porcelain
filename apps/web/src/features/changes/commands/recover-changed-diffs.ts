import { useQueryClient } from '@tanstack/react-query';
import { changesQueryOptions } from '@porcelain/client/changes';
import { type ChangesScope } from '@porcelain/client/changes/rules';
import { changedDiffRecovery } from '../store';
import { Effect } from 'effect';
import { type Connection } from '@/shared/workspace/connection';

export function useRecoverChangedDiffs(
  scope: ChangesScope,
  possibleConnection: Connection,
) {
  const client = useQueryClient();
  const connection = possibleConnection;
  const options = changesQueryOptions(scope, connection);
  const key = JSON.stringify([
    connection.environmentId,
    scope.projectId,
    scope.worktreeId,
  ]);
  return (statusToken: string) => {
    if (!Effect.runSync(changedDiffRecovery.begin(key, statusToken))) return;
    void client
      .invalidateQueries({ queryKey: options.queryKey })
      .finally(() =>
        Effect.runSync(changedDiffRecovery.finish(key, statusToken)),
      );
  };
}
