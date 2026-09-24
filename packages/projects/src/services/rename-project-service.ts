import { ProjectNotFoundError } from '../errors/project-not-found-error.ts';
import type {
  RenameProjectInput,
  RenameProjectResult,
} from '../models/rename-project.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';

export class RenameProjectService {
  private readonly inventory: InventoryStore;

  constructor(inventory: InventoryStore) {
    this.inventory = inventory;
  }

  execute(input: RenameProjectInput): RenameProjectResult {
    const project = this.inventory.find({ projectId: input.projectId });
    if (!project) throw new ProjectNotFoundError();
    this.inventory.save({ ...project, name: input.name, namedByOwner: true });
    return { id: project.id, name: input.name };
  }
}
