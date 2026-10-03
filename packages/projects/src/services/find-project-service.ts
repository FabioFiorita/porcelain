import type {
  FindProjectInput,
  FindProjectResult,
} from '../models/find-project.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';

export class FindProjectService {
  private readonly inventory: InventoryStore;

  constructor(inventory: InventoryStore) {
    this.inventory = inventory;
  }

  execute(input: FindProjectInput): FindProjectResult {
    const project = this.inventory.find({ projectId: input.projectId });
    return project ? { kind: 'found', project } : { kind: 'missing' };
  }
}
