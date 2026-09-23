import { ProjectNotFoundError } from '../errors/project-not-found-error.ts';
import type { ProjectName } from '../models/project.ts';
import type { ProjectStore } from '../ports/project-store.ts';

export class RenameProjectService {
  private readonly store: ProjectStore;

  constructor(store: ProjectStore) {
    this.store = store;
  }

  execute(projectId: string, name: string): ProjectName {
    const project = this.store
      .read()
      .projects.find((entry) => entry.id === projectId);
    if (!project) throw new ProjectNotFoundError();
    this.store.save({ ...project, name, namedByOwner: true });
    return { id: project.id, name };
  }
}
