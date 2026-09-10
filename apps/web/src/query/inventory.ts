import { ConnectionError } from '@porcelain/client/errors/connection-error';
import {
  queryOptions,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { Api } from '../api/api';
import { queryKeys } from './keys';
import { asMutation } from './mutation';
import { useWorkspaceContext } from './workspace-provider';

type Connection = NonNullable<
  ReturnType<typeof useWorkspaceContext>['connection']
>;

async function read(
  api: Api,
  connection: Connection,
  signal: AbortSignal,
  refresh = false,
) {
  const combined = AbortSignal.any([
    signal,
    connection.controller.signal,
    AbortSignal.timeout(15_000),
  ]);
  const result = await api.inventory.read({
    token: connection.token,
    signal: combined,
    refresh,
  });
  combined.throwIfAborted();
  if (result.environmentId !== connection.environmentId)
    throw new ConnectionError(
      'The environment changed. Disconnect and connect again.',
    );
  return result;
}

function inventoryQueryOptions(api: Api, connection: Connection) {
  return queryOptions({
    queryKey: queryKeys.inventory(connection.environmentId),
    queryFn: ({ signal }) => read(api, connection, signal),
  });
}

function useConnectedContext() {
  const { api, connection } = useWorkspaceContext();
  if (!connection) throw new Error('A connected environment is required');
  return { api, connection };
}

export function useInventory() {
  const { api, connection } = useConnectedContext();
  return useSuspenseQuery(inventoryQueryOptions(api, connection)).data;
}

export function useRefreshInventory() {
  const { api, connection } = useConnectedContext();
  const client = useQueryClient();
  const queryKey = queryKeys.inventory(connection.environmentId);
  return asMutation(
    useMutation({
      mutationFn: async () => {
        await client.cancelQueries({ queryKey });
        return read(api, connection, connection.controller.signal, true);
      },
      onSuccess: (inventory) => {
        if (!connection.controller.signal.aborted)
          client.setQueryData(queryKey, inventory);
      },
    }),
  );
}
