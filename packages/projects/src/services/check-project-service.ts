import { Effect, Context, Layer } from 'effect';
import { ProjectNotFoundError } from '../errors/project-not-found-error.ts';
import {
  type CheckProjectResult,
  type FindProjectInput,
} from '../models/find-project.ts';
import { InventoryStore } from '../ports/inventory-store.ts';

export class CheckProjectService extends Context.Service<
  CheckProjectService,
  {
    readonly execute: (
      input: FindProjectInput,
    ) => Effect.Effect<CheckProjectResult, ProjectNotFoundError>;
  }
>()('@porcelain/projects/CheckProjectService') {
  static readonly layer = Layer.effect(
    CheckProjectService,
    Effect.gen(function* () {
      const inventoryCapability = yield* InventoryStore;

      return {
        execute: Effect.fn('CheckProjectService.execute')(function* (
          input: FindProjectInput,
        ): Effect.fn.Return<CheckProjectResult, ProjectNotFoundError> {
          const project = yield* inventoryCapability.find({
            projectId: input.projectId,
          });
          if (!project) return yield* Effect.fail(new ProjectNotFoundError());
          return project;
        }),
      };
    }),
  );
}
