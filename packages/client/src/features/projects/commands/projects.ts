import { Context, Effect, Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import { FileDrafts, fileDraftRuntime } from '../../files/store.ts';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import { InventoryState, inventoryRuntime } from '../store/inventory.ts';

function makeProjectCommands(connection: RuntimeConnection) {
  return Effect.gen(function* () {
    const api = yield* porcelainClient(connection);
    const inventory = yield* InventoryState;
    return {
      register: (path: string) =>
        inventory.confirm(
          requestEffect(api.projects.registerProject({ payload: { path } })),
          (inventory, project) => ({
            ...inventory,
            projects: inventory.projects.some(
              (entry) => entry.id === project.id,
            )
              ? inventory.projects.map((entry) =>
                  entry.id === project.id ? project : entry,
                )
              : [...inventory.projects, project],
          }),
        ),
      rename: (input: { projectId: string; name: string }) =>
        inventory.confirm(
          requestEffect(
            api.projects.renameProject({
              params: { projectId: input.projectId },
              payload: { name: input.name },
            }),
          ),
          (inventory, project) => ({
            ...inventory,
            projects: inventory.projects.map((entry) =>
              entry.id === project.id
                ? { ...entry, name: project.name }
                : entry,
            ),
          }),
        ),
      remove: (projectId: string) =>
        inventory.confirm(
          Effect.gen(function* () {
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
            return yield* requestEffect(
              api.projects.removeProject({ params: { projectId } }),
            );
          }),
          (inventory) => ({
            ...inventory,
            projects: inventory.projects.filter(
              (project) => project.id !== projectId,
            ),
          }),
        ),
    };
  });
}
class ProjectCommands extends Context.Service<
  ProjectCommands,
  Effect.Success<ReturnType<typeof makeProjectCommands>>
>()('@porcelain/client/ProjectCommands') {}
const projectCommandRuntime = Atom.family((connection: RuntimeConnection) =>
  connection.atoms((get) =>
    Layer.provideMerge(
      Layer.effect(ProjectCommands, makeProjectCommands(connection)),
      get(inventoryRuntime(connection).layer),
    ),
  ),
);
export const registerProject = Atom.family((connection: RuntimeConnection) =>
  projectCommandRuntime(connection).fn(
    (path: string) =>
      ProjectCommands.use((commands) => commands.register(path)),
    { concurrent: true },
  ),
);
export const renameProject = Atom.family((connection: RuntimeConnection) =>
  projectCommandRuntime(connection).fn(
    (input: { projectId: string; name: string }) =>
      ProjectCommands.use((commands) => commands.rename(input)),
    { concurrent: true },
  ),
);
export const removeProject = Atom.family((connection: RuntimeConnection) =>
  projectCommandRuntime(connection).fn(
    (projectId: string) =>
      ProjectCommands.use((commands) => commands.remove(projectId)),
    { concurrent: true },
  ),
);
