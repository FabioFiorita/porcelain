import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import type { QueryFunctionContext } from '@tanstack/query-core';
import { projectsApi } from '../api.ts';
import { runRequest } from '../../../shared/api/effect-client.ts';
import type { WorktreeConnection } from '../../../shared/api/connection.ts';

export function inventoryScopeQueryOptions(environmentId: string | undefined) {
  return { queryKey: queryKeys.inventory(environmentId) };
}

export function inventoryQueryOptions(connection: WorktreeConnection) {
  return {
    queryKey: queryKeys.connectedInventory(connection),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const inventory = await runRequest(
        projectsApi(connection).readInventory(),
        connected.signal,
      );
      assertCurrentAnswer(
        connected.signal,
        inventory.environmentId === connection.environmentId,
      );
      return inventory;
    },
  };
}
