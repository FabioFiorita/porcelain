import { useQueryClient } from '@tanstack/react-query';
import { inventoryQueryOptions } from '../queries/inventory';
import type { Inventory } from '../rules/inventory';
import {
  type Connection,
  requireConnection,
} from '@/shared/workspace/connection';

export function useInventoryCache(possibleConnection: Connection | null) {
  const connection = requireConnection(possibleConnection);
  const client = useQueryClient();
  const key = inventoryQueryOptions(
    connection.environmentId,
    connection,
  ).queryKey;
  return {
    connection,
    client,
    key,
    scope: { id: `inventory:${connection.environmentId}` },
    update: async (change: (inventory: Inventory) => Inventory) => {
      await client.cancelQueries({ queryKey: key });
      client.setQueryData<Inventory>(
        key,
        (inventory) => inventory && change(inventory),
      );
    },
  };
}
