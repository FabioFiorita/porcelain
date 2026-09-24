import { ProjectNotFoundError } from '../errors/project-not-found-error.ts';
import type {
  CheckProjectInput,
  CheckProjectResult,
} from '../models/check-project.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';

export class CheckProjectService {
  private readonly inventory: InventoryStore;

  constructor(inventory: InventoryStore) {
    this.inventory = inventory;
  }

  execute(input: CheckProjectInput): CheckProjectResult {
    const project = this.inventory
      .read()
      .projects.find((entry) => entry.id === input.projectId);
    if (!project) throw new ProjectNotFoundError();
    return project;
  }
}
