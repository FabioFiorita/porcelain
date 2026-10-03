import { ProjectNotFoundError } from '../errors/project-not-found-error.ts';
import type {
  CheckProjectResult,
  FindProjectInput,
} from '../models/find-project.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';

export class CheckProjectService {
  private readonly inventory: InventoryStore;

  constructor(inventory: InventoryStore) {
    this.inventory = inventory;
  }

  execute(input: FindProjectInput): CheckProjectResult {
    const project = this.inventory.find({ projectId: input.projectId });
    if (!project) throw new ProjectNotFoundError();
    return project;
  }
}
