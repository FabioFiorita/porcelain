import { Effect, Context, Layer } from 'effect';
import { IdSource } from '@porcelain/kernel/ports';
import {
  type RegisterProjectInput,
  type RegisterProjectResult,
} from '../models/register-project.ts';
import { type RegisteredProject } from '../models/project.ts';
import { InventoryStore } from '../ports/inventory-store.ts';
import { deriveProjectName } from '../rules/derive-project-name.ts';
import { nextPosition } from '../rules/next-position.ts';
import { parentFolder } from '../rules/parent-folder.ts';
import { sameProject } from '../rules/same-project.ts';

export class RegisterProjectService extends Context.Service<
  RegisterProjectService,
  {
    readonly execute: (
      input: RegisterProjectInput,
    ) => Effect.Effect<RegisterProjectResult, never>;
  }
>()('@porcelain/projects/RegisterProjectService') {
  static readonly layer = Layer.effect(
    RegisterProjectService,
    Effect.gen(function* () {
      const inventoryCapability = yield* InventoryStore;
      const idSourceCapability = yield* IdSource;

      return {
        execute: Effect.fn('RegisterProjectService.execute')(function* (
          input: RegisterProjectInput,
        ): Effect.fn.Return<RegisterProjectResult, never> {
          const { repository } = input;
          const { projects } = yield* inventoryCapability.read();
          const previous = projects.find(
            (project) =>
              project.repositoryIdentity === repository.repositoryIdentity,
          );
          const project: RegisteredProject = {
            id: previous?.id ?? idSourceCapability.next(),
            name: previous?.namedByOwner
              ? previous.name
              : deriveProjectName(
                  input.originUrl,
                  repository.worktrees.find((worktree) => worktree.main)
                    ?.path ?? parentFolder(repository.commonDirectory),
                ),
            namedByOwner: previous?.namedByOwner ?? false,
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
