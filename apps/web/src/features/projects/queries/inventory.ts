import {
  queryOptions,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { inventoryQueryOptions as clientInventoryQueryOptions } from '@porcelain/client/projects';
import { type Connection } from '@/shared/workspace/connection';

export function inventoryQueryOptions(
  environmentId: string,
  connection: Connection,
) {
  return queryOptions(
    clientInventoryQueryOptions({ ...connection, environmentId }),
  );
}

export function useInventory(connection: Connection | null) {
  if (!connection) throw new Error('A connected environment is required');
  return useSuspenseQuery(
    inventoryQueryOptions(connection.environmentId, connection),
  ).data;
}

export function useRemoteInventory(connection: Connection, enabled: boolean) {
  const query = useQuery({
    ...inventoryQueryOptions(connection.environmentId, connection),
    enabled,
    throwOnError: false,
  });
  return { inventory: query.data, error: query.error };
}
