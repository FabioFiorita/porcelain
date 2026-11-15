import { Effect, Context, Layer } from 'effect';
import { ProjectNotFoundError } from '../errors/project-not-found-error.ts';
import { ProjectReconnectionRefusedError } from '../errors/project-reconnection-refused-error.ts';
import { IdSource } from '@porcelain/kernel/ports';
import {
  type RegisterProjectInput,
  type RegisterProjectResult,
} from '../models/register-project.ts';
import { type RegisteredProject } from '../models/project.ts';
import { InventoryStore } from '../ports/inventory-store.ts';
import { WorktreePresenceStore } from '../ports/worktree-presence-store.ts';
import { deriveProjectName } from '../rules/derive-project-name.ts';
import { nextPosition } from '../rules/next-position.ts';
import { parentFolder } from '../rules/parent-folder.ts';
import { sameProject } from '../rules/same-project.ts';

export class RegisterProjectService extends Context.Service<
  RegisterProjectService,
  {
    readonly execute: (
      input: RegisterProjectInput,
    ) => Effect.Effect<
      RegisterProjectResult,
      ProjectNotFoundError | ProjectReconnectionRefusedError
    >;
  }
>()('@porcelain/projects/RegisterProjectService') {
  static readonly layer = Layer.effect(
    RegisterProjectService,
    Effect.gen(function* () {
      const inventoryCapability = yield* InventoryStore;
      const presenceCapability = yield* WorktreePresenceStore;
      const idSourceCapability = yield* IdSource;

      return {
        execute: Effect.fn('RegisterProjectService.execute')(function* (
          input: RegisterProjectInput,
        ): Effect.fn.Return<
          RegisterProjectResult,
          ProjectNotFoundError | ProjectReconnectionRefusedError
        > {
          const { repository } = input;
          const { projects } = yield* inventoryCapability.read();
          const sameIdentity = projects.find(
            (project) =>
              project.repositoryIdentity === repository.repositoryIdentity,
          );
          const reconnecting = input.reconnectProjectId !== undefined;
          const selected = reconnecting
            ? projects.find(
                (project) => project.id === input.reconnectProjectId,
              )
            : undefined;
          if (reconnecting && !selected)
            return yield* new ProjectNotFoundError();
          if (
            selected?.available &&
            selected.repositoryIdentity !== repository.repositoryIdentity
          )
            return yield* new ProjectReconnectionRefusedError({
              message:
                'This project is available. Refresh the project list before reconnecting it.',
            });
          if (selected && sameIdentity && selected.id !== sameIdentity.id)
            return yield* new ProjectReconnectionRefusedError({
              message:
                'This repository already belongs to another registered project. Choose a different folder.',
            });
          const atPath = projects.find(
            (project) => project.commonDirectory === repository.commonDirectory,
          );
          if (selected && atPath && selected.id !== atPath.id)
            return yield* new ProjectReconnectionRefusedError({
              message:
                'This folder already belongs to another registered project. Choose a different folder.',
            });
          if (!reconnecting && atPath && !sameIdentity)
            return { project: atPath, changed: false };
          const previous = selected ?? sameIdentity;
          if (
            selected &&
            selected.repositoryIdentity !== repository.repositoryIdentity
          )
            yield* presenceCapability.save({
              rows: (yield* presenceCapability.read({
                projectId: selected.id,
              })).map((row) => ({ ...row, preserved: true })),
            });
          const project: RegisteredProject = {
            id: previous?.id ?? idSourceCapability.next(),
            name: selected
              ? selected.name
              : previous?.namedByOwner
                ? previous.name
                : deriveProjectName(
                    input.originUrl,
                    repository.worktrees.find((worktree) => worktree.main)
                      ?.path ?? parentFolder(repository.commonDirectory),
                  ),
            namedByOwner: selected ? true : (previous?.namedByOwner ?? false),
            commonDirectory: repository.commonDirectory,
            repositoryIdentity: repository.repositoryIdentity,
            available: true,
            position: previous?.position ?? nextPosition(projects),
          };
          const changed =
            previous === undefined || !sameProject(previous, project);
          if (changed) yield* inventoryCapability.save(project);
          return { project, changed };
        }),
      };
    }),
  );
}
