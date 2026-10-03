import { useQueryClient } from '@tanstack/react-query';
import { changesQueryOptions } from '../queries/changes';
import { type ChangesScope } from '../rules/changes';
import { useChangesStore } from '../store';
import {
  type Connection,
  requireConnection,
} from '@/shared/workspace/connection';

export function useRecoverChangedDiffs(
  scope: ChangesScope,
  possibleConnection: Connection | null,
) {
  const client = useQueryClient();
  const connection = requireConnection(possibleConnection);
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
