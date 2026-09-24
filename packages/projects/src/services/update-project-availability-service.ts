import { ProjectNotFoundError } from '../errors/project-not-found-error.ts';
import type { UpdateProjectAvailabilityInput } from '../models/update-project-availability.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';

export class UpdateProjectAvailabilityService {
  private readonly inventory: InventoryStore;

  constructor(inventory: InventoryStore) {
    this.inventory = inventory;
  }

  execute(input: UpdateProjectAvailabilityInput): void {
    const { projectId, available } = input.worktrees;
    const project = this.inventory
      .read()
      .projects.find((entry) => entry.id === projectId);
    if (!project) throw new ProjectNotFoundError();
    if (project.available === available) return;
    this.inventory.save({ ...project, available });
  }
}
