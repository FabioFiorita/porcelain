import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { ProjectNotFoundError } from './errors/project-not-found-error.ts';

/**
 * The owner names a project.
 *
 * A name is a label, not identity: two projects may share one, and nothing
 * else in the system looks a project up by it. Once set, the name is theirs —
 * registering the repository again will not derive over it.
 */
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
