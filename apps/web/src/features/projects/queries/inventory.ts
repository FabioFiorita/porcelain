import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { inventoryQueryOptions } from '@porcelain/client/projects';
import { type Connection } from '@/shared/workspace/connection';

export function useInventory(connection: Connection) {
  return useSuspenseQuery(inventoryQueryOptions(connection)).data;
}

export function useRemoteInventory(connection: Connection, enabled: boolean) {
  const query = useQuery({
    ...inventoryQueryOptions(connection),
    enabled,
    throwOnError: false,
  });
  return { inventory: query.data, error: query.error };
}
