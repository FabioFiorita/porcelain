import type { UpdateProjectAvailabilityInput } from '../models/inventory-operations.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';

export class UpdateProjectAvailabilityService {
  private readonly inventoryStore: InventoryStore;

  constructor(inventoryStore: InventoryStore) {
    this.inventoryStore = inventoryStore;
  }

  execute(input: UpdateProjectAvailabilityInput): void {
    const { projectId, available } = input.worktrees;
    const project = this.inventoryStore
      .read()
      .projects.find((entry) => entry.id === projectId);
    if (!project || project.available === available) return;
    this.inventoryStore.save({ ...project, available });
  }
}
