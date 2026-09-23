import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { ProjectNotFoundError } from './errors/project-not-found-error.ts';

export class RenameProject {
  private readonly store: InventoryStore;

  constructor(store: InventoryStore) {
    this.store = store;
  }

  execute(projectId: string, name: string) {
    const project = this.store
      .read()
      .projects.find((entry) => entry.id === projectId);
    if (!project) throw new ProjectNotFoundError();
    this.store.save({ ...project, name, namedByOwner: true });
    return { id: project.id, name };
  }
}
