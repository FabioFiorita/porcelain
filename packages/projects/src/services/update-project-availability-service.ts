import { Effect, Context, Layer } from 'effect';
import { ProjectNotFoundError } from '../errors/project-not-found-error.ts';
import { type UpdateProjectAvailabilityInput } from '../models/update-project-availability.ts';
import { InventoryStore } from '../ports/inventory-store.ts';

export class UpdateProjectAvailabilityService extends Context.Service<
  UpdateProjectAvailabilityService,
  {
    readonly execute: (
      input: UpdateProjectAvailabilityInput,
    ) => Effect.Effect<void, ProjectNotFoundError>;
  }
>()('@porcelain/projects/UpdateProjectAvailabilityService') {
  static readonly layer = Layer.effect(
    UpdateProjectAvailabilityService,
    Effect.gen(function* () {
      const inventoryCapability = yield* InventoryStore;

      return {
        execute: Effect.fn('UpdateProjectAvailabilityService.execute')(
          function* (
            input: UpdateProjectAvailabilityInput,
          ): Effect.fn.Return<void, ProjectNotFoundError> {
            const { projectId, available } = input.worktrees;
            const project = inventoryCapability.find({ projectId });
            if (!project) return yield* Effect.fail(new ProjectNotFoundError());
            if (project.available === available) return;
            inventoryCapability.save({ ...project, available });
          },
        ),
      };
    }),
  );
}
