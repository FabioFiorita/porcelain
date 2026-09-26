import { useQueryClient } from '@tanstack/react-query';
import { changesQueryOptions } from '../queries/changes';
import {
  requireChangesConnection,
  type ChangesConnection,
  type ChangesScope,
} from '../rules/changes';
import { useChangesStore } from '../store';

export function useRecoverChangedDiffs(
  scope: ChangesScope,
  possibleConnection: ChangesConnection | null,
) {
  const client = useQueryClient();
  const connection = requireChangesConnection(possibleConnection);
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
