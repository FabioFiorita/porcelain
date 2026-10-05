import { Effect } from 'effect';
import { ProjectNotFoundError } from '../errors/project-not-found-error.ts';
import type { UpdateProjectAvailabilityInput } from '../models/update-project-availability.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';

export class UpdateProjectAvailabilityService {
  private readonly inventory: InventoryStore;

  constructor(inventory: InventoryStore) {
    this.inventory = inventory;
  }

  execute(
    input: UpdateProjectAvailabilityInput,
  ): Effect.Effect<void, ProjectNotFoundError> {
    return Effect.gen({ self: this }, function* () {
      const { projectId, available } = input.worktrees;
      const project = this.inventory.find({ projectId });
      if (!project) return yield* Effect.fail(new ProjectNotFoundError());
      if (project.available === available) return;
      this.inventory.save({ ...project, available });
    });
  }
}
