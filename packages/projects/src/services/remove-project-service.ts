import type {
  RemoveProjectInput,
  RemoveProjectResult,
} from '../models/project-operations.ts';
import type { ProjectRemovalStore } from '../ports/project-removal-store.ts';

export class RemoveProjectService {
  private readonly projectRemovalStore: ProjectRemovalStore;

  constructor(projectRemovalStore: ProjectRemovalStore) {
    this.projectRemovalStore = projectRemovalStore;
  }

  execute(input: RemoveProjectInput): RemoveProjectResult {
    return this.projectRemovalStore.remove(input.projectId);
  }
}
