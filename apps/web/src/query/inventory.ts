import { ConnectionError } from '@porcelain/client/errors/connection-error';
import {
  queryOptions,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { Api } from '../api/api';
import type { Inventory, Project } from '../domain/inventory';
import { retainedFileDrafts } from './file-drafts';
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

async function read(api: Api, connection: Connection, signal?: AbortSignal) {
  const request = connection.request(signal);
  const result = await api.inventory.read(request);
  request.signal.throwIfAborted();
  if (result.environmentId !== connection.environmentId)
    throw new ConnectionError(
      'The connected environment changed. Reopen Porcelain to continue safely.',
    );
  return result;
}

function inventoryQueryOptions(api: Api, connection: Connection) {
  return queryOptions({
    queryKey: queryKeys.inventory(connection.environmentId),
    // There is nothing to rescan: the server lists worktrees from Git when it
    // is asked, so reading the inventory is the refresh.
    queryFn: ({ signal }) => read(api, connection, signal),
  });
}

export function useInventory() {
  const { api, connection } = useConnectedContext();
  return useSuspenseQuery(inventoryQueryOptions(api, connection)).data;
}

export function useRegisterProject() {
  const { api, connection } = useConnectedContext();
  const client = useQueryClient();
  const queryKey = queryKeys.inventory(connection.environmentId);
  return asMutation(
    useMutation<Project, Error, string, InventoryWriteContext>({
      onMutate: () => ({ version: beginInventoryWrite(connection) }),
      mutationFn: async (path: string) => {
        // A focus refresh may still be reading the old inventory. Cancel it
        // before the write so its response cannot replace the new project.
        await client.cancelQueries({ queryKey });
        const request = connection.request();
        const project = await api.inventory.register({ ...request, path });
        request.signal.throwIfAborted();
        return project;
      },
      onSuccess: async (project, _path, context) => {
        if (!context || !canApplyInventoryWrite(connection, context.version))
          return;
        // A focus refresh can begin while registration is in flight. Cancel
        // once more at the commit point before applying the new snapshot.
        await client.cancelQueries({ queryKey });
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

/** Name a project. The list is the only thing that changes. */
export function useRenameProject() {
  const { api, connection } = useConnectedContext();
  const client = useQueryClient();
  const queryKey = queryKeys.inventory(connection.environmentId);
  return asMutation(
    useMutation<
      { id: string; name: string },
      Error,
      { projectId: string; name: string }
    >({
      mutationFn: async ({ projectId, name }) => {
        const request = connection.request();
        const result = await api.inventory.rename({
          ...request,
          projectId,
          name,
        });
        request.signal.throwIfAborted();
        return result;
      },
      onSuccess: async (result) => {
        if (connection.controller.signal.aborted) return;
        await client.cancelQueries({ queryKey });
        client.setQueryData<Inventory>(
          queryKey,
          (inventory) =>
            inventory && {
              ...inventory,
              projects: inventory.projects.map((project) =>
                project.id === result.id
                  ? { ...project, name: result.name }
                  : project,
              ),
            },
        );
      },
    }),
  );
}

export function useRemoveProject() {
  const { api, connection } = useConnectedContext();
  const client = useQueryClient();
  const queryKey = queryKeys.inventory(connection.environmentId);
  return asMutation(
    useMutation<{ deleted: boolean }, Error, string, InventoryWriteContext>({
      onMutate: () => ({ version: beginInventoryWrite(connection) }),
      mutationFn: async (projectId) => {
        const prefix = `[${JSON.stringify(projectId)},`;
        for (const [key, draft] of retainedFileDrafts(connection)) {
          if (key.startsWith(prefix) && !(await draft.save()))
            throw new ConnectionError(
              'Save or discard unsaved file drafts before removing this project.',
            );
        }
        await client.cancelQueries({ queryKey });
        const request = connection.request();
        const result = await api.inventory.remove({ ...request, projectId });
        request.signal.throwIfAborted();
        return result;
      },
      onSuccess: async (_result, projectId, context) => {
        if (connection.controller.signal.aborted) return;
        if (context) canApplyInventoryWrite(connection, context.version);
        await client.cancelQueries({ queryKey });
        client.setQueryData<Inventory>(
          queryKey,
          (inventory) =>
            inventory && {
              ...inventory,
              projects: inventory.projects.filter(
                (project) => project.id !== projectId,
              ),
            },
        );
        const projectKey = queryKeys.reviewProject(
          connection.environmentId,
          projectId,
        );
        await client.cancelQueries({ queryKey: projectKey });
        client.removeQueries({ queryKey: projectKey });
      },
    }),
  );
}
