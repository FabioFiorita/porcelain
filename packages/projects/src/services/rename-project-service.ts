import { Effect, Context, Layer } from 'effect';
import { ProjectNotFoundError } from '../errors/project-not-found-error.ts';
import {
  type RenameProjectInput,
  type RenameProjectResult,
} from '../models/rename-project.ts';
import { InventoryStore } from '../ports/inventory-store.ts';

export class RenameProjectService extends Context.Service<
  RenameProjectService,
  {
    readonly execute: (
      input: RenameProjectInput,
    ) => Effect.Effect<RenameProjectResult, ProjectNotFoundError>;
  }
>()('@porcelain/projects/RenameProjectService') {
  static readonly layer = Layer.effect(
    RenameProjectService,
    Effect.gen(function* () {
      const inventoryCapability = yield* InventoryStore;

      return {
        execute: Effect.fn('RenameProjectService.execute')(function* (
          input: RenameProjectInput,
        ): Effect.fn.Return<RenameProjectResult, ProjectNotFoundError> {
          const project = yield* inventoryCapability.find({
            projectId: input.projectId,
          });
          if (!project) return yield* Effect.fail(new ProjectNotFoundError());
          const renamed = { id: project.id, name: input.name };
          if (project.namedByOwner && project.name === input.name)
            return { project: renamed, changed: false };
          yield* inventoryCapability.save({
            ...project,
            name: input.name,
            namedByOwner: true,
          });
          return { project: renamed, changed: true };
        }),
      };
    }),
  );
}
