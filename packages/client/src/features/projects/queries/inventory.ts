import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import type { QueryFunctionContext } from '@tanstack/query-core';
import { inventoryApi } from '../api.ts';
import type { WorktreeConnection } from '../../../shared/api/connection.ts';

export function inventoryScopeQueryOptions(environmentId: string | undefined) {
  return { queryKey: queryKeys.inventory(environmentId) };
}

export function inventoryQueryOptions(connection: WorktreeConnection) {
  return {
    queryKey: queryKeys.connectedInventory(connection),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const inventory = await inventoryApi(connection).read({
        signal: connected.signal,
      });
      assertCurrentAnswer(
        connected.signal,
        inventory.environmentId === connection.environmentId,
      );
      return inventory;
    },
  };
}
