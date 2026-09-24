import type {
  RemoveProjectInput,
  RemoveProjectResult,
} from '../models/remove-project.ts';
import type { ProjectRemovalStore } from '../ports/project-removal-store.ts';

export class RemoveProjectService {
  private readonly projectRemoval: ProjectRemovalStore;

  constructor(projectRemoval: ProjectRemovalStore) {
    this.projectRemoval = projectRemoval;
  }

  execute(input: RemoveProjectInput): RemoveProjectResult {
    return this.projectRemoval.remove({ projectId: input.projectId });
  }
}
