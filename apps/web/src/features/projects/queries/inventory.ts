import {
  queryOptions,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { ProjectConnection } from '../rules/connection';
import { ConnectionError } from '@/shared/api/connection-error';
import { projectsApi } from '../api';

export function inventoryQueryOptions(
  environmentId: string,
  connection: ProjectConnection,
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

export function useInventory(connection: ProjectConnection | null) {
  if (!connection) throw new Error('A connected environment is required');
  return useSuspenseQuery(
    inventoryQueryOptions(connection.environmentId, connection),
  ).data;
}

export function useRemoteInventory(
  connection: ProjectConnection,
  enabled: boolean,
) {
  const query = useQuery({
    ...inventoryQueryOptions(connection.environmentId, connection),
    enabled,
    throwOnError: false,
  });
  return { inventory: query.data, error: query.error };
}
