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
import { useConnectedContext } from './workspace-provider';

type Connection = ReturnType<typeof useConnectedContext>['connection'];

async function read(
  api: Api,
  connection: Connection,
  signal?: AbortSignal,
  refresh = false,
) {
  const request = connection.request(signal);
  const result = await api.inventory.read({ ...request, refresh });
  request.signal.throwIfAborted();
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
        return read(api, connection, undefined, true);
      },
      onSuccess: (inventory) => {
        if (!connection.controller.signal.aborted)
          client.setQueryData(queryKey, inventory);
      },
    }),
  );
}
