import { ConnectionError } from '@porcelain/client/errors/connection-error';
import {
  queryOptions,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { Api } from '../api/api';
import type { Inventory, Project } from '../domain/inventory';
import { queryKeys } from './keys';
import { asMutation } from './mutation';
import { useConnectedContext } from './workspace-provider';

type Connection = ReturnType<typeof useConnectedContext>['connection'];

type InventoryWriteContext = { version: number };
type InventoryWriteState = { nextVersion: number; appliedVersion: number };
const inventoryWrites = new WeakMap<Connection, InventoryWriteState>();

function beginInventoryWrite(connection: Connection) {
  const state = inventoryWrites.get(connection) ?? {
    nextVersion: 0,
    appliedVersion: 0,
  };
  state.nextVersion += 1;
  inventoryWrites.set(connection, state);
  return state.nextVersion;
}

/**
 * Only a successful write advances the applied version. A failed newer
 * operation must not prevent an older, still-valid response from updating
 * the cache.
 */
function canApplyInventoryWrite(connection: Connection, version: number) {
  if (connection.controller.signal.aborted) return false;
  const state = inventoryWrites.get(connection);
  if (!state || version < state.appliedVersion) return false;
  state.appliedVersion = version;
  return true;
}

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
    useMutation<Inventory, Error, void, InventoryWriteContext>({
      onMutate: () => ({ version: beginInventoryWrite(connection) }),
      mutationFn: async () => {
        await client.cancelQueries({ queryKey });
        return read(api, connection, undefined, true);
      },
      onSuccess: (inventory, _variables, context) => {
        if (context && canApplyInventoryWrite(connection, context.version))
          client.setQueryData(queryKey, inventory);
      },
    }),
  );
}

export function useRegisterProject() {
  const { api, connection } = useConnectedContext();
  const client = useQueryClient();
  const queryKey = queryKeys.inventory(connection.environmentId);
  return asMutation(
    useMutation<Project, Error, string, InventoryWriteContext>({
      onMutate: () => ({ version: beginInventoryWrite(connection) }),
      mutationFn: async (path: string) => {
        const request = connection.request();
        const project = await api.inventory.register({ ...request, path });
        request.signal.throwIfAborted();
        return project;
      },
      onSuccess: (project, _path, context) => {
        if (!context || !canApplyInventoryWrite(connection, context.version))
          return;
        client.setQueryData<Inventory>(queryKey, (inventory) => {
          if (
            !inventory ||
            inventory.environmentId !== connection.environmentId
          )
            return inventory;
          const projects = inventory.projects.some(
            (entry) => entry.id === project.id,
          )
            ? inventory.projects.map((entry) =>
                entry.id === project.id ? project : entry,
              )
            : [...inventory.projects, project];
          return { ...inventory, projects };
        });
      },
    }),
  );
}
