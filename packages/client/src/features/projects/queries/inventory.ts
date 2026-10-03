import type { QueryFunctionContext } from '@tanstack/query-core';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import { inventoryApi } from '../api.ts';
import type { WorktreeConnection } from '../../../shared/api/connection.ts';

export function inventoryScopeQueryOptions(environmentId: string | undefined) {
  return { queryKey: ['inventory', environmentId] };
}

export function inventoryQueryOptions(connection: WorktreeConnection) {
  return {
    queryKey: [
      ...inventoryScopeQueryOptions(connection.environmentId).queryKey,
      ...(connection.cacheIdentity ?? []),
    ],
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const inventory = await inventoryApi(connection).read({
        signal: connected.signal,
      });
      connected.signal.throwIfAborted();
      if (inventory.environmentId !== connection.environmentId)
        throw new ConnectionError(
          'The connected environment changed. Reopen Porcelain to continue safely.',
        );
      return inventory;
    },
  };
}
