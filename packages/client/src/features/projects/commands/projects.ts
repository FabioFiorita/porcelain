import { requestEffect } from '../../../shared/api/effect-client.ts';
import { Effect } from 'effect';
import { nativeOperation } from '@porcelain/effects';
import type { QueryClient } from '@tanstack/query-core';
import type {
  ReadInventoryResponse,
  SetFilePreferenceRequest,
} from '@porcelain/contracts/projects';
import type { WorktreeConnection } from '../../../shared/api/connection.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { createScopedWriteQueues } from '../../../shared/api/write-queue.ts';
import { projectsApi } from '../api.ts';
import { inventoryQueryOptions } from '../queries/inventory.ts';
import { filePreferencesQueryOptions } from '../queries/file-preferences.ts';
import { FileDrafts, fileDraftRuntime } from '../../files/store.ts';
import { ConnectionError } from '../../../shared/api/connection-error.ts';

const writeQueue = createScopedWriteQueues();

export function projectCommands(
  connection: WorktreeConnection,
  client: QueryClient,
) {
  const api = projectsApi(connection);
  const key = inventoryQueryOptions(connection).queryKey;
  const queue = writeQueue(connection, key);
  function update(
    change: (inventory: ReadInventoryResponse) => ReadInventoryResponse,
    signal: AbortSignal,
  ) {
    return Effect.gen(function* () {
      yield* nativeOperation(() => client.cancelQueries({ queryKey: key }));
      yield* currentAnswerEffect(signal);
      client.setQueryData<ReadInventoryResponse>(
        key,
        (inventory) => inventory && change(inventory),
      );
    });
  }
  return {
    register: (path: string) =>
      queue.enqueue(
        Effect.gen(function* () {
          const request = connection.request();
          yield* currentAnswerEffect(request.signal);
          yield* nativeOperation(() => client.cancelQueries({ queryKey: key }));
          const project = yield* requestEffect(
            api.registerProject({ payload: { path } }),
            request.signal,
          );
          yield* currentAnswerEffect(request.signal);
          yield* update((inventory) => {
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
      ),
    rename: (input: { projectId: string; name: string }) =>
      queue.enqueue(
        Effect.gen(function* () {
          const request = connection.request();
          const project = yield* requestEffect(
            api.renameProject({
              params: { projectId: input.projectId },
              payload: { name: input.name },
            }),
            request.signal,
          );
          yield* currentAnswerEffect(request.signal);
          yield* update(
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
      ),
    remove: (projectId: string) =>
      queue.enqueue(
        Effect.gen(function* () {
          const request = connection.request();
          yield* currentAnswerEffect(request.signal);
          const prefix = `[${JSON.stringify(projectId)},`;
          for (const [key, draft] of fileDraftRuntime
            .runSync(FileDrafts)
            .entries(connection))
            if (key.startsWith(prefix) && !(yield* draft.save()))
              return yield* Effect.fail(
                new ConnectionError({
                  message:
                    'Save or discard unsaved file drafts before removing this project.',
                }),
              );
          yield* nativeOperation(() => client.cancelQueries({ queryKey: key }));
          const result = yield* requestEffect(
            api.removeProject({ params: { projectId } }),
            request.signal,
          );
          yield* currentAnswerEffect(request.signal);
          yield* update(
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
          yield* nativeOperation(() =>
            client.cancelQueries({ queryKey: projectKey }),
          );
          yield* currentAnswerEffect(request.signal);
          client.removeQueries({ queryKey: projectKey });
          return result;
        }),
      ),
  };
}

export function setFilePreference(
  connection: WorktreeConnection,
  client: QueryClient,
  projectId: string,
  input: SetFilePreferenceRequest,
) {
  const key = filePreferencesQueryOptions(connection, projectId).queryKey;
  return writeQueue(connection, key).enqueue(
    Effect.gen(function* () {
      const request = connection.request();
      const result = yield* requestEffect(
        projectsApi(connection).setFilePreference({
          params: { projectId },
          payload: input,
        }),
        request.signal,
      );
      yield* currentAnswerEffect(request.signal);
      yield* nativeOperation(() =>
        client.cancelQueries({ queryKey: key, exact: true }),
      );
      yield* currentAnswerEffect(request.signal);
      client.setQueryData(key, result);
      return result;
    }),
  );
}
