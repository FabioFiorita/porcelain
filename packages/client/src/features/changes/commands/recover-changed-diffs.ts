import type { QueryClient } from '@tanstack/query-core';
import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { changesQueryOptions } from '../queries/changes.ts';
import { changesStore, changesRecoveryKey } from '../store.ts';

export function recoverChangedDiffs(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  client: QueryClient,
  statusToken: string,
) {
  const key = changesRecoveryKey(scope, connection);
  if (!changesStore.getState().begin(key, statusToken)) return;
  return client
    .invalidateQueries({
      queryKey: changesQueryOptions(scope, connection).queryKey,
    })
    .finally(() => changesStore.getState().finish(key, statusToken));
}
