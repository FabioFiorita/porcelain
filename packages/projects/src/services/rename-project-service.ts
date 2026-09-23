import { ProjectNotFoundError } from '../errors/project-not-found-error.ts';
import type { ProjectName } from '../models/project.ts';
import type { RenameProjectInput } from '../models/project-operations.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';

export class RenameProjectService {
  private readonly inventoryStore: InventoryStore;

  constructor(inventoryStore: InventoryStore) {
    this.inventoryStore = inventoryStore;
  }

  execute(input: RenameProjectInput): ProjectName {
    const project = this.inventoryStore
      .read()
      .projects.find((entry) => entry.id === input.projectId);
    if (!project) throw new ProjectNotFoundError();
    this.inventoryStore.save({
      ...project,
      name: input.name,
      namedByOwner: true,
    });
    return { id: project.id, name: input.name };
  }
}
