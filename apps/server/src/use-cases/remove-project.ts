import type { ProjectRemovalStore } from '../repositories/interfaces/project-removal-store.ts';

export class RemoveProject {
  private readonly store: ProjectRemovalStore;
  constructor(store: ProjectRemovalStore) {
    this.store = store;
  }
  execute(projectId: string) {
    return this.store.remove(projectId);
  }
}
