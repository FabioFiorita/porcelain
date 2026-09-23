import { ProjectNotFoundError } from '../errors/project-not-found-error.ts';
import type { RegisteredProject } from '../models/project.ts';
import type { CheckProjectInput } from '../models/project-operations.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';

export class CheckProjectService {
  private readonly inventoryStore: InventoryStore;

  constructor(inventoryStore: InventoryStore) {
    this.inventoryStore = inventoryStore;
  }

  execute(input: CheckProjectInput): RegisteredProject {
    const project = this.inventoryStore
      .read()
      .projects.find((entry) => entry.id === input.projectId);
    if (!project) throw new ProjectNotFoundError();
    return project;
  }
}
