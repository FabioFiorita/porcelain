import {
  queryOptions,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { ConnectionError } from '@porcelain/client/transport';
import { projectsApi } from '../api';
import { type Connection } from '@/shared/workspace/connection';

export function inventoryQueryOptions(
  environmentId: string,
  connection: Connection,
) {
  return queryOptions({
    queryKey: ['inventory', environmentId],
    queryFn: async ({ signal }) => {
      const connected = connection.request(signal);
      const inventory = await projectsApi(connection).inventory.read(
        connected.signal,
      );
      connected.signal.throwIfAborted();
      if (inventory.environmentId !== environmentId)
        throw new ConnectionError(
          'The connected environment changed. Reopen Porcelain to continue safely.',
        );
      return inventory;
    },
  });
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
