import type {
  RemoveProjectInput,
  RemoveProjectResult,
} from '../models/remove-project.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';

export class RemoveProjectService {
  private readonly inventory: InventoryStore;

  constructor(inventory: InventoryStore) {
    this.inventory = inventory;
  }

  execute(input: RemoveProjectInput): RemoveProjectResult {
    const { projectId } = input;
    if (!this.inventory.find({ projectId })) return { deleted: false };
    this.inventory.remove({ projectId });
    return { deleted: true };
  }
}
