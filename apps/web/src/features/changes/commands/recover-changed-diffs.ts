import { useQueryClient } from '@tanstack/react-query';
import { changesQueryOptions } from '@porcelain/client/changes';
import { type ChangesScope } from '@porcelain/client/changes/rules';
import { useChangesStore } from '../store';
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
    if (!useChangesStore.getState().begin(key, statusToken)) return;
    void client
      .invalidateQueries({ queryKey: options.queryKey })
      .finally(() => useChangesStore.getState().finish(key, statusToken));
  };
}
