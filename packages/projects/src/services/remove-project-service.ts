import type { ProjectRemovalStore } from '../ports/project-removal-store.ts';

export class RemoveProjectService {
  private readonly store: ProjectRemovalStore;
  constructor(store: ProjectRemovalStore) {
    this.store = store;
  }
  execute(projectId: string): { deleted: boolean } {
    return this.store.remove(projectId);
  }
}
