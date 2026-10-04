import type { QueryClient } from '@tanstack/query-core';
import type {
  ReadInventoryResponse,
  SetFilePreferenceRequest,
} from '@porcelain/contracts/projects';
import type { WorktreeConnection } from '../../../shared/api/connection.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { createScopedWriteQueues } from '../../../shared/api/write-queue.ts';
import { projectsApi } from '../api.ts';
import { inventoryQueryOptions } from '../queries/inventory.ts';
import { filePreferencesQueryOptions } from '../queries/file-preferences.ts';

const writeQueue = createScopedWriteQueues();

export function projectCommands(
  connection: WorktreeConnection,
  client: QueryClient,
) {
  const api = projectsApi(connection);
  const key = inventoryQueryOptions(connection).queryKey;
  const queue = writeQueue(connection, key);
  async function update(
    change: (inventory: ReadInventoryResponse) => ReadInventoryResponse,
    signal: AbortSignal,
  ) {
    await client.cancelQueries({ queryKey: key });
    assertCurrentAnswer(signal);
    client.setQueryData<ReadInventoryResponse>(
      key,
      (inventory) => inventory && change(inventory),
    );
  }
  return {
    register: (path: string) =>
      queue.enqueue(async () => {
        await client.cancelQueries({ queryKey: key });
        const request = connection.request();
        const project = await api.inventory.register({ ...request, path });
        assertCurrentAnswer(request.signal);
        await update((inventory) => {
          const exists = inventory.projects.some(
            (entry) => entry.id === project.id,
          );
          const projects = exists
            ? inventory.projects.map((entry) =>
                entry.id === project.id ? project : entry,
              )
            : [...inventory.projects, project];
          return { ...inventory, projects };
        }, request.signal);
        return project;
      }),
    rename: (input: { projectId: string; name: string }) =>
      queue.enqueue(async () => {
        const request = connection.request();
        const project = await api.inventory.rename({ ...request, ...input });
        assertCurrentAnswer(request.signal);
        await update(
          (inventory) => ({
            ...inventory,
            projects: inventory.projects.map((entry) =>
              entry.id === project.id
                ? { ...entry, name: project.name }
                : entry,
            ),
          }),
          request.signal,
        );
        return project;
      }),
    remove: (projectId: string) =>
      queue.enqueue(async () => {
        await client.cancelQueries({ queryKey: key });
        const request = connection.request();
        const result = await api.inventory.remove({ ...request, projectId });
        assertCurrentAnswer(request.signal);
        await update(
          (inventory) => ({
            ...inventory,
            projects: inventory.projects.filter(
              (project) => project.id !== projectId,
            ),
          }),
          request.signal,
        );
        const projectKey = queryKeys.reviewProject(
          connection.environmentId,
          projectId,
        );
        await client.cancelQueries({ queryKey: projectKey });
        assertCurrentAnswer(request.signal);
        client.removeQueries({ queryKey: projectKey });
        return result;
      }),
  };
}

export function setFilePreference(
  connection: WorktreeConnection,
  client: QueryClient,
  projectId: string,
  input: SetFilePreferenceRequest,
) {
  const key = filePreferencesQueryOptions(connection, projectId).queryKey;
  return writeQueue(connection, key).enqueue(async () => {
    const request = connection.request();
    const result = await projectsApi(connection).filePreferences.set({
      ...request,
      projectId,
      input,
    });
    assertCurrentAnswer(request.signal);
    await client.cancelQueries({ queryKey: key, exact: true });
    assertCurrentAnswer(request.signal);
    client.setQueryData(key, result);
    return result;
  });
}
